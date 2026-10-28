import { Injectable, Inject, Optional, BadRequestException } from '@nestjs/common';
import type {
  WorkflowDefinition,
  GenerateWorkflowDto,
  GenerateWorkflowResponse,
} from '@flowmind/contracts';
import { WORKFLOW_SCHEMA_VERSION, getNodeConfigIssues } from '@flowmind/contracts';
import { DagValidator } from '../engine/dag-validator';
import { validateEmailConfiguration, validateNodeConfigurations } from '../engine/workflow-validation';
import {
  validateWorkflowReferences,
  validateWorkflowAvailability,
  validateNoConvergence,
  validateWorkflowResources,
} from '../engine/workflow-reference.validation';
import type { AiClient } from './ai-client.interface';
import { AI_CLIENT } from './ai-client.interface';
import { DeterministicAiClient } from './deterministic-ai-client';
import { ResourceResolver } from '../engine/resource-resolver';

const pendingFieldLabels: Record<string, string> = {
  url: 'o destino HTTP', inputPromptTemplate: 'o texto para análise', fieldMappings: 'o nome ou e-mail do registro',
  to: 'o destinatário', subject: 'o assunto', bodyTemplate: 'o corpo da mensagem',
};

@Injectable()
export class AiGeneratorService {
  private readonly aiClient: AiClient;
  private readonly resources: ResourceResolver;

  /**
   * Padrões de comandos e termos proibidos para evitar execução de código arbitrário e escape de escopo
   */
  private readonly forbiddenPatterns: RegExp[] = [
    /\b(eval|exec|spawn|fork|system|sh|bash|powershell|cmd|rm\s+-rf|drop\s+table)\b/i,
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
    /\bprocess\.env\b/i,
  ];

  constructor(@Inject(ResourceResolver) resources: ResourceResolver, @Optional() @Inject(AI_CLIENT) aiClient?: AiClient) {
    if (!resources || typeof resources.resolveAiModel !== 'function') throw new Error('Resolvedor de recursos obrigatório.');
    this.resources = resources;
    this.aiClient = aiClient ?? new DeterministicAiClient();
  }

  /**
   * Gera uma proposta estruturada de workflow a partir de um prompt em linguagem natural.
   * A proposta NÃO é ativada ou executada automaticamente; retorna sempre para revisão humana ('requiresHumanReview: true').
   */
  async generateFromNaturalLanguage(
    dto: GenerateWorkflowDto,
    orgId: string,
  ): Promise<GenerateWorkflowResponse> {
    const rawPrompt = typeof dto.prompt === 'string' ? dto.prompt.trim() : '';

    if (!rawPrompt || rawPrompt.length < 5) {
      throw new BadRequestException({
        code: 'INVALID_PROMPT',
        message: 'O prompt fornecido é muito curto ou vazio. Descreva a automação desejada.',
      });
    }

    // Validação de segurança: Proibir código arbitrário e comandos de SO
    for (const pattern of this.forbiddenPatterns) {
      if (pattern.test(rawPrompt)) {
        throw new BadRequestException({
          code: 'SECURITY_SCOPE_VIOLATION',
          message:
            'O prompt contém padrões inseguros ou tentativas de execução de comandos arbitrários, o que é proibido.',
        });
      }
    }

    // Delegação para o adaptador de IA configurado (OpenAI Structured Outputs ou Template Determinístico)
    const generationResult = await this.aiClient.generateWorkflow(rawPrompt, orgId);
    const usage = generationResult.tokensConsumed;
    const tokensConsumed = typeof usage === 'number' && Number.isSafeInteger(usage) && usage >= 0 ? usage : null;

    // Validação estrita do DAG gerado utilizando o motor do FlowMind
    const dummyWorkflow: WorkflowDefinition = {
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      id: 'draft-generation-check',
      orgId,
      name: generationResult.draft.name,
      description: generationResult.draft.description,
      version: 1,
      status: 'DRAFT',
      triggerNodeId: generationResult.draft.triggerNodeId,
      nodes: generationResult.draft.nodes,
      edges: generationResult.draft.edges,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Rascunho pode ter campos ausentes; valores inválidos e referências impossíveis não são propostas válidas.
    try {
      if (generationResult.draft.schemaVersion !== WORKFLOW_SCHEMA_VERSION) {
        throw new BadRequestException('Schema de proposta incompatível');
      }
      const { ancestorsByNode, edgesByTarget } = DagValidator.validateAndSort(dummyWorkflow);
      validateNoConvergence(edgesByTarget);
      validateNodeConfigurations(dummyWorkflow.nodes, true);
      validateWorkflowReferences(dummyWorkflow.nodes, ancestorsByNode);
      validateWorkflowAvailability(dummyWorkflow.nodes);
      validateWorkflowResources(dummyWorkflow, this.resources, { requireComplete: false });
      // Destinatário ausente é pendência do draft. Quando presente, C03 continua obrigatório.
      validateEmailConfiguration({ ...dummyWorkflow, nodes: dummyWorkflow.nodes.filter((node) =>
        node.type !== 'send_email' || (typeof node.config.to === 'string' && node.config.to.trim())) }, ancestorsByNode);
    } catch (error: unknown) {
      if (!(error instanceof BadRequestException)) throw error;
      // Preserva somente o código da regra violada; mensagens e issues não são repassadas.
      const cause = error.getResponse();
      const reason = typeof cause === 'object' && cause !== null && typeof (cause as { code?: unknown }).code === 'string'
        ? (cause as { code: string }).code : undefined;
      throw new BadRequestException({
        code: 'AI_INVALID_WORKFLOW_RESPONSE',
        message: 'A proposta devolvida contém configuração, referência ou grafo inválido e não pode ser aplicada.',
        ...(reason ? { reason } : {}),
        tokensConsumed,
      });
    }

    const pendingFields = dummyWorkflow.nodes.flatMap((node, index) => getNodeConfigIssues(node.type, node.config)
      .filter((issue) => issue.code === 'MISSING_REQUIRED_FIELD')
      .map((issue) => `Nó ${index + 1}: defina ${pendingFieldLabels[issue.field] ?? 'o campo obrigatório'} antes de revisar ou simular.`));

    const pendingModels = dummyWorkflow.nodes.some((node) => node.type === 'ai_analyze_intent' &&
      this.resources.isModelSelectionPending(orgId, node.config.modelRef))
      ? ['Selecione um modelo aprovado e autorizado antes da revisão formal.'] : [];

    return {
      workflow: generationResult.draft,
      reasoning: generationResult.reasoning,
      warnings: [...new Set([...generationResult.warnings, ...pendingFields, ...pendingModels])],
      modelUsed: generationResult.modelUsed,
      tokensConsumed,
      requiresHumanReview: true,
    };
  }
}

import { Injectable, BadRequestException } from '@nestjs/common';
import type {
  WorkflowDefinition,
  GenerateWorkflowDto,
  GenerateWorkflowResponse,
} from '@flowmind/contracts';
import { WORKFLOW_SCHEMA_VERSION } from '@flowmind/contracts';
import { DagValidator } from '../engine/dag-validator';
import type { AiClient } from './ai-client.interface';
import { DeterministicAiClient } from './deterministic-ai-client';

@Injectable()
export class AiGeneratorService {
  private readonly aiClient: AiClient;

  /**
   * Padrões de comandos e termos proibidos para evitar execução de código arbitrário e escape de escopo
   */
  private readonly forbiddenPatterns: RegExp[] = [
    /\b(eval|exec|spawn|fork|system|sh|bash|powershell|cmd|rm\s+-rf|drop\s+table)\b/i,
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
    /\bprocess\.env\b/i,
  ];

  constructor(aiClient?: AiClient) {
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

    // Valida topologia, ausência de ciclos e consistência de nós e arestas
    DagValidator.validateAndSort(dummyWorkflow);

    return {
      workflow: generationResult.draft,
      reasoning: generationResult.reasoning,
      warnings: generationResult.warnings,
      modelUsed: generationResult.modelUsed,
      tokensConsumed: generationResult.tokensConsumed,
      requiresHumanReview: true,
    };
  }
}

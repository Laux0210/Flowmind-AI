import { BadRequestException } from '@nestjs/common';
import { getOutputFieldKind } from '@flowmind/contracts';
import type { WorkflowDefinition, WorkflowNode, OutputFieldKind, WorkflowEdge } from '@flowmind/contracts';
import { VariableResolver } from './variable-resolver';
import { ResourceResolver } from './resource-resolver';

interface ReferenceProblem {
  nodeIndex: number;
  field: string;
  code: 'PRODUCER_NOT_FOUND' | 'INVALID_PRECEDENCE' | 'OUTPUT_NOT_DECLARED' | 'INCOMPATIBLE_OUTPUT_TYPE' | 'OUTPUT_NOT_AVAILABLE' | 'OUTPUT_MODE_INCOMPATIBLE';
}

function configField(path: string[]): string {
  return path[0] === 'fieldMappings' ? 'fieldMappings.' + path[1] : path[0];
}

function compatible(node: WorkflowNode, path: string[], kind: OutputFieldKind): boolean {
  if (node.type === 'condition' || kind === 'json' || kind === 'string_or_array') return true;
  const field = configField(path);
  const ambiguities = node.type === 'internal_record' &&
    ((field === 'ambiguities' && path.length === 1) || (field === 'fieldMappings.ambiguities' && path.length === 2));
  return kind === 'string' || (ambiguities && kind === 'string_array');
}

/** Precedência e campos/tipos conhecidos; não prova disponibilidade entre ramos ou autorização de recursos. */
export function validateWorkflowReferences(nodes: WorkflowNode[], ancestorsByNode: Map<string, Set<string>>): void {
  const producers = new Map(nodes.map((node) => [node.id, node]));
  const problems: ReferenceProblem[] = [];
  nodes.forEach((node, nodeIndex) => {
    const pending: Array<{ value: unknown; path: string[] }> = [{ value: node.config, path: [] }];
    while (pending.length) {
      const { value, path } = pending.pop()!;
      if (typeof value === 'string') {
        for (const reference of VariableResolver.extractReferences(value)) {
          const producer = producers.get(reference.nodeId);
          let code: ReferenceProblem['code'] | null = null;
          if (!producer) code = 'PRODUCER_NOT_FOUND';
          else if (!ancestorsByNode.get(node.id)?.has(producer.id)) code = 'INVALID_PRECEDENCE';
          else {
            const kind = getOutputFieldKind(producer.type, reference.fieldPath);
            if (kind === null) code = 'OUTPUT_NOT_DECLARED';
            else if (VariableResolver.isExactReference(value) && !compatible(node, path, kind)) code = 'INCOMPATIBLE_OUTPUT_TYPE';
          }
          if (code) problems.push({ nodeIndex, field: configField(path), code });
        }
      } else if (value !== null && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) pending.push({ value: child, path: [...path, key] });
      }
    }
  });
  if (problems.length) {
    throw new BadRequestException({ code: 'WORKFLOW_INVALID_REFERENCE',
      message: 'Violação de precedência no DAG ou saída inválida na referência; revise os campos indicados.', issues: problems });
  }
}

/**
 * Validação de disponibilidade de saídas (T03-S2b Opção A):
 * Nega referências a campos opcionais sem prova de mapeamento no produtor e campos exclusivos de modos não executados.
 */
const INTERNAL_RECORD_OPTIONAL_OUTPUTS = ['ai_summary', 'ai_intent', 'ambiguities', 'name', 'email', 'raw_message'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Valor vazio não produz a saída opcional correspondente.
function hasValue(value: unknown, allowArray = false): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (allowArray && Array.isArray(value)) return value.length > 0;
  return false;
}

export function validateWorkflowAvailability(nodes: WorkflowNode[]): void {
  const producers = new Map(nodes.map((node) => [node.id, node]));
  const problems: ReferenceProblem[] = [];

  nodes.forEach((node, nodeIndex) => {
    const pending: Array<{ value: unknown; path: string[] }> = [{ value: node.config, path: [] }];
    while (pending.length) {
      const { value, path } = pending.pop()!;
      if (typeof value === 'string') {
        for (const reference of VariableResolver.extractReferences(value)) {
          const producer = producers.get(reference.nodeId);
          if (!producer) continue;

          const root = reference.fieldPath.split('.')[0];
          const cfg = (producer.config || {}) as Record<string, unknown>;
          if (producer.type === 'internal_record') {
            if (root === 'persisted_at') {
              problems.push({
                nodeIndex,
                field: configField(path),
                code: 'OUTPUT_MODE_INCOMPATIBLE',
              });
            } else if (INTERNAL_RECORD_OPTIONAL_OUTPUTS.includes(root)) {
              // Espelha executeInternalRecord: fieldMappings (ou config) e, como fallback, a raiz da config.
              const mappings = isRecord(cfg.fieldMappings) ? cfg.fieldMappings : cfg;
              // Um mapeamento vazio oculta o fallback, assim como no executor.
              const value = root === 'raw_message'
                ? mappings.raw_message ?? mappings.message ?? cfg.raw_message
                : mappings[root] ?? cfg[root];
              const allowArray = root === 'ambiguities'; // executor só aceita array em ambiguities
              if (!hasValue(value, allowArray)) {
                problems.push({
                  nodeIndex,
                  field: configField(path),
                  code: 'OUTPUT_NOT_AVAILABLE',
                });
              }
            }
          } else if (producer.type === 'send_email' && root === 'subject' && !hasValue(cfg.subject)) {
            problems.push({ nodeIndex, field: configField(path), code: 'OUTPUT_NOT_AVAILABLE' });
          }
        }
      } else if (value !== null && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          pending.push({ value: child, path: [...path, key] });
        }
      }
    }
  });

  if (problems.length) {
    throw new BadRequestException({
      // Código específico no topo quando todos os problemas têm a mesma causa.
      code: new Set(problems.map((problem) => problem.code)).size === 1 ? problems[0].code : 'WORKFLOW_INVALID_REFERENCE',
      message: 'Referência a saída indisponível ou incompatível com o modo de execução; revise os campos indicados antes de ativar.',
      issues: problems,
    });
  }
}

/**
 * Validação estrutural de não convergência (T03-S2b Opção A - MVP sem convergências):
 * Nega mais de uma aresta de entrada no mesmo nó durante revisão e ativação.
 */
export function validateNoConvergence(edgesByTarget: Map<string, WorkflowEdge[]>): void {
  for (const [nodeId, incomingEdges] of edgesByTarget.entries()) {
    if (incomingEdges.length > 1) {
      throw new BadRequestException({
        code: 'WORKFLOW_CONVERGENCE_NOT_SUPPORTED',
        message: `Convergência de múltiplos ramos no nó '${nodeId}' não é suportada no MVP (cada nó deve possuir no máximo uma conexão de entrada); revise o fluxo antes de ativar.`,
      });
    }
  }
}

/**
 * Validação de recursos e credenciais por organização (T03-S3 Opção A):
 * Valida modelos homologados de IA e lookup determinístico de credenciais/formulários vinculados à organização.
 */
export function validateWorkflowResources(
  workflow: WorkflowDefinition,
  resolver: ResourceResolver,
  options?: { requireComplete?: boolean },
): void {
  const requireComplete = options?.requireComplete ?? true;
  const problems: Array<{
    nodeIndex: number;
    nodeId: string;
    field: string;
    code: string;
    message: string;
  }> = [];

  workflow.nodes.forEach((node, nodeIndex) => {
    const config = (node.config || {}) as Record<string, unknown>;

    if (node.type === 'ai_analyze_intent') {
      const modelRef = config.modelRef;
      if (modelRef !== undefined && modelRef !== null && String(modelRef).trim() !== '') {
        const trimmed = String(modelRef).trim();
        if (resolver.isModelSelectionPending(workflow.orgId, trimmed)) {
            if (!requireComplete) return;
          problems.push({
            nodeIndex,
            nodeId: node.id,
            field: 'modelRef',
            code: 'PENDING_MODEL_SELECTION',
            message: 'Selecione um modelo aprovado e autorizado antes de revisar ou ativar.',
          });
        } else {
          try {
            resolver.resolveAiModel(workflow.orgId, trimmed);
          } catch (err: any) {
            problems.push({
              nodeIndex,
              nodeId: node.id,
              field: 'modelRef',
              code: err?.response?.code ?? 'UNKNOWN_MODEL_REFERENCE',
              message: err?.response?.message ?? err.message,
            });
          }
        }
      } else if (requireComplete) {
        problems.push({
          nodeIndex,
          nodeId: node.id,
          field: 'modelRef',
          code: 'MISSING_REQUIRED_RESOURCE',
          message: "O nó de análise de IA requer a definição de um modelo homologado ('modelRef') para revisão e ativação.",
        });
      }
    }

    if (node.type === 'http_request') {
      const credentialRef = config.credentialRef;
      if (credentialRef !== undefined && credentialRef !== null && String(credentialRef).trim() !== '') {
        try {
          resolver.resolveCredential(workflow.orgId, String(credentialRef));
        } catch (err: any) {
          problems.push({
            nodeIndex,
            nodeId: node.id,
            field: 'credentialRef',
            code: err?.response?.code ?? 'RESOURCE_NOT_FOUND',
            message: err?.response?.message ?? err.message,
          });
        }
      }
    }

    if (node.type === 'trigger_form') {
      const formId = config.formId;
      if (formId !== undefined && formId !== null && String(formId).trim() !== '') {
        try {
          resolver.resolveForm(workflow.orgId, String(formId));
        } catch (err: any) {
          problems.push({
            nodeIndex,
            nodeId: node.id,
            field: 'formId',
            code: err?.response?.code ?? 'RESOURCE_NOT_FOUND',
            message: err?.response?.message ?? err.message,
          });
        }
      }
    }
  });

  if (problems.length > 0) {
    const first = problems[0];
    throw new BadRequestException({
      code: problems.length === 1 ? first.code : 'WORKFLOW_RESOURCE_ERROR',
      message: problems.length === 1 ? first.message : 'Erros de validação ou autorização de recursos na definição do workflow.',
      issues: problems,
    });
  }
}


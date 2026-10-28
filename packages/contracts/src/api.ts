/**
 * FlowMind AI — DTOs e Envelopes de API REST
 */

import type { WorkflowDefinition, WorkflowExecution, WorkflowVersion } from './workflow';

// Envelopes de Resposta Padrão
export interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
  timestamp: string;
}

// DTOs de Criação e Atualização de Workflow
export interface CreateWorkflowDto {
  name: string;
  description?: string;
}

export interface UpdateWorkflowDto {
  name?: string;
  description?: string;
  nodes?: WorkflowDefinition['nodes'];
  edges?: WorkflowDefinition['edges'];
  triggerNodeId?: string;
}

// DTOs de Ciclo de Vida e Revisão (T03)
export interface ReviewWorkflowResponse {
  workflow: WorkflowDefinition;
  reviewedBy: string;
  reviewedAt: string;
}

export interface PublishWorkflowResponse {
  workflow: WorkflowDefinition;
  versionSnapshot: WorkflowVersion;
  publishedAt: string;
}

export interface DeactivateWorkflowResponse {
  workflow: WorkflowDefinition;
  deactivatedAt: string;
}

// DTOs de Execução e Simulação
export interface SimulateWorkflowDto {
  initialPayload: Record<string, unknown>;
}

export interface ExecuteWorkflowDto {
  triggerPayload: Record<string, unknown>;
}

// DTO de Resposta de Simulação
export interface SimulateWorkflowResponse {
  executionId: string;
  status: 'COMPLETED' | 'FAILED';
  totalDurationMs: number;
  nodeResults: WorkflowExecution['nodeResults'];
}

// DTOs de Geração Estruturada por IA (T10)
export interface GenerateWorkflowDto {
  prompt: string;
  contextHint?: string;
}

export interface GeneratedWorkflowDraft {
  schemaVersion: string;
  name: string;
  description: string;
  triggerNodeId: string;
  nodes: WorkflowDefinition['nodes'];
  edges: WorkflowDefinition['edges'];
}

export interface GenerateWorkflowResponse {
  workflow: GeneratedWorkflowDraft;
  reasoning: string;
  warnings?: string[];
  modelUsed: string;
  tokensConsumed: number | null; // Uso desconhecido não deve ser convertido em zero.
  requiresHumanReview: true;
}

// DTOs de Histórico e Consumo (T13)
export interface OrgUsageReport {
  orgId: string;
  billingPeriod: string;
  totalExecutions: number;
  maxExecutionsQuota: number;
  usagePercentage: number;
  /** null enquanto o consumo de tokens não tiver sido medido. */
  estimatedTokensConsumed: number | null;
  isLimitReached: boolean;
  /** Total de execuções de simulação registradas no período (isentas da cota comercial LIVE). */
  totalSimulations?: number;
}

export interface ExecutionListItemDto {
  id: string;
  workflowId: string;
  workflowName?: string;
  workflowVersion: number;
  mode: 'SIMULATION' | 'LIVE';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  triggeredBy: string;
  nodeCount: number;
}

// DTOs de Gatilhos e Webhooks (T12)
export interface WebhookTriggerHeaders {
  signature?: string;
  idempotencyKey?: string;
}

export interface WebhookTriggerResponse {
  executionId: string;
  status: 'COMPLETED' | 'FAILED' | 'QUEUED';
  idempotentReplay: boolean;
  workflowId: string;
  triggeredAt: string;
}

export interface ScheduleConfig {
  cronExpression: string; // Ex: '0 9 * * 1-5'
  timezone?: string; // Ex: 'America/Sao_Paulo'
  enabled: boolean;
}

export interface ScheduleCalculationResult {
  isValid: boolean;
  cronExpression: string;
  timezone: string;
  nextExecutionAt?: string;
  error?: string;
}

/**
 * FlowMind AI — Contratos de Filas e Background Jobs (T05/T12)
 */

export type WorkflowJobType = 'WORKFLOW_SIMULATION' | 'WORKFLOW_EXECUTION';

export type WorkflowJobMode = 'SIMULATION' | 'LIVE';

export type WorkflowJobStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'RETRYING';

export interface WorkflowJobPayload {
  jobId: string;
  workflowId: string;
  workflowVersion?: number;
  orgId: string;
  userId: string;
  mode: WorkflowJobMode;
  initialPayload: Record<string, unknown>;
  idempotencyKey?: string;
  /** Presente quando o job veio de um agendamento (T12). */
  scheduleId?: string;
  attempt?: number;
  maxRetries?: number;
  enqueuedAt?: string;
}

export interface WorkflowJobResult {
  jobId: string;
  executionId: string;
  status: 'COMPLETED' | 'FAILED';
  durationMs?: number;
  attempt: number;
  completedAt?: string;
  error?: string;
}

export interface QueueMetrics {
  isAvailable: boolean;
  pendingJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
}

export const QUEUE_ERROR_CODES = {
  INVALID_CONTRACT: 'QUEUE_INVALID_JOB_CONTRACT',
  CROSS_TENANT: 'QUEUE_CROSS_TENANT_VIOLATION',
  STORAGE_UNAVAILABLE: 'QUEUE_STORAGE_UNAVAILABLE',
  LIVE_NOT_IMPLEMENTED: 'QUEUE_LIVE_NOT_IMPLEMENTED',
  MAX_RETRIES_EXCEEDED: 'QUEUE_MAX_RETRIES_EXCEEDED',
  DUPLICATE_IDEMPOTENCY: 'QUEUE_DUPLICATE_IDEMPOTENCY',
} as const;

export type QueueErrorCode = typeof QUEUE_ERROR_CODES[keyof typeof QUEUE_ERROR_CODES];

export function isValidWorkflowJobPayload(value: unknown): value is WorkflowJobPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const requiredStringFields = ['jobId', 'workflowId', 'orgId', 'userId'];
  for (const field of requiredStringFields) {
    if (typeof candidate[field] !== 'string' || !(candidate[field] as string).trim()) {
      return false;
    }
  }
  if (!candidate.initialPayload || typeof candidate.initialPayload !== 'object' || Array.isArray(candidate.initialPayload)) {
    return false;
  }
  if (candidate.mode !== 'SIMULATION' && candidate.mode !== 'LIVE') {
    return false;
  }
  if (candidate.workflowVersion !== undefined && (!Number.isInteger(candidate.workflowVersion) || (candidate.workflowVersion as number) < 1)) {
    return false;
  }
  if (candidate.attempt !== undefined && (!Number.isInteger(candidate.attempt) || (candidate.attempt as number) < 1)) {
    return false;
  }
  if (candidate.maxRetries !== undefined && (!Number.isInteger(candidate.maxRetries) || (candidate.maxRetries as number) < 0)) {
    return false;
  }
  if (candidate.idempotencyKey !== undefined && (typeof candidate.idempotencyKey !== 'string' || !(candidate.idempotencyKey as string).trim())) {
    return false;
  }
  return true;
}

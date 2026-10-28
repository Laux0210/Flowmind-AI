import type {
  WorkflowDefinition, CreateWorkflowDto, UpdateWorkflowDto,
  SimulateWorkflowResponse, GenerateWorkflowDto, GenerateWorkflowResponse,
  ExecutionListItemDto, WorkflowExecution, OrgUsageReport, ApiResponse,
  ReviewWorkflowResponse, PublishWorkflowResponse, DeactivateWorkflowResponse,
  PublicResource, ResourceType,
} from '@flowmind/contracts';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
type SessionToken = string | null | undefined;

const generationUsageCodes = new Set([
  'AI_RATE_LIMIT_EXCEEDED', 'AI_AUTHENTICATION_ERROR', 'AI_UPSTREAM_ERROR', 'AI_INVALID_RESPONSE_STRUCTURE',
  'AI_PROMPT_REFUSED', 'AI_INCOMPLETE_RESPONSE', 'AI_EMPTY_RESPONSE', 'AI_INVALID_JSON_RESPONSE',
  'AI_INVALID_WORKFLOW_RESPONSE', 'AI_REQUEST_TIMEOUT', 'AI_REQUEST_FAILED',
]);

export class AiGenerationRequestError extends Error {
  readonly tokensConsumed: number | null;

  constructor(message: string, tokensConsumed: unknown) {
    super(message);
    this.name = 'AiGenerationRequestError';
    this.tokensConsumed = typeof tokensConsumed === 'number' && Number.isSafeInteger(tokensConsumed) && tokensConsumed >= 0
      ? tokensConsumed : null;
  }
}

export interface WebhookEndpointView {
  publicId: string;
  workflowId: string;
  status: 'ACTIVE' | 'REVOKED';
  createdAt: string;
  rotatedAt?: string;
  revokedAt?: string;
}
export type WebhookEndpointWithSecret = WebhookEndpointView & { secret: string };

export interface WorkflowScheduleView {
  id: string;
  workflowId: string;
  cron: string;
  timezone: string;
  status: 'ACTIVE' | 'PAUSED' | 'REVOKED';
  createdAt: string;
  revokedAt?: string;
}

/** URL pública de recebimento de um endpoint. */
export function webhookUrl(publicId: string): string {
  return `${API_BASE}/triggers/webhook/${encodeURIComponent(publicId)}`;
}

export class ApiClient {
  private static async request<T>(path: string, token: SessionToken, options: RequestInit = {}): Promise<T> {
    if (!token) throw new Error('Entre e selecione uma organização para continuar.');
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      let message = `A operação não foi concluída (HTTP ${res.status}).`;
      let declaredUsage: unknown = null;
      try {
        if (typeof res.json === 'function') {
          const errorBody = await res.json();
          if (path === '/ai/generate-workflow' && errorBody && generationUsageCodes.has(errorBody.code)) {
            declaredUsage = errorBody.tokensConsumed;
          }
          if (errorBody && typeof errorBody.message === 'string' && errorBody.message.trim()) {
            message = errorBody.message;
          } else if (errorBody && Array.isArray(errorBody.message) && errorBody.message.length > 0) {
            message = errorBody.message.join('; ');
          }
        }
      } catch {
        // Fallback seguro para o código HTTP
      }
      if (path === '/ai/generate-workflow') throw new AiGenerationRequestError(message, declaredUsage);
      throw new Error(message);
    }
    if (res.status === 204) return undefined as unknown as T;
    const response: ApiResponse<T> = await res.json();
    if (response.success !== true) throw new Error('Resposta inválida da API.');
    return response.data;
  }

  static async listWorkflows(token?: SessionToken): Promise<WorkflowDefinition[]> {
    return this.request('/workflows', token);
  }

  static async listResources(token?: SessionToken, type?: ResourceType): Promise<PublicResource[]> {
    const data = await this.request<unknown>('/resources' + (type ? '?type=' + encodeURIComponent(type) : ''), token);
    if (!Array.isArray(data) || data.some((item) => !item || typeof item !== 'object' ||
        Object.keys(item).some((key) => !['id', 'type', 'name', 'status'].includes(key)) ||
        typeof item.id !== 'string' || !item.id.trim() || typeof item.name !== 'string' || !item.name.trim() ||
        !['form', 'credential', 'ai_model'].includes(item.type) || item.status !== 'ACTIVE') ||
        new Set(data.map((item) => item.id)).size !== data.length) {
      throw new Error('Catálogo de recursos inválido.');
    }
    return data;
  }

  static async getWorkflow(id: string, token?: SessionToken): Promise<WorkflowDefinition> {
    return this.request(`/workflows/${encodeURIComponent(id)}`, token);
  }

  static async createWorkflow(dto: CreateWorkflowDto, token?: SessionToken): Promise<WorkflowDefinition> {
    return this.request('/workflows', token, { method: 'POST', body: JSON.stringify(dto) });
  }

  static async updateWorkflow(id: string, dto: UpdateWorkflowDto, token?: SessionToken): Promise<WorkflowDefinition> {
    return this.request(`/workflows/${encodeURIComponent(id)}`, token, { method: 'PUT', body: JSON.stringify(dto) });
  }

  static async simulateWorkflow(id: string, initialPayload: Record<string, unknown>, token?: SessionToken): Promise<SimulateWorkflowResponse> {
    return this.request(`/workflows/${encodeURIComponent(id)}/simulate`, token, {
      method: 'POST', body: JSON.stringify({ initialPayload }),
    });
  }

  static async generateWorkflow(dto: GenerateWorkflowDto, token?: SessionToken): Promise<GenerateWorkflowResponse> {
    return this.request('/ai/generate-workflow', token, { method: 'POST', body: JSON.stringify(dto) });
  }

  static async listExecutions(token?: SessionToken, workflowId?: string): Promise<ExecutionListItemDto[]> {
    const query = workflowId ? `?workflowId=${encodeURIComponent(workflowId)}` : '';
    return this.request(`/executions${query}`, token);
  }

  static async getExecution(id: string, token?: SessionToken): Promise<WorkflowExecution> {
    return this.request(`/executions/${encodeURIComponent(id)}`, token);
  }

  static async getUsage(token?: SessionToken): Promise<OrgUsageReport> {
    return this.request('/executions/usage', token);
  }

  static async reviewWorkflow(id: string, token?: SessionToken): Promise<ReviewWorkflowResponse> {
    return this.request(`/workflows/${encodeURIComponent(id)}/review`, token, { method: 'POST' });
  }

  static async activateWorkflow(id: string, token?: SessionToken): Promise<PublishWorkflowResponse> {
    return this.request(`/workflows/${encodeURIComponent(id)}/activate`, token, { method: 'POST' });
  }

  static async deactivateWorkflow(id: string, token?: SessionToken): Promise<DeactivateWorkflowResponse> {
    return this.request(`/workflows/${encodeURIComponent(id)}/deactivate`, token, { method: 'POST' });
  }

  static async listWebhooks(workflowId: string, token?: SessionToken): Promise<WebhookEndpointView[]> {
    return this.request(`/workflows/${encodeURIComponent(workflowId)}/webhooks`, token);
  }

  static async createWebhook(workflowId: string, token?: SessionToken): Promise<WebhookEndpointWithSecret> {
    return this.request(`/workflows/${encodeURIComponent(workflowId)}/webhooks`, token, { method: 'POST' });
  }

  static async rotateWebhook(publicId: string, token?: SessionToken): Promise<WebhookEndpointWithSecret> {
    return this.request(`/webhooks/${encodeURIComponent(publicId)}/rotate`, token, { method: 'POST' });
  }

  static async revokeWebhook(publicId: string, token?: SessionToken): Promise<WebhookEndpointView> {
    return this.request(`/webhooks/${encodeURIComponent(publicId)}`, token, { method: 'DELETE' });
  }

  static async listSchedules(workflowId: string, token?: SessionToken): Promise<WorkflowScheduleView[]> {
    return this.request(`/workflows/${encodeURIComponent(workflowId)}/schedules`, token);
  }

  static async createSchedule(workflowId: string, cron: string, timezone: string, token?: SessionToken): Promise<WorkflowScheduleView> {
    return this.request(`/workflows/${encodeURIComponent(workflowId)}/schedules`, token, {
      method: 'POST', body: JSON.stringify({ cron, timezone }),
    });
  }

  static async revokeSchedule(id: string, token?: SessionToken): Promise<WorkflowScheduleView> {
    return this.request(`/schedules/${encodeURIComponent(id)}`, token, { method: 'DELETE' });
  }

  static async deleteWorkflow(id: string, token?: SessionToken): Promise<void> {
    return this.request(`/workflows/${encodeURIComponent(id)}`, token, { method: 'DELETE' });
  }
}


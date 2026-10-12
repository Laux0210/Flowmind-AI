import type {
  WorkflowDefinition, CreateWorkflowDto, UpdateWorkflowDto,
  SimulateWorkflowResponse, GenerateWorkflowDto, GenerateWorkflowResponse,
  ExecutionListItemDto, WorkflowExecution, OrgUsageReport, ApiResponse,
  ReviewWorkflowResponse, PublishWorkflowResponse, DeactivateWorkflowResponse,
} from '@flowmind/contracts';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
type SessionToken = string | null | undefined;

export class ApiClient {
  private static async request<T>(path: string, token: SessionToken, options: RequestInit = {}): Promise<T> {
    if (!token) throw new Error('Entre e selecione uma organização para continuar.');
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      let message = `A operação não foi concluída (HTTP ${res.status}).`;
      try {
        if (typeof res.json === 'function') {
          const errorBody = await res.json();
          if (errorBody && typeof errorBody.message === 'string' && errorBody.message.trim()) {
            message = errorBody.message;
          } else if (errorBody && Array.isArray(errorBody.message) && errorBody.message.length > 0) {
            message = errorBody.message.join('; ');
          }
        }
      } catch {
        // Fallback seguro para o código HTTP
      }
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

  static async deleteWorkflow(id: string, token?: SessionToken): Promise<void> {
    return this.request(`/workflows/${encodeURIComponent(id)}`, token, { method: 'DELETE' });
  }
}


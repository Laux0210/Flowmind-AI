/**
 * FlowMind AI — Catálogo de Nós do MVP e Tipagens Específicas
 */

// 1. Gatilho de Formulário (trigger_form)
export interface TriggerFormConfig {
  formId?: string;
  requiredFields: ('name' | 'email' | 'message')[];
}

export interface TriggerFormOutputs {
  submission_id: string;
  contact_name: string;
  contact_email: string;
  message_text: string;
  submitted_at: string;
}

// 2. Resumo, intenção e ambiguidades (ai_analyze_intent)
export interface AiAnalyzeIntentConfig {
  modelRef: string; // Resolvido no servidor; modelo real ainda não escolhido.
  inputPromptTemplate: string; // Ex: 'Analise a seguinte mensagem: {{trigger_form.message_text}}'
  systemInstructions?: string;
}

export interface AiAnalyzeIntentOutputs {
  summary: string;
  intent: string;
  ambiguities: string[];
  model_used: string;
  tokens_consumed: number;
}

// 3. Registro interno de negócio (internal_record)
export interface InternalRecordConfig {
  fieldMappings: {
    name: string;
    email: string;
    raw_message: string;
    ai_summary: string;
    ai_intent: string;
    ambiguities: string | string[]; // Referência exata preserva o array de saída da IA.
  };
}

export type InternalRecordOutputs =
  | {
      record_id: string;
      name?: string;
      email?: string;
      raw_message?: string;
      ai_summary?: string;
      ai_intent?: string;
      ambiguities?: string | string[];
      status: 'saved';
      persisted_at: string;
    }
  | {
      record_id: string;
      name?: string;
      email?: string;
      raw_message?: string;
      ai_summary?: string;
      ai_intent?: string;
      ambiguities?: string | string[];
      status: 'simulated';
      simulated_at: string;
    };

// 4. Envio de E-mail de Resposta (send_email)
export interface SendEmailConfig {
  to: string; // Ex: '{{trigger_form.contact_email}}'
  subject: string;
  bodyTemplate: string;
  replyTo?: string;
}

export interface SendEmailOutputs {
  delivery_status: 'accepted' | 'simulated' | 'failed' | 'unknown';
  recipient: string;
  subject?: string;
  message_id: string;
  dispatched_at: string;
}

// 5. Nó de Condição (condition)
export type ConditionOperator =
  | 'equals'
  | '=='
  | 'eq'
  | 'not_equals'
  | '!='
  | 'neq'
  | 'contains'
  | 'not_contains'
  | 'in'
  | 'not_in'
  | 'greater_than'
  | '>'
  | 'gt'
  | 'less_than'
  | '<'
  | 'lt'
  | 'greater_or_equal'
  | '>='
  | 'gte'
  | 'less_or_equal'
  | '<='
  | 'lte'
  | 'is_empty'
  | 'is_not_empty'
  | 'starts_with'
  | 'ends_with';

export interface ConditionConfig {
  leftOperand: string;
  operator: ConditionOperator;
  rightOperand: string;
}

export interface ConditionOutputs {
  result: boolean;
  evaluated_at: string;
}

// 6. Nó HTTP (http_request)
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface HttpRequestConfig {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  credentialRef?: string;
  bodyTemplate?: string;
}

export interface HttpRequestOutputs {
  status_code: number;
  response_body: unknown;
  duration_ms: number;
}

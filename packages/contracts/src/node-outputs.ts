import type { NodeType } from './workflow';
import type { TriggerFormOutputs, TriggerScheduleOutputs, AiAnalyzeIntentOutputs, InternalRecordOutputs,
  SendEmailOutputs, ConditionOutputs, HttpRequestOutputs } from './nodes';

type OutputsByType = {
  trigger_schedule: TriggerScheduleOutputs;
  trigger_form: TriggerFormOutputs; ai_analyze_intent: AiAnalyzeIntentOutputs;
  internal_record: InternalRecordOutputs; send_email: SendEmailOutputs;
  condition: ConditionOutputs; http_request: HttpRequestOutputs;
};
type UnionKeys<T> = T extends unknown ? keyof T : never;
export type OutputFieldKind = 'string' | 'number' | 'boolean' | 'string_array' | 'string_or_array' | 'json';

// Catálogo de campos declarados. Não garante presença de campos opcionais ou específicos de modo.
export const NODE_OUTPUT_KINDS = {
  trigger_schedule: { scheduledAt: 'string' },
  trigger_form: { submission_id: 'string', contact_name: 'string', contact_email: 'string', message_text: 'string', submitted_at: 'string' },
  ai_analyze_intent: { summary: 'string', intent: 'string', ambiguities: 'string_array', model_used: 'string', tokens_consumed: 'number' },
  internal_record: { record_id: 'string', name: 'string', email: 'string', raw_message: 'string', ai_summary: 'string', ai_intent: 'string',
    ambiguities: 'string_or_array', status: 'string', persisted_at: 'string', simulated_at: 'string' },
  send_email: { delivery_status: 'string', recipient: 'string', subject: 'string', message_id: 'string', dispatched_at: 'string' },
  condition: { result: 'boolean', evaluated_at: 'string' },
  http_request: { status_code: 'number', response_body: 'json', duration_ms: 'number' },
} as const satisfies { [Type in NodeType]: Record<Extract<UnionKeys<OutputsByType[Type]>, string>, OutputFieldKind> };

export function getOutputFieldKind(type: NodeType, fieldPath: string): OutputFieldKind | null {
  const parts = fieldPath.split('.');
  if (parts.some((part) => !part || ['__proto__', 'prototype', 'constructor'].includes(part))) return null;
  const fields: Readonly<Record<string, OutputFieldKind>> = NODE_OUTPUT_KINDS[type];
  if (!Object.hasOwn(fields, parts[0])) return null;
  const kind = fields[parts[0]];
  if (parts.length === 1) return kind;
  // Conteúdo de resposta HTTP é dinâmico: só o root é declarado; o lookup real continua obrigatório.
  if (kind === 'json') return 'json';
  if (parts.length === 2 && ['string_array', 'string_or_array'].includes(kind)) {
    if (parts[1] === 'length') return kind === 'string_array' ? 'number' : 'json';
    if (/^(0|[1-9]\d*)$/.test(parts[1])) return kind === 'string_array' ? 'string' : 'json';
  }
  return null;
}

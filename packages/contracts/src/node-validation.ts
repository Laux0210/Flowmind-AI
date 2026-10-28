import type { NodeType } from './workflow';
import { CONDITION_OPERATORS, HTTP_METHODS } from './nodes';

export interface NodeConfigIssue {
  field: string;
  code: 'INVALID_CONFIG' | 'UNKNOWN_FIELD' | 'INVALID_FIELD_TYPE' | 'INVALID_FIELD_VALUE' | 'MISSING_REQUIRED_FIELD';
}

const fields: Record<NodeType, readonly string[]> = {
  trigger_form: ['requiredFields', 'formId'],
  trigger_schedule: [],
  ai_analyze_intent: ['modelRef', 'inputPromptTemplate', 'message_text', 'systemInstructions'],
  internal_record: ['fieldMappings', 'name', 'email', 'raw_message', 'message', 'ai_summary', 'ai_intent', 'ambiguities'],
  send_email: ['to', 'subject', 'bodyTemplate', 'replyTo'],
  condition: ['leftOperand', 'operator', 'rightOperand'],
  http_request: ['url', 'method', 'headers', 'credentialRef', 'bodyTemplate'],
};
const recordFields = fields.internal_record.filter((field) => field !== 'fieldMappings');
const unsafeKeys = ['__proto__', 'prototype', 'constructor'];
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value: Record<string, unknown>, field: string): unknown =>
  Object.hasOwn(value, field) ? value[field] : undefined;

// Percurso iterativo: aceita apenas JSON finito, detecta ciclos e não altera o input.
function validJson(value: unknown): boolean {
  const ancestors = new Set<object>();
  const pending: Array<{ value: unknown; exit: boolean }> = [{ value, exit: false }];
  while (pending.length) {
    const item = pending.pop()!;
    const value = item.value;
    if (value !== null && typeof value === 'object') {
      if (item.exit) { ancestors.delete(value); continue; }
      if (ancestors.has(value)) return false;
      if (!Array.isArray(value) && Object.prototype.toString.call(value) !== '[object Object]') return false;
      ancestors.add(value);
      pending.push({ value, exit: true });
      for (const [key, child] of Object.entries(value)) {
        if (unsafeKeys.includes(key)) return false;
        // Propriedade opcional undefined é omitida pela serialização JSON.
        if (child !== undefined) pending.push({ value: child, exit: false });
      }
    } else if (typeof value === 'number') {
      if (!Number.isFinite(value)) return false;
    } else if (value !== null && !['string', 'boolean'].includes(typeof value)) return false;
  }
  return true;
}

/** Inspeciona config declarativa; não autoriza recursos, interpreta intenção ou valida referências. */
export function getNodeConfigIssues(type: NodeType, config: unknown): NodeConfigIssue[] {
  if (!object(config) || !validJson(config)) return [{ field: 'config', code: 'INVALID_CONFIG' }];
  const issues: NodeConfigIssue[] = [];
  const issue = (field: string, code: NodeConfigIssue['code']) => { issues.push({ field, code }); };
  const closed = (value: Record<string, unknown>, allowed: readonly string[], field: string) => {
    if (Object.keys(value).some((key) => !allowed.includes(key))) issue(field, 'UNKNOWN_FIELD');
  };
  const string = (field: string, required = false, nonempty = false) => {
    const value = own(config, field);
    if (value === undefined) { if (required) issue(field, 'MISSING_REQUIRED_FIELD'); return; }
    if (typeof value !== 'string') issue(field, 'INVALID_FIELD_TYPE');
    else if (nonempty && !value.trim()) issue(field, 'MISSING_REQUIRED_FIELD');
  };
  closed(config, fields[type], 'config');

  switch (type) {
    case 'trigger_form': {
      string('formId');
      const required = own(config, 'requiredFields');
      if (required !== undefined) {
        if (!Array.isArray(required)) issue('requiredFields', 'INVALID_FIELD_TYPE');
        else if (required.some((field) => !['name', 'email', 'message'].includes(field))) {
          issue('requiredFields', 'INVALID_FIELD_VALUE');
        }
      }
      break;
    }
    case 'ai_analyze_intent': {
      string('modelRef'); string('inputPromptTemplate'); string('message_text'); string('systemInstructions');
      const input = own(config, 'inputPromptTemplate') ?? own(config, 'message_text');
      if (input === undefined || (typeof input === 'string' && !input.trim())) issue('inputPromptTemplate', 'MISSING_REQUIRED_FIELD');
      break;
    }
    case 'internal_record': {
      const mappings = own(config, 'fieldMappings');
      if (mappings !== undefined && !object(mappings)) issue('fieldMappings', 'INVALID_FIELD_TYPE');
      const sources = [{ value: config, prefix: '' }];
      if (object(mappings)) { closed(mappings, recordFields, 'fieldMappings'); sources.push({ value: mappings, prefix: 'fieldMappings.' }); }
      for (const { value, prefix } of sources) {
        for (const field of recordFields) {
          const item = own(value, field);
          if (item === undefined) continue;
          const valid = typeof item === 'string' ||
            (field === 'ambiguities' && Array.isArray(item) && item.every((child) => typeof child === 'string'));
          if (!valid) issue(prefix + field, 'INVALID_FIELD_TYPE');
        }
      }
      const name = (object(mappings) ? own(mappings, 'name') : undefined) ?? own(config, 'name');
      const email = (object(mappings) ? own(mappings, 'email') : undefined) ?? own(config, 'email');
      if (![name, email].some((value) => typeof value === 'string' && value.trim())) issue('fieldMappings', 'MISSING_REQUIRED_FIELD');
      break;
    }
    case 'send_email': {
      string('to', true, true); string('subject', true); string('bodyTemplate', true); string('replyTo');
      for (const field of ['to', 'subject', 'replyTo']) {
        const value = own(config, field);
        if (typeof value === 'string' && /[\r\n]/.test(value)) issue(field, 'INVALID_FIELD_VALUE');
      }
      break;
    }
    case 'condition': {
      const operator = own(config, 'operator');
      if (operator !== undefined) {
        if (typeof operator !== 'string') issue('operator', 'INVALID_FIELD_TYPE');
        else if (!(CONDITION_OPERATORS as readonly string[]).includes(operator.toLowerCase().trim())) issue('operator', 'INVALID_FIELD_VALUE');
      }
      // Operand types/defaults seguem o executor: JSON e referências exatas preservam tipo.
      break;
    }
    case 'http_request': {
      string('url', true, true); string('method'); string('credentialRef'); string('bodyTemplate');
      const method = own(config, 'method');
      if (typeof method === 'string' && !(HTTP_METHODS as readonly string[]).includes(method.toUpperCase())) issue('method', 'INVALID_FIELD_VALUE');
      const headers = own(config, 'headers');
      if (headers !== undefined) {
        if (!object(headers) || Object.values(headers).some((value) => typeof value !== 'string')) issue('headers', 'INVALID_FIELD_TYPE');
        else if (Object.entries(headers).some(([key, value]) => /[\r\n]/.test(key) || /[\r\n]/.test(value as string))) issue('headers', 'INVALID_FIELD_VALUE');
      }
      break;
    }
  }
  return issues;
}

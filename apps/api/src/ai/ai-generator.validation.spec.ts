import { createTestResourceResolver } from '../../test/resource-fixtures';
import { BadRequestException } from '@nestjs/common';
import type { GeneratedWorkflowDraft, NodeType, WorkflowNode } from '@flowmind/contracts';
import { AiGeneratorService } from './ai-generator.service';
import type { AiClient, AiGenerationResult } from './ai-client.interface';
import { OpenAiStructuredClient } from './openai-structured-client';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import { NodeExecutors } from '../engine/node-executors';

const privateMarker = 'private_marker_fixture';
const prompt = { prompt: 'Proposta sintética para formulário de contato' };
function node(id: string, type: NodeType, config: unknown): WorkflowNode {
  return { id, type, label: 'Fixture', position: { x: 0, y: 0 }, config: config as Record<string, unknown> };
}
function draft(type: NodeType = 'send_email', config: unknown = {
  to: '{{form.contact_email}}', subject: 'Fixture', bodyTemplate: '{{form.message_text}}',
}): GeneratedWorkflowDraft {
  const form = node('form', 'trigger_form', { requiredFields: ['name', 'email', 'message'] });
  return { schemaVersion: '1.0.0', name: 'Fixture', description: 'Proposta local', triggerNodeId: 'form',
    nodes: type === 'trigger_form' ? [{ ...form, config: config as Record<string, unknown> }] : [form, node('target', type, config)],
    edges: type === 'trigger_form' ? [] : [{ id: 'form_target', sourceNodeId: 'form', targetNodeId: 'target' }] };
}
function adapter(value: GeneratedWorkflowDraft, usage: unknown = 24) {
  const result: AiGenerationResult = { draft: value, reasoning: 'Revisão necessária', warnings: [],
    modelUsed: 'fixture-only-not-approved', tokensConsumed: usage as number | null };
  const client = { generateWorkflow: jest.fn().mockResolvedValue(result) } satisfies AiClient;
  return { client, service: new AiGeneratorService(createTestResourceResolver(), client) };
}
async function rejected(operation: Promise<unknown>, tokens: number | null = 24) {
  try { await operation; throw new Error('A proposta inválida deveria ser recusada'); }
  catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    const response = (error as BadRequestException).getResponse();
    expect(response).toMatchObject({ code: 'AI_INVALID_WORKFLOW_RESPONSE', tokensConsumed: tokens });
    expect(JSON.stringify(response)).not.toContain(privateMarker);
    expect(response).not.toHaveProperty('issues');
  }
}

describe('T10-S4a — validade conhecida da proposta, sem efeitos', () => {
  const invalidConfigs: Array<[string, NodeType, unknown]> = [
    ['form requiredFields não array', 'trigger_form', { requiredFields: 'email' }],
    ['form campo fora do catálogo', 'trigger_form', { requiredFields: [privateMarker] }],
    ['IA prompt numérico', 'ai_analyze_intent', { inputPromptTemplate: 17 }],
    ['IA instrução em objeto', 'ai_analyze_intent', { inputPromptTemplate: 'Fixture', systemInstructions: {} }],
    ['registro mapeamento numérico', 'internal_record', { fieldMappings: { name: 17 } }],
    ['registro ambiguidades boolean', 'internal_record', { fieldMappings: { name: 'Fixture', ambiguities: true } }],
    ['email assunto numérico', 'send_email', { to: 'contato@example.test', subject: 17, bodyTemplate: 'Fixture' }],
    ['email corpo array', 'send_email', { to: 'contato@example.test', subject: 'Fixture', bodyTemplate: [] }],
    ['email CRLF', 'send_email', { to: 'contato@example.test', subject: privateMarker + '\r\nX: fixture', bodyTemplate: 'Fixture' }],
    ['condição operador inválido', 'condition', { operator: privateMarker }],
    ['HTTP método inválido', 'http_request', { url: 'https://endpoint.example.invalid', method: 'TRACE' }],
    ['HTTP header não string', 'http_request', { url: 'https://endpoint.example.invalid', headers: { [privateMarker]: 17 } }],
    ['HTTP CRLF', 'http_request', { url: 'https://endpoint.example.invalid', headers: { [privateMarker]: 'a\r\nb' } }],
    ['HTTP destino literal interno', 'http_request', { url: 'http://127.0.0.1/' + privateMarker }],
    ['config não objeto', 'internal_record', null],
    ['config campo desconhecido', 'internal_record', { name: 'Fixture', [privateMarker]: 'private_value' }],
  ];
  it.each(invalidConfigs)('nega %s antes de devolver proposta ao editor', async (_name, type, config) => {
    const { service } = adapter(draft(type, config));
    await rejected(service.generateFromNaturalLanguage(prompt, 'org_fixture'));
  });

  const invalidReferences: Array<[string, NodeType, Record<string, unknown>]> = [
    ['produtor ausente em body', 'send_email', { to: '{{form.contact_email}}', subject: 'Fixture', bodyTemplate: '{{' + privateMarker + '.summary}}' }],
    ['saída inexistente em to', 'send_email', { to: '{{form.' + privateMarker + '}}', subject: 'Fixture', bodyTemplate: 'Fixture' }],
    ['saída inexistente em frase', 'send_email', { to: '{{form.contact_email}}', subject: 'Fixture', bodyTemplate: 'Olá {{form.' + privateMarker + '}}' }],
    ['subcampo de string', 'send_email', { to: '{{form.contact_email}}', subject: 'Fixture', bodyTemplate: '{{form.message_text.length}}' }],
    ['caminho reservado', 'send_email', { to: '{{form.contact_email}}', subject: 'Fixture', bodyTemplate: '{{form.constructor}}' }],
    ['auto referência', 'send_email', { to: '{{form.contact_email}}', subject: 'Fixture', bodyTemplate: '{{target.subject}}' }],
    ['produtor ausente em header', 'http_request', { url: 'https://endpoint.example.invalid', headers: { [privateMarker]: '{{absent.status}}' } }],
    ['produtor ausente em mapping', 'internal_record', { fieldMappings: { name: 'Fixture', raw_message: '{{absent.summary}}' } }],
    ['saída ausente em prompt IA', 'ai_analyze_intent', { inputPromptTemplate: '{{form.' + privateMarker + '}}' }],
  ];
  it.each(invalidReferences)('nega %s usando a guarda de referências existente', async (_name, type, config) => {
    await rejected(adapter(draft(type, config)).service.generateFromNaturalLanguage(prompt, 'org_fixture'));
  });

  it('nega referência a produtor posterior', async () => {
    const value = draft();
    value.nodes[1].config.bodyTemplate = '{{future.name}}';
    value.nodes.push(node('future', 'internal_record', { name: 'Fixture' }));
    value.edges.push({ id: 'target_future', sourceNodeId: 'target', targetNodeId: 'future' });
    await rejected(adapter(value).service.generateFromNaturalLanguage(prompt, 'org_fixture'));
  });

  it('nega tipo boolean exato em campo string', async () => {
    const value = draft();
    value.nodes.splice(1, 0, node('decision', 'condition', { leftOperand: 'a', operator: 'equals', rightOperand: 'a' }));
    value.nodes[2].config.bodyTemplate = '{{decision.result}}';
    value.edges = [{ id: 'form_decision', sourceNodeId: 'form', targetNodeId: 'decision' },
      { id: 'decision_target', sourceNodeId: 'decision', targetNodeId: 'target', sourceHandle: 'true' }];
    await rejected(adapter(value).service.generateFromNaturalLanguage(prompt, 'org_fixture'));
  });

  it.each(['destinatario_invalido', 'http://example.invalid'])('nega destinatário literal %s', async (to) => {
    const value = draft(); value.nodes[1].config.to = to;
    await rejected(adapter(value).service.generateFromNaturalLanguage(prompt, 'org_fixture'));
  });

  it('preserva C03 quando email não é obrigatório no form', async () => {
    const value = draft(); value.nodes[0].config.requiredFields = ['name', 'message'];
    await rejected(adapter(value).service.generateFromNaturalLanguage(prompt, 'org_fixture'));
  });

  it('nega schemaVersion incompatível de adaptador injetado', async () => {
    const value = draft(); (value as { schemaVersion: string }).schemaVersion = 'future-fixture';
    await rejected(adapter(value).service.generateFromNaturalLanguage(prompt, 'org_fixture'));
  });

  it.each([
    ['HTTP pendente', 'http_request', { url: '', method: 'POST' }, 'destino HTTP'],
    ['IA pendente', 'ai_analyze_intent', {}, 'texto para análise'],
    ['registro parcial', 'internal_record', {}, 'nome ou e-mail do registro'],
    ['email parcial', 'send_email', {}, 'destinatário'],
    ['email sem corpo', 'send_email', { to: '{{form.contact_email}}', subject: 'Fixture' }, 'corpo da mensagem'],
  ] as const)('mantém %s como draft com aviso seguro', async (_name, type, config, field) => {
    const value = draft(type, config);
    const { service } = adapter(value);
    const result = await service.generateFromNaturalLanguage(prompt, 'org_fixture');
    expect(result.requiresHumanReview).toBe(true);
    expect(result.workflow).toBe(value);
    expect(result.warnings?.some((warning) => warning.includes(field) && warning.includes('Nó 2'))).toBe(true);
  });

  it.each([undefined, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1, '24'])('normaliza uso inválido %s na resposta', async (usage) => {
    const { service, client } = adapter(draft(), usage);
    // undefined deve atingir o resultado do adaptador, não o default do helper.
    if (usage === undefined) client.generateWorkflow.mockResolvedValue({
      draft: draft(), reasoning: 'Fixture', warnings: [], modelUsed: 'fixture', tokensConsumed: undefined,
    });
    expect((await service.generateFromNaturalLanguage(prompt, 'org_fixture')).tokensConsumed).toBeNull();
  });

  it.each([null, 0, 24])('preserva uso conhecido/desconhecido %s', async (usage) => {
    expect((await adapter(draft(), usage).service.generateFromNaturalLanguage(prompt, 'org_fixture')).tokensConsumed).toBe(usage);
  });

  it('usa o adaptador uma vez e não chama motor ou executor', async () => {
    const engine = jest.spyOn(WorkflowEngineService.prototype, 'simulate');
    const mailExecutor = jest.spyOn(NodeExecutors, 'executeSendEmail');
    const network = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Rede proibida'));
    try {
      const value = draft(); const before = JSON.stringify(value);
      const { client, service } = adapter(value);
      const result = await service.generateFromNaturalLanguage(prompt, 'org_fixture');
      expect(client.generateWorkflow).toHaveBeenCalledTimes(1);
      expect(client.generateWorkflow).toHaveBeenCalledWith(prompt.prompt, 'org_fixture');
      expect(result.warnings).toEqual([]);
      expect(JSON.stringify(value)).toBe(before);
      expect(engine).not.toHaveBeenCalled(); expect(mailExecutor).not.toHaveBeenCalled(); expect(network).not.toHaveBeenCalled();
    } finally { engine.mockRestore(); mailExecutor.mockRestore(); network.mockRestore(); }
  });

  it('atravessa o parser OpenAI sintético, preserva consumo e esconde conteúdo inválido', async () => {
    const value = draft(); value.nodes[1].config.bodyTemplate = '{{form.' + privateMarker + '}}';
    const body = { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
      workflow: { ...value, nodes: value.nodes.map((n) => ({ ...n, config: JSON.stringify(n.config) })),
        edges: value.edges.map((e) => ({ ...e, sourceHandle: null, targetHandle: null })) },
      reasoning: privateMarker, warnings: [],
    }) } }], usage: { total_tokens: 37 } };
    const client = new OpenAiStructuredClient('fixture-key-not-real', { model: 'fixture-only-not-approved',
      fetchFn: async () => ({ ok: true, status: 200, json: async () => body }) as Response });
    await rejected(new AiGeneratorService(createTestResourceResolver(), client).generateFromNaturalLanguage(prompt, 'org_fixture'), 37);
  });
});

describe('T03-S2b Opção A — proposta de IA preserva o código da regra', () => {
  it.each([
    ['convergência', 'WORKFLOW_CONVERGENCE_NOT_SUPPORTED', (d: GeneratedWorkflowDraft) => {
      d.nodes.push(node('mail', 'send_email', { to: '{{form.contact_email}}', subject: 'Fixture', bodyTemplate: 'Fixture' }));
      d.edges.push({ id: 'form_mail', sourceNodeId: 'form', targetNodeId: 'mail' }, { id: 'target_mail', sourceNodeId: 'target', targetNodeId: 'mail' });
    }],
    ['saída não mapeada', 'OUTPUT_NOT_AVAILABLE', (d: GeneratedWorkflowDraft) => {
      d.nodes.push(node('mail', 'send_email', { to: '{{form.contact_email}}', subject: 'Fixture', bodyTemplate: '{{target.ai_summary}}' }));
      d.edges.push({ id: 'target_mail', sourceNodeId: 'target', targetNodeId: 'mail' });
    }],
    ['saída exclusiva de LIVE', 'OUTPUT_MODE_INCOMPATIBLE', (d: GeneratedWorkflowDraft) => {
      d.nodes.push(node('mail', 'send_email', { to: '{{form.contact_email}}', subject: 'Fixture', bodyTemplate: '{{target.persisted_at}}' }));
      d.edges.push({ id: 'target_mail', sourceNodeId: 'target', targetNodeId: 'mail' });
    }],
    ['mapeamento vazio', 'OUTPUT_NOT_AVAILABLE', (d: GeneratedWorkflowDraft) => {
      (d.nodes[1].config.fieldMappings as Record<string, unknown>).ai_summary = '  ';
      d.nodes.push(node('mail', 'send_email', { to: '{{form.contact_email}}', subject: 'Fixture', bodyTemplate: '{{target.ai_summary}}' }));
      d.edges.push({ id: 'target_mail', sourceNodeId: 'target', targetNodeId: 'mail' });
    }],
  ] as const)('nega %s com reason %s', async (_label, reason, edit) => {
    const d = draft('internal_record', { fieldMappings: { name: '{{form.contact_name}}' } }); edit(d);
    const error = await adapter(d).service.generateFromNaturalLanguage(prompt, 'org_fixture').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BadRequestException);
    const response = (error as BadRequestException).getResponse();
    expect(response).toMatchObject({ code: 'AI_INVALID_WORKFLOW_RESPONSE', reason, tokensConsumed: 24 });
    expect(response).not.toHaveProperty('issues');
  });
});

import { createTestResourceResolver } from '../../test/resource-fixtures';
import { BadRequestException, Logger } from '@nestjs/common';
import type { NodeType, WorkflowDefinition } from '@flowmind/contracts';
import type { PrismaService } from '../prisma/prisma.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { NodeExecutors } from './node-executors';

const invalidCases: Array<[string, NodeType, unknown]> = [
  ['campos de formulário com tipo inválido', 'trigger_form', { requiredFields: 'email' }],
  ['campo de formulário fora do catálogo', 'trigger_form', { requiredFields: ['fixture_unknown_field'] }],
  ['prompt de IA não string', 'ai_analyze_intent', { inputPromptTemplate: 17 }],
  ['instrução de IA não string', 'ai_analyze_intent', { inputPromptTemplate: 'Fixture', systemInstructions: [] }],
  ['mapeamento não objeto', 'internal_record', { fieldMappings: [] }],
  ['identificador mapeado não string', 'internal_record', { fieldMappings: { name: 17 } }],
  ['ambiguidades com elemento não string', 'internal_record', { fieldMappings: { name: 'Fixture', ambiguities: [17] } }],
  ['assunto não string', 'send_email', { to: 'contato@example.test', subject: 17, bodyTemplate: 'Fixture' }],
  ['corpo ausente', 'send_email', { to: 'contato@example.test', subject: 'Fixture' }],
  ['corpo não string', 'send_email', { to: 'contato@example.test', subject: 'Fixture', bodyTemplate: [] }],
  ['operador fora do catálogo', 'condition', { leftOperand: 'a', operator: 'fixture_invalid_operator', rightOperand: 'b' }],
  ['operador não string', 'condition', { operator: 17 }],
  ['URL ausente', 'http_request', {}],
  ['método fora do catálogo', 'http_request', { url: 'https://endpoint.example.invalid', method: 'TRACE' }],
  ['header não string', 'http_request', { url: 'https://endpoint.example.invalid', headers: { Authorization: 17 } }],
  ['CRLF em header', 'http_request', { url: 'https://endpoint.example.invalid', headers: { Authorization: 'private-fixture\r\nX-Test: value' } }],
  ['destino literal já bloqueado pelo executor', 'http_request', { url: 'http://127.0.0.1/private-fixture' }],
  ['config não objeto', 'internal_record', null],
  ['campo desconhecido', 'internal_record', { fieldMappings: { name: 'Fixture' }, 'private-fixture': 'private-value' }],
];

function fixture(type: NodeType, config: unknown, status: 'DRAFT' | 'REVIEWED' = 'DRAFT') {
  const form = { id: 'form', type: 'trigger_form' as const, label: 'Fixture', position: { x: 0, y: 0 }, config: {} };
  const target = { id: 'target', type, label: 'Fixture', position: { x: 100, y: 0 }, config: config as Record<string, unknown> };
  const w: WorkflowDefinition = {
    id: 'wf_config', orgId: 'org_fixture', name: 'Fixture', schemaVersion: '1.0.0', version: 1, status,
    triggerNodeId: 'form', nodes: type === 'trigger_form' ? [{ ...form, config: target.config }] : [form, target],
    edges: type === 'trigger_form' ? [] : [{ id: 'form_target', sourceNodeId: 'form', targetNodeId: 'target' }],
    createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z',
  };
  const row = { ...w, createdAt: new Date(w.createdAt), updatedAt: new Date(w.updatedAt),
    reviewedBy: status === 'REVIEWED' ? 'admin_fixture' : null,
    reviewedAt: status === 'REVIEWED' ? new Date(w.updatedAt) : null };
  const workflow = {
    findFirst: jest.fn(async () => structuredClone(row)),
    updateMany: jest.fn(async ({ data }: { data: object }) => { Object.assign(row, data); return { count: 1 }; }),
  };
  const workflowVersion = { create: jest.fn(async ({ data }: { data: object }) => ({ id: 'snapshot', ...data })) };
  const prisma = { workflow, workflowVersion,
    $transaction: async (action: (tx: object) => Promise<unknown>) => action({ workflow, workflowVersion }) };
  const engine = new WorkflowEngineService(createTestResourceResolver());
  return { w, row, workflow, workflowVersion, engine,
    service: new WorkflowsService(prisma as unknown as PrismaService, engine, createTestResourceResolver()) };
}

describe('Configurações antes de revisão e ativação', () => {
  describe.each(['review', 'publish'] as const)('%s', (operation) => {
    it.each(invalidCases)('nega %s antes de escrever revisão/snapshot', async (_label, type, config) => {
      const f = fixture(type, config, operation === 'review' ? 'DRAFT' : 'REVIEWED');
      await expect(f.service[operation]('org_fixture', 'wf_config', 'admin_fixture')).rejects.toBeInstanceOf(BadRequestException);
      expect(f.workflow.updateMany).not.toHaveBeenCalled();
      expect(f.workflowVersion.create).not.toHaveBeenCalled();
    });
  });

  it('erros não incluem valores ou nomes privados desconhecidos', async () => {
    const f = fixture('http_request', { url: 'https://endpoint.example.invalid', headers: { Authorization: 'private-fixture\r\nX-Test: value' } });
    let error: unknown;
    try { await f.service.review('org_fixture', 'wf_config', 'admin_fixture'); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(BadRequestException);
    expect(JSON.stringify((error as BadRequestException).getResponse())).not.toContain('private-fixture');
  });

  it('salva config incompleta no rascunho sem conferir aptidão para ativação', async () => {
    const f = fixture('http_request', {});
    await expect(f.service.update('org_fixture', 'wf_config', { nodes: f.w.nodes })).resolves.toBeDefined();
    expect(f.workflow.updateMany).toHaveBeenCalledTimes(1);
    expect(f.row.status).toBe('DRAFT');
  });

  it('nega tipo inválido de config no rascunho antes de escrever', async () => {
    const f = fixture('http_request', { url: 'https://endpoint.example.invalid', headers: [] });
    await expect(f.service.update('org_fixture', 'wf_config', { nodes: f.w.nodes })).rejects.toBeInstanceOf(BadRequestException);
    expect(f.workflow.updateMany).not.toHaveBeenCalled();
  });
});

describe('Configurações antes da simulação', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each(invalidCases)('nega %s antes de executar o primeiro nó', async (_label, type, config) => {
    const f = fixture(type, config);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const form = jest.spyOn(NodeExecutors, 'executeTriggerForm');
    await expect(f.engine.simulate(f.w, { name: 'Fixture', email: 'contato@example.test', message: 'Fixture' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(form).not.toHaveBeenCalled();
  });

  it('falha sem executar e-mail quando uma referência JSON dinâmica produz objeto', async () => {
    const f = fixture('http_request', { url: 'https://endpoint.example.invalid' });
    f.w.nodes.push({ id: 'mail', type: 'send_email', label: 'Fixture', position: { x: 200, y: 0 },
      config: { to: '{{form.contact_email}}', subject: 'Fixture', bodyTemplate: '{{target.response_body}}' } });
    f.w.edges.push({ id: 'condition_mail', sourceNodeId: 'target', targetNodeId: 'mail' });
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const mail = jest.spyOn(NodeExecutors, 'executeSendEmail');
    const result = await f.engine.simulate(f.w, { name: 'Fixture', email: 'contato@example.test', message: 'Fixture' });
    expect(result.status).toBe('FAILED');
    expect(result.nodeResults.at(-1)?.nodeId).toBe('mail');
    expect(mail).not.toHaveBeenCalled();
  });

  it('falha sem executar e-mail quando o corpo depende de saída SKIPPED', async () => {
    const f = fixture('condition', { leftOperand: 'a', operator: 'equals', rightOperand: 'b' });
    f.w.nodes.push(
      { id: 'yes', type: 'internal_record', label: 'Fixture', position: { x: 200, y: 0 },
        config: { fieldMappings: { name: '{{form.contact_name}}', raw_message: '{{form.message_text}}' } } },
      { id: 'no', type: 'internal_record', label: 'Fixture', position: { x: 200, y: 100 },
        config: { fieldMappings: { name: '{{form.contact_name}}' } } },
      { id: 'mail', type: 'send_email', label: 'Fixture', position: { x: 300, y: 0 },
        config: { to: '{{form.contact_email}}', subject: 'Fixture', bodyTemplate: '{{yes.raw_message}}' } },
    );
    f.w.edges.push(
      { id: 'condition_yes', sourceNodeId: 'target', targetNodeId: 'yes', sourceHandle: 'true' },
      { id: 'condition_no', sourceNodeId: 'target', targetNodeId: 'no', sourceHandle: 'false' },
      { id: 'yes_mail', sourceNodeId: 'yes', targetNodeId: 'mail' },
      { id: 'no_mail', sourceNodeId: 'no', targetNodeId: 'mail' },
    );
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const mail = jest.spyOn(NodeExecutors, 'executeSendEmail');
    const result = await f.engine.simulate(f.w, { name: 'Fixture', email: 'contato@example.test', message: 'Fixture' });
    expect(result.status).toBe('FAILED');
    expect(result.nodeResults.find((node) => node.nodeId === 'yes')?.status).toBe('SKIPPED');
    expect(mail).not.toHaveBeenCalled();
  });
});

import { createTestResourceResolver } from '../../test/resource-fixtures';
import { BadRequestException, Logger } from '@nestjs/common';
import type { WorkflowDefinition } from '@flowmind/contracts';
import { getOutputFieldKind } from '@flowmind/contracts';
import type { PrismaService } from '../prisma/prisma.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { NodeExecutors } from './node-executors';
import {
  validateWorkflowAvailability,
  validateNoConvergence,
} from './workflow-reference.validation';

function definition(): WorkflowDefinition {
  const entries = [
    ['form', 'trigger_form', {}],
    ['ai', 'ai_analyze_intent', { inputPromptTemplate: '{{form.message_text}}', modelRef: 'test-approved-model' }],
    ['record', 'internal_record', { fieldMappings: { name: '{{form.contact_name}}', ambiguities: '{{ai.ambiguities}}' } }],
    ['condition', 'condition', { leftOperand: '{{ai.intent}}', operator: 'is_empty' }],
    ['http', 'http_request', { url: 'https://endpoint.example.invalid', method: 'GET' }],
    ['mail', 'send_email', { to: '{{form.contact_email}}', subject: 'Fixture', bodyTemplate: '{{ai.summary}}' }],
  ];
  const nodes = entries.map(([id, type, config]) => ({ id, type, config, label: 'Fixture', position: { x: 0, y: 0 } })) as WorkflowDefinition['nodes'];
  return { id: 'wf_refs', orgId: 'org_fixture', name: 'Fixture', schemaVersion: '1.0.0', version: 1,
    status: 'DRAFT', triggerNodeId: 'form', nodes,
    edges: nodes.slice(1).map((node, i) => ({ id: 'edge_' + i, sourceNodeId: nodes[i].id, targetNodeId: node.id })),
    createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z' };
}

type Edit = (w: WorkflowDefinition) => void;
const body = (template: string): Edit => (w) => { w.nodes[5].config.bodyTemplate = template; };
const cases: Array<[string, Edit]> = [
  ['produtor inexistente', body('{{missing.summary}}')],
  ['campo não declarado', body('{{form.output_inexistente}}')],
  ['saída antiga de interesse', body('{{ai.interest_level}}')],
  ['auto referência', body('{{mail.recipient}}')],
  ['produtor futuro no prompt', (w) => { w.nodes[1].config.inputPromptTemplate = '{{http.response_body}}'; }],
  ['subcampo de string', body('{{form.contact_name.child}}')],
  ['acesso reservado em JSON dinâmico', body('{{http.response_body.__proto__}}')],
  ['boolean exato em corpo string', body('{{condition.result}}')],
  ['número exato em corpo string', body('{{http.status_code}}')],
  ['array exato em corpo string', body('{{ai.ambiguities}}')],
  ['índice de array inválido', body('{{ai.ambiguities.00}}')],
  ['subcampo de item string', body('{{ai.ambiguities.0.child}}')],
  ['destinatário usa saída inexistente', (w) => { w.nodes[5].config.to = '{{form.output_inexistente}}'; }],
  ['boolean em header string', (w) => { w.nodes[4].config.headers = { 'X-Fixture': '{{condition.result}}' }; }],
  ['número em campo de registro string', (w) => { w.nodes[2].config.fieldMappings = { name: 'Fixture', raw_message: '{{ai.tokens_consumed}}' }; }],
  ['número em elemento de ambiguidades', (w) => { w.nodes[2].config.fieldMappings = { name: 'Fixture', ambiguities: ['{{ai.tokens_consumed}}'] }; }],
];

function serviceFixture(w: WorkflowDefinition, status: 'DRAFT' | 'REVIEWED') {
  const row = { ...w, status, createdAt: new Date(w.createdAt), updatedAt: new Date(w.updatedAt),
    reviewedBy: status === 'REVIEWED' ? 'admin_fixture' : null,
    reviewedAt: status === 'REVIEWED' ? new Date(w.updatedAt) : null };
  const workflow = { findFirst: jest.fn(async () => structuredClone(row)),
    updateMany: jest.fn(async ({ data }: { data: object }) => { Object.assign(row, data); return { count: 1 }; }) };
  const workflowVersion = { create: jest.fn(async ({ data }: { data: object }) => ({ id: 'snapshot', ...data })) };
  const prisma = { workflow, workflowVersion,
    $transaction: async (action: (tx: object) => Promise<unknown>) => action({ workflow, workflowVersion }) };
  return { service: new WorkflowsService(prisma as unknown as PrismaService, new WorkflowEngineService(createTestResourceResolver()), createTestResourceResolver()), workflow, workflowVersion };
}

describe('Referências antes de revisão/ativação', () => {
  describe.each(['review', 'publish'] as const)('%s', (operation) => {
    it.each(cases)('nega %s antes de escrever', async (_label, edit) => {
      const w = definition(); edit(w); const f = serviceFixture(w, operation === 'review' ? 'DRAFT' : 'REVIEWED');
      await expect(f.service[operation](w.orgId, w.id, 'admin_fixture')).rejects.toBeInstanceOf(BadRequestException);
      expect(f.workflow.updateMany).not.toHaveBeenCalled(); expect(f.workflowVersion.create).not.toHaveBeenCalled();
    });
  });

  it('erro não divulga produtor/campo privados inexistentes', async () => {
    const w = definition(); body('{{private-fixture.private-field}}')(w); const f = serviceFixture(w, 'DRAFT');
    let error: unknown;
    try { await f.service.review(w.orgId, w.id, 'admin_fixture'); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(BadRequestException);
    expect(JSON.stringify((error as BadRequestException).getResponse())).not.toMatch(/private-fixture|private-field/);
  });

  it.each(['{{ai.ambiguities.0}}', 'Itens {{ai.ambiguities.length}}', '{{http.response_body.target_url}}'])
    ('permite campo declarado/JSON dinâmico %s sem certificar todo payload', async (template) => {
      const w = definition(); body(template)(w); const f = serviceFixture(w, 'DRAFT');
      await expect(f.service.review(w.orgId, w.id, 'admin_fixture')).resolves.toBeDefined();
    });
});

describe('Catálogo de campos de saída', () => {
  it.each([
    ['ai_analyze_intent', 'ambiguities.0', 'string'],
    ['ai_analyze_intent', 'ambiguities.length', 'number'],
    ['ai_analyze_intent', 'ambiguities.00', null],
    ['ai_analyze_intent', 'ambiguities.0.child', null],
    ['trigger_form', 'contact_email.child', null],
    ['http_request', 'response_body.customer.email', 'json'],
    ['http_request', 'response_body.constructor', null],
    ['internal_record', 'persisted_at', 'string'],
    ['internal_record', 'simulated_at', 'string'],
  ] as const)('descreve %s.%s com alcance explícito', (type, fieldPath, expected) => {
    expect(getOutputFieldKind(type, fieldPath)).toBe(expected);
  });
});

describe('Referências antes da execução', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each(cases)('nega %s antes do primeiro nó', async (_label, edit) => {
    const w = definition(); edit(w); jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const form = jest.spyOn(NodeExecutors, 'executeTriggerForm');
    await expect(new WorkflowEngineService(createTestResourceResolver()).simulate(w, { name: 'Fixture', email: 'contato@example.test', message: 'Fixture' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(form).not.toHaveBeenCalled();
  });

  it('preserva interpolação textual, array exato e dados não reinterpretados como template', async () => {
    const w = definition();
    w.nodes[5].config.bodyTemplate = 'Resumo {{ai.summary}} / Resultado {{condition.result}} / HTTP {{http.status_code}} / {{ai.ambiguities}}';
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const result = await new WorkflowEngineService(createTestResourceResolver()).simulate(w, {
      name: 'Fixture', email: 'contato@example.test', message: 'Texto sintético {{private-fixture.secret}}',
    });
    expect(result.status).toBe('COMPLETED');
    expect(result.nodeResults.find((n) => n.nodeId === 'record')?.inputs.fieldMappings).toEqual({
      name: 'Fixture', ambiguities: expect.any(Array),
    });
    expect(result.nodeResults.at(-1)?.inputs.bodyTemplate).toContain('{{private-fixture.secret}}');
  });
});

describe('T03-S2b Opção A — Não convergência e disponibilidade de saídas', () => {
  it('validateNoConvergence rejeita nó com mais de uma aresta de entrada', () => {
    const edgesByTarget = new Map();
    edgesByTarget.set('mail', [
      { id: 'e1', sourceNodeId: 'ai', targetNodeId: 'mail' },
      { id: 'e2', sourceNodeId: 'record', targetNodeId: 'mail' },
    ]);
    expect(() => validateNoConvergence(edgesByTarget)).toThrow(BadRequestException);
  });

  it('validateNoConvergence permite nós com até uma aresta de entrada', () => {
    const edgesByTarget = new Map();
    edgesByTarget.set('ai', [{ id: 'e1', sourceNodeId: 'form', targetNodeId: 'ai' }]);
    edgesByTarget.set('mail', [{ id: 'e2', sourceNodeId: 'ai', targetNodeId: 'mail' }]);
    expect(() => validateNoConvergence(edgesByTarget)).not.toThrow();
  });

  it('validateWorkflowAvailability rejeita referência a saída opcional não mapeada pelo produtor (B5)', () => {
    const nodes = [
      { id: 'form', type: 'trigger_form', config: {} },
      { id: 'record', type: 'internal_record', config: { fieldMappings: { name: '{{form.contact_name}}' } } },
      { id: 'mail', type: 'send_email', config: { to: 'contato@example.test', bodyTemplate: '{{record.ai_summary}}' } },
    ] as any;
    expect(() => validateWorkflowAvailability(nodes)).toThrow(BadRequestException);
  });

  it('validateWorkflowAvailability rejeita referência a persisted_at incompatível com SIMULATION (B6)', () => {
    const nodes = [
      { id: 'form', type: 'trigger_form', config: {} },
      { id: 'record', type: 'internal_record', config: { fieldMappings: { name: '{{form.contact_name}}' } } },
      { id: 'mail', type: 'send_email', config: { to: 'contato@example.test', bodyTemplate: '{{record.persisted_at}}' } },
    ] as any;
    expect(() => validateWorkflowAvailability(nodes)).toThrow(BadRequestException);
  });

  it('validateWorkflowAvailability aceita saídas opcionais devidamente mapeadas no produtor', () => {
    const nodes = [
      { id: 'form', type: 'trigger_form', config: {} },
      { id: 'record', type: 'internal_record', config: { fieldMappings: { name: '{{form.contact_name}}', ai_summary: 'Resumo' } } },
      { id: 'mail', type: 'send_email', config: { to: 'contato@example.test', bodyTemplate: '{{record.ai_summary}}' } },
    ] as any;
    expect(() => validateWorkflowAvailability(nodes)).not.toThrow();
  });

  it('revisão/ativação nega convergência (B1) e aceita bifurcação sem join (B3)', async () => {
    // B1: convergência de ai e record em mail
    const wfB1: any = {
      id: 'wf_b1', orgId: 'org_fixture', schemaVersion: '1.0.0', version: 1, status: 'DRAFT', triggerNodeId: 'form',
      nodes: [
        { id: 'form', type: 'trigger_form', config: { requiredFields: ['name', 'email', 'message'] }, label: '', position: { x: 0, y: 0 } },
        { id: 'ai', type: 'ai_analyze_intent', config: { inputPromptTemplate: '{{form.message_text}}', modelRef: 'm' }, label: '', position: { x: 0, y: 0 } },
        { id: 'record', type: 'internal_record', config: { fieldMappings: { name: '{{form.contact_name}}' } }, label: '', position: { x: 0, y: 0 } },
        { id: 'mail', type: 'send_email', config: { to: '{{form.contact_email}}', subject: 'Sub', bodyTemplate: '{{ai.summary}}' }, label: '', position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: 'e1', sourceNodeId: 'form', targetNodeId: 'ai' },
        { id: 'e2', sourceNodeId: 'form', targetNodeId: 'record' },
        { id: 'e3', sourceNodeId: 'ai', targetNodeId: 'mail' },
        { id: 'e4', sourceNodeId: 'record', targetNodeId: 'mail' },
      ],
      createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z',
    };
    const fB1 = serviceFixture(wfB1, 'DRAFT');
    await expect(fB1.service.review(wfB1.orgId, wfB1.id, 'admin_fixture')).rejects.toThrow(BadRequestException);
    expect(fB1.workflow.updateMany).not.toHaveBeenCalled();

    // B3: condição com mail apenas no ramo yes (sem convergência)
    const wfB3: any = {
      id: 'wf_b3', orgId: 'org_fixture', schemaVersion: '1.0.0', version: 1, status: 'DRAFT', triggerNodeId: 'form',
      nodes: [
        { id: 'form', type: 'trigger_form', config: { requiredFields: ['name', 'email', 'message'] }, label: '', position: { x: 0, y: 0 } },
        { id: 'cond', type: 'condition', config: { leftOperand: '{{form.message_text}}', operator: 'equals', rightOperand: 'yes' }, label: '', position: { x: 0, y: 0 } },
        { id: 'yes', type: 'internal_record', config: { fieldMappings: { name: '{{form.contact_name}}', raw_message: '{{form.message_text}}' } }, label: '', position: { x: 0, y: 0 } },
        { id: 'no', type: 'internal_record', config: { fieldMappings: { name: '{{form.contact_name}}' } }, label: '', position: { x: 0, y: 0 } },
        { id: 'mail', type: 'send_email', config: { to: '{{form.contact_email}}', subject: 'Sub', bodyTemplate: '{{yes.raw_message}}' }, label: '', position: { x: 0, y: 0 } },
      ],
      edges: [
        { id: 'e1', sourceNodeId: 'form', targetNodeId: 'cond' },
        { id: 'e2', sourceNodeId: 'cond', targetNodeId: 'yes', sourceHandle: 'true' },
        { id: 'e3', sourceNodeId: 'cond', targetNodeId: 'no', sourceHandle: 'false' },
        { id: 'e4', sourceNodeId: 'yes', targetNodeId: 'mail' },
      ],
      createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z',
    };
    const fB3 = serviceFixture(wfB3, 'DRAFT');
    await expect(fB3.service.review(wfB3.orgId, wfB3.id, 'admin_fixture')).resolves.toBeDefined();
    expect(fB3.workflow.updateMany).toHaveBeenCalled();
  });
});


describe('T03-S2b Opção A — códigos de erro em revisão e ativação', () => {
  const converge: Edit = (w) => { w.edges.push({ id: 'edge_join', sourceNodeId: 'ai', targetNodeId: 'mail' }); };
  const ruleCases: Array<[string, Edit, string]> = [
    ['convergência', converge, 'WORKFLOW_CONVERGENCE_NOT_SUPPORTED'],
    ['saída opcional não mapeada', body('{{record.ai_summary}}'), 'OUTPUT_NOT_AVAILABLE'],
    ['mapeamento vazio', (w) => { (w.nodes[2].config.fieldMappings as Record<string, unknown>).ai_summary = '  ';
      body('{{record.ai_summary}}')(w); }, 'OUTPUT_NOT_AVAILABLE'],
    ['saída exclusiva de LIVE', body('{{record.persisted_at}}'), 'OUTPUT_MODE_INCOMPATIBLE'],
    ['causas mistas', body('{{record.ai_summary}} {{record.persisted_at}}'), 'WORKFLOW_INVALID_REFERENCE'],
    ['assunto ausente no produtor', (w) => { w.nodes[5].config.subject = '';
      w.nodes.push({ id: 'mail2', type: 'send_email', label: 'Fixture', position: { x: 0, y: 0 },
        config: { to: 'contato@example.test', subject: '{{mail.subject}}', bodyTemplate: 'Fixture' } });
      w.edges.push({ id: 'edge_mail2', sourceNodeId: 'mail', targetNodeId: 'mail2' }); }, 'OUTPUT_NOT_AVAILABLE'],
    ['lista em ai_summary (barrada já na config do nó)', (w) => { (w.nodes[2].config.fieldMappings as Record<string, unknown>).ai_summary = ['x'];
      body('{{record.ai_summary}}')(w); }, 'WORKFLOW_INVALID_NODE_CONFIG'],
  ];
  describe.each(['review', 'publish'] as const)('%s', (operation) => {
    it.each(ruleCases)('nega %s com código específico e zero escritas', async (_label, edit, code) => {
      const w = definition(); edit(w); const f = serviceFixture(w, operation === 'review' ? 'DRAFT' : 'REVIEWED');
      let error: unknown;
      try { await f.service[operation](w.orgId, w.id, 'admin_fixture'); } catch (caught) { error = caught; }
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code });
      expect(f.workflow.updateMany).not.toHaveBeenCalled(); expect(f.workflowVersion.create).not.toHaveBeenCalled();
    });
  });

  it('mantém WORKFLOW_INVALID_REFERENCE quando as causas são mistas, com issues específicas', () => {
    const w = definition(); body('{{record.ai_summary}} {{record.persisted_at}}')(w);
    let error: unknown;
    try { validateWorkflowAvailability(w.nodes); } catch (caught) { error = caught; }
    const response = (error as BadRequestException).getResponse() as { code: string; issues: Array<{ code: string }> };
    expect(response.code).toBe('WORKFLOW_INVALID_REFERENCE');
    expect(response.issues.map((issue) => issue.code).sort()).toEqual(['OUTPUT_MODE_INCOMPATIBLE', 'OUTPUT_NOT_AVAILABLE']);
  });

  it('aceita saída opcional na raiz da config, como o executor', () => {
    const w = definition(); w.nodes[2].config = { name: '{{form.contact_name}}', ai_summary: '{{ai.summary}}' };
    body('{{record.ai_summary}}')(w);
    expect(() => validateWorkflowAvailability(w.nodes)).not.toThrow();
  });

  it('nega send_email.subject sem assunto configurado no produtor', () => {
    const w = definition();
    w.nodes.push({ id: 'mail2', type: 'send_email', label: 'Fixture', position: { x: 0, y: 0 },
      config: { to: 'contato@example.test', subject: '{{mail.subject}}', bodyTemplate: 'Fixture' } });
    expect(() => validateWorkflowAvailability(w.nodes)).not.toThrow();
    w.nodes[5].config.subject = '';
    expect(() => validateWorkflowAvailability(w.nodes)).toThrow(expect.objectContaining({ response: expect.objectContaining({ code: 'OUTPUT_NOT_AVAILABLE' }) }));
  });

  it('DRAFT com convergência continua salvável', async () => {
    const w = definition(); const f = serviceFixture(w, 'DRAFT');
    const edges = [...w.edges, { id: 'edge_join', sourceNodeId: 'ai', targetNodeId: 'mail' }];
    await expect(f.service.update(w.orgId, w.id, { edges } as never)).resolves.toBeDefined();
  });
});

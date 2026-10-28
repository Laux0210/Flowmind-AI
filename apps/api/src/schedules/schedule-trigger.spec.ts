import { BadRequestException } from '@nestjs/common';
import type { WorkflowDefinition, NodeType } from '@flowmind/contracts';
import { WORKFLOW_SCHEMA_VERSION, getNodeConfigIssues, getOutputFieldKind } from '@flowmind/contracts';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import { createTestResourceResolver } from '../../test/resource-fixtures';
import { SchedulesService } from './schedules.service';
import { ScheduleTickConsumer } from './schedule-tick.consumer';
import { SchedulerService } from '../triggers/scheduler.service';
import type { PrismaService } from '../prisma/prisma.service';
import { WorkerService } from '../worker/worker.service';
import { ExecutionsService } from '../executions/executions.service';
import { AiGeneratorService } from '../ai/ai-generator.service';
import { DeterministicAiClient } from '../ai/deterministic-ai-client';

const scheduleType = 'trigger_schedule' as NodeType;
const scheduledAt = '2026-10-24T12:30:00.000Z';
const definition = (): WorkflowDefinition => ({
  schemaVersion: WORKFLOW_SCHEMA_VERSION, id: 'wf', orgId: 'org', name: 'Agenda', version: 1,
  status: 'PUBLISHED', triggerNodeId: 'start', nodes: [
    { id: 'start', type: scheduleType, label: 'Agendamento', config: {}, position: { x: 0, y: 0 } },
    { id: 'check', type: 'condition', label: 'Horário preservado', position: { x: 200, y: 0 },
      config: { leftOperand: '{{start.scheduledAt}}', operator: 'equals', rightOperand: scheduledAt } },
  ], edges: [{ id: 'edge', sourceNodeId: 'start', targetNodeId: 'check' }], createdAt: scheduledAt, updatedAt: scheduledAt,
});

describe('Contrato executável do gatilho de agendamento', () => {
  const engine = new WorkflowEngineService(createTestResourceResolver());
  it('preserva horário previsto e o disponibiliza ao próximo nó', async () => {
    const result = await engine.simulate(definition(), { scheduledAt });
    expect(result.status).toBe('COMPLETED');
    expect(result.nodeResults[0].outputs).toEqual({ scheduledAt });
    expect(result.nodeResults[1].outputs).toMatchObject({ result: true });
    expect(getOutputFieldKind(scheduleType, 'scheduledAt')).toBe('string');
  });
  it.each([undefined, '', 'amanhã', '2026-02-30T12:00:00.000Z', '2026-10-24T12:30:00+03:00', 123])(
    'registra falha de nó para horário inválido %s', async value => {
      const result = await engine.simulate(definition(), { scheduledAt: value });
      expect(result.status).toBe('FAILED');
      expect(result.nodeResults).toHaveLength(1);
      expect(result.nodeResults[0].error?.code).toBe('NODE_EXECUTION_FAILED');
    });
  it('configuração é fechada e não permite payload nem código', () => {
    expect(getNodeConfigIssues(scheduleType, {})).toEqual([]);
    expect(getNodeConfigIssues(scheduleType, { payload: 'x' })).toContainEqual({ field: 'config', code: 'UNKNOWN_FIELD' });
  });
  it('formulário continua exigindo dados de contato', async () => {
    const workflow = definition();
    workflow.nodes = [{ ...workflow.nodes[0], type: 'trigger_form', config: {} }]; workflow.edges = [];
    expect((await engine.simulate(workflow, { scheduledAt })).status).toBe('FAILED');
  });
});

describe('Elegibilidade de versões publicadas para agendamento', () => {
  let tx: { workflow: { findFirst: jest.Mock }; workflowVersion: { findFirst: jest.Mock };
    workflowSchedule: { count: jest.Mock; create: jest.Mock; findUnique: jest.Mock; updateMany: jest.Mock } };
  let prisma: PrismaService;
  beforeEach(() => {
    tx = { workflow: { findFirst: jest.fn().mockResolvedValue({ status: 'PUBLISHED' }) },
      workflowVersion: { findFirst: jest.fn().mockResolvedValue({ ...definition(), version: 3 }) },
      workflowSchedule: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({
        id: 'sc', workflowId: 'wf', cron: '0 * * * *', timezone: 'UTC', status: 'ACTIVE', createdAt: new Date(), revokedAt: null,
      }), findUnique: jest.fn().mockResolvedValue({ id: 'sc', workflowId: 'wf', orgId: 'org', status: 'ACTIVE',
        workflow: { status: 'PUBLISHED', orgId: 'org' } }), updateMany: jest.fn() } };
    prisma = { ...tx, $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)) } as unknown as PrismaService;
  });
  async function service() {
    const instance = new SchedulesService(prisma, new SchedulerService());
    await instance.onModuleDestroy(); instance.useSync(undefined); return instance;
  }
  it('aceita somente versão publicada compatível, não o rascunho atual', async () => {
    await expect((await service()).create('org', 'wf', 'admin', '0 * * * *')).resolves.toMatchObject({ status: 'ACTIVE' });
    expect(tx.workflowVersion.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { workflowId: 'wf' } }));
  });
  it.each(['form', 'absent', 'bad-config', 'bad-trigger'])('nega versão %s antes de gravar', async variant => {
    const snapshot = { ...definition() };
    if (variant === 'form') snapshot.nodes[0].type = 'trigger_form';
    if (variant === 'bad-config') snapshot.nodes[0].config = { code: 'x' };
    if (variant === 'bad-trigger') snapshot.triggerNodeId = 'missing';
    tx.workflowVersion.findFirst.mockResolvedValue(variant === 'absent' ? null : snapshot);
    await expect((await service()).create('org', 'wf', 'admin', '0 * * * *')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.workflowSchedule.create).not.toHaveBeenCalled();
  });
  it('não lê versões nem grava para outra organização', async () => {
    tx.workflow.findFirst.mockResolvedValue(null);
    await expect((await service()).create('other', 'wf', 'admin', '0 * * * *')).rejects.toThrow('Workflow não encontrado');
    expect(tx.workflowVersion.findFirst).not.toHaveBeenCalled();
    expect(tx.workflowSchedule.create).not.toHaveBeenCalled();
  });
  it('tick ignora versão incompatível sem alterar/revogar registro anterior', async () => {
    tx.workflowVersion.findFirst.mockResolvedValue({ ...definition(), nodes: [] });
    const enqueue = jest.fn(), set = jest.fn().mockResolvedValue('OK');
    const tick = new ScheduleTickConsumer(prisma, { enqueue }, { set, eval: jest.fn() }, { remove: jest.fn() });
    expect(await tick.tick('sc', Date.parse(scheduledAt))).toBe('incompatible');
    expect(enqueue).not.toHaveBeenCalled();
    expect(tx.workflowSchedule.updateMany).not.toHaveBeenCalled();
  });
  it('tick envia exatamente a versão elegível e payload fixo', async () => {
    const enqueue = jest.fn().mockResolvedValue({}), set = jest.fn().mockResolvedValue('OK');
    const tick = new ScheduleTickConsumer(prisma, { enqueue }, { set, eval: jest.fn() }, { remove: jest.fn() });
    expect(await tick.tick('sc', Date.parse(scheduledAt))).toBe('enqueued');
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ workflowVersion: 3, orgId: 'org', mode: 'SIMULATION', initialPayload: { scheduledAt } }));
  });
});

describe('Agendamento atravessa o motor e o registro de histórico', () => {
  const published = { ...definition(), workflowId: 'wf', version: 3 };
  const job = { jobId: 'job', workflowId: 'wf', orgId: 'org', userId: 'schedule_sc',
    scheduleId: 'sc', workflowVersion: 3, mode: 'SIMULATION' as const, initialPayload: { scheduledAt } };
  let findFirst: jest.Mock, versions: jest.Mock, record: jest.Mock, worker: WorkerService;
  beforeEach(() => {
    // A versão corrente deliberadamente diverge: formulário no rascunho, agendamento publicado.
    findFirst = jest.fn().mockResolvedValue({ ...definition(), version: 9,
      nodes: [{ ...definition().nodes[0], type: 'trigger_form' }], createdAt: new Date(), updatedAt: new Date() });
    versions = jest.fn().mockResolvedValue(published);
    record = jest.fn().mockImplementation(async (_org, _id, _version, _mode, status) => ({ id: 'exec', status }));
    worker = new WorkerService({ workflow: { findFirst }, workflowVersion: { findFirst: versions } } as unknown as PrismaService,
      new WorkflowEngineService(createTestResourceResolver()), { recordExecution: record } as unknown as ExecutionsService);
  });
  it('executa o snapshot fixado e registra versão/saídas corretas', async () => {
    expect((await worker.processJob(job)).status).toBe('COMPLETED');
    expect(versions).toHaveBeenCalledWith({ where: { workflowId: 'wf', version: 3 } });
    expect(record).toHaveBeenCalledWith('org', 'wf', 3, 'SIMULATION', 'COMPLETED', 'schedule_sc',
      expect.arrayContaining([expect.objectContaining({ nodeType: 'trigger_schedule', outputs: { scheduledAt } })]),
      expect.any(String), expect.any(String), expect.any(String));
  });
  it('payload inválido deixa FAILED no histórico sem executar o próximo nó', async () => {
    expect((await worker.processJob({ ...job, initialPayload: { scheduledAt: 'inválido' } })).status).toBe('FAILED');
    expect(record.mock.calls[0][4]).toBe('FAILED');
    expect(record.mock.calls[0][6]).toHaveLength(1);
  });
  it('nega versão inexistente e organização divergente antes do motor', async () => {
    versions.mockResolvedValue(null);
    await expect(worker.processJob(job)).rejects.toBeInstanceOf(BadRequestException);
    expect(record).not.toHaveBeenCalled();
    findFirst.mockResolvedValue(null); versions.mockClear();
    await expect(worker.processJob({ ...job, orgId: 'other' })).rejects.toThrow('Workflow não encontrado');
    expect(versions).not.toHaveBeenCalled();
  });
  it('nega LIVE e workflow desativado', async () => {
    await expect(worker.processJob({ ...job, mode: 'LIVE' })).rejects.toBeInstanceOf(BadRequestException);
    findFirst.mockResolvedValue({ ...definition(), status: 'DRAFT' });
    await expect(worker.processJob(job)).rejects.toBeInstanceOf(BadRequestException);
    expect(record).not.toHaveBeenCalled();
  });
});

describe('Geração local de agendamento, sem fornecedor externo', () => {
  const generator = new AiGeneratorService(createTestResourceResolver());
  it.each(['Para cada envio de formulário, sincronizar contato via webhook', 'Sincronizar contato recebido no formulário'])
    ('preserva o evento de formulário no pedido %s', async prompt => {
      const result = await new DeterministicAiClient().generateWorkflow(prompt, 'org');
      expect(result.draft.nodes[0].type).toBe('trigger_form');
    });
  it.each(['A cada 15 minutos, executar', 'Todo dia, executar'])('reconhece frequência temporal %s', async prompt => {
    const result = await new DeterministicAiClient().generateWorkflow(prompt, 'org');
    expect(result.draft.nodes[0].type).toBe('trigger_schedule');
  });
  it('gera gatilho sem inventar contatos, cron ou ativar o fluxo', async () => {
    const result = await generator.generateFromNaturalLanguage({ prompt: 'Executar diariamente por agendamento' }, 'org');
    expect(result.workflow.nodes).toHaveLength(1);
    expect(result.workflow.nodes[0]).toMatchObject({ type: 'trigger_schedule', config: {} });
    expect(result.requiresHumanReview).toBe(true);
    expect(result.tokensConsumed).toBe(0);
  });
  it('destinatário de e-mail continua pendente para revisão humana', async () => {
    const result = await generator.generateFromNaturalLanguage({ prompt: 'Agendar diariamente e enviar e-mail' }, 'org');
    expect(result.workflow.nodes.find(node => node.type === 'send_email')?.config.to).toBe('');
    expect(result.warnings?.some(warning => warning.includes('destinatário'))).toBe(true);
  });
});

import 'reflect-metadata';
import { Server } from 'node:net';
import { Test, TestingModule } from '@nestjs/testing';
import { WORKFLOW_SCHEMA_VERSION } from '@flowmind/contracts';
import { WorkerModule } from './worker.module';
import { WorkerService } from './worker.service';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import { ExecutionsService } from '../executions/executions.service';
import { PrismaService } from '../prisma/prisma.service';

// DI/motor/registro reais, somente storage sintético. Sem servidor ou fila.
describe('WorkerModule — contexto Nest sem portas nem efeitos externos', () => {
  let context: TestingModule;
  let service: WorkerService;
  let engine: WorkflowEngineService;
  let listen: jest.SpyInstance;
  let fetch: jest.SpyInstance;
  const executions: any[] = [];
  const workflows = new Map<string, any>();
  const prisma = {
    workflow: { findFirst: jest.fn(async ({ where }: any) => {
      const row = workflows.get(where.id);
      return row?.orgId === where.orgId ? row : null;
    }) },
    workflowExecution: {
      create: jest.fn(async ({ data }: any) => { executions.push(data); return data; }),
      count: jest.fn(),
    },
  };

  beforeAll(async () => {
    listen = jest.spyOn(Server.prototype, 'listen').mockImplementation(() => {
      throw new Error('Portas são proibidas neste teste');
    });
    fetch = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Rede é proibida neste teste'));
    context = await Test.createTestingModule({ imports: [WorkerModule] })
      .overrideProvider(PrismaService).useValue(prisma).compile();
    await context.init();
    service = context.get(WorkerService);
    engine = context.get(WorkflowEngineService);
  });

  beforeEach(() => {
    executions.length = 0;
    prisma.workflow.findFirst.mockClear();
    prisma.workflowExecution.create.mockClear();
    workflows.clear();
    for (const org of ['alpha', 'beta']) {
      workflows.set(`wf_${org}`, {
        id: `wf_${org}`, orgId: `org_${org}`, schemaVersion: WORKFLOW_SCHEMA_VERSION,
        name: 'Fixture', version: 1, status: 'DRAFT', triggerNodeId: 'form',
        nodes: [{ id: 'form', type: 'trigger_form', label: 'Form', position: { x: 0, y: 0 }, config: {} }],
        edges: [], createdAt: new Date(), updatedAt: new Date(),
      });
    }
  });

  afterAll(async () => {
    await context?.close();
    expect(listen).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    listen.mockRestore();
    fetch.mockRestore();
  });

  it('resolve providers reais e permanece em standby', () => {
    expect(context.get(PrismaService)).toBe(prisma);
    expect(engine).toBeInstanceOf(WorkflowEngineService);
    expect(context.get(ExecutionsService)).toBeInstanceOf(ExecutionsService);
    expect(service.isWorkerRunning()).toBe(false);
  });

  it.each(['alpha', 'beta'])('simulação de %s preserva modo, organização, autoria e ID', async (org) => {
    const result = await service.processJob({
      jobId: `job_${org}`, workflowId: `wf_${org}`, orgId: `org_${org}`,
      userId: `user_${org}`, mode: 'SIMULATION',
      initialPayload: { name: 'Fixture', email: 'fixture@example.test', message: 'Fixture' },
    });
    expect(result.status).toBe('COMPLETED');
    expect(executions).toHaveLength(1);
    expect(executions[0]).toMatchObject({
      id: result.executionId, mode: 'SIMULATION', orgId: `org_${org}`,
      workflowId: `wf_${org}`, workflowVersion: 1, triggeredBy: `user_${org}`,
    });
  });

  it('nega workflow alheio antes de simular ou persistir', async () => {
    const simulate = jest.spyOn(engine, 'simulate');
    try {
      await expect(service.processJob({
        jobId: 'job_cross', workflowId: 'wf_alpha', orgId: 'org_beta',
        userId: 'user_beta', mode: 'SIMULATION', initialPayload: {},
      })).rejects.toMatchObject({ status: 404 });
      expect(simulate).not.toHaveBeenCalled();
      expect(executions).toHaveLength(0);
    } finally { simulate.mockRestore(); }
  });

  it('LIVE não consulta o banco nem se transforma em sucesso simulado', async () => {
    const simulate = jest.spyOn(engine, 'simulate');
    try {
      await expect(service.processJob({
        jobId: 'job_live', workflowId: 'wf_alpha', orgId: 'org_alpha',
        userId: 'user_alpha', mode: 'LIVE', initialPayload: {},
      })).rejects.toMatchObject({ status: 400 });
      expect(prisma.workflow.findFirst).not.toHaveBeenCalled();
      expect(simulate).not.toHaveBeenCalled();
      expect(executions).toHaveLength(0);
    } finally { simulate.mockRestore(); }
  });

  it('falha de gravação retorna 503 genérico, sem registro fictício', async () => {
    prisma.workflowExecution.create.mockRejectedValueOnce(new Error('private_write_fixture'));
    const error = await service.processJob({
      jobId: 'job_write', workflowId: 'wf_alpha', orgId: 'org_alpha',
      userId: 'user_alpha', mode: 'SIMULATION', initialPayload: {},
    }).catch((failure) => failure);
    expect(error.getStatus()).toBe(503);
    expect(JSON.stringify(error.getResponse())).not.toContain('private_write_fixture');
    expect(executions).toHaveLength(0);
  });

  it('entrada incompleta conserva resultado FAILED e modo SIMULATION no histórico', async () => {
    const result = await service.processJob({
      jobId: 'job_failed', workflowId: 'wf_alpha', orgId: 'org_alpha',
      userId: 'user_alpha', mode: 'SIMULATION', initialPayload: {},
    });
    expect(result.status).toBe('FAILED');
    expect(executions[0]).toMatchObject({ id: result.executionId, mode: 'SIMULATION', status: 'FAILED' });
    expect(executions[0].nodeResults[0].status).toBe('FAILED');
  });
});

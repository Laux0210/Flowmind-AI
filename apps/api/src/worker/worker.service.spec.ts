import { WorkerService, WorkflowJobData } from './worker.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import { ExecutionsService } from '../executions/executions.service';

describe('WorkerService (T05 — Background Worker sem HTTP)', () => {
  let workerService: WorkerService;
  let mockPrisma: any;
  let mockEngine: any;
  let mockExecutions: any;

  beforeEach(() => {
    mockPrisma = {
      workflow: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'wf_worker_1',
          orgId: 'org_test',
          name: 'Workflow Worker',
          version: 1,
          schemaVersion: '1.0.0',
          triggerNodeId: 'trigger_1',
          nodes: [{ id: 'trigger_1', type: 'trigger_form', config: {} }],
          edges: [],
          status: 'PUBLISHED',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
    };

    mockEngine = {
      simulate: jest.fn().mockResolvedValue({
        executionId: 'exec_sim_job_1',
        status: 'COMPLETED',
        totalDurationMs: 15,
        nodeResults: [
          {
            nodeId: 'trigger_1',
            nodeType: 'trigger_form',
            status: 'SUCCESS',
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            inputs: {},
            outputs: { lead_name: 'Teste' },
          },
        ],
      }),
    };

    mockExecutions = {
      recordExecution: jest.fn().mockResolvedValue({
        id: 'exec_recorded_job_1',
        orgId: 'org_test',
        workflowId: 'wf_worker_1',
        workflowVersion: 1,
        mode: 'SIMULATION',
        status: 'COMPLETED',
        triggeredBy: 'user_worker',
        nodeResults: [],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      }),
    };

    workerService = new WorkerService(
      mockPrisma as PrismaService,
      mockEngine as WorkflowEngineService,
      mockExecutions as ExecutionsService,
    );
  });

  it('permanece em standby sem consumidor de fila, mesmo com REDIS_HOST configurado', async () => {
    const original = process.env.REDIS_HOST;
    process.env.REDIS_HOST = 'redis-fixture.invalid';
    try {
      expect(workerService.isWorkerRunning()).toBe(false);
      await workerService.onModuleInit();
      expect(workerService.isWorkerRunning()).toBe(false);

      await workerService.onModuleDestroy();
      expect(workerService.isWorkerRunning()).toBe(false);
    } finally {
      if (original === undefined) delete process.env.REDIS_HOST;
      else process.env.REDIS_HOST = original;
    }
  });

  it('deve processar job de execução assíncrona com sucesso', async () => {
    await workerService.onModuleInit();

    const jobData: WorkflowJobData = {
      jobId: 'job_123',
      workflowId: 'wf_worker_1',
      orgId: 'org_test',
      userId: 'user_worker',
      initialPayload: { email: 'worker@test.com' },
      mode: 'SIMULATION',
    };

    const result = await workerService.processJob(jobData);

    expect(result).toBeDefined();
    expect(result.executionId).toBe('exec_recorded_job_1');
    expect(result.status).toBe('COMPLETED');
    expect(mockEngine.simulate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'wf_worker_1' }),
      jobData.initialPayload,
    );
    expect(mockExecutions.recordExecution).toHaveBeenCalledWith(
      'org_test',
      'wf_worker_1',
      1,
      'SIMULATION',
      'COMPLETED',
      'user_worker',
      expect.any(Array),
      expect.any(String),
      expect.any(String),
      'exec_sim_job_1',
    );
  });

  it('deve rejeitar job se o workflow não for encontrado para a organização ativa', async () => {
    mockPrisma.workflow.findFirst.mockResolvedValue(null);

    const jobData: WorkflowJobData = {
      jobId: 'job_404',
      workflowId: 'wf_missing',
      orgId: 'org_test',
      userId: 'user_worker',
      initialPayload: {},
      mode: 'SIMULATION',
    };

    await expect(workerService.processJob(jobData)).rejects.toThrow(
      /Workflow não encontrado para a organização ativa: wf_missing/,
    );
    expect(mockEngine.simulate).not.toHaveBeenCalled();
    expect(mockExecutions.recordExecution).not.toHaveBeenCalled();
  });

  it('bloqueia LIVE antes de consultar storage, simular ou registrar consumo', async () => {
    const job: WorkflowJobData = {
      jobId: 'job_live', workflowId: 'wf_worker_1', orgId: 'org_test',
      userId: 'user_worker', initialPayload: {}, mode: 'LIVE',
    };
    await expect(workerService.processJob(job)).rejects.toThrow(/LIVE.*não implementada/);
    expect(mockPrisma.workflow.findFirst).not.toHaveBeenCalled();
    expect(mockEngine.simulate).not.toHaveBeenCalled();
    expect(mockExecutions.recordExecution).not.toHaveBeenCalled();
  });

  it.each([null, undefined, [], {}, {
    jobId: 'job_invalid', workflowId: 'wf_worker_1', orgId: 'org_test',
    userId: 'user_worker', initialPayload: {}, mode: 'UNKNOWN',
  }, {
    jobId: 'job_invalid', workflowId: 'wf_worker_1', orgId: 'org_test',
    userId: 'user_worker', initialPayload: [], mode: 'SIMULATION',
  }, {
    jobId: ' ', workflowId: 'wf_worker_1', orgId: 'org_test',
    userId: 'user_worker', initialPayload: {}, mode: 'SIMULATION',
  }])('rejeita contrato de job inválido sem acessar providers (%j)', async (job) => {
    await expect(workerService.processJob(job as WorkflowJobData)).rejects.toThrow();
    expect(mockPrisma.workflow.findFirst).not.toHaveBeenCalled();
    expect(mockEngine.simulate).not.toHaveBeenCalled();
    expect(mockExecutions.recordExecution).not.toHaveBeenCalled();
  });

  it('fixa organização, autoria e modo antes de aguardar o storage', async () => {
    let release!: (row: any) => void;
    const row = await mockPrisma.workflow.findFirst();
    mockPrisma.workflow.findFirst.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const job: WorkflowJobData = {
      jobId: 'job_mutable', workflowId: 'wf_worker_1', orgId: 'org_test',
      userId: 'user_worker', initialPayload: {}, mode: 'SIMULATION',
    };
    const pending = workerService.processJob(job);
    Object.assign(job, { mode: 'LIVE', orgId: 'org_other', userId: 'user_other' });
    release(row);
    await pending;
    expect(mockExecutions.recordExecution.mock.calls[0].slice(0, 6)).toEqual([
      'org_test', 'wf_worker_1', 1, 'SIMULATION', 'COMPLETED', 'user_worker',
    ]);
  });

  it('rejeita vínculo inconsistente retornado pelo storage antes do motor', async () => {
    const row = await mockPrisma.workflow.findFirst();
    mockPrisma.workflow.findFirst.mockResolvedValue({ ...row, orgId: 'org_other' });
    await expect(workerService.processJob({
      jobId: 'job_cross', workflowId: 'wf_worker_1', orgId: 'org_test',
      userId: 'user_worker', initialPayload: {}, mode: 'SIMULATION',
    })).rejects.toThrow();
    expect(mockEngine.simulate).not.toHaveBeenCalled();
    expect(mockExecutions.recordExecution).not.toHaveBeenCalled();
  });

  it('oculta erro privado do storage e não executa o motor', async () => {
    mockPrisma.workflow.findFirst.mockRejectedValue(new Error('private_db_fixture'));
    try {
      await workerService.processJob({
        jobId: 'job_storage', workflowId: 'wf_worker_1', orgId: 'org_test',
        userId: 'user_worker', initialPayload: {}, mode: 'SIMULATION',
      });
      throw new Error('A consulta deveria falhar');
    } catch (error: any) {
      expect(error.getStatus()).toBe(503);
      expect(JSON.stringify(error.getResponse())).not.toContain('private_db_fixture');
    }
    expect(mockEngine.simulate).not.toHaveBeenCalled();
    expect(mockExecutions.recordExecution).not.toHaveBeenCalled();
  });

  describe('Fila em memória, Idempotência e Retries (T05/T12)', () => {
    it('enfileira job válido e consome com sucesso atualizando métricas', async () => {
      const enqueueRes = await workerService.enqueueJob({
        jobId: 'job_queue_1',
        workflowId: 'wf_worker_1',
        orgId: 'org_test',
        userId: 'user_worker',
        initialPayload: { message: 'Fila' },
        mode: 'SIMULATION',
        idempotencyKey: 'idem_key_1',
      });

      expect(enqueueRes.enqueued).toBe(true);
      expect(enqueueRes.isDuplicate).toBe(false);

      const metricsBefore = workerService.getQueueMetrics();
      expect(metricsBefore.pendingJobs).toBe(1);
      expect(metricsBefore.completedJobs).toBe(0);

      const processed = await workerService.processNextJob();
      expect(processed).toBeDefined();
      expect(processed?.jobId).toBe('job_queue_1');
      expect(processed?.status).toBe('COMPLETED');

      const metricsAfter = workerService.getQueueMetrics();
      expect(metricsAfter.pendingJobs).toBe(0);
      expect(metricsAfter.completedJobs).toBe(1);
      expect(metricsAfter.failedJobs).toBe(0);
    });

    it('deduplica jobs com a mesma chave de idempotência para a mesma organização', async () => {
      const first = await workerService.enqueueJob({
        jobId: 'job_idem_first',
        workflowId: 'wf_worker_1',
        orgId: 'org_test',
        userId: 'user_worker',
        initialPayload: {},
        mode: 'SIMULATION',
        idempotencyKey: 'idem_unique_key',
      });
      expect(first.enqueued).toBe(true);

      const second = await workerService.enqueueJob({
        jobId: 'job_idem_second',
        workflowId: 'wf_worker_1',
        orgId: 'org_test',
        userId: 'user_worker',
        initialPayload: {},
        mode: 'SIMULATION',
        idempotencyKey: 'idem_unique_key',
      });
      expect(second.enqueued).toBe(false);
      expect(second.isDuplicate).toBe(true);
      expect(second.jobId).toBe('job_idem_first');
    });

    it('permite a mesma chave de idempotência para organizações distintas (multi-tenant)', async () => {
      const orgA = await workerService.enqueueJob({
        jobId: 'job_org_a',
        workflowId: 'wf_worker_1',
        orgId: 'org_a',
        userId: 'user_a',
        initialPayload: {},
        mode: 'SIMULATION',
        idempotencyKey: 'shared_key',
      });
      const orgB = await workerService.enqueueJob({
        jobId: 'job_org_b',
        workflowId: 'wf_worker_1',
        orgId: 'org_b',
        userId: 'user_b',
        initialPayload: {},
        mode: 'SIMULATION',
        idempotencyKey: 'shared_key',
      });
      expect(orgA.enqueued).toBe(true);
      expect(orgB.enqueued).toBe(true);
      expect(orgA.jobId).not.toBe(orgB.jobId);
    });

    it('re-enfileira job quando falha é temporária (ServiceUnavailableException) respeitando maxRetries', async () => {
      mockPrisma.workflow.findFirst.mockRejectedValue(new Error('db_temp_error'));

      await workerService.enqueueJob({
        jobId: 'job_retry_test',
        workflowId: 'wf_worker_1',
        orgId: 'org_test',
        userId: 'user_worker',
        initialPayload: {},
        mode: 'SIMULATION',
        maxRetries: 2,
        attempt: 1,
      });

      // Tentativa 1: falha temporária -> re-enfileirado com attempt 2
      const res1 = await workerService.processNextJob();
      expect(res1?.status).toBe('FAILED');
      let jobRecord = workerService.queue.getJob('job_retry_test');
      expect(jobRecord?.status).toBe('RETRYING');
      expect(jobRecord?.payload.attempt).toBe(2);

      // Tentativa 2: atinge maxRetries -> FAILED terminal
      const res2 = await workerService.processNextJob();
      expect(res2?.status).toBe('FAILED');
      jobRecord = workerService.queue.getJob('job_retry_test');
      expect(jobRecord?.status).toBe('FAILED');
      expect(workerService.queue.getQueueLength()).toBe(0);
    });

    it('inicia e para o consumidor local sem vazar timers', () => {
      expect(workerService.isWorkerRunning()).toBe(false);
      workerService.startConsumer(50);
      expect(workerService.isWorkerRunning()).toBe(true);

      workerService.stopConsumer();
      expect(workerService.isWorkerRunning()).toBe(false);
    });
  });
});

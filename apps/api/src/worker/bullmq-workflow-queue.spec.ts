import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { WorkflowJobPayload } from '@flowmind/contracts';
import type { WorkerService } from './worker.service';
import { BullMqWorkflowQueue, backoffDelayMs, isTransientFailure, workflowJobId, WORKFLOW_QUEUE_POLICY } from './bullmq-workflow-queue';

const payload = (event: string): WorkflowJobPayload => ({ jobId: `job-${event}`, workflowId: 'wf_fixture', workflowVersion: 2,
  orgId: 'org_fixture', userId: 'user_fixture', mode: 'SIMULATION', initialPayload: { message: 'Fixture' }, idempotencyKey: event });

describe('Política da fila T12', () => {
  it('repete só falhas transitórias', () => {
    expect(isTransientFailure(new ServiceUnavailableException())).toBe(true);
    expect(isTransientFailure(Object.assign(new Error('rede'), { code: 'ECONNRESET' }))).toBe(true);
    expect(isTransientFailure(Object.assign(new Error('tempo'), { name: 'TimeoutError' }))).toBe(true);
    expect(isTransientFailure(new BadRequestException())).toBe(false);
    expect(isTransientFailure(new NotFoundException())).toBe(false);
    expect(isTransientFailure(new Error('genérico'))).toBe(false);
    expect(isTransientFailure(Object.assign(new Error('db'), { code: 'P1001' }))).toBe(true);
    expect(isTransientFailure(Object.assign(new Error('único'), { code: 'P2002' }))).toBe(false);
  });

  it('usa backoff 5 s/25 s/125 s e 3 tentativas com concorrência 5', () => {
    expect([1, 2, 3, 9].map((n) => backoffDelayMs(n))).toEqual([5_000, 25_000, 125_000, 125_000]);
    expect(WORKFLOW_QUEUE_POLICY).toMatchObject({ attempts: 3, concurrency: 5 });
  });

  it('gera jobId determinístico por versão e evento, sem ":"', () => {
    expect(workflowJobId(payload('evt:1'))).toBe('org_fixture-wf_fixture-v2-evt_1');
    expect(workflowJobId({ ...payload('evt:1'), orgId: 'org_outra' })).not.toBe(workflowJobId(payload('evt:1')));
    expect(workflowJobId({ ...payload('evt:1'), workflowVersion: 3 })).not.toBe(workflowJobId(payload('evt:1')));
  });
});

// Redis real: FLOWMIND_REDIS_INTEGRATION=1 e REDIS_HOST de uma instância descartável.
const run = process.env.FLOWMIND_REDIS_INTEGRATION === '1' ? describe : describe.skip;
run('BullMQ sobre Redis real', () => {
  const connection = { host: process.env.REDIS_HOST ?? '127.0.0.1', port: Number(process.env.REDIS_PORT) || 6379 };
  const policy = { attempts: 3, delaysMs: [50, 100, 150], concurrency: 5 };
  let queueName: string;
  let queue: BullMqWorkflowQueue | undefined;

  function fixture(processJob: jest.Mock) {
    queueName = `flowmind-it-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const service = { processJob, recordExhaustedFailure: jest.fn().mockResolvedValue(undefined) };
    queue = new BullMqWorkflowQueue(service as unknown as WorkerService, connection, policy, queueName);
    queue.start();
    return service;
  }
  const until = async (check: () => boolean) => {
    for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 50));
    expect(check()).toBe(true);
  };

  afterEach(async () => {
    await queue?.close();
    const admin = new Queue(queueName, { connection });
    await admin.obliterate({ force: true }); await admin.close();
  });

  it('repete falha transitória e conclui na terceira tentativa', async () => {
    const processJob = jest.fn()
      .mockRejectedValueOnce(new ServiceUnavailableException()).mockRejectedValueOnce(new ServiceUnavailableException())
      .mockResolvedValue({ executionId: 'exec', status: 'COMPLETED' });
    const service = fixture(processJob);
    await queue!.enqueue(payload('ok'));
    await until(() => processJob.mock.results.filter((r) => r.type === 'return').length === 3);
    await new Promise((r) => setTimeout(r, 100));
    expect(processJob.mock.calls.map(([job]) => job.attempt)).toEqual([1, 2, 3]);
    expect(service.recordExhaustedFailure).not.toHaveBeenCalled();
  });

  it('esgota 3 tentativas transitórias e registra FAILED uma vez', async () => {
    const service = fixture(jest.fn().mockRejectedValue(new ServiceUnavailableException()));
    await queue!.enqueue(payload('down'));
    await until(() => service.recordExhaustedFailure.mock.calls.length === 1);
    expect(service.processJob).toHaveBeenCalledTimes(3);
  });

  it('não repete validação nem registra falha final', async () => {
    const service = fixture(jest.fn().mockRejectedValue(new BadRequestException('inválido')));
    await queue!.enqueue(payload('bad'));
    await until(() => service.processJob.mock.calls.length === 1);
    await new Promise((r) => setTimeout(r, 400));
    expect(service.processJob).toHaveBeenCalledTimes(1);
    expect(service.recordExhaustedFailure).not.toHaveBeenCalled();
  });

  it('mesmo evento enfileirado duas vezes executa uma vez', async () => {
    const service = fixture(jest.fn().mockResolvedValue({ executionId: 'exec', status: 'COMPLETED' }));
    const first = await queue!.enqueue(payload('dup'));
    const second = await queue!.enqueue(payload('dup'));
    expect(second).toEqual({ jobId: first.jobId, isDuplicate: true });
    await until(() => service.processJob.mock.calls.length === 1);
    await new Promise((r) => setTimeout(r, 300));
    expect(service.processJob).toHaveBeenCalledTimes(1);
  });
});
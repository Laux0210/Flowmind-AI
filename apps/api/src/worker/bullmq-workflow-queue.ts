import { HttpException, Logger } from '@nestjs/common';
import { Queue, UnrecoverableError, Worker } from 'bullmq';
import type { Job } from 'bullmq';
import type { WorkflowJobPayload } from '@flowmind/contracts';
import { isValidWorkflowJobPayload } from '@flowmind/contracts';
import type { WorkerService } from './worker.service';

export const WORKFLOW_QUEUE_NAME = 'flowmind-workflow-jobs';

// Política aprovada em 23/10/2026 (PROJECT_CONTEXT, T12): 3 tentativas totais, backoff 5 s/25 s/125 s, concorrência 5.
export const WORKFLOW_QUEUE_POLICY = { attempts: 3, delaysMs: [5_000, 25_000, 125_000], concurrency: 5 };

const TRANSIENT_NETWORK_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'EPIPE', 'ENOTFOUND']);
// Prisma: banco inacessível, timeout de conexão/operação ou conexão encerrada.
const TRANSIENT_PRISMA_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

export interface RedisConnection { host: string; port: number; password?: string }

/** Falhas transitórias (timeout, 5xx, rede) são repetidas; validação e 4xx nunca. */
export function isTransientFailure(error: unknown): boolean {
  if (error instanceof HttpException) return error.getStatus() >= 500;
  if (!error || typeof error !== 'object') return false;
  const { code, name } = error as { code?: unknown; name?: unknown };
  return (typeof code === 'string' && (TRANSIENT_NETWORK_CODES.has(code) || TRANSIENT_PRISMA_CODES.has(code))) ||
    name === 'TimeoutError' || name === 'AbortError' || name === 'PrismaClientInitializationError';
}

export function backoffDelayMs(attemptsMade: number, delaysMs = WORKFLOW_QUEUE_POLICY.delaysMs): number {
  return delaysMs[Math.min(Math.max(attemptsMade, 1), delaysMs.length) - 1];
}

/** jobId determinístico: organização + workflow + versão + evento de entrada. BullMQ não aceita ':' no id. */
export function workflowJobId(payload: WorkflowJobPayload): string {
  const event = payload.idempotencyKey ?? payload.jobId;
  return `${payload.orgId}-${payload.workflowId}-v${payload.workflowVersion ?? 'current'}-${event}`.replace(/:/g, '_');
}

async function enqueueWorkflowJob(queue: Queue<WorkflowJobPayload>, payload: WorkflowJobPayload, attempts: number) {
  if (!isValidWorkflowJobPayload(payload)) throw new UnrecoverableError('QUEUE_INVALID_JOB_CONTRACT');
  const jobId = workflowJobId(payload);
  if (await queue.getJob(jobId)) return { jobId, isDuplicate: true };
  await queue.add('workflow', { ...payload, jobId }, {
    jobId, attempts, backoff: { type: 'flowmind' },
    removeOnComplete: { count: 1000 }, removeOnFail: { count: 1000 },
  });
  return { jobId, isDuplicate: false };
}

/** Produtor sem consumidor: usado pela API para enfileirar disparos. */
export class WorkflowJobProducer {
  private readonly queue: Queue<WorkflowJobPayload>;
  private readonly attempts: number;

  constructor(connection: RedisConnection, attempts = WORKFLOW_QUEUE_POLICY.attempts, queueName = WORKFLOW_QUEUE_NAME) {
    this.attempts = attempts;
    this.queue = new Queue<WorkflowJobPayload>(queueName, { connection });
  }

  enqueue(payload: WorkflowJobPayload): Promise<{ jobId: string; isDuplicate: boolean }> {
    return enqueueWorkflowJob(this.queue, payload, this.attempts);
  }

  close(): Promise<void> {
    return this.queue.close();
  }
}

export class BullMqWorkflowQueue {
  private readonly logger = new Logger(BullMqWorkflowQueue.name);
  private readonly queue: Queue<WorkflowJobPayload>;
  private worker?: Worker<WorkflowJobPayload>;
  private finishedHook?: (data: WorkflowJobPayload) => Promise<void>;

  private readonly service: WorkerService;
  private readonly connection: RedisConnection;
  private readonly policy: typeof WORKFLOW_QUEUE_POLICY;
  private readonly queueName: string;

  constructor(service: WorkerService, connection: RedisConnection, policy = WORKFLOW_QUEUE_POLICY, queueName = WORKFLOW_QUEUE_NAME) {
    this.service = service;
    this.connection = connection;
    this.policy = policy;
    this.queueName = queueName;
    this.queue = new Queue<WorkflowJobPayload>(queueName, { connection });
  }

  async enqueue(payload: WorkflowJobPayload): Promise<{ jobId: string; isDuplicate: boolean }> {
    return enqueueWorkflowJob(this.queue, payload, this.policy.attempts);
  }

  /** Chamado uma vez por job ao concluir ou falhar em definitivo (ex.: liberar trava de agendamento). */
  onJobFinished(hook: (data: WorkflowJobPayload) => Promise<void>): void {
    this.finishedHook = hook;
  }

  start(): void {
    if (this.worker) return;
    this.worker = new Worker<WorkflowJobPayload>(this.queueName, (job) => this.process(job), {
      connection: this.connection,
      concurrency: this.policy.concurrency,
      settings: { backoffStrategy: (attemptsMade: number) => backoffDelayMs(attemptsMade, this.policy.delaysMs) },
    });
    this.worker.on('failed', (job, error) => { if (job) void this.onFailed(job, error); });
    this.worker.on('completed', (job) => void this.finish(job.data));
    this.worker.on('error', (error) => this.logger.error(`Erro de conexão da fila: ${error.message}`));
  }

  private async process(job: Job<WorkflowJobPayload>) {
    try {
      return await this.service.processJob({ ...job.data, attempt: job.attemptsMade + 1 });
    } catch (error) {
      if (isTransientFailure(error)) throw error;
      throw new UnrecoverableError(error instanceof Error ? error.message : 'Falha não repetível');
    }
  }

  private async onFailed(job: Job<WorkflowJobPayload>, error: Error): Promise<void> {
    const exhausted = !(error instanceof UnrecoverableError) && job.attemptsMade >= this.policy.attempts;
    this.logger.warn(`Job [${job.id}] falhou na tentativa ${job.attemptsMade}${exhausted ? '; tentativas esgotadas' : ''}.`);
    if (exhausted) await this.service.recordExhaustedFailure(job.data).catch(() =>
      this.logger.error(`Não foi possível registrar a falha final do job [${job.id}].`));
    if (exhausted || error instanceof UnrecoverableError) await this.finish(job.data);
  }

  private async finish(data: WorkflowJobPayload): Promise<void> {
    await this.finishedHook?.(data).catch(() => this.logger.error('Falha no encerramento do job.'));
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
  }
}
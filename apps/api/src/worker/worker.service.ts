import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import type { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type {
  WorkflowJobPayload,
  WorkflowJobResult,
  QueueMetrics,
} from '@flowmind/contracts';
import { isValidWorkflowJobPayload } from '@flowmind/contracts';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import { ExecutionsService } from '../executions/executions.service';
import { PrismaService } from '../prisma/prisma.service';
import { hasScheduleTrigger } from '../schedules/schedule-compatibility';
import { InMemoryJobQueue } from './in-memory-job-queue';

export type WorkflowJobData = WorkflowJobPayload;

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private readonly prisma: PrismaService;
  private readonly engine: WorkflowEngineService;
  private readonly executions: ExecutionsService;
  public readonly queue: InMemoryJobQueue;
  private isRunning: boolean;
  private consumerTimer?: NodeJS.Timeout;

  constructor(
    prisma: PrismaService,
    engine: WorkflowEngineService,
    executions: ExecutionsService,
    @Optional() queue?: InMemoryJobQueue,
  ) {
    this.prisma = prisma;
    this.engine = engine;
    this.executions = executions;
    this.queue = queue ?? new InMemoryJobQueue();
    this.isRunning = false;
  }

  async onModuleInit(): Promise<void> {
    // Configuração não comprova conexão: ainda não existe consumidor BullMQ.
    this.isRunning = false;
    this.logger.warn(
      'Consumidor de fila não implementado. Worker permanece em standby.',
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.stopConsumer();
    this.isRunning = false;
    this.logger.log('Encerrando WorkerService em standby.');
  }

  isWorkerRunning(): boolean {
    return this.isRunning;
  }

  startConsumer(intervalMs = 100): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.logger.log(`Iniciando consumidor determinístico local (intervalo: ${intervalMs}ms).`);
    this.consumerTimer = setInterval(() => {
      void this.processNextJob().catch((err) => {
        this.logger.error(`Erro no ciclo do consumidor: ${err?.message ?? err}`);
      });
    }, intervalMs);
  }

  stopConsumer(): void {
    if (this.consumerTimer) {
      clearInterval(this.consumerTimer);
      this.consumerTimer = undefined;
    }
    this.isRunning = false;
  }

  async enqueueJob(job: WorkflowJobPayload): Promise<{ jobId: string; enqueued: boolean; isDuplicate: boolean }> {
    return this.queue.enqueue(job);
  }

  getQueueMetrics(): QueueMetrics {
    return this.queue.getMetrics();
  }

  async processNextJob(): Promise<{ jobId: string; executionId?: string; status: string } | null> {
    const job = await this.queue.dequeue();
    if (!job) {
      return null;
    }

    try {
      const result = await this.processJob(job);
      this.queue.completeJob(job.jobId, {
        jobId: job.jobId,
        executionId: result.executionId,
        status: result.status as 'COMPLETED' | 'FAILED',
        attempt: job.attempt ?? 1,
        completedAt: new Date().toISOString(),
      });
      return { jobId: job.jobId, executionId: result.executionId, status: result.status };
    } catch (error: any) {
      const isRetryable = error instanceof ServiceUnavailableException;
      const { canRetry, nextAttempt } = this.queue.failJob(job.jobId, error?.message ?? 'Falha de processamento', isRetryable);
      this.logger.warn(`Job [${job.jobId}] falhou (tentativa ${job.attempt ?? 1}). Retry possível: ${canRetry} (próxima: ${nextAttempt})`);
      return { jobId: job.jobId, status: 'FAILED' };
    }
  }

  /** Tentativas transitórias esgotadas: registra FAILED no histórico somente se o workflow pertence à organização. */
  async recordExhaustedFailure(job: WorkflowJobData): Promise<void> {
    if (job.mode !== 'SIMULATION') return;
    const row = await this.prisma.workflow.findFirst({ where: { id: job.workflowId, orgId: job.orgId } });
    if (!row) return;
    const now = new Date().toISOString();
    await this.executions.recordExecution(job.orgId, row.id, job.workflowVersion ?? row.version, 'SIMULATION', 'FAILED', job.userId, [], now, now);
  }
  async processJob(job: WorkflowJobData): Promise<{ executionId: string; status: string; durationMs?: number; attempt?: number }> {
    if (!job || typeof job !== 'object' || Array.isArray(job)) {
      throw new BadRequestException('Contrato de job inválido');
    }
    const { jobId, workflowId, orgId, userId, initialPayload, mode } = job;
    if (![jobId, workflowId, orgId, userId].every((id) => typeof id === 'string' && id.trim()) ||
        !initialPayload || typeof initialPayload !== 'object' || Array.isArray(initialPayload) ||
        !['SIMULATION', 'LIVE'].includes(mode)) {
      throw new BadRequestException('Contrato de job inválido');
    }
    if (mode !== 'SIMULATION') {
      throw new BadRequestException('Execução LIVE não implementada; somente simulação está disponível');
    }
    this.logger.log(`Processando simulação [Job: ${jobId}] para workflow [ID: ${workflowId}] org [${orgId}]`);

    let workflowRow;
    try {
      workflowRow = await this.prisma.workflow.findFirst({ where: { id: workflowId, orgId } });
    } catch {
      throw new ServiceUnavailableException({
        code: 'WORKER_STORAGE_UNAVAILABLE',
        message: 'Não foi possível consultar o workflow. Tente novamente mais tarde.',
      });
    }

    if (!workflowRow || workflowRow.id !== workflowId || workflowRow.orgId !== orgId) {
      throw new NotFoundException(`Workflow não encontrado para a organização ativa: ${workflowId}`);
    }

    // Agendamentos executam a versão fixada no job, nunca o rascunho atual.
    if (job.scheduleId) {
      if (workflowRow.status !== 'PUBLISHED' || !Number.isInteger(job.workflowVersion) || (job.workflowVersion ?? 0) < 1) {
        throw new BadRequestException('Agendamento exige workflow ativo e versão publicada.');
      }
      const published = await this.prisma.workflowVersion.findFirst({
        where: { workflowId, version: job.workflowVersion },
      });
      if (!hasScheduleTrigger(published)) throw new BadRequestException('Versão de agendamento inexistente ou incompatível.');
      workflowRow = { ...workflowRow, version: published!.version, schemaVersion: published!.schemaVersion,
        triggerNodeId: published!.triggerNodeId, nodes: published!.nodes, edges: published!.edges };
    }

    const workflow = {
      ...workflowRow,
      description: workflowRow.description ?? undefined,
      nodes: (typeof workflowRow.nodes === 'string'
        ? JSON.parse(workflowRow.nodes)
        : workflowRow.nodes) as any,
      edges: (typeof workflowRow.edges === 'string'
        ? JSON.parse(workflowRow.edges)
        : workflowRow.edges) as any,
      reviewedBy: (workflowRow as any).reviewedBy ?? undefined,
      reviewedAt: (workflowRow as any).reviewedAt
        ? new Date((workflowRow as any).reviewedAt).toISOString()
        : undefined,
      createdAt: workflowRow.createdAt.toISOString(),
      updatedAt: workflowRow.updatedAt.toISOString(),
    };

    const simResult = await this.engine.simulate(workflow, initialPayload);

    const now = Date.now();
    const startedAt = new Date(now - simResult.totalDurationMs).toISOString();
    const completedAt = new Date(now).toISOString();

    const execution = await this.executions.recordExecution(
      orgId,
      workflow.id,
      workflow.version,
      'SIMULATION',
      simResult.status,
      userId,
      simResult.nodeResults,
      startedAt,
      completedAt,
      simResult.executionId,
    );

    this.logger.log(`Simulação [Job: ${jobId}] concluída com status ${execution.status} [ExecutionId: ${execution.id}]`);
    return {
      executionId: execution.id,
      status: execution.status,
      durationMs: simResult.totalDurationMs,
      attempt: job.attempt ?? 1,
    };
  }
}

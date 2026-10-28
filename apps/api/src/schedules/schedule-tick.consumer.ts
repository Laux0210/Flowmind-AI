import { Logger } from '@nestjs/common';
import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import type Redis from 'ioredis';
import type { PrismaService } from '../prisma/prisma.service';
import type { RedisConnection, WorkflowJobProducer } from '../worker/bullmq-workflow-queue';
import { hasScheduleTrigger } from './schedule-compatibility';
import { SCHEDULE_TICK_QUEUE } from './schedule-sync';
import type { ScheduleSync, ScheduleTickData } from './schedule-sync';

// Trava de sobreposição: o próximo disparo é pulado enquanto o anterior roda (teto de 1 h).
export const SCHEDULE_RUNNING_TTL_SECONDS = 3600;
export const scheduleLockKey = (scheduleId: string) => `fm:sched:running:${scheduleId}`;

// Apaga a trava só se ela ainda pertence ao disparo que terminou.
const RELEASE_IF_OWNER = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

export function releaseScheduleLock(redis: Pick<Redis, 'eval'>, scheduleId: string, event: string): Promise<unknown> {
  return redis.eval(RELEASE_IF_OWNER, 1, scheduleLockKey(scheduleId), event);
}

export const scheduleEventId = (scheduleId: string, millis: number) => `sch-${scheduleId}-${millis}`;

/** Horário previsto do disparo: job schedulers do BullMQ usam ids `repeat:<scheduler>:<millis>`. */
export function scheduledMillis(job: Pick<Job, 'id' | 'timestamp'>): number {
  const suffix = Number(String(job.id ?? '').split(':').pop());
  return Number.isFinite(suffix) && suffix > 0 ? suffix : job.timestamp;
}

export type TickOutcome = 'enqueued' | 'skipped_running' | 'paused' | 'ignored' | 'incompatible';

export class ScheduleTickConsumer {
  private readonly logger = new Logger(ScheduleTickConsumer.name);
  private readonly prisma: PrismaService;
  private readonly producer: Pick<WorkflowJobProducer, 'enqueue'>;
  private readonly redis: Pick<Redis, 'set' | 'eval'>;
  private readonly sync: Pick<ScheduleSync, 'remove'>;
  private worker?: Worker<ScheduleTickData>;

  constructor(prisma: PrismaService, producer: Pick<WorkflowJobProducer, 'enqueue'>, redis: Pick<Redis, 'set' | 'eval'>,
    sync: Pick<ScheduleSync, 'remove'>) {
    this.prisma = prisma;
    this.producer = producer;
    this.redis = redis;
    this.sync = sync;
  }

  start(connection: RedisConnection, queueName = SCHEDULE_TICK_QUEUE): void {
    if (this.worker) return;
    this.worker = new Worker<ScheduleTickData>(queueName, (job) => this.tick(job.data.scheduleId, scheduledMillis(job)), { connection });
    this.worker.on('error', (error) => this.logger.error(`Erro de conexão dos agendamentos: ${error.message}`));
  }

  async tick(scheduleId: string, millis: number): Promise<TickOutcome> {
    const schedule = await this.prisma.workflowSchedule.findUnique({
      where: { id: scheduleId }, include: { workflow: { select: { status: true, orgId: true } } },
    });
    if (!schedule || schedule.status !== 'ACTIVE') {
      await this.sync.remove(scheduleId);
      return 'ignored';
    }
    if (schedule.workflow.status !== 'PUBLISHED' || schedule.workflow.orgId !== schedule.orgId) {
      // Workflow desativado: pausa o agendamento e para de disparar.
      await this.prisma.workflowSchedule.updateMany({ where: { id: scheduleId, status: 'ACTIVE' }, data: { status: 'PAUSED' } });
      await this.sync.remove(scheduleId);
      this.logger.log(`Agendamento [${scheduleId}] pausado: workflow não está ativado.`);
      return 'paused';
    }
    const version = await this.prisma.workflowVersion.findFirst({
      where: { workflowId: schedule.workflowId }, orderBy: { version: 'desc' },
    });
    if (!hasScheduleTrigger(version)) {
      this.logger.warn(`Disparo [${scheduleId}] ignorado: versão publicada sem gatilho de agendamento compatível.`);
      return 'incompatible';
    }
    const event = scheduleEventId(scheduleId, millis);
    const lock = await this.redis.set(scheduleLockKey(scheduleId), event, 'EX', SCHEDULE_RUNNING_TTL_SECONDS, 'NX');
    if (lock !== 'OK') {
      this.logger.warn(`Disparo do agendamento [${scheduleId}] pulado: execução anterior ainda em andamento.`);
      return 'skipped_running';
    }
    try {
      await this.producer.enqueue({
        jobId: event, idempotencyKey: event, scheduleId, workflowId: schedule.workflowId, workflowVersion: version!.version,
        orgId: schedule.orgId, userId: `schedule_${scheduleId}`, mode: 'SIMULATION',
        initialPayload: { scheduledAt: new Date(millis).toISOString() },
      });
      return 'enqueued';
    } catch (error) {
      await releaseScheduleLock(this.redis, scheduleId, event);
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.worker?.close();
  }
}

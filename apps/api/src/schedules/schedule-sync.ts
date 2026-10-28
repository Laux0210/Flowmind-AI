import { Queue } from 'bullmq';
import type { RedisConnection } from '../worker/bullmq-workflow-queue';

export const SCHEDULE_TICK_QUEUE = 'flowmind-schedule-ticks';

export interface ScheduleTickData { scheduleId: string }
export interface SyncedSchedule { id: string; cron: string; timezone: string }

/** Espelha agendamentos ativos do banco nos job schedulers do BullMQ. */
export class ScheduleSync {
  private readonly queue: Queue<ScheduleTickData>;

  constructor(connection: RedisConnection, queueName = SCHEDULE_TICK_QUEUE) {
    // Sem fila offline: com Redis fora, comandos falham rápido em vez de segurar a requisição HTTP.
    this.queue = new Queue<ScheduleTickData>(queueName, { connection: { ...connection, enableOfflineQueue: false, connectTimeout: 3000 } });
  }

  async upsert(schedule: SyncedSchedule): Promise<void> {
    await this.queue.upsertJobScheduler(schedule.id, { pattern: schedule.cron, tz: schedule.timezone },
      { name: 'tick', data: { scheduleId: schedule.id }, opts: { removeOnComplete: { count: 100 }, removeOnFail: { count: 100 } } });
  }

  async remove(scheduleId: string): Promise<void> {
    await this.queue.removeJobScheduler(scheduleId);
  }

  /** Banco como fonte da verdade: cria os ativos e remove os que não existem mais. */
  async resync(active: SyncedSchedule[], isStillActive?: (id: string) => Promise<boolean>): Promise<{ upserted: number; removed: number }> {
    const wanted = new Set(active.map((schedule) => schedule.id));
    let removed = 0;
    for (const scheduler of await this.queue.getJobSchedulers(0, -1)) {
      if (!scheduler.key || wanted.has(scheduler.key)) continue;
      // Reconsulta o banco: agendamento criado durante a resync não é tratado como órfão.
      if (isStillActive && await isStillActive(scheduler.key)) continue;
      await this.remove(scheduler.key); removed++;
    }
    for (const schedule of active) await this.upsert(schedule);
    return { upserted: active.length, removed };
  }

  close(): Promise<void> {
    return this.queue.close();
  }
}

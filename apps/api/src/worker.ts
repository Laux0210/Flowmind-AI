import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { WorkerModule } from './worker/worker.module';
import { WorkerService } from './worker/worker.service';
import { BullMqWorkflowQueue, WorkflowJobProducer } from './worker/bullmq-workflow-queue';
import Redis from 'ioredis';
import { PrismaService } from './prisma/prisma.service';
import { ScheduleSync } from './schedules/schedule-sync';
import { ScheduleTickConsumer, releaseScheduleLock } from './schedules/schedule-tick.consumer';

export async function bootstrapWorker(): Promise<void> {
  const logger = new Logger('WorkerBootstrap');
  logger.log('Inicializando FlowMind AI Background Worker (sem portas HTTP)...');

  const app = await NestFactory.createApplicationContext(WorkerModule, { abortOnError: false });
  const host = process.env.REDIS_HOST?.trim();
  if (!host) {
    app.enableShutdownHooks();
    logger.log('Processo do worker inicializado em standby; consumo de fila indisponível.');
    return;
  }
  const connection = { host, port: Number(process.env.REDIS_PORT) || 6379, password: process.env.REDIS_PASSWORD || undefined };
  const queue = new BullMqWorkflowQueue(app.get(WorkerService), connection);
  const redis = new Redis(connection);
  const prisma = app.get(PrismaService);
  const sync = new ScheduleSync(connection);
  const producer = new WorkflowJobProducer(connection);
  const ticks = new ScheduleTickConsumer(prisma, producer, redis, sync);
  // Libera a trava de sobreposição quando o job de um agendamento termina.
  queue.onJobFinished(async (data) => {
    if (data.scheduleId && data.idempotencyKey) await releaseScheduleLock(redis, data.scheduleId, data.idempotencyKey);
  });
  queue.start();
  // Banco como fonte da verdade: resync na inicialização e a cada 5 min (cobre sincronizações que falharam na API).
  const resync = async () => {
    const active = await prisma.workflowSchedule.findMany({ where: { status: 'ACTIVE' }, select: { id: true, cron: true, timezone: true } });
    return sync.resync(active, async (id) => (await prisma.workflowSchedule.count({ where: { id, status: 'ACTIVE' } })) > 0);
  };
  const synced = await resync();
  ticks.start(connection);
  logger.log(`Agendamentos ressincronizados a partir do banco: ${synced.upserted} ativos, ${synced.removed} removidos do Redis.`);
  const resyncTimer = setInterval(() => void resync().catch(() => logger.warn('Ressincronização de agendamentos falhou; nova tentativa em 5 min.')), 5 * 60_000);
  // Fecha consumidores (aguarda jobs ativos) antes de encerrar o Nest e o Prisma.
  const shutdown = async () => {
    clearInterval(resyncTimer);
    await Promise.allSettled([ticks.close(), queue.close(), sync.close(), producer.close()]);
    await redis.quit().catch(() => undefined);
    await app.close();
  };
  process.once('SIGTERM', () => void shutdown());
  process.once('SIGINT', () => void shutdown());
  logger.log('Consumidor BullMQ iniciado (somente SIMULATION).');
}

// Importar definições/testes não deve iniciar serviços.
if (typeof require !== 'undefined' && require.main === module) {
  void bootstrapWorker().catch(() => {
    new Logger('WorkerBootstrap').error('Não foi possível inicializar o worker; confira a configuração.');
    process.exitCode = 1;
  });
}

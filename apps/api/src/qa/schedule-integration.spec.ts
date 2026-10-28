import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulerService } from '../triggers/scheduler.service';
import { SchedulesService } from '../schedules/schedules.service';
import { ScheduleSync } from '../schedules/schedule-sync';
import { ScheduleTickConsumer, scheduleLockKey, scheduledMillis } from '../schedules/schedule-tick.consumer';
import { WorkflowJobProducer, BullMqWorkflowQueue, workflowJobId } from '../worker/bullmq-workflow-queue';
import { WorkerService } from '../worker/worker.service';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import { ExecutionsService } from '../executions/executions.service';
import { UsageLimitsService } from '../executions/usage-limits.service';
import { createTestResourceResolver } from '../../test/resource-fixtures';

// PostgreSQL e Redis reais: FLOWMIND_DB_INTEGRATION=1, FLOWMIND_REDIS_INTEGRATION=1 e DATABASE_URL.
const enabled = process.env.FLOWMIND_DB_INTEGRATION === '1' && process.env.FLOWMIND_REDIS_INTEGRATION === '1';
const run = enabled ? describe : describe.skip;
const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const orgA = `org_sc_a_${suffix}`;
const orgB = `org_sc_b_${suffix}`;
const tickQueue = `flowmind-sc-it-${suffix}`;
const connection = { host: process.env.REDIS_HOST ?? '127.0.0.1', port: Number(process.env.REDIS_PORT) || 6379 };

run('Agendamento com PostgreSQL e Redis reais', () => {
  let prisma: PrismaService;
  let redis: Redis;
  let sync: ScheduleSync;
  let service: SchedulesService;
  const enqueue = jest.fn().mockResolvedValue({ jobId: 'job', isDuplicate: false });
  let ticks: ScheduleTickConsumer;

  async function workflow(org: string, status: 'PUBLISHED' | 'DRAFT' = 'PUBLISHED') {
    const row = await prisma.workflow.create({ data: { orgId: org, name: 'Agendado', status, version: 2, triggerNodeId: 'form' } });
    if (status === 'PUBLISHED') await prisma.workflowVersion.create({ data: { workflowId: row.id, version: 2, triggerNodeId: 'form', nodes: [{ id: 'form', type: 'trigger_schedule', label: 'Agenda', position: { x: 0, y: 0 }, config: {} }], edges: [], publishedBy: 'admin' } });
    return row.id;
  }

  beforeAll(async () => {
    prisma = new PrismaService(); await prisma.$connect();
    redis = new Redis(connection);
    sync = new ScheduleSync(connection, tickQueue);
    service = new SchedulesService(prisma, new SchedulerService());
    await service.onModuleDestroy();
    service.useSync(sync);
    ticks = new ScheduleTickConsumer(prisma, { enqueue }, redis, sync);
    await prisma.organization.createMany({ data: [{ id: orgA, name: 'A' }, { id: orgB, name: 'B' }] });
  });

  afterAll(async () => {
    const admin = new Queue(tickQueue, { connection }); await admin.obliterate({ force: true }); await admin.close();
    await sync.close(); await redis.quit();
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.$disconnect();
  });

  it('valida cron, frequência, fuso e status do workflow', async () => {
    const id = await workflow(orgA);
    const code = (p: Promise<unknown>) => p.catch((e: BadRequestException) => (e.getResponse() as { code: string }).code);
    expect(await code(service.create(orgA, id, 'admin', 'x * * * *'))).toBe('SCHEDULE_INVALID_CRON');
    expect(await code(service.create(orgA, id, 'admin', '*/5 * * * *'))).toBe('SCHEDULE_TOO_FREQUENT');
    expect(await code(service.create(orgA, id, 'admin', '0 * * * *', 'Marte/Base'))).toBe('SCHEDULE_INVALID_TIMEZONE');
    expect(await code(service.create(orgA, await workflow(orgA, 'DRAFT'), 'admin', '0 * * * *'))).toBe('SCHEDULE_WORKFLOW_NOT_ACTIVE');
    await expect(service.create(orgB, id, 'admin', '0 * * * *')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cria com fuso padrão, espelha no Redis e revoga', async () => {
    const created = await service.create(orgA, await workflow(orgA), 'admin', '*/15 * * * *');
    expect(created).toMatchObject({ timezone: 'America/Sao_Paulo', status: 'ACTIVE' });
    const queue = new Queue(tickQueue, { connection });
    expect((await queue.getJobSchedulers(0, -1)).map((s) => s.key)).toContain(created.id);
    await expect(service.revoke(orgB, created.id)).rejects.toBeInstanceOf(NotFoundException);
    expect((await service.revoke(orgA, created.id)).status).toBe('REVOKED');
    expect((await queue.getJobSchedulers(0, -1)).map((s) => s.key)).not.toContain(created.id);
    await queue.close();
  });

  it('limita 5 agendamentos ativos por organização', async () => {
    await prisma.workflowSchedule.updateMany({ where: { orgId: orgA }, data: { status: 'REVOKED' } });
    const id = await workflow(orgA);
    for (let i = 0; i < 5; i++) await service.create(orgA, id, 'admin', `${i} * * * *`);
    await expect(service.create(orgA, id, 'admin', '30 * * * *')).rejects.toBeInstanceOf(ConflictException);
    await prisma.workflowSchedule.updateMany({ where: { orgId: orgA }, data: { status: 'REVOKED' } });
  });

  it('tick enfileira versão publicada, pula sobreposição e libera depois', async () => {
    const schedule = await service.create(orgA, await workflow(orgA), 'admin', '0 * * * *');
    enqueue.mockClear();
    expect(await ticks.tick(schedule.id, 1_000)).toBe('enqueued');
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ orgId: orgA, workflowVersion: 2, mode: 'SIMULATION',
      scheduleId: schedule.id, jobId: `sch-${schedule.id}-1000`, initialPayload: { scheduledAt: new Date(1_000).toISOString() } }));
    expect(await ticks.tick(schedule.id, 2_000)).toBe('skipped_running');
    await redis.del(scheduleLockKey(schedule.id));
    expect(await ticks.tick(schedule.id, 3_000)).toBe('enqueued');
    await redis.del(scheduleLockKey(schedule.id));
    await service.revoke(orgA, schedule.id);
    expect(await ticks.tick(schedule.id, 4_000)).toBe('ignored');
  });

  it('falha ao enfileirar libera a trava', async () => {
    const schedule = await service.create(orgA, await workflow(orgA), 'admin', '0 * * * *');
    enqueue.mockRejectedValueOnce(new Error('fila caiu'));
    await expect(ticks.tick(schedule.id, 5_000)).rejects.toThrow('fila caiu');
    expect(await redis.exists(scheduleLockKey(schedule.id))).toBe(0);
    await service.revoke(orgA, schedule.id);
  });

  it('workflow desativado pausa o agendamento no próximo tick', async () => {
    const id = await workflow(orgA);
    const schedule = await service.create(orgA, id, 'admin', '0 * * * *');
    await prisma.workflow.update({ where: { id }, data: { status: 'DRAFT' } });
    expect(await ticks.tick(schedule.id, 6_000)).toBe('paused');
    expect((await prisma.workflowSchedule.findUniqueOrThrow({ where: { id: schedule.id } })).status).toBe('PAUSED');
  });

  it('resync remove do Redis o que não está ativo no banco', async () => {
    await sync.upsert({ id: 'orfao', cron: '0 * * * *', timezone: 'UTC' });
    const active = await prisma.workflowSchedule.findMany({ where: { orgId: orgA, status: 'ACTIVE' } });
    const result = await sync.resync(active);
    const inspectionQueue = new Queue(tickQueue, { connection });
    const keys = await inspectionQueue.getJobSchedulers(0, -1).then(rows => rows.map(row => row.key))
      .finally(() => inspectionQueue.close());
    expect(keys).not.toContain('orfao');
    expect(result.removed).toBeGreaterThanOrEqual(1);
  });

  it('scheduler real do BullMQ dispara com id repeat:<agendamento>:<millis>', async () => {
    const queueName = `${tickQueue}-fire`;
    const fire = new ScheduleSync(connection, queueName);
    const seen: Array<{ id?: string; data: unknown }> = [];
    const worker = new Worker(queueName, async (job) => { seen.push({ id: job.id, data: job.data }); }, { connection });
    await fire.upsert({ id: 'sched_fire', cron: '* * * * * *', timezone: 'UTC' });
    for (let i = 0; i < 60 && !seen.length; i++) await new Promise((r) => setTimeout(r, 100));
    await fire.remove('sched_fire'); await worker.close();
    const admin = new Queue(queueName, { connection }); await admin.obliterate({ force: true }); await admin.close(); await fire.close();
    expect(seen[0].data).toEqual({ scheduleId: 'sched_fire' });
    expect(seen[0].id).toMatch(/^repeat:sched_fire:\d+$/);
    expect(scheduledMillis({ id: seen[0].id, timestamp: 0 })).toBeGreaterThan(1_700_000_000_000);
  }, 15_000);

  it('tick → fila real → motor → histórico usa snapshot publicado e preserva scheduledAt', async () => {
    const id = await workflow(orgA);
    // A definição corrente difere do snapshot de agendamento publicado pelo helper.
    await prisma.workflow.update({ where: { id }, data: { version: 9, nodes: [{ id: 'form', type: 'trigger_form', config: {} }] } });
    const schedule = await service.create(orgA, id, 'admin', '0 * * * *');
    const queueName = `${tickQueue}-journey`;
    const history = new ExecutionsService(prisma, new UsageLimitsService(prisma));
    const workerService = new WorkerService(prisma, new WorkflowEngineService(createTestResourceResolver()), history);
    const producer = new WorkflowJobProducer(connection, 3, queueName);
    const consumer = new BullMqWorkflowQueue(workerService, connection, undefined, queueName);
    const events = new QueueEvents(queueName, { connection });
    const queue = new Queue(queueName, { connection });
    const millis = Date.parse('2026-10-24T12:30:00.000Z');
    try {
      await events.waitUntilReady(); consumer.start();
      const actualTick = new ScheduleTickConsumer(prisma, producer, redis, sync);
      expect(await actualTick.tick(schedule.id, millis)).toBe('enqueued');
      const jobId = workflowJobId({ jobId: `sch-${schedule.id}-${millis}`, idempotencyKey: `sch-${schedule.id}-${millis}`,
        workflowId: id, workflowVersion: 2, orgId: orgA, userId: `schedule_${schedule.id}`, mode: 'SIMULATION', initialPayload: {} });
      const job = await queue.getJob(jobId);
      expect(job).toBeDefined();
      const result = await job!.waitUntilFinished(events, 10_000);
      expect(result.status).toBe('COMPLETED');
      const rows = await prisma.workflowExecution.findMany({ where: { workflowId: id, orgId: orgA } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ workflowVersion: 2, mode: 'SIMULATION', status: 'COMPLETED' });
      expect(rows[0].nodeResults).toEqual(expect.arrayContaining([expect.objectContaining({
        nodeType: 'trigger_schedule', outputs: { scheduledAt: new Date(millis).toISOString() },
      })]));
      expect(await prisma.workflowExecution.count({ where: { workflowId: id, orgId: orgB } })).toBe(0);
    } finally {
      await consumer.close(); await producer.close(); await events.close();
      await queue.obliterate({ force: true }); await queue.close();
      await redis.del(scheduleLockKey(schedule.id));
      await service.revoke(orgA, schedule.id);
    }
  }, 20_000);
});

import { ConflictException, HttpException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookEndpointsService } from '../triggers/webhook-endpoints.service';
import { WebhookIngressService } from '../triggers/webhook-ingress.service';
import { WebhookSignatureValidator } from '../triggers/webhook-signature.validator';
import { WorkflowJobProducer } from '../worker/bullmq-workflow-queue';

// PostgreSQL e Redis reais: FLOWMIND_DB_INTEGRATION=1, FLOWMIND_REDIS_INTEGRATION=1, DATABASE_URL e ENCRYPTION_KEY_32BYTES.
const enabled = process.env.FLOWMIND_DB_INTEGRATION === '1' && process.env.FLOWMIND_REDIS_INTEGRATION === '1';
const run = enabled ? describe : describe.skip;
const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const orgA = `org_wh_a_${suffix}`;
const orgB = `org_wh_b_${suffix}`;
const queueName = `flowmind-wh-it-${suffix}`;
const connection = { host: process.env.REDIS_HOST ?? '127.0.0.1', port: Number(process.env.REDIS_PORT) || 6379 };

run('Webhook com PostgreSQL e Redis reais', () => {
  let prisma: PrismaService;
  let redis: Redis;
  let producer: WorkflowJobProducer;
  let endpoints: WebhookEndpointsService;
  let ingress: WebhookIngressService;
  let published: { publicId: string; secret: string };
  let workflowId: string;

  async function workflow(status: 'PUBLISHED' | 'DRAFT') {
    const row = await prisma.workflow.create({ data: { orgId: orgA, name: `WH ${status}`, status, version: 1, triggerNodeId: 'form' } });
    if (status === 'PUBLISHED') await prisma.workflowVersion.create({ data: { workflowId: row.id, version: 1, triggerNodeId: 'form', nodes: [], edges: [], publishedBy: 'admin_fixture' } });
    return row.id;
  }
  const signed = (secret: string, body: string) => WebhookSignatureValidator.computeSignature(body, secret);
  const call = (publicId: string, body: string, signature?: string, extra: Record<string, string> = {}) =>
    ingress.handle({ publicId, rawBody: Buffer.from(body), contentType: 'application/json', signature, ...extra });
  async function status(promise: Promise<unknown>) {
    try { await promise; return 202; } catch (error) { return error instanceof HttpException ? error.getStatus() : 500; }
  }

  beforeAll(async () => {
    prisma = new PrismaService(); await prisma.$connect();
    redis = new Redis(connection);
    producer = new WorkflowJobProducer(connection, 3, queueName);
    endpoints = new WebhookEndpointsService(prisma);
    ingress = new WebhookIngressService(prisma);
    await ingress.onModuleDestroy();
    ingress.useDependencies({ redis, producer });
    await prisma.organization.createMany({ data: [{ id: orgA, name: 'Org A' }, { id: orgB, name: 'Org B' }] });
    workflowId = await workflow('PUBLISHED');
    published = await endpoints.create(orgA, workflowId, 'admin_fixture');
  });

  afterAll(async () => {
    const admin = new Queue(queueName, { connection }); await admin.obliterate({ force: true }); await admin.close();
    await producer.close(); await redis.quit();
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.$disconnect();
  });

  it('guarda só o segredo cifrado', async () => {
    const row = await prisma.webhookEndpoint.findUniqueOrThrow({ where: { publicId: published.publicId } });
    expect(row.secretCiphertext).not.toContain(published.secret);
    expect(row).toMatchObject({ orgId: orgA, workflowId, status: 'ACTIVE' });
  });

  it('aceita assinatura válida e enfileira com organização e versão do servidor', async () => {
    const body = JSON.stringify({ name: 'Fixture', orgId: orgB });
    const { jobId } = await call(published.publicId, body, signed(published.secret, body), { eventId: 'evt-1' });
    const job = await new Queue(queueName, { connection }).getJob(jobId);
    expect(job?.data).toMatchObject({ orgId: orgA, workflowId, workflowVersion: 1, mode: 'SIMULATION', initialPayload: { name: 'Fixture' } });
  });

  it('recusa o mesmo evento por replay', async () => {
    const body = JSON.stringify({ name: 'Fixture' });
    await expect(call(published.publicId, body, signed(published.secret, body), { eventId: 'evt-1' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('responde 401 idêntico para assinatura errada, endpoint inexistente, revogado e workflow não ativado', async () => {
    const body = JSON.stringify({ name: 'Fixture' });
    const draft = await endpoints.create(orgA, await workflow('DRAFT'), 'admin_fixture');
    const revoked = await endpoints.create(orgA, workflowId, 'admin_fixture');
    await endpoints.revoke(orgA, revoked.publicId);
    const attempts = [
      call(published.publicId, body, signed('whsec_errado', body)),
      call(published.publicId, body, undefined),
      call(`whk_${'x'.repeat(22)}`, body, signed(published.secret, body)),
      call(revoked.publicId, body, signed(revoked.secret, body)),
      call(draft.publicId, body, signed(draft.secret, body)),
    ];
    for (const attempt of attempts) {
      const error = await attempt.catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getResponse()).toEqual({ code: 'WEBHOOK_UNAUTHORIZED', message: 'Webhook não autorizado.' });
    }
  });

  it('rotação invalida o segredo anterior', async () => {
    const endpoint = await endpoints.create(orgA, workflowId, 'admin_fixture');
    const rotated = await endpoints.rotate(orgA, endpoint.publicId);
    const body = JSON.stringify({ name: 'Fixture' });
    expect(await status(call(endpoint.publicId, body, signed(endpoint.secret, body), { eventId: 'evt-rot-1' }))).toBe(401);
    expect(await status(call(endpoint.publicId, body, signed(rotated.secret, body), { eventId: 'evt-rot-2' }))).toBe(202);
  });

  it('aplica tipo de conteúdo, tamanho e limite de taxa', async () => {
    const body = '{}';
    expect(await status(ingress.handle({ publicId: published.publicId, rawBody: Buffer.from(body), contentType: 'text/plain' }))).toBe(415);
    const big = JSON.stringify({ text: 'x'.repeat(65 * 1024) });
    expect(await status(call(published.publicId, big, signed(published.secret, big)))).toBe(413);
    const id = `whk_${`rate${suffix}`.replace(/[^A-Za-z0-9]/g, '').padEnd(22, 'x').slice(0, 22)}`;
    const codes: number[] = [];
    for (let i = 0; i < 61; i++) codes.push(await status(call(id, body, 't=1,v1=00')));
    expect(codes.slice(0, 60).every((code) => code === 401)).toBe(true);
    expect(codes[60]).toBe(429);
  });

  it('falha ao enfileirar libera o evento para reenvio', async () => {
    const failing = { enqueue: jest.fn().mockRejectedValueOnce(new Error('redis caiu')), close: jest.fn() };
    ingress.useDependencies({ redis, producer: failing as never });
    const body = JSON.stringify({ name: 'Fixture' });
    const first = await call(published.publicId, body, signed(published.secret, body), { eventId: 'evt-retry' }).catch((e: unknown) => e);
    expect((first as HttpException).getStatus()).toBe(503);
    ingress.useDependencies({ redis, producer });
    expect(await status(call(published.publicId, body, signed(published.secret, body), { eventId: 'evt-retry' }))).toBe(202);
  });

  it('ID fora do formato responde 401 sem criar contador', async () => {
    const body = JSON.stringify({ name: 'Fixture' });
    expect(await status(call('whk_curto', body, signed(published.secret, body)))).toBe(401);
    expect(await redis.exists('fm:wh:rate:whk_curto')).toBe(0);
  });

  it('outra organização não lista, roda nem revoga endpoints', async () => {
    expect(await endpoints.list(orgB, workflowId)).toEqual([]);
    await expect(endpoints.create(orgB, workflowId, 'admin_b')).rejects.toBeInstanceOf(NotFoundException);
    await expect(endpoints.rotate(orgB, published.publicId)).rejects.toBeInstanceOf(NotFoundException);
    await expect(endpoints.revoke(orgB, published.publicId)).rejects.toBeInstanceOf(NotFoundException);
  });
});

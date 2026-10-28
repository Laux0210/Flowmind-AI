import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, Logger,
  OnModuleDestroy, PayloadTooLargeException, ServiceUnavailableException, UnauthorizedException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret } from '../webhooks/secret-cipher';
import { WorkflowJobProducer } from '../worker/bullmq-workflow-queue';
import { WebhookSignatureValidator } from './webhook-signature.validator';

// Política aprovada em 23/10/2026 (PROJECT_CONTEXT, T12 webhook).
export const WEBHOOK_POLICY = { maxBodyBytes: 64 * 1024, ratePerMinute: 60, replayTtlSeconds: 600, toleranceSeconds: 300 };
const EVENT_ID_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/;
const PUBLIC_ID_PATTERN = /^whk_[A-Za-z0-9_-]{22}$/;

export interface WebhookIngressRequest {
  publicId: string;
  rawBody?: Buffer;
  contentType?: string;
  signature?: string;
  eventId?: string;
}

export interface WebhookQueueDeps {
  redis: Pick<Redis, 'incr' | 'set' | 'del' | 'quit'>;
  producer: Pick<WorkflowJobProducer, 'enqueue' | 'close'>;
}

function unauthorized(): UnauthorizedException {
  return new UnauthorizedException({ code: 'WEBHOOK_UNAUTHORIZED', message: 'Webhook não autorizado.' });
}

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({ code: 'WEBHOOK_UNAVAILABLE', message: 'Recebimento de webhooks indisponível.' });
}

@Injectable()
export class WebhookIngressService implements OnModuleDestroy {
  private readonly logger = new Logger(WebhookIngressService.name);
  private deps?: WebhookQueueDeps;

  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
    const host = process.env.REDIS_HOST?.trim();
    if (host) {
      const connection = { host, port: Number(process.env.REDIS_PORT) || 6379, password: process.env.REDIS_PASSWORD || undefined };
      this.deps = { redis: new Redis({ ...connection, lazyConnect: true, maxRetriesPerRequest: 1 }), producer: new WorkflowJobProducer(connection) };
    }
  }

  /** Testes injetam Redis/produtor sintéticos. */
  useDependencies(deps: WebhookQueueDeps | undefined): void {
    this.deps = deps;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.deps?.producer.close(), this.deps?.redis.quit()]);
  }

  async handle(request: WebhookIngressRequest): Promise<{ jobId: string }> {
    const deps = this.deps;
    // Sem Redis o ingresso fica fechado antes de qualquer consulta.
    if (!deps) throw new ServiceUnavailableException({ code: 'WEBHOOK_NOT_CONFIGURED', message: 'O recebimento de webhooks ainda não está disponível.' });
    if (!request.contentType?.toLowerCase().startsWith('application/json')) {
      throw new UnsupportedMediaTypeException({ code: 'WEBHOOK_UNSUPPORTED_MEDIA', message: 'Use application/json.' });
    }
    const raw = request.rawBody;
    if (!raw) throw new BadRequestException({ code: 'WEBHOOK_INVALID_BODY', message: 'Corpo ausente.' });
    if (raw.length > WEBHOOK_POLICY.maxBodyBytes) {
      throw new PayloadTooLargeException({ code: 'WEBHOOK_BODY_TOO_LARGE', message: 'Corpo acima de 64 KB.' });
    }

    // ID fora do formato gerado pelo servidor não consulta banco nem cria chave no Redis.
    if (!PUBLIC_ID_PATTERN.test(request.publicId)) throw unauthorized();
    const rateKey = `fm:wh:rate:${request.publicId}`;
    let count: number;
    try {
      // TTL criado junto com a chave: INCR posterior não deixa contador sem expiração.
      await deps.redis.set(rateKey, '0', 'EX', 60, 'NX');
      count = await deps.redis.incr(rateKey);
    } catch {
      throw unavailable();
    }
    if (count > WEBHOOK_POLICY.ratePerMinute) {
      throw new HttpException({ code: 'WEBHOOK_RATE_LIMITED', message: 'Limite de requisições excedido.' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const endpoint = await this.prisma.webhookEndpoint.findUnique({
      where: { publicId: request.publicId }, include: { workflow: { select: { status: true, orgId: true } } },
    });
    const usable = endpoint?.status === 'ACTIVE' && endpoint.workflow.status === 'PUBLISHED' && endpoint.workflow.orgId === endpoint.orgId;
    let secret: string;
    try {
      // Endpoint inexistente/revogado também calcula HMAC, para não diferenciar por tempo.
      secret = usable ? decryptSecret(endpoint.secretCiphertext) : randomBytes(32).toString('base64url');
    } catch {
      // Mesma resposta de endpoint inexistente: falha de chave não revela que o endpoint existe.
      this.logger.error('Segredo de webhook não pôde ser decifrado.');
      throw unauthorized();
    }
    const validSignature = WebhookSignatureValidator.verifySignature(request.signature, raw.toString('utf8'), secret, WEBHOOK_POLICY.toleranceSeconds);
    if (!usable || !validSignature) throw unauthorized();

    let body: unknown;
    try { body = JSON.parse(raw.toString('utf8')); } catch { body = undefined; }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException({ code: 'WEBHOOK_INVALID_BODY', message: 'O corpo deve ser um objeto JSON.' });
    }

    const eventId = request.eventId?.trim();
    if (eventId !== undefined && !EVENT_ID_PATTERN.test(eventId)) {
      throw new BadRequestException({ code: 'WEBHOOK_INVALID_EVENT_ID', message: 'X-FlowMind-Event-Id inválido.' });
    }
    const event = eventId || createHash('sha256').update(request.signature!).digest('hex').slice(0, 32);
    const replayKey = `fm:wh:replay:${endpoint.id}:${event}`;
    let fresh: string | null;
    try {
      fresh = await deps.redis.set(replayKey, '1', 'EX', WEBHOOK_POLICY.replayTtlSeconds, 'NX');
    } catch {
      throw unavailable();
    }
    if (fresh !== 'OK') throw new ConflictException({ code: 'WEBHOOK_REPLAY', message: 'Evento já recebido.' });

    // Qualquer falha após marcar o evento libera a marca, para o reenvio legítimo não virar replay.
    let jobId: string;
    try {
      const version = await this.prisma.workflowVersion.findFirst({
        where: { workflowId: endpoint.workflowId }, orderBy: { version: 'desc' }, select: { version: true },
      });
      if (!version) throw unauthorized();
      ({ jobId } = await deps.producer.enqueue({
        jobId: `wh-${event}`, idempotencyKey: `wh-${event}`, workflowId: endpoint.workflowId, workflowVersion: version.version,
        orgId: endpoint.orgId, userId: `webhook_${endpoint.publicId}`, mode: 'SIMULATION', initialPayload: body as Record<string, unknown>,
      }));
    } catch (error) {
      await deps.redis.del(replayKey).catch(() => this.logger.error('Não foi possível liberar a marca de replay.'));
      if (error instanceof HttpException) throw error;
      throw unavailable();
    }
    return { jobId };
  }
}

import { timingSafeEqual } from 'node:crypto';
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { WebhookSignatureValidator } from './webhook-signature.validator';
import type { WorkflowDefinition } from '@flowmind/contracts';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import type { WebhookTriggerHeaders, WebhookTriggerResponse } from './triggers.types';

interface IdempotencyRecord {
  response: WebhookTriggerResponse;
  recordedAt: number;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  // Cache em memória de chaves de idempotência (com TTL de 10 minutos)
  private readonly idempotencyCache = new Map<string, IdempotencyRecord>();
  private readonly IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
  private readonly engineService: WorkflowEngineService;

  constructor(engineService: WorkflowEngineService) {
    this.engineService = engineService;
  }

  /**
   * Processa o disparo de um webhook com deduplicação por idempotência e validação de assinatura.
   */
  async handleWebhookTrigger(
    workflow: WorkflowDefinition | null,
    payload: Record<string, unknown>,
    headers: WebhookTriggerHeaders,
    expectedSecret?: string,
  ): Promise<WebhookTriggerResponse> {
    // Autenticar antes de expor existência, status ou payload do workflow.
    if (typeof expectedSecret !== 'string' || !expectedSecret.trim()) {
      throw new ServiceUnavailableException({ code: 'WEBHOOK_NOT_CONFIGURED', message: 'O recebimento de webhooks ainda não está disponível.' });
    }
    {
      const receivedSig = headers.signature;
      if (!receivedSig || typeof receivedSig !== 'string') {
        throw new UnauthorizedException({
          code: 'INVALID_WEBHOOK_SIGNATURE',
          message: 'Assinatura ou segredo do webhook ausente.',
        });
      }

      let isMatch = false;

      // 1. Verificação canônica HMAC-SHA256 no formato t=<timestamp>,v1=<hmac>
      if (receivedSig.startsWith('t=')) {
        isMatch = WebhookSignatureValidator.verifySignature(
          receivedSig,
          JSON.stringify(payload),
          expectedSecret,
        );
      } else {
        // 2. Comparação timing-safe direta (para compatibilidade com fixtures de secret plano)
        const receivedBuf = Buffer.from(receivedSig);
        const expectedBuf = Buffer.from(expectedSecret);

        isMatch =
          receivedBuf.length === expectedBuf.length &&
          timingSafeEqual(receivedBuf, expectedBuf);
      }

      if (!isMatch) {
        throw new UnauthorizedException({
          code: 'INVALID_WEBHOOK_SIGNATURE',
          message: 'Assinatura ou segredo do webhook inválido.',
        });
      }
    }

    if (!workflow) {
      throw new NotFoundException({
        code: 'WORKFLOW_NOT_FOUND',
        message: 'Workflow não encontrado para o identificador fornecido.',
      });
    }

    // 1. Validação do status: Somente workflows PUBLISHED podem ser acionados via webhook
    if (workflow.status !== 'PUBLISHED') {
      throw new BadRequestException({
        code: 'WORKFLOW_NOT_PUBLISHED',
        message: `O workflow '${workflow.name}' está em estado ${workflow.status}. Apenas workflows ativados (PUBLISHED) podem receber webhooks.`,
      });
    }

    // 2. Validação do payload recebido
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException({
        code: 'INVALID_WEBHOOK_PAYLOAD',
        message: 'Payload do webhook deve ser um objeto JSON válido.',
      });
    }

    // 4. Verificação de idempotência (Idempotency Key / Replay Protection)
    if (headers.idempotencyKey !== undefined && headers.idempotencyKey !== null) {
      const key = String(headers.idempotencyKey).trim();
      if (!key) {
        throw new BadRequestException({
          code: 'INVALID_IDEMPOTENCY_KEY',
          message: 'Chave de idempotência não pode ser vazia.',
        });
      }

      const cacheKey = `${workflow.id}:${key}`;
      const existing = this.idempotencyCache.get(cacheKey);

      if (existing) {
        const isFresh = Date.now() - existing.recordedAt < this.IDEMPOTENCY_TTL_MS;
        if (isFresh) {
          this.logger.log(`Idempotência acionada para chave '${key}' no workflow '${workflow.id}'`);
          return {
            ...existing.response,
            idempotentReplay: true,
          };
        }
      }
    }

    // 5. Disparo através do motor de execução
    const executionResult = await this.engineService.simulate(workflow, payload);

    const response: WebhookTriggerResponse = {
      executionId: executionResult.executionId,
      status: executionResult.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
      idempotentReplay: false,
      workflowId: workflow.id,
      triggeredAt: new Date().toISOString(),
    };

    // 6. Salva na memória de idempotência se chave foi fornecida
    if (headers.idempotencyKey) {
      const key = String(headers.idempotencyKey).trim();
      if (key) {
        const cacheKey = `${workflow.id}:${key}`;
        this.idempotencyCache.set(cacheKey, {
          response,
          recordedAt: Date.now(),
        });
      }
    }

    return response;
  }

  /**
   * Limpa registros expirados do cache de idempotência
   */
  pruneExpiredIdempotencyKeys(): void {
    const now = Date.now();
    for (const [key, record] of this.idempotencyCache.entries()) {
      if (now - record.recordedAt >= this.IDEMPOTENCY_TTL_MS) {
        this.idempotencyCache.delete(key);
      }
    }
  }
}

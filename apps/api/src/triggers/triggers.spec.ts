import {
  BadRequestException,
  UnauthorizedException,
  ServiceUnavailableException,
  NotFoundException,
} from '@nestjs/common';
import { WorkflowDefinition, WORKFLOW_SCHEMA_VERSION } from '@flowmind/contracts';
import { WebhooksService } from './webhooks.service';
import { SchedulerService } from './scheduler.service';
import { WebhooksController } from './webhooks.controller';
import type { WebhookTriggerHeaders } from '@flowmind/contracts';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import { WebhookSignatureValidator } from './webhook-signature.validator';

describe('Triggers (T12 — Webhooks e Agendamento)', () => {
  let webhooksService: WebhooksService;
  let schedulerService: SchedulerService;
  let engineServiceMock: jest.Mocked<WorkflowEngineService>;

  const mockPublishedWorkflow: WorkflowDefinition = {
    schemaVersion: WORKFLOW_SCHEMA_VERSION,
    id: 'wf_webhook_pub',
    orgId: 'org_test_1',
    name: 'Workflow Publicado de Teste',
    version: 1,
    status: 'PUBLISHED',
    triggerNodeId: 'node_trigger',
    nodes: [
      {
        id: 'node_trigger',
        type: 'trigger_form',
        label: 'Gatilho',
        position: { x: 0, y: 0 },
        config: { requiredFields: ['name', 'email', 'message'] },
      },
    ],
    edges: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockDraftWorkflow: WorkflowDefinition = {
    ...mockPublishedWorkflow,
    id: 'wf_draft',
    status: 'DRAFT',
  };

  beforeEach(() => {
    engineServiceMock = {
      simulate: jest.fn().mockResolvedValue({
        executionId: 'exec_sim_123',
        status: 'COMPLETED',
        totalDurationMs: 45,
        nodeResults: [],
      }),
    } as unknown as jest.Mocked<WorkflowEngineService>;

    webhooksService = new WebhooksService(engineServiceMock);
    schedulerService = new SchedulerService();
  });

  // Fixtures positivas autenticadas; casos sem segredo são testados diretamente
  // em triggers.hardening.spec.ts e no container.
  async function authenticatedTrigger(workflow: WorkflowDefinition | null, payload: Record<string, unknown>,
    headers: WebhookTriggerHeaders = {}, expectedSecret = 'fixture_server_secret') {
    return webhooksService.handleWebhookTrigger(workflow, payload, { signature: expectedSecret, ...headers }, expectedSecret);
  }

  describe('WebhooksService', () => {
    it('deve disparar workflow publicado com sucesso via webhook', async () => {
      const payload = {
        name: 'Lead Webhook',
        email: 'lead@example.test',
        message: 'Contato via webhook externo',
      };

      const result = await authenticatedTrigger(
        mockPublishedWorkflow,
        payload,
        {},
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('COMPLETED');
      expect(result.idempotentReplay).toBe(false);
      expect(result.workflowId).toBe(mockPublishedWorkflow.id);
      expect(engineServiceMock.simulate).toHaveBeenCalledTimes(1);
    });

    it('deve rejeitar webhook se o workflow estiver em modo DRAFT (WORKFLOW_NOT_PUBLISHED)', async () => {
      await expect(
        authenticatedTrigger(mockDraftWorkflow, {}, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar se o workflow for nulo (WORKFLOW_NOT_FOUND)', async () => {
      await expect(
        authenticatedTrigger(null, {}, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve validar assinatura do webhook quando segredo for esperado', async () => {
      const expectedSecret = 'super_secret_webhook_token_123';

      // 1. Assinatura inválida
      await expect(
        authenticatedTrigger(
          mockPublishedWorkflow,
          {},
          { signature: 'token_errado' },
          expectedSecret,
        ),
      ).rejects.toThrow(UnauthorizedException);

      // 2. Assinatura correta (secret direto legado)
      const successResult = await authenticatedTrigger(
        mockPublishedWorkflow,
        {},
        { signature: expectedSecret },
        expectedSecret,
      );
      expect(successResult.status).toBe('COMPLETED');
    });

    it('deve validar assinatura canônica HMAC-SHA256 (t=<timestamp>,v1=<hmac>) e rejeitar adulteração', async () => {
      const expectedSecret = 'whsec_prod_secret_998877';
      const payload = { contact: 'lead@test.com', plan: 'enterprise' };
      const rawPayload = JSON.stringify(payload);
      const currentTs = Math.floor(Date.now() / 1000);

      const validHmacHeader = WebhookSignatureValidator.computeSignature(
        rawPayload,
        expectedSecret,
        currentTs,
      );

      // Assinatura HMAC válida: sucesso
      const res = await webhooksService.handleWebhookTrigger(
        mockPublishedWorkflow,
        payload,
        { signature: validHmacHeader },
        expectedSecret,
      );
      expect(res.status).toBe('COMPLETED');

      // Assinatura HMAC com payload adulterado: UnauthorizedException
      await expect(
        webhooksService.handleWebhookTrigger(
          mockPublishedWorkflow,
          { ...payload, injected: true },
          { signature: validHmacHeader },
          expectedSecret,
        ),
      ).rejects.toThrow(UnauthorizedException);

      // Assinatura HMAC expirada (replay): UnauthorizedException
      const expiredHmacHeader = WebhookSignatureValidator.computeSignature(
        rawPayload,
        expectedSecret,
        currentTs - 400,
      );
      await expect(
        webhooksService.handleWebhookTrigger(
          mockPublishedWorkflow,
          payload,
          { signature: expiredHmacHeader },
          expectedSecret,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve deduplicar requests com a mesma chave de idempotência (Idempotent Replay)', async () => {
      const idempotencyKey = 'unique_req_id_999';
      const payload = { event: 'user_signup', userId: 42 };

      // Primeira chamada: executa no motor
      const firstRes = await authenticatedTrigger(
        mockPublishedWorkflow,
        payload,
        { idempotencyKey },
      );
      expect(firstRes.idempotentReplay).toBe(false);
      expect(engineServiceMock.simulate).toHaveBeenCalledTimes(1);

      // Segunda chamada com mesma chave: retorna cache e não executa o motor novamente
      const secondRes = await authenticatedTrigger(
        mockPublishedWorkflow,
        payload,
        { idempotencyKey },
      );
      expect(secondRes.idempotentReplay).toBe(true);
      expect(secondRes.executionId).toBe(firstRes.executionId);
      expect(engineServiceMock.simulate).toHaveBeenCalledTimes(1); // Continua 1 vez!
    });
    it('deve rejeitar payload inválido se não for objeto', async () => {
      await expect(
        authenticatedTrigger(
          mockPublishedWorkflow,
          null as unknown as Record<string, unknown>,
          {},
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        authenticatedTrigger(
          mockPublishedWorkflow,
          [] as unknown as Record<string, unknown>,
          {},
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar chave de idempotência vazia', async () => {
      await expect(
        authenticatedTrigger(
          mockPublishedWorkflow,
          { name: 'Lead' },
          { idempotencyKey: '   ' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve limpar chaves expiradas de idempotência no prune', async () => {
      const idempotencyKey = 'key_to_prune';
      await authenticatedTrigger(
        mockPublishedWorkflow,
        { test: 1 },
        { idempotencyKey },
      );

      // Avança o tempo além do TTL de 10 min
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60 * 1000);
      webhooksService.pruneExpiredIdempotencyKeys();
      nowSpy.mockRestore();

      // Nova chamada com a mesma chave executa o motor novamente porque a anterior foi limpa
      await authenticatedTrigger(
        mockPublishedWorkflow,
        { test: 1 },
        { idempotencyKey },
      );
      expect(engineServiceMock.simulate).toHaveBeenCalledTimes(2);
    });
  });

  describe('SchedulerService', () => {
    it('deve validar expressões cron válidas', () => {
      expect(schedulerService.validateCronExpression('0 9 * * 1-5')).toBe(true);
      expect(schedulerService.validateCronExpression('*/15 * * * *')).toBe(true);
      expect(schedulerService.validateCronExpression('0 0 1 * *')).toBe(true);
      expect(schedulerService.validateCronExpression('30 14 1,15 * *')).toBe(true);
    });

    it('deve rejeitar expressões cron inválidas e limites fora da faixa', () => {
      expect(schedulerService.validateCronExpression('')).toBe(false);
      expect(schedulerService.validateCronExpression('invalid_cron')).toBe(false);
      expect(schedulerService.validateCronExpression('0 0 * *')).toBe(false); // apenas 4 partes
      expect(schedulerService.validateCronExpression('1 2 3 4 5 6')).toBe(false); // 6 partes
      expect(schedulerService.validateCronExpression('99 * * * *')).toBe(false); // minuto > 59
      expect(schedulerService.validateCronExpression('0 45 * * *')).toBe(false); // hora > 23
      expect(schedulerService.validateCronExpression('0 0 32 * *')).toBe(false); // dia > 31
      expect(schedulerService.validateCronExpression('0 0 1 13 *')).toBe(false); // mês > 12
      expect(schedulerService.validateCronExpression('0 0 * * 8')).toBe(false); // dia da semana > 7
      expect(schedulerService.validateCronExpression('0 0 5-1 * *')).toBe(false); // start > end
    });

    it('deve validar timezone e informar cálculo ainda indisponível', () => {
      const nextRun = schedulerService.calculateNextRun({
        cronExpression: '0 9 * * 1-5',
        timezone: 'America/Sao_Paulo',
        enabled: true,
      });

      expect(nextRun.isValid).toBe(true);
      expect(nextRun.timezone).toBe('America/Sao_Paulo');
      expect(nextRun.nextExecutionAt).toBeUndefined();
      expect(nextRun.error).toMatch(/indisponível/);
    });

    it('deve rejeitar fuso horário (timezone) IANA inválido', () => {
      const invalidTz = schedulerService.calculateNextRun({
        cronExpression: '0 9 * * 1-5',
        timezone: 'Invalido/Fuso_Inexistente',
        enabled: true,
      });

      expect(invalidTz.isValid).toBe(false);
      expect(invalidTz.error).toMatch(/Fuso horário/);
    });

    it('deve retornar nextExecutionAt indefinido quando agendamento estiver desabilitado', () => {
      const disabledRun = schedulerService.calculateNextRun({
        cronExpression: '0 9 * * 1-5',
        timezone: 'America/Sao_Paulo',
        enabled: false,
      });

      expect(disabledRun.isValid).toBe(true);
      expect(disabledRun.nextExecutionAt).toBeUndefined();
    });

    it('deve bloquear sobreposição de execuções concorrentes para o mesmo workflow', async () => {
      const workflowId = 'wf_concurrent_test';

      let resolveSlowRun: () => void = () => {};
      const slowPromise = new Promise<void>((resolve) => {
        resolveSlowRun = resolve;
      });

      // Dispara primeira execução (lenta/em andamento)
      const firstTrigger = schedulerService.triggerScheduledRun(workflowId, () => slowPromise);

      expect(schedulerService.isRunning(workflowId)).toBe(true);

      // Tenta disparar segunda execução enquanto a primeira roda
      const secondTriggerStarted = await schedulerService.triggerScheduledRun(
        workflowId,
        async () => {},
      );

      // A segunda tentativa deve ser bloqueada (retorna false)
      expect(secondTriggerStarted).toBe(false);

      // Finaliza a primeira
      resolveSlowRun();
      await firstTrigger;

      // Agora o workflow está livre novamente
      expect(schedulerService.isRunning(workflowId)).toBe(false);
    });

    it('deve rejeitar workflowId vazio em triggerScheduledRun', async () => {
      await expect(
        schedulerService.triggerScheduledRun('', async () => {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('WebhooksController', () => {
    it('ingresso permanece fechado até resolver autorização no servidor', async () => {
      const ingress = { handle: jest.fn().mockRejectedValue(new ServiceUnavailableException()) };
      const controller = new WebhooksController(ingress as never);
      await expect(controller.handleWebhook('whk_fixture', { rawBody: Buffer.from('{}') } as never, 'application/json')).rejects.toThrow(ServiceUnavailableException);
      expect(engineServiceMock.simulate).not.toHaveBeenCalled();
    });
  });
});

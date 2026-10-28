import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { WorkflowDefinition } from '@flowmind/contracts';
import { WebhooksService } from './webhooks.service';
import { SchedulerService } from './scheduler.service';

describe('T12 — ingresso autenticado e datas não fabricadas', () => {
  const workflow = { id: 'wf_beta', orgId: 'org_beta', name: 'Nome privado Beta', status: 'PUBLISHED' } as WorkflowDefinition;
  const secret = 'fixture_server_secret';
  let engine: any;
  let service: WebhooksService;
  beforeEach(() => {
    engine = { simulate: jest.fn(async () => ({ executionId: 'exec_fixture', status: 'COMPLETED' })) };
    service = new WebhooksService(engine);
  });

  it.each([undefined, '', '   '])('sem segredo do servidor (%s) não executa', async (configuredSecret) => {
    await expect(service.handleWebhookTrigger(workflow, {}, { signature: secret }, configuredSecret))
      .rejects.toThrow(ServiceUnavailableException);
    expect(engine.simulate).not.toHaveBeenCalled();
  });

  it.each([undefined, 'wrong', 'fixture_server_secreX'])('assinatura %s não expõe estado nem executa', async (signature) => {
    for (const candidate of [workflow, { ...workflow, status: 'DRAFT' } as WorkflowDefinition, null]) {
      try {
        await service.handleWebhookTrigger(candidate, {}, { signature }, secret);
        throw new Error('Deveria negar autenticação');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(JSON.stringify((error as UnauthorizedException).getResponse())).not.toContain('Nome privado Beta');
      }
    }
    expect(engine.simulate).not.toHaveBeenCalled();
  });

  it('com autorização sintética válida simula e deduplica chamadas sequenciais', async () => {
    const headers = { signature: secret, idempotencyKey: 'fixture_event' };
    const first = await service.handleWebhookTrigger(workflow, {}, headers, secret);
    const replay = await service.handleWebhookTrigger(workflow, {}, headers, secret);
    expect(first.status).toBe('COMPLETED'); expect(replay.idempotentReplay).toBe(true);
    expect(engine.simulate).toHaveBeenCalledTimes(1);
  });

  it('cron diário não apresenta próximo minuto como próxima execução', () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-10-12T00:01:30Z'));
      const result = new SchedulerService().calculateNextRun({ cronExpression: '0 9 * * *', timezone: 'UTC', enabled: true });
      expect(result.isValid).toBe(true); expect(result.nextExecutionAt).toBeUndefined();
      expect(result.error).toMatch(/indisponível/);
    } finally { jest.useRealTimers(); }
  });
});

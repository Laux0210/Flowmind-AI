import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './load-typescript.mjs';

const webhooksServicePath = 'apps/api/src/triggers/webhooks.service.ts';
const schedulerServicePath = 'apps/api/src/triggers/scheduler.service.ts';

function authenticatedTrigger(service, workflow, payload, headers = {}, expectedSecret = 'fixture_server_secret') {
  return service.handleWebhookTrigger(workflow, payload, { signature: expectedSecret, ...headers }, expectedSecret);
}

function createMockPublishedWorkflow() {
  return {
    schemaVersion: '1.0.0',
    id: 'wf_reg_pub',
    orgId: 'org_alpha',
    name: 'Workflow Publicado Regressão',
    version: 1,
    status: 'PUBLISHED',
    triggerNodeId: 'form',
    nodes: [
      { id: 'form', type: 'trigger_form', config: { requiredFields: ['name', 'email'] } },
    ],
    edges: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

test('WebhooksService: dispara workflow PUBLISHED e deduplica chamadas idênticas via idempotencyKey', async () => {
  const { exports } = await loadTypeScript(webhooksServicePath);
  let simulateCalls = 0;
  const mockEngine = {
    simulate: async (wf, payload) => {
      simulateCalls++;
      return {
        executionId: 'exec_reg_123',
        status: 'COMPLETED',
        totalDurationMs: 15,
        nodeResults: [],
      };
    },
  };

  const service = new exports.WebhooksService(mockEngine);
  const wf = createMockPublishedWorkflow();
  const payload = { name: 'Lead Teste', email: 'lead@example.test' };

  // Primeira execução
  const res1 = await authenticatedTrigger(service, wf, payload, { idempotencyKey: 'idemp_reg_99' });
  assert.equal(res1.status, 'COMPLETED');
  assert.equal(res1.idempotentReplay, false);
  assert.equal(simulateCalls, 1);

  // Segunda execução com a mesma chave: não chama o motor novamente
  const res2 = await authenticatedTrigger(service, wf, payload, { idempotencyKey: 'idemp_reg_99' });
  assert.equal(res2.status, 'COMPLETED');
  assert.equal(res2.idempotentReplay, true);
  assert.equal(res2.executionId, res1.executionId);
  assert.equal(simulateCalls, 1);
});

test('WebhooksService: bloqueia disparo de workflow em estado DRAFT', async () => {
  const { exports } = await loadTypeScript(webhooksServicePath);
  const mockEngine = { simulate: async () => ({}) };
  const service = new exports.WebhooksService(mockEngine);
  const draftWf = { ...createMockPublishedWorkflow(), status: 'DRAFT' };

  await assert.rejects(
    authenticatedTrigger(service, draftWf, { name: 'Lead' }, {}),
    (err) => err.response?.code === 'WORKFLOW_NOT_PUBLISHED',
  );
});

test('WebhooksService: valida assinatura timing-safe e rejeita token incorreto', async () => {
  const { exports } = await loadTypeScript(webhooksServicePath);
  const mockEngine = { simulate: async () => ({ executionId: 'ex1', status: 'COMPLETED' }) };
  const service = new exports.WebhooksService(mockEngine);
  const wf = createMockPublishedWorkflow();
  const secret = 'super_safe_secret_456';

  // Assinatura inválida
  await assert.rejects(
    authenticatedTrigger(service, wf, { name: 'Lead' }, { signature: 'wrong_secret' }, secret),
    (err) => err.response?.code === 'INVALID_WEBHOOK_SIGNATURE',
  );

  // Assinatura válida
  const okRes = await authenticatedTrigger(service,
    wf,
    { name: 'Lead' },
    { signature: secret },
    secret,
  );
  assert.equal(okRes.status, 'COMPLETED');
});

test('WebhooksService: rejeita payload inválido ou chave de idempotência em branco', async () => {
  const { exports } = await loadTypeScript(webhooksServicePath);
  const mockEngine = { simulate: async () => ({}) };
  const service = new exports.WebhooksService(mockEngine);
  const wf = createMockPublishedWorkflow();

  await assert.rejects(
    authenticatedTrigger(service, wf, null, {}),
    (err) => err.response?.code === 'INVALID_WEBHOOK_PAYLOAD',
  );

  await assert.rejects(
    authenticatedTrigger(service, wf, { name: 'Lead' }, { idempotencyKey: '   ' }),
    (err) => err.response?.code === 'INVALID_IDEMPOTENCY_KEY',
  );
});

test('SchedulerService: valida cron com limites numéricos e rejeita valores fora da faixa', async () => {
  const { exports } = await loadTypeScript(schedulerServicePath);
  const scheduler = new exports.SchedulerService();

  assert.equal(scheduler.validateCronExpression('0 9 * * 1-5'), true);
  assert.equal(scheduler.validateCronExpression('*/15 * * * *'), true);
  assert.equal(scheduler.validateCronExpression('0 0 1 * *'), true);

  // Fora da faixa
  assert.equal(scheduler.validateCronExpression('60 * * * *'), false); // min > 59
  assert.equal(scheduler.validateCronExpression('0 25 * * *'), false); // hora > 23
  assert.equal(scheduler.validateCronExpression('0 0 32 * *'), false); // dia > 31
  assert.equal(scheduler.validateCronExpression('0 0 1 13 *'), false); // mês > 12
  assert.equal(scheduler.validateCronExpression('0 0 * * 9'), false);  // semana > 7
  assert.equal(scheduler.validateCronExpression('invalido'), false);
});

test('SchedulerService: valida timezone IANA e bloqueia execuções concorrentes simultâneas', async () => {
  const { exports } = await loadTypeScript(schedulerServicePath);
  const scheduler = new exports.SchedulerService();

  const validRun = scheduler.calculateNextRun({
    cronExpression: '0 9 * * 1-5',
    timezone: 'America/Sao_Paulo',
    enabled: true,
  });
  assert.equal(validRun.isValid, true);
  assert.equal(validRun.nextExecutionAt, undefined);
  assert.match(validRun.error, /indisponível/);

  const invalidTzRun = scheduler.calculateNextRun({
    cronExpression: '0 9 * * 1-5',
    timezone: 'Planeta/Marte',
    enabled: true,
  });
  assert.equal(invalidTzRun.isValid, false);
  assert.match(invalidTzRun.error, /Fuso horário/);

  // Concorrência: bloqueia disparo enquanto anterior está rodando
  const workflowId = 'wf_sched_concurrency';
  let finishRun;
  const runningPromise = new Promise((resolve) => { finishRun = resolve; });

  const firstTrigger = scheduler.triggerScheduledRun(workflowId, () => runningPromise);
  assert.equal(scheduler.isRunning(workflowId), true);

  // Segunda chamada concorrente rejeitada
  const secondResult = await scheduler.triggerScheduledRun(workflowId, async () => {});
  assert.equal(secondResult, false);

  finishRun();
  await firstTrigger;
  assert.equal(scheduler.isRunning(workflowId), false);
});

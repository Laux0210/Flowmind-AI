import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './load-typescript.mjs';

const executionsServicePath = 'apps/api/src/executions/executions.service.ts';
const usageLimitsServicePath = 'apps/api/src/executions/usage-limits.service.ts';

test('ExecutionsService: isolamento estrito entre organizações (SEC01 e SEC04)', async () => {
  const { exports: limitsExports } = await loadTypeScript(usageLimitsServicePath);
  const { exports: execExports } = await loadTypeScript(executionsServicePath);

  const rows = [];
  const prismaMock = {
    workflowExecution: {
      create: async (args) => {
        rows.push(args.data);
        return args.data;
      },
      findMany: async ({ where, take }) => {
        return rows
          .filter((r) => r.orgId === where.orgId && (!where.workflowId || r.workflowId === where.workflowId))
          .slice(0, take);
      },
      findFirst: async ({ where }) => {
        return rows.find((r) => r.id === where.id && r.orgId === where.orgId) || null;
      },
      count: async ({ where }) => {
        return rows.filter((r) => r.orgId === where.orgId).length;
      },
    },
  };

  const usageLimits = new limitsExports.UsageLimitsService(prismaMock);
  const executionsService = new execExports.ExecutionsService(prismaMock, usageLimits);

  // Tenant Alpha registra uma execução
  const execAlpha = await executionsService.recordExecution(
    'org_alpha',
    'wf_alpha_1',
    1,
    'SIMULATION',
    'COMPLETED',
    'user_alpha',
    [{ nodeId: 'n1', nodeType: 'trigger_form', status: 'SUCCESS', startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), inputs: {}, outputs: {} }],
    new Date().toISOString(),
  );

  // Tenant Beta registra uma execução
  const execBeta = await executionsService.recordExecution(
    'org_beta',
    'wf_beta_1',
    1,
    'SIMULATION',
    'COMPLETED',
    'user_beta',
    [{ nodeId: 'n2', nodeType: 'trigger_form', status: 'SUCCESS', startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), inputs: {}, outputs: {} }],
    new Date().toISOString(),
  );

  // 1. Listagem isolada
  const listAlpha = await executionsService.listExecutions('org_alpha');
  assert.equal(listAlpha.length, 1);
  assert.equal(listAlpha[0].id, execAlpha.id);

  const listBeta = await executionsService.listExecutions('org_beta');
  assert.equal(listBeta.length, 1);
  assert.equal(listBeta[0].id, execBeta.id);

  // 2. Consulta direta de detalhe próprio
  const detailAlpha = await executionsService.getExecutionById('org_alpha', execAlpha.id);
  assert.equal(detailAlpha.id, execAlpha.id);
  assert.equal(detailAlpha.orgId, 'org_alpha');

  // 3. Consulta cruzada: Tenant Beta tenta consultar Alpha -> 404 EXECUTION_NOT_FOUND
  await assert.rejects(
    executionsService.getExecutionById('org_beta', execAlpha.id),
    (err) => err.response?.code === 'EXECUTION_NOT_FOUND',
  );

  // Tenant Alpha tenta consultar Beta -> 404 EXECUTION_NOT_FOUND
  await assert.rejects(
    executionsService.getExecutionById('org_alpha', execBeta.id),
    (err) => err.response?.code === 'EXECUTION_NOT_FOUND',
  );
});

test('ExecutionsService: sanitiza segredos e tokens nos dados gravados', async () => {
  const { exports: limitsExports } = await loadTypeScript(usageLimitsServicePath);
  const { exports: execExports } = await loadTypeScript(executionsServicePath);

  const rows = [];
  const prismaMock = {
    workflowExecution: {
      create: async (args) => {
        rows.push(args.data);
        return args.data;
      },
      findFirst: async ({ where }) => rows.find((r) => r.id === where.id) || null,
      count: async () => 0,
    },
  };

  const usageLimits = new limitsExports.UsageLimitsService(prismaMock);
  const executionsService = new execExports.ExecutionsService(prismaMock, usageLimits);

  const execution = await executionsService.recordExecution(
    'org_sanit_test',
    'wf_sec_1',
    1,
    'SIMULATION',
    'COMPLETED',
    'user_test',
    [
      {
        nodeId: 'n_auth',
        nodeType: 'http_request',
        status: 'SUCCESS',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        inputs: {
          authHeader: 'Bearer my_jwt_token_secret',
          apiKey: 'sk-1234567890abcdef1234567890abcdef',
          password: 'pass_secret_123',
        },
        outputs: {
          result: 'ok',
        },
      },
    ],
    new Date().toISOString(),
  );

  assert.equal(execution.nodeResults[0].inputs.authHeader, 'Bearer [REDACTED]');
  assert.equal(execution.nodeResults[0].inputs.apiKey, '[REDACTED]');
  assert.equal(execution.nodeResults[0].inputs.password, '[REDACTED]');
});

test('UsageLimitsService: barra execução quando limite de quota mensal for atingido', async () => {
  const { exports: limitsExports } = await loadTypeScript(usageLimitsServicePath);

  const prismaMock = {
    workflowExecution: {
      count: async () => 1000, // Limite atingido
    },
  };

  const usageLimits = new limitsExports.UsageLimitsService(prismaMock);

  await assert.rejects(
    usageLimits.checkAndConsumeExecution('org_quota_full'),
    (err) => err.response?.code === 'QUOTA_EXCEEDED',
  );

  const report = await usageLimits.getOrgUsageReport('org_quota_full');
  assert.equal(report.isLimitReached, true);
  assert.equal(report.usagePercentage, 100);
  assert.equal(report.totalExecutions, 1000);
});

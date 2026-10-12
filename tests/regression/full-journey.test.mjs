import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { loadTypeScript } from './load-typescript.mjs';

const engineFile = 'apps/api/src/engine/workflow-engine.service.ts';
const aiGeneratorFile = 'apps/api/src/ai/ai-generator.service.ts';
const executionsFile = 'apps/api/src/executions/executions.service.ts';
const limitsFile = 'apps/api/src/executions/usage-limits.service.ts';
const workflowsFile = 'apps/api/src/workflows/workflows.service.ts';
const executorsFile = 'apps/api/src/engine/node-executors.ts';

const orgAlpha = 'org_alpha_master';
const orgBeta = 'org_beta_intruder';

// Fixture do workflow padrão da jornada (T01 / C01 / C02 / C03)
function buildJourneyWorkflow(orgId = orgAlpha) {
  return {
    schemaVersion: '1.0.0',
    id: 'wf_journey_c01',
    orgId,
    name: 'Atendimento Comercial Inteligente',
    version: 1,
    status: 'PUBLISHED',
    triggerNodeId: 'form',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: [
      {
        id: 'form',
        type: 'trigger_form',
        label: 'Gatilho de Formulário',
        position: { x: 0, y: 0 },
        config: { requiredFields: ['name', 'email', 'message'] },
      },
      {
        id: 'ai',
        type: 'ai_analyze_intent',
        label: 'Análise de Intenção por IA',
        position: { x: 200, y: 0 },
        config: { modelRef: 'gpt-4o-mini', inputPromptTemplate: '{{form.message_text}}' },
      },
      {
        id: 'record',
        type: 'internal_record',
        label: 'Registro Interno de Negócio',
        position: { x: 400, y: 0 },
        config: {
          fieldMappings: {
            name: '{{form.contact_name}}',
            email: '{{form.contact_email}}',
            raw_message: '{{form.message_text}}',
            ai_summary: '{{ai.summary}}',
            ai_intent: '{{ai.intent}}',
            ambiguities: '{{ai.ambiguities}}',
          },
        },
      },
      {
        id: 'email',
        type: 'send_email',
        label: 'E-mail de Confirmação',
        position: { x: 600, y: 0 },
        config: {
          to: '{{form.contact_email}}',
          subject: 'Recebemos seu contato comercial',
          bodyTemplate: 'Olá {{form.contact_name}}! Resumo: {{ai.summary}} | Pendências: {{ai.ambiguities}}',
        },
      },
    ],
    edges: [
      { id: 'e1', sourceNodeId: 'form', targetNodeId: 'ai' },
      { id: 'e2', sourceNodeId: 'ai', targetNodeId: 'record' },
      { id: 'e3', sourceNodeId: 'record', targetNodeId: 'email' },
    ],
  };
}

test('T14 — C01: Jornada completa com formulário, IA, registro e e-mail (Pedido Completo)', async () => {
  const { exports: engineModule } = await loadTypeScript(engineFile);
  const { exports: aiModule } = await loadTypeScript(aiGeneratorFile);
  const { exports: executionsModule } = await loadTypeScript(executionsFile);
  const { exports: limitsModule } = await loadTypeScript(limitsFile);

  // 1. Proposta gerada por IA a partir de linguagem natural
  const aiGenerator = new aiModule.AiGeneratorService();
  const proposal = await aiGenerator.generateFromNaturalLanguage(
    { prompt: 'Quando formulário for enviado, resuma mensagem e identifique intenção e ambiguidades com IA, registre internamente e envie e-mail.' },
    orgAlpha,
  );
  assert.equal(proposal.requiresHumanReview, true);
  assert.equal(proposal.workflow.nodes.length, 4);

  // 2. Execução da simulação com dados do Caso C01
  const engine = new engineModule.WorkflowEngineService();
  const c01Payload = {
    name: 'Carlos Proposta',
    email: 'carlos.empresa@example.test',
    message: 'Gostaria de contratar seus serviços de IA e solicitar uma proposta orçamentária comercial urgente.',
  };

  const simResult = await engine.simulate(buildJourneyWorkflow(), c01Payload);
  assert.equal(simResult.status, 'COMPLETED');
  assert.equal(simResult.nodeResults.length, 4);

  // Verificações semânticas e de negócio
  const formStep = simResult.nodeResults.find((n) => n.nodeId === 'form');
  assert.equal(formStep.status, 'SUCCESS');
  assert.equal(formStep.outputs.contact_name, 'Carlos Proposta');
  assert.equal(formStep.outputs.contact_email, 'carlos.empresa@example.test');

  const aiStep = simResult.nodeResults.find((n) => n.nodeId === 'ai');
  assert.equal(aiStep.status, 'SUCCESS');
  assert.match(aiStep.outputs.summary, /proposta|orçament/i);
  assert.equal(typeof aiStep.outputs.intent, 'string');
  assert.ok(Array.isArray(aiStep.outputs.ambiguities));
  assert.equal('interest_level' in aiStep.outputs, false, 'Não deve inventar pontuação comercial');
  assert.equal('confidence_score' in aiStep.outputs, false, 'Não deve inventar pontuação comercial');

  const recordStep = simResult.nodeResults.find((n) => n.nodeId === 'record');
  assert.equal(recordStep.status, 'SUCCESS');
  assert.equal(recordStep.outputs.status, 'simulated');
  assert.ok(recordStep.outputs.record_id);

  const emailStep = simResult.nodeResults.find((n) => n.nodeId === 'email');
  assert.equal(emailStep.status, 'SUCCESS');
  assert.equal(emailStep.outputs.recipient, 'carlos.empresa@example.test');
  assert.equal(emailStep.outputs.delivery_status, 'simulated');

  // 3. Persistência de histórico isolado
  const prismaFake = {
    workflowExecution: {
      create: async ({ data }) => ({ ...data, id: 'exec_c01_001', createdAt: new Date() }),
      count: async () => 1,
    },
  };
  const limitsService = new limitsModule.UsageLimitsService(prismaFake);
  const executionsService = new executionsModule.ExecutionsService(prismaFake, limitsService);

  const recorded = await executionsService.recordExecution(
    orgAlpha,
    'wf_journey_c01',
    1,
    'SIMULATION',
    'COMPLETED',
    'test_user',
    simResult.nodeResults,
    new Date().toISOString(),
  );
  assert.equal(recorded.orgId, orgAlpha);
  assert.equal(recorded.workflowId, 'wf_journey_c01');
});

test('T14 — C02: Preservação de ambiguidades em dúvidas gerais sem pontuação comercial', async () => {
  const { exports: engineModule } = await loadTypeScript(engineFile);
  const engine = new engineModule.WorkflowEngineService();

  const c02Payload = {
    name: 'Mariana Dúvidas',
    email: 'mariana.contato@example.test',
    message: 'Tenho algumas dúvidas gerais sobre a plataforma e não sei se temos interesse imediato.',
  };

  const simResult = await engine.simulate(buildJourneyWorkflow(), c02Payload);
  assert.equal(simResult.status, 'COMPLETED');

  const aiStep = simResult.nodeResults.find((n) => n.nodeId === 'ai');
  assert.ok(aiStep.outputs.ambiguities.length > 0, 'Deve identificar ambiguidades');
  assert.equal('interest_level' in aiStep.outputs, false);

  const emailStep = simResult.nodeResults.find((n) => n.nodeId === 'email');
  assert.ok(emailStep.inputs.bodyTemplate.includes(aiStep.outputs.ambiguities[0]));
});

test('T14 — C03: Interrupção imediata antes de efeitos colaterais com payload incompleto', async () => {
  const { exports: engineModule } = await loadTypeScript(engineFile);
  const engine = new engineModule.WorkflowEngineService();

  const incompletePayloads = [
    { name: 'Sem Email', message: 'Falta email' },
    { name: 'Email Vazio', email: '', message: 'Email vazio' },
    { name: 'Email Espaços', email: '   ', message: 'Espaços' },
    { name: 'Email Inválido', email: 'nao-e-email', message: 'Inválido' },
  ];

  for (const payload of incompletePayloads) {
    const result = await engine.simulate(buildJourneyWorkflow(), payload);
    assert.equal(result.status, 'FAILED');
    assert.equal(result.nodeResults.length, 1, 'Deve parar imediatamente no gatilho');
    assert.equal(result.nodeResults[0].nodeId, 'form');
    assert.equal(result.nodeResults[0].status, 'FAILED');
    assert.equal(result.nodeResults.some((n) => n.nodeId === 'ai'), false);
    assert.equal(result.nodeResults.some((n) => n.nodeId === 'record'), false);
    assert.equal(result.nodeResults.some((n) => n.nodeId === 'email'), false);
  }
});

test('T14 — Matriz de Isolamento Multi-tenant (SEC01–SEC04, SEC09)', async () => {
  const { exports: workflowsModule } = await loadTypeScript(workflowsFile);
  const { exports: executionsModule } = await loadTypeScript(executionsFile);
  const { exports: limitsModule } = await loadTypeScript(limitsFile);

  const store = new Map();
  const prismaMock = {
    $transaction: async (fn) => fn(prismaMock),
    workflow: {
      create: async ({ data }) => {
        const item = { ...data, id: 'wf_alpha_secret', createdAt: new Date(), updatedAt: new Date() };
        store.set(item.id, item);
        return item;
      },
      findFirst: async ({ where }) => {
        const item = store.get(where.id);
        return item?.orgId === where.orgId ? item : null;
      },
      updateMany: async ({ where, data }) => {
        const item = store.get(where.id);
        if (item?.orgId !== where.orgId) return { count: 0 };
        store.set(item.id, { ...item, ...data });
        return { count: 1 };
      },
      deleteMany: async ({ where }) => {
        const item = store.get(where.id);
        if (item?.orgId !== where.orgId) return { count: 0 };
        store.delete(item.id);
        return { count: 1 };
      },
    },
    workflowExecution: {
      findFirst: async ({ where }) => (where.orgId === orgAlpha ? { id: where.id, orgId: orgAlpha } : null),
      findMany: async ({ where }) => (where.orgId === orgAlpha ? [{ id: 'exec_alpha', orgId: orgAlpha }] : []),
      count: async () => 0,
    },
  };

  const engineFake = { simulate: async () => ({ status: 'COMPLETED' }) };
  const workflowsService = new workflowsModule.WorkflowsService(prismaMock, engineFake);
  const limitsService = new limitsModule.UsageLimitsService(prismaMock);
  const executionsService = new executionsModule.ExecutionsService(prismaMock, limitsService);

  const created = await workflowsService.create(orgAlpha, { name: 'Workflow Confidencial Alpha' });

  // SEC01: Consulta cruzada por Org_Beta falha
  await assert.rejects(workflowsService.findOne(orgBeta, created.id), /não encontrado|NotFoundException/i);

  // SEC02: Mutação cruzada por Org_Beta falha
  await assert.rejects(workflowsService.update(orgBeta, created.id, { name: 'Hack' }), /não encontrado|NotFoundException/i);

  // SEC03: Simulação cruzada por Org_Beta falha
  await assert.rejects(workflowsService.simulate(orgBeta, created.id, { initialPayload: {} }), /não encontrado|NotFoundException/i);

  // SEC04: Histórico de execuções de Org_Alpha invisível para Org_Beta
  await assert.rejects(executionsService.getExecutionById(orgBeta, 'exec_alpha'), /não encontrada|NotFoundException/i);
  const betaList = await executionsService.listExecutions(orgBeta);
  assert.equal(betaList.length, 0);

  // SEC09: Workflow PUBLISHED não permite edição direta ou exclusão
  const publishedItem = {
    ...created,
    status: 'PUBLISHED',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.set(publishedItem.id, publishedItem);

  await assert.rejects(workflowsService.update(orgAlpha, publishedItem.id, { name: 'Nova Versao' }), /novas revisões/);
  await assert.rejects(workflowsService.remove(orgAlpha, publishedItem.id), /ativo/);
});

test('T14 — Segurança: Proteção contra SSRF e sanitização profunda de credenciais', async () => {
  const { exports: executorsModule } = await loadTypeScript(executorsFile);
  const { exports: limitsModule } = await loadTypeScript(limitsFile);

  // 1. SSRF: Bloqueio estrito de IPs e domínios de infraestrutura privada
  const dangerousUrls = [
    'http://127.0.0.1:8080/admin',
    'http://localhost:3000/keys',
    'http://169.254.169.254/latest/meta-data',
    'http://metadata.google.internal/computeMetadata',
    'http://10.0.0.1/private',
    'http://172.16.0.1/internal',
    'http://192.168.1.1/router',
  ];

  for (const url of dangerousUrls) {
    assert.throws(
      () => executorsModule.NodeExecutors.validateUrlAgainstSsrf(url),
      /bloqueado por segurança|bloqueados/i,
    );
  }

  // 2. PRIV01: Sanitização de dados sensíveis
  const dirtyData = {
    apiSecret: 'super-secret-key-12345',
    token: 'jwt.bearer.fake.token',
    openAiKey: 'sk-abcdef1234567890abcdef1234567890',
    user: {
      name: 'Maria',
      password: 'password123',
      credentials: {
        apiKey: 'chave_privada_123',
      },
    },
  };

  const sanitized = limitsModule.UsageLimitsService.sanitizeSensitiveData(dirtyData);
  assert.equal(sanitized.apiSecret, '[REDACTED]');
  assert.equal(sanitized.token, '[REDACTED]');
  assert.equal(sanitized.openAiKey, 'sk-[REDACTED]');
  assert.equal(sanitized.user.password, '[REDACTED]');
  assert.equal(sanitized.user.credentials.apiKey, '[REDACTED]');
  assert.equal(sanitized.user.name, 'Maria');
});

test('T14 — Acessibilidade e WCAG 2.1 AA: Verificação estática dos componentes de interface', () => {
  const webDir = path.resolve('apps/web/src');
  const dashboardContent = fs.readFileSync(path.join(webDir, 'app/dashboard/page.tsx'), 'utf-8');
  const historyContent = fs.readFileSync(path.join(webDir, 'app/history/page.tsx'), 'utf-8');
  const workflowContent = fs.readFileSync(path.join(webDir, 'app/workflows/[id]/page.tsx'), 'utf-8');
  const navbarContent = fs.readFileSync(path.join(webDir, 'components/navigation/navbar.tsx'), 'utf-8');

  // 1. Modais devem conter role="dialog", aria-modal="true" e aria-labelledby
  assert.ok(dashboardContent.includes('role="dialog"'), 'Dashboard deve ter role dialog no modal');
  assert.ok(dashboardContent.includes('aria-modal="true"'), 'Dashboard deve ter aria-modal');
  assert.ok(dashboardContent.includes('aria-labelledby="modal-workflow-title"'), 'Dashboard deve ter aria-labelledby');
  assert.ok(dashboardContent.includes('e.key === \'Escape\''), 'Dashboard deve fechar com Escape');

  assert.ok(historyContent.includes('role="dialog"'), 'History deve ter role dialog no modal');
  assert.ok(historyContent.includes('aria-modal="true"'), 'History deve ter aria-modal');
  assert.ok(historyContent.includes('aria-labelledby="execution-detail-title"'), 'History deve ter aria-labelledby');
  assert.ok(historyContent.includes('e.key === \'Escape\''), 'History deve fechar com Escape');

  assert.ok(workflowContent.includes('role="dialog"'), 'Workflow editor deve ter role dialog no drawer de simulação');
  assert.ok(workflowContent.includes('aria-modal="true"'), 'Workflow editor deve ter aria-modal');
  assert.ok(workflowContent.includes('aria-labelledby="sim-drawer-title"'), 'Workflow editor deve ter aria-labelledby');
  assert.ok(workflowContent.includes('e.key === \'Escape\''), 'Workflow editor deve fechar com Escape');

  // 2. Navbar deve ter aria-label em links icônicos
  assert.ok(navbarContent.includes('aria-label='), 'Navbar deve ter aria-label no link da marca');

  // 3. Hierarquia semântica h1 / h2 presente
  assert.ok(dashboardContent.includes('<h1'), 'Dashboard deve possuir h1');
  assert.ok(historyContent.includes('<h1'), 'History deve possuir h1');
  assert.ok(workflowContent.includes('Etapas da Jornada'), 'Workflow editor deve conter painel de etapas acessível');
});

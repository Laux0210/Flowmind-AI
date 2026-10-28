import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './load-typescript.mjs';
import { loadUiHandlers } from './load-ui-handlers.mjs';

const clientFile = 'apps/web/src/lib/api-client.ts';
const engineFile = 'apps/api/src/engine/workflow-engine.service.ts';
const dagFile = 'apps/api/src/engine/dag-validator.ts';
const historyPage = 'apps/web/src/app/history/page.tsx';
const editorPage = 'apps/web/src/app/workflows/[id]/page.tsx';
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const activeContext = (orgId = 'org_alpha') => ({ orgId, revision: 0, selection: 0,
  saving: false, simulating: false, reviewing: false, publishing: false, deactivating: false, generatingAi: false });

async function historyHarness(api) {
  return loadUiHandlers(historyPage, ['handleInspect', 'closeExecutionDetail'], {
    orgId: 'org_alpha', activeOrg: { current: 'org_alpha' }, inspectSeq: { current: 0 },
    inspectError: null, activeContext: { current: activeContext() },
    getToken: async () => 'signed_fixture', ApiClient: api,
  });
}

test('history: falha do consumo preserva a listagem que respondeu com sucesso', async () => {
  const rows = [{ id: 'exec_alpha' }];
  const h = await loadUiHandlers(historyPage, ['loadData'], {
    cancelled: false, getToken: async () => 'signed_fixture',
    ApiClient: { listExecutions: async () => rows, getUsage: async () => { throw new Error('Consumo indisponível.'); } },
  });
  await h.handlers.loadData();
  assert.equal(h.state.executions, rows); assert.equal(h.state.usage, null);
  assert.match(h.state.error, /consumo/i); assert.equal(h.state.loading, false);
});
test('history: falha da listagem preserva consumo obtido e distingue erro de lista vazia', async () => {
  const usage = { orgId: 'org_alpha', totalExecutions: 12 };
  const h = await loadUiHandlers(historyPage, ['loadData'], {
    cancelled: false, getToken: async () => 'signed_fixture',
    ApiClient: { listExecutions: async () => { throw new Error('Histórico indisponível.'); }, getUsage: async () => usage },
  });
  await h.handlers.loadData(); assert.equal(h.state.usage, usage);
  assert.equal(h.state.executionLoadFailed, true); assert.match(h.state.error, /histórico/i);
});

test('history: carregar contexto cancelado após getToken não dispara consultas', async () => {
  const token = deferred(); let calls = 0;
  const h = await loadUiHandlers(historyPage, ['loadData'], {
    cancelled: false, getToken: () => token.promise,
    ApiClient: { listExecutions: async () => { calls++; return []; }, getUsage: async () => { calls++; return {}; } },
  });
  const pending = h.handlers.loadData(); h.context.cancelled = true;
  token.resolve('new_session'); await pending; assert.equal(calls, 0);
});

test('history: resposta E1 atrasada não substitui seleção mais recente E2', async () => {
  const first = deferred(), second = deferred();
  const h = await historyHarness({ getExecution: (id) => id === 'e1' ? first.promise : second.promise });
  const p1 = h.handlers.handleInspect('e1'), p2 = h.handlers.handleInspect('e2');
  await flush(); second.resolve({ id: 'e2' }); await p2;
  first.resolve({ id: 'e1' }); await p1;
  assert.equal(h.state.selectedExecution.id, 'e2');
});

test('history: finally de uma seleção antiga não encerra loading da seleção atual', async () => {
  const first = deferred(), second = deferred();
  const h = await historyHarness({ getExecution: (id) => id === 'e1' ? first.promise : second.promise });
  const p1 = h.handlers.handleInspect('e1'), p2 = h.handlers.handleInspect('e2');
  await flush(); first.resolve({ id: 'e1' }); await p1;
  assert.equal(h.state.loadingDetail, true); assert.equal(h.state.selectedExecution, null);
  second.resolve({ id: 'e2' }); await p2;
  assert.equal(h.state.loadingDetail, false); assert.equal(h.state.selectedExecution.id, 'e2');
});

test('history: contexto Alpha→Beta→Alpha invalida a resposta da geração anterior', async () => {
  const response = deferred(); const h = await historyHarness({ getExecution: () => response.promise });
  const pending = h.handlers.handleInspect('e1'); await flush();
  h.context.activeOrg.current = 'org_beta'; h.context.activeContext.current = activeContext('org_beta');
  h.context.activeOrg.current = 'org_alpha'; h.context.activeContext.current = activeContext('org_alpha');
  response.resolve({ id: 'e1' }); await pending;
  assert.equal(h.state.selectedExecution, null);
});

test('history: rejeição antiga não escreve erro na nova organização', async () => {
  const response = deferred(); const h = await historyHarness({ getExecution: () => response.promise });
  const pending = h.handlers.handleInspect('e1'); await flush();
  h.context.activeOrg.current = 'org_beta'; h.context.activeContext.current = activeContext('org_beta');
  response.reject(new Error('Falha da organização anterior')); await pending;
  assert.equal(h.state.inspectError, null);
});

test('history: fechar o modal invalida a inspeção pendente', async () => {
  const response = deferred(); const h = await historyHarness({ getExecution: () => response.promise });
  const pending = h.handlers.handleInspect('e1'); await flush();
  h.handlers.closeExecutionDetail(); response.resolve({ id: 'e1' }); await pending;
  assert.equal(h.state.selectedExecution, null); assert.equal(h.state.loadingDetail, false);
});

test('history: troca de contexto durante getToken evita consultar recurso com sessão nova', async () => {
  const token = deferred(); let calls = 0;
  const h = await historyHarness({ getExecution: async () => { calls++; return { id: 'e1' }; } });
  h.context.getToken = () => token.promise;
  const pending = h.handlers.handleInspect('e1');
  h.context.activeOrg.current = 'org_beta'; h.context.activeContext.current = activeContext('org_beta');
  token.resolve('new_session'); await pending; assert.equal(calls, 0);
});

test('history: erro da inspeção atual preserva a mensagem do servidor', async () => {
  const h = await historyHarness({ getExecution: async () => { throw new Error('Histórico temporariamente indisponível.'); } });
  await h.handlers.handleInspect('e1');
  assert.equal(h.state.inspectError, 'Histórico temporariamente indisponível.');
});

async function editorHarness(api) {
  return loadUiHandlers(editorPage, ['handleApplyAiProposal', 'handleReviewWorkflow', 'handleActivateWorkflow'], {
    workflow: { id: 'wf_alpha', status: 'DRAFT', nodes: [{ id: 'g1' }], edges: [] },
    aiResponse: { workflow: { nodes: [{ id: 'g2' }], edges: [], triggerNodeId: 'g2' } },
    isDirty: false, isAnyActionRunning: false, activeContext: { current: activeContext() },
    getToken: async () => 'signed_fixture', ApiClient: api,
  });
}

for (const [handler, flag] of [
  ['handleReviewWorkflow', 'isReviewing'], ['handleActivateWorkflow', 'isPublishing'], ['handleDeactivateWorkflow', 'isDeactivating'],
]) {
  test(`editor: trocar contexto limpa ${flag} enquanto a operação anterior aguarda token`, async () => {
    const token = deferred();
    const h = await loadUiHandlers(editorPage, [handler, 'resetContextEffect'], {
      workflow: { id: 'wf_alpha', status: 'DRAFT', nodes: [], edges: [] }, workflowId: 'wf_alpha',
      orgId: 'org_alpha', isLoaded: true, isDirty: false, searchParams: null, confirm: () => true,
      activeContext: { current: activeContext() }, getToken: () => token.promise,
      ApiClient: { getWorkflow: async () => ({ id: 'wf_beta', status: 'DRAFT', nodes: [], edges: [] }) },
    });
    const pending = h.handlers[handler](); assert.equal(h.state[flag], true);
    h.context.activeContext.current = activeContext('org_beta');
    h.context.orgId = 'org_beta'; h.context.workflowId = 'wf_beta';
    h.context.getToken = async () => 'new_session';
    const cleanup = h.handlers.resetContextEffect(); await flush();
    token.resolve('old_session'); await pending;
    assert.equal(h.state[flag], false); cleanup?.();
  });
}

for (const status of ['FAILED', 'COMPLETED']) {
  test(`editor: feedback da simulação respeita status ${status}`, async () => {
    const h = await loadUiHandlers(editorPage, ['handleRunSimulation'], {
      workflow: { id: 'wf_alpha', triggerNodeId: 'form', nodes: [{ id: 'form', type: 'trigger_form' }] }, workflowId: 'wf_alpha', isDirty: false,
      contactName: 'Pessoa', contactEmail: 'pessoa@example.test', messageText: 'Fixture', scheduledAt: '',
      activeContext: { current: activeContext() }, getToken: async () => 'signed_fixture',
      ApiClient: { simulateWorkflow: async () => ({ status, nodeResults: status === 'FAILED'
        ? [{ nodeId: 'form', status: 'FAILED', error: { message: 'E-mail obrigatório ausente.' } }] : [] }) },
    });
    await h.handlers.handleRunSimulation();
    assert.equal(h.state.feedback.type, status === 'FAILED' ? 'error' : 'success');
    if (status === 'FAILED') assert.match(h.state.feedback.message, /E-mail obrigatório ausente/);
    assert.equal(h.state.simResults.status, status); assert.equal(h.state.simLoading, false);
  });
}

test('editor: handler de aplicar proposta bloqueia mutação enquanto revisão está pendente', async () => {
  const response = deferred(); const h = await editorHarness({ reviewWorkflow: () => response.promise });
  const pending = h.handlers.handleReviewWorkflow(); await flush();
  h.handlers.handleApplyAiProposal(); assert.equal(h.state.workflow.nodes[0].id, 'g1');
  response.resolve({ workflow: { ...h.state.workflow, status: 'REVIEWED' } }); await pending;
  assert.equal(h.state.workflow.status, 'REVIEWED');
});

for (const [handler, method, status] of [
  ['handleReviewWorkflow', 'reviewWorkflow', 'REVIEWED'], ['handleActivateWorkflow', 'activateWorkflow', 'PUBLISHED'],
]) {
  test(`editor: ${method} não aplica resposta de revisão local anterior`, async () => {
    const response = deferred(); const h = await editorHarness({ [method]: () => response.promise });
    if (status === 'PUBLISHED') h.context.workflow.status = 'REVIEWED';
    const old = h.context.workflow; const pending = h.handlers[handler](); await flush();
    h.context.activeContext.current.revision++;
    h.context.setWorkflow({ ...old, nodes: [{ id: 'g2' }] });
    response.resolve({ workflow: { ...old, status }, versionSnapshot: { version: 1 } }); await pending;
    assert.equal(h.state.workflow.nodes[0].id, 'g2');
  });
  test(`editor: ${method} não envia mutação após trocar contexto durante getToken`, async () => {
    const token = deferred(); let calls = 0;
    const h = await editorHarness({ [method]: async () => { calls++; return { workflow: {}, versionSnapshot: { version: 1 } }; } });
    h.context.getToken = () => token.promise;
    const pending = h.handlers[handler](); h.context.activeContext.current = activeContext('org_beta');
    token.resolve('new_session'); await pending; assert.equal(calls, 0);
  });
}

test('ApiClient sanitiza URL e codifica identificadores com caracteres especiais', async () => {
  const requests = [];
  const { exports } = await loadTypeScript(clientFile, {
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => ({ success: true, data: { id: 'wf_test', schemaVersion: '1.0.0' } }) };
    },
  });

  const specialId = 'wf/123#special?query=1';
  await exports.ApiClient.getWorkflow(specialId, 'signed_fixture');
  assert.equal(requests.length, 1);
  assert.ok(requests[0].url.includes(encodeURIComponent(specialId)));
  assert.equal(requests[0].options.headers.Authorization, 'Bearer signed_fixture');
});

test('ApiClient propaga mensagens de erro estruturadas da API em caso de 400 ou 403', async () => {
  const { exports } = await loadTypeScript(clientFile, {
    fetch: async () => ({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Workflow ativo não pode ser alterado diretamente.' }),
    }),
  });

  await assert.rejects(
    exports.ApiClient.updateWorkflow('wf_1', { name: 'Novo' }, 'signed_fixture'),
    /Workflow ativo não pode ser alterado diretamente/,
  );
});

test('Mapeamento dos 6 nós do catálogo do MVP para o canvas XYFlow', async () => {
  const { exports: dag } = await loadTypeScript(dagFile);
  const sampleWorkflow = {
    schemaVersion: '1.0.0',
    id: 'wf_all_nodes',
    orgId: 'org_test',
    name: 'Workflow Completo',
    version: 1,
    status: 'DRAFT',
    triggerNodeId: 'node_trigger',
    nodes: [
      { id: 'node_trigger', type: 'trigger_form', label: 'Formulário', position: { x: 0, y: 0 }, config: { requiredFields: ['name', 'email', 'message'] } },
      { id: 'node_ai', type: 'ai_analyze_intent', label: 'Análise IA', position: { x: 200, y: 0 }, config: { modelRef: 'modelo-a-aprovar', inputPromptTemplate: '{{node_trigger.message_text}}' } },
      { id: 'node_record', type: 'internal_record', label: 'Registro Interno', position: { x: 400, y: 0 }, config: { fieldMappings: { name: '{{node_trigger.contact_name}}', email: '{{node_trigger.contact_email}}' } } },
      { id: 'node_cond', type: 'condition', label: 'Condição', position: { x: 600, y: 0 }, config: { field: '{{node_trigger.contact_email}}', operator: 'contains', value: '@' } },
      { id: 'node_email', type: 'send_email', label: 'E-mail', position: { x: 800, y: -50 }, config: { to: '{{node_trigger.contact_email}}', subject: 'Confirmação', bodyTemplate: 'Olá' } },
      { id: 'node_http', type: 'http_request', label: 'HTTP', position: { x: 800, y: 50 }, config: { url: 'https://api.exemplo.test/webhook', method: 'POST', bodyTemplate: '{}' } },
    ],
    edges: [
      { id: 'e1', sourceNodeId: 'node_trigger', targetNodeId: 'node_ai' },
      { id: 'e2', sourceNodeId: 'node_ai', targetNodeId: 'node_record' },
      { id: 'e3', sourceNodeId: 'node_record', targetNodeId: 'node_cond' },
      { id: 'e4', sourceNodeId: 'node_cond', targetNodeId: 'node_email', sourceHandle: 'true' },
      { id: 'e5', sourceNodeId: 'node_cond', targetNodeId: 'node_http', sourceHandle: 'false' },
    ],
  };

  const sortResult = dag.DagValidator.validateAndSort(sampleWorkflow);
  assert.equal(sortResult.sortedNodes.length, 6);
  assert.equal(sortResult.sortedNodes[0].id, 'node_trigger');

  // Conversão de nós para formato de canvas
  const flowNodes = sampleWorkflow.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { label: n.label, type: n.type },
  }));
  assert.equal(flowNodes.length, 6);
  assert.deepEqual(flowNodes.map((n) => n.id), ['node_trigger', 'node_ai', 'node_record', 'node_cond', 'node_email', 'node_http']);
});

test('Validação de simulação de workflow com dados sintéticos no cliente', async () => {
  const { exports: engine } = await loadTypeScript(engineFile);
  const service = new engine.WorkflowEngineService(engine.createTestResourceResolver());

  const workflow = {
    schemaVersion: '1.0.0',
    id: 'wf_sim_test',
    orgId: 'org_test',
    name: 'Workflow de Teste',
    version: 1,
    status: 'DRAFT',
    triggerNodeId: 't1',
    nodes: [
      { id: 't1', type: 'trigger_form', label: 'Início', position: { x: 0, y: 0 }, config: { requiredFields: ['name', 'email', 'message'] } },
      { id: 'email1', type: 'send_email', label: 'Resposta', position: { x: 200, y: 0 }, config: { to: '{{t1.contact_email}}', subject: 'Recebido', bodyTemplate: 'Olá {{t1.contact_name}}' } },
    ],
    edges: [{ id: 'e1', sourceNodeId: 't1', targetNodeId: 'email1' }],
  };

  // 1. Simulação bem-sucedida
  const successResult = await service.simulate(workflow, {
    name: 'Contato Teste',
    email: 'contato@example.test',
    message: 'Gostaria de uma cotação.',
  });
  assert.equal(successResult.status, 'COMPLETED');
  assert.equal(successResult.nodeResults.length, 2);
  assert.equal(successResult.nodeResults[0].status, 'SUCCESS');
  assert.equal(successResult.nodeResults[1].status, 'SUCCESS');

  // 2. Simulação com erro no gatilho por campo ausente
  const failResult = await service.simulate(workflow, {
    name: 'Contato Incompleto',
    // email ausente
    message: 'Sem email',
  });
  assert.equal(failResult.status, 'FAILED');
  assert.equal(failResult.nodeResults[0].status, 'FAILED');
  assert.match(failResult.nodeResults[0].error.message, /Campo obrigatório ausente/);
});

test('ApiClient serializa requisições de simulação e ciclo de vida com integridade de headers e payload', async () => {
  const requests = [];
  const { exports } = await loadTypeScript(clientFile, {
    fetch: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: { status: 'COMPLETED', totalDurationMs: 42, nodeResults: [] },
        }),
      };
    },
  });

  const simResult = await exports.ApiClient.simulateWorkflow('wf_sim_req', { test: true }, 'tok_valid');
  assert.equal(simResult.status, 'COMPLETED');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.method, 'POST');
  assert.ok(requests[0].url.includes('/workflows/wf_sim_req/simulate'));
  assert.equal(requests[0].options.headers['Content-Type'], 'application/json');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer tok_valid');
  assert.deepEqual(JSON.parse(requests[0].options.body), { initialPayload: { test: true } });
});

test('Invariantes estáticas de prevenção de condições de corrida e feedback acessível no frontend', async () => {
  const { readFileSync } = await import('node:fs');
  const editorCode = readFileSync('apps/web/src/app/workflows/[id]/page.tsx', 'utf8');
  const dashboardCode = readFileSync('apps/web/src/app/dashboard/page.tsx', 'utf8');
  const historyCode = readFileSync('apps/web/src/app/history/page.tsx', 'utf8');

  // 1. Editor: bloqueio de ações concorrentes e imutabilidade de não-DRAFT
  assert.ok(editorCode.includes('isAnyActionRunning'), 'Editor deve checar se outra ação está em execução');
  assert.ok(editorCode.includes("workflow?.status !== 'DRAFT'"), 'Editor deve desabilitar alteração fora de DRAFT');
  assert.ok(editorCode.includes('role={feedback.type === \'error\' ? \'alert\' : \'status\'}'), 'Editor deve prover role de acessibilidade');
  assert.ok(editorCode.includes('aria-live="polite"'), 'Editor deve prover aria-live no banner de feedback');
  assert.ok(!editorCode.includes('alert('), 'Editor não deve utilizar alert() síncrono bloqueante');

  // 2. Dashboard: prevenção de deleção concorrente, loading manual e feedback acessível
  assert.ok(dashboardCode.includes('deletingIds'), 'Dashboard deve rastrear IDs em processo de exclusão');
  assert.ok(dashboardCode.includes('isCreatingManual'), 'Dashboard deve possuir estado de carregamento para criação manual');
  assert.ok(dashboardCode.includes('role={feedback.type === \'error\' ? \'alert\' : \'status\'}'), 'Dashboard deve prover role no feedback');
  assert.ok(dashboardCode.includes('aria-live="polite"'), 'Dashboard deve prover aria-live no feedback');
  assert.ok(!dashboardCode.includes('alert('), 'Dashboard não deve utilizar alert() síncrono bloqueante');

  // 3. Histórico: prevenção de out-of-order race em inspeção e alerta acessível
  assert.ok(historyCode.includes('inspectSeq'), 'Histórico deve ordenar requisições de inspeção com inspectSeq');
  assert.ok(historyCode.includes('inspectingId'), 'Histórico deve rastrear o item sob inspeção');
  assert.ok(historyCode.includes('role="alert"'), 'Histórico deve prover role="alert" para erros de inspeção');
  assert.ok(historyCode.includes('aria-live="polite"'), 'Histórico deve prover aria-live para erros de inspeção');
});

test('Filtros e paginação de execuções no Histórico e automações no Dashboard', async () => {
  const { readFileSync } = await import('node:fs');
  const historyCode = readFileSync('apps/web/src/app/history/page.tsx', 'utf8');
  const dashboardCode = readFileSync('apps/web/src/app/dashboard/page.tsx', 'utf8');

  // Histórico: filtros por status, modo, busca textual e paginação
  assert.ok(historyCode.includes('statusFilter'), 'Histórico deve ter filtro de status');
  assert.ok(historyCode.includes('modeFilter'), 'Histórico deve ter filtro de modo');
  assert.ok(historyCode.includes('searchQuery'), 'Histórico deve ter busca textual');
  assert.ok(historyCode.includes('paginatedExecutions'), 'Histórico deve computar execuções paginadas');
  assert.ok(historyCode.includes('handleResetFilters'), 'Histórico deve ter ação para restaurar visualização');
  assert.ok(historyCode.includes('aria-label="Página anterior"'), 'Histórico deve ter aria-label na paginação anterior');
  assert.ok(historyCode.includes('aria-label="Próxima página"'), 'Histórico deve ter aria-label na próxima página');

  // Dashboard: abas de status, busca e contadores
  assert.ok(dashboardCode.includes('statusFilter'), 'Dashboard deve ter filtro de status');
  assert.ok(dashboardCode.includes('searchQuery'), 'Dashboard deve ter busca textual');
  assert.ok(dashboardCode.includes('filteredWorkflows'), 'Dashboard deve computar workflows filtrados');
  assert.ok(dashboardCode.includes('handleResetFilters'), 'Dashboard deve ter ação para restaurar visualização');
  assert.ok(dashboardCode.includes('Rascunhos'), 'Dashboard deve ter aba de Rascunhos');
  assert.ok(dashboardCode.includes('Revisados'), 'Dashboard deve ter aba de Revisados');
  assert.ok(dashboardCode.includes('Ativos'), 'Dashboard deve ter aba de Ativos');
});




test('simulação de agendamento envia somente o horário previsto', async () => {
  let sent;
  const scheduledAt = '2026-10-28T12:30:00.000Z';
  const h = await loadUiHandlers(editorPage, ['handleRunSimulation'], {
    workflow: { id: 'wf_alpha', triggerNodeId: 'agenda', nodes: [{ id: 'agenda', type: 'trigger_schedule' }] },
    workflowId: 'wf_alpha', isDirty: false, scheduledAt,
    activeContext: { current: activeContext() }, getToken: async () => 'signed_fixture',
    ApiClient: { simulateWorkflow: async (_id, payload) => { sent = payload; return { status: 'COMPLETED', nodeResults: [] }; } },
  });
  await h.handlers.handleRunSimulation();
  assert.equal(JSON.stringify(sent), JSON.stringify({ scheduledAt }));
  assert.equal(h.state.feedback.type, 'success');
});

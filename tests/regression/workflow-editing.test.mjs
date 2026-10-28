import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { loadTypeScript } from './load-typescript.mjs';
import { loadUiHandlers } from './load-ui-handlers.mjs';

const page = 'apps/web/src/app/workflows/[id]/page.tsx';
const fixture = (status = 'DRAFT') => ({
  id: 'wf_alpha', orgId: 'org_alpha', name: 'Contato sintético', schemaVersion: '1.0.0', version: 2, status,
  triggerNodeId: 'form', nodes: [
    { id: 'form', type: 'trigger_form', label: 'Formulário', position: { x: 0, y: 0 }, config: {} },
    { id: 'check', type: 'condition', label: 'Condição', position: { x: 100, y: 100 }, config: { rightOperand: ['a', 'b'] } },
    { id: 'mail', type: 'send_email', label: 'Resposta', position: { x: 200, y: 200 }, config: { to: '{{form.contact_email}}', subject: 'Contato', bodyTemplate: 'Olá', replyTo: '' } },
  ], edges: [{ id: 'form_check', sourceNodeId: 'form', targetNodeId: 'check' }],
});
const context = () => ({ workflowId: 'wf_alpha', orgId: 'org_alpha', revision: 0, saving: false,
  reviewing: false, publishing: false, deactivating: false, simulating: false, generatingAi: false, parameterEditing: false });
const flush = () => new Promise((resolve) => setImmediate(resolve));
let editing;
async function logic() {
  if (!editing) editing = (await loadTypeScript('apps/web/src/lib/workflow-editing.ts')).exports;
  return editing;
}
async function harness(names, overrides = {}, options = {}) {
  const workflow = overrides.workflow ?? fixture(), current = context();
  return loadUiHandlers(page, names, { workflow, orgId: 'org_alpha', workflowId: workflow.id,
    activeContext: { current }, editingContext: current, draftView: { current: { workflow, context: current } },
    isAnyActionRunning: false, hasPendingConfig: false, isDirty: true, isSaving: false,
    selectedNodeId: 'mail', simResults: { executionId: 'previous' }, aiResponse: null,
    getToken: async () => 'synthetic', crypto: { randomUUID: () => 'fixture_edge' }, ...overrides }, options);
}

test('configuração pendente impede salvar uma definição anterior à edição do usuário', async () => {
  const h = await harness(['handleSave'], { hasPendingConfig: true,
    ApiClient: { updateWorkflow: async () => { throw new Error('salvamento indevido'); } } });
  h.context.activeContext.current.parameterEditing = true;
  await h.handlers.handleSave();
  assert.equal(h.state.isDirty, true);
  assert.match(h.state.feedback?.message ?? '', /aplique|descarte/i);
});

test('resposta de salvamento obsoleta não substitui novas alterações nem escreve feedback de erro', async () => {
  let reject; const pending = new Promise((_resolve, fail) => { reject = fail; });
  const h = await harness(['handleSave'], { ApiClient: { updateWorkflow: () => pending } });
  const request = h.handlers.handleSave(); await flush();
  h.context.activeContext.current.revision++;
  reject(new Error('erro de versão anterior')); await request;
  assert.equal(h.state.feedback, null); assert.equal(h.state.isDirty, true);
});

test('parâmetros de e-mail editados preservam IDs, referências e campos não alterados', async () => {
  const { editNodeParameters } = await logic(); const original = fixture();
  const changed = editNodeParameters(original, 'mail', 'Resposta personalizada', { subject: 'Recebemos seu contato' });
  assert.deepEqual(JSON.parse(JSON.stringify(original.nodes[2].config)), { to: '{{form.contact_email}}', subject: 'Contato', bodyTemplate: 'Olá', replyTo: '' });
  assert.equal(changed.nodes[2].id, 'mail'); assert.equal(changed.nodes[2].label, 'Resposta personalizada');
  assert.deepEqual(JSON.parse(JSON.stringify(changed.nodes[2].config)), { to: '{{form.contact_email}}', subject: 'Recebemos seu contato', bodyTemplate: 'Olá', replyTo: '' });
  assert.equal(changed.orgId, 'org_alpha'); assert.equal(changed.version, 2); assert.equal(changed.edges, original.edges);
});

test('valores JSON da condição preservam número, array e booleano', async () => {
  const { editNodeParameters } = await logic();
  for (const [raw, expected] of [['23', 23], ['true', true], ['["x","y"]', ['x', 'y']]]) {
    const changed = editNodeParameters(fixture(), 'check', 'Condição', { rightOperand: raw });
    assert.deepEqual(JSON.parse(JSON.stringify(changed.nodes[1].config.rightOperand)), expected);
  }
});

test('JSON inválido e campos desconhecidos não substituem a configuração', async () => {
  const { editNodeParameters } = await logic(); const workflow = fixture();
  assert.throws(() => editNodeParameters(workflow, 'check', 'Condição', { rightOperand: '{' }), /JSON/i);
  assert.throws(() => editNodeParameters(workflow, 'mail', 'Resposta', { '__proto__.secret': 'x' }), /campo/i);
  assert.equal(workflow.nodes[2].config.subject, 'Contato');
});

test('aliases existentes de mensagem e mapeamento são preservados ao editar outro campo', async () => {
  const { editNodeParameters, getNodeParameterFields } = await logic(); const workflow = fixture();
  workflow.nodes[1] = { ...workflow.nodes[1], type: 'internal_record', config: { name: '{{form.contact_name}}', message: '{{form.message_text}}', fieldMappings: { email: '{{form.contact_email}}' } } };
  const changed = editNodeParameters(workflow, 'check', 'Registro', { 'fieldMappings.email': 'fixture@example.test' });
  assert.equal(changed.nodes[1].config.name, '{{form.contact_name}}');
  assert.equal(changed.nodes[1].config.message, '{{form.message_text}}');
  assert.equal(changed.nodes[1].config.fieldMappings.email, 'fixture@example.test');
  assert.ok(getNodeParameterFields(workflow.nodes[1]).some((field) => field.path === 'message'));
});

test('draft incompleto continua editável e ausência de opcionais não injeta defaults', async () => {
  const { editNodeParameters } = await logic(); const workflow = fixture(); workflow.nodes[2].config = {};
  const changed = editNodeParameters(workflow, 'mail', 'Resposta', { subject: 'Contato' });
  assert.deepEqual(JSON.parse(JSON.stringify(changed.nodes[2].config)), { subject: 'Contato' });
});

for (const status of ['REVIEWED', 'PUBLISHED', 'ARCHIVED']) {
  test(`edições de parâmetros/posições/conexões são negadas em ${status}`, async () => {
    const { editNodeParameters, moveWorkflowNodes, connectWorkflowNodes, removeWorkflowConnection } = await logic();
    const wf = fixture(status);
    for (const operation of [() => editNodeParameters(wf, 'mail', 'Resposta', {}),
      () => moveWorkflowNodes(wf, [{ id: 'mail', position: { x: 3, y: 4 } }]),
      () => connectWorkflowNodes(wf, 'check', 'mail', 'true', 'new'),
      () => removeWorkflowConnection(wf, 'form_check')]) assert.throws(operation, /rascunho/i);
  });
}

test('movimentação persiste coordenadas finitas sem mudar configuração ou arestas', async () => {
  const { moveWorkflowNodes } = await logic(); const original = fixture();
  const moved = moveWorkflowNodes(original, [{ id: 'mail', position: { x: -12, y: 24 } }]);
  assert.deepEqual(JSON.parse(JSON.stringify(moved.nodes[2].position)), { x: -12, y: 24 });
  assert.equal(original.nodes[2].position.x, 200); assert.equal(moved.nodes[2].config, original.nodes[2].config);
  assert.throws(() => moveWorkflowNodes(original, [{ id: 'mail', position: { x: Infinity, y: 0 } }]), /posição/i);
});

test('conexões condicionais preservam os handles usados pelo motor', async () => {
  const { connectWorkflowNodes } = await logic(); const original = fixture();
  const yes = connectWorkflowNodes(original, 'check', 'mail', 'true', 'yes_edge');
  const both = connectWorkflowNodes(yes, 'check', 'mail', 'false', 'no_edge');
  assert.deepEqual(JSON.parse(JSON.stringify(both.edges.slice(1))), [
    { id: 'yes_edge', sourceNodeId: 'check', targetNodeId: 'mail', sourceHandle: 'true' },
    { id: 'no_edge', sourceNodeId: 'check', targetNodeId: 'mail', sourceHandle: 'false' },
  ]);
});

test('ciclo, auto-conexão, nó ausente e conexão repetida são recusados antes de mudar o grafo', async () => {
  const { connectWorkflowNodes } = await logic(); const wf = fixture();
  assert.throws(() => connectWorkflowNodes(wf, 'check', 'form', 'true', 'loop'), /ciclo/i);
  assert.throws(() => connectWorkflowNodes(wf, 'mail', 'mail', undefined, 'self'), /ciclo/i);
  assert.throws(() => connectWorkflowNodes(wf, 'absent', 'mail', undefined, 'invalid'), /etapa/i);
  assert.throws(() => connectWorkflowNodes(wf, 'form', 'check', undefined, 'repeat'), /exist/i);
  assert.equal(wf.edges.length, 1);
});

test('remoção de conexão preserva nós e demais IDs, sem resolver convergências', async () => {
  const { connectWorkflowNodes, removeWorkflowConnection } = await logic();
  const wf = connectWorkflowNodes(fixture(), 'check', 'mail', 'true', 'yes_edge');
  const removed = removeWorkflowConnection(wf, 'form_check');
  assert.deepEqual(JSON.parse(JSON.stringify(removed.edges)), [{ id: 'yes_edge', sourceNodeId: 'check', targetNodeId: 'mail', sourceHandle: 'true' }]);
  assert.equal(removed.nodes, wf.nodes); assert.equal(wf.edges.length, 2);
});

test('formulários abrangem os seis tipos e conservam ausência versus valores JSON', async () => {
  const { getNodeParameterFields } = await logic();
  const expected = { trigger_form: 'requiredFields', ai_analyze_intent: 'inputPromptTemplate', internal_record: 'email',
    send_email: 'bodyTemplate', condition: 'rightOperand', http_request: 'headers' };
  for (const [type, path] of Object.entries(expected)) {
    assert.ok(getNodeParameterFields({ ...fixture().nodes[0], type, config: {} }).some((field) => field.path === path));
  }
});

test('arestas exibidas no canvas mantêm sourceHandle e targetHandle sem normalização', async () => {
  const wf = fixture(); wf.edges.push({ id: 'branch', sourceNodeId: 'check', targetNodeId: 'mail', sourceHandle: 'false', targetHandle: 'legacy_target' });
  const h = await loadUiHandlers(page, ['flowEdges'], { workflow: wf, useMemo: (fn) => fn(), MarkerType: { ArrowClosed: 'arrow' } });
  assert.equal(h.handlers.flowEdges[1].sourceHandle, 'false');
  assert.equal(h.handlers.flowEdges[1].targetHandle, 'legacy_target');
});

async function editHarness(overrides = {}, options = {}) {
  return harness(['commitWorkflowEdit', 'handleEditNode', 'handleNodesChange', 'handleConnect', 'handleRemoveConnection', 'handleSelectNode', 'handleParameterPending', 'handleSave', 'handleReviewWorkflow', 'handleRunSimulation', 'handleActivateWorkflow', 'handleApplyAiProposal', 'handleAddNode', 'handleRemoveNode'], { ...(await logic()), ...overrides }, options);
}

test('edição aplicada marca dirty, avança revisão e invalida resultado anterior', async () => {
  const h = await editHarness();
  assert.equal(h.handlers.handleEditNode('mail', 'Nova resposta', { subject: 'Novo assunto' }, { x: 20, y: 30 }), true);
  assert.equal(h.state.workflow.nodes[2].config.subject, 'Novo assunto'); assert.equal(h.state.workflow.nodes[2].position.x, 20);
  assert.equal(h.state.isDirty, true); assert.equal(h.context.activeContext.current.revision, 1);
  assert.equal(h.state.simResults, null);
});

for (const flag of ['saving', 'reviewing', 'publishing', 'deactivating', 'simulating', 'generatingAi']) {
  test(`edição não altera o workflow durante ${flag}`, async () => {
    const h = await editHarness(); h.context.activeContext.current[flag] = true;
    const original = h.state.workflow;
    assert.equal(h.handlers.handleEditNode('mail', 'Novo', {}, { x: 1, y: 2 }), false);
    assert.equal(h.state.workflow, original); assert.equal(h.context.activeContext.current.revision, 0);
  });
}

test('duas movimentações antes de renderizar preservam as duas alterações', async () => {
  const h = await editHarness();
  h.handlers.handleNodesChange([{ type: 'position', id: 'form', position: { x: 10, y: 20 } }]);
  h.handlers.handleNodesChange([{ type: 'position', id: 'mail', position: { x: 30, y: 40 } }]);
  assert.equal(h.state.workflow.nodes[0].position.x, 10); assert.equal(h.state.workflow.nodes[2].position.x, 30);
});

test('edição com contexto Alpha→Beta→Alpha anterior é descartada', async () => {
  const h = await editHarness(); const original = h.state.workflow;
  h.context.activeContext.current = { ...context(), orgId: 'org_beta' };
  h.context.activeContext.current = context();
  assert.equal(h.handlers.handleEditNode('mail', 'Obsoleto', {}, { x: 1, y: 2 }), false);
  assert.equal(h.state.workflow, original);
});

test('rascunho local de parâmetros impede trocar etapa, mover ou aplicar conexões', async () => {
  const h = await editHarness(); const original = h.state.workflow;
  h.handlers.handleParameterPending(true);
  h.handlers.handleSelectNode('form');
  h.handlers.handleNodesChange([{ type: 'position', id: 'mail', position: { x: 1, y: 2 } }]);
  h.handlers.handleConnect({ source: 'check', target: 'mail', sourceHandle: 'true' });
  assert.equal(h.state.selectedNodeId, 'mail'); assert.equal(h.state.workflow, original);
  assert.equal(h.context.activeContext.current.parameterEditing, true);
});

test('conectar e remover pela interface altera somente as arestas pertinentes', async () => {
  const h = await editHarness();
  h.handlers.handleConnect({ source: 'check', target: 'mail', sourceHandle: 'false', targetHandle: null });
  assert.equal(h.state.workflow.edges[1].sourceHandle, 'false');
  h.handlers.handleRemoveConnection('form_check');
  assert.equal(h.state.workflow.edges.length, 1); assert.equal(h.state.workflow.edges[0].id, 'edge_fixture_edge');
});

// Renderiza React real em SSR; não executa effects, DOM, teclado ou browser.
const webRequire = createRequire(new URL('../../apps/web/package.json', import.meta.url));

test('editar e salvar no mesmo snapshot usa a definição recente da referência', async () => {
  const h = await editHarness({ isDirty: false, ApiClient: { updateWorkflow: async (_id, dto) => ({ ...fixture(), ...dto }) } }, { freezeRenderBindings: true });
  h.handlers.handleEditNode('mail', 'Resposta recente', { subject: 'Assunto recente' }, { x: 12, y: 34 });
  await h.handlers.handleSave();
  assert.equal(h.state.workflow.nodes[2].config.subject, 'Assunto recente');
  assert.equal(h.state.workflow.nodes[2].position.x, 12); assert.equal(h.state.isDirty, false);
});

test('edição antes de render bloqueia simulação, revisão e ativação do snapshot antigo', async () => {
  const h = await editHarness({ isDirty: false, ApiClient: {
    simulateWorkflow: async () => { throw new Error('simulação indevida'); },
    reviewWorkflow: async () => { throw new Error('revisão indevida'); },
    activateWorkflow: async () => { throw new Error('ativação indevida'); },
  } }, { freezeRenderBindings: true });
  h.handlers.handleEditNode('mail', 'Nova resposta', { subject: 'Novo' }, { x: 20, y: 30 });
  for (const name of ['handleRunSimulation', 'handleReviewWorkflow', 'handleActivateWorkflow']) {
    await h.handlers[name](); assert.match(h.state.feedback?.message ?? '', /salve/i);
    assert.equal(h.state.workflow.nodes[2].config.subject, 'Novo');
  }
});

test('proposta aplicada e editada antes de render mantém os nós da proposta', async () => {
  const proposal = fixture(); proposal.nodes[2].id = 'mail_new';
  const h = await editHarness({ aiResponse: { workflow: proposal } }, { freezeRenderBindings: true });
  h.handlers.handleApplyAiProposal();
  assert.equal(h.handlers.handleEditNode('mail_new', 'Resposta proposta', { subject: 'Editada' }, { x: 5, y: 6 }), true);
  assert.equal(h.state.workflow.nodes[2].id, 'mail_new'); assert.equal(h.state.workflow.nodes[2].config.subject, 'Editada');
});

for (const [handler, status, method] of [['handleReviewWorkflow', 'REVIEWED', 'reviewWorkflow'], ['handleActivateWorkflow', 'PUBLISHED', 'activateWorkflow']]) {
  test(`${status} recebido impede editar antes de renderizar o novo estado`, async () => {
    const initial = fixture(handler === 'handleActivateWorkflow' ? 'REVIEWED' : 'DRAFT');
    const h = await editHarness({ workflow: initial, isDirty: false,
      ApiClient: { [method]: async () => ({ workflow: { ...initial, status }, versionSnapshot: { version: 2 } }) },
    }, { freezeRenderBindings: true });
    await h.handlers[handler]();
    assert.equal(h.handlers.handleEditNode('mail', 'Obsoleto', { subject: 'Antigo' }, { x: 0, y: 0 }), false);
    assert.equal(h.context.draftView.current.workflow.status, status);
    assert.equal(h.state.workflow.status, status);
  });
}

test('falha de carregamento do contexto anterior não altera erro ou loading atuais', async () => {
  let reject; const pending = new Promise((_resolve, fail) => { reject = fail; });
  const h = await harness(['resetContextEffect'], { isLoaded: true, searchParams: null,
    ApiClient: { getWorkflow: () => pending } }, { freezeRenderBindings: true });
  const cleanup = h.handlers.resetContextEffect(); await flush();
  h.context.activeContext.current = { ...context(), workflowId: 'wf_beta', orgId: 'org_beta' };
  reject(new Error('contexto anterior')); await flush(); await flush();
  assert.equal(h.state.error, null); assert.equal(h.state.loading, true);
  cleanup?.();
});

function graphComponent() {
  const source = readFileSync(new URL('../../apps/web/src/components/workflows/workflow-graph-node.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const effects = [], updates = [], module = { exports: {} };
  runInNewContext(compiled, { exports: module.exports, module, require: (name) => {
    if (name === 'react') return { ...webRequire('react'), useEffect: (callback) => effects.push(callback) };
    if (name === '@xyflow/react') return { ...webRequire(name), useUpdateNodeInternals: () => (id) => updates.push(id) };
    if (name === 'react/jsx-runtime') return webRequire(name);
    throw new Error('Importação não permitida');
  } });
  const element = module.exports.WorkflowGraphNode({ id: 'mail', data: { label: 'Resposta', nodeType: 'send_email',
    sourceHandles: [undefined, 'default'], targetHandles: [undefined, 'legacy'] }, selected: true, isConnectable: true });
  return { element, effects, updates };
}

test('handles padrão e nomeado default têm chaves distintas no componente real', () => {
  const { element } = graphComponent();
  const sources = element.props.children.at(-1);
  assert.notEqual(sources[0].key, sources[1].key);
  assert.equal(sources[0].props.style.left, '33.333333333333336%');
  assert.equal(sources[1].props.id, 'default');
});

test('efeito real do nó solicita atualização dos bounds dos handles após render', () => {
  const { effects, updates, element } = graphComponent();
  assert.equal(element.props.children[0][1].props.id, 'legacy');
  assert.equal(effects.length, 1);
  effects[0](); assert.deepEqual(updates, ['mail']);
});

for (const type of ['trigger_form', 'ai_analyze_intent', 'internal_record', 'send_email', 'condition', 'http_request']) {
  test(`formulário real de ${type} renderiza labels, valores escapados e bloqueio de edição`, async () => {
    const source = readFileSync(new URL('../../apps/web/src/components/workflows/node-parameter-editor.tsx', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const module = { exports: {} };
    const helpers = await logic();
    runInNewContext(compiled, { exports: module.exports, module, require: (name) => {
      if (name === '@/lib/workflow-editing') return helpers;
      if (name === 'react' || name === 'react/jsx-runtime') return webRequire(name);
      throw new Error('Dependência não permitida no teste SSR');
    } });
    const React = webRequire('react'), { renderToStaticMarkup } = webRequire('react-dom/server');
    const node = { ...fixture().nodes[0], type, label: '<script>fixture</script>', config: type === 'send_email' ? { subject: '<script>subject</script>' } : {} };
    const html = renderToStaticMarkup(React.createElement(module.exports.NodeParameterEditor, {
      node, disabled: true, onPendingChange: () => {}, onApply: () => { throw new Error('Edição proibida em SSR'); },
    }));
    assert.match(html, /Configurar etapa/); assert.match(html, /Nome da etapa/);
    assert.match(html, /fieldset disabled/); assert.ok(!html.includes('<script>'));
    assert.match(html, /Aplicar à etapa/); assert.match(html, /Posição X/);
    for (const id of [...html.matchAll(/<label for="([^"]+)"/g)].map((match) => match[1])) assert.ok(html.includes(`id="${id}"`));
  });
}

test('addWorkflowNode: adiciona nó do catálogo com defaults e rejeita fora de DRAFT', async () => {
  const { addWorkflowNode } = await logic();
  const wf = fixture('DRAFT');

  // 1. Adicionar nó HTTP
  const updated = addWorkflowNode(wf, 'http_request', { label: 'Webhook Parceiro' });
  assert.equal(updated.nodes.length, wf.nodes.length + 1);
  const newNode = updated.nodes.at(-1);
  assert.equal(newNode.type, 'http_request');
  assert.equal(newNode.label, 'Webhook Parceiro');
  assert.equal(newNode.config.method, 'POST');
  assert.equal(newNode.config.url, '');

  // 2. Bloqueia fora de DRAFT
  assert.throws(() => addWorkflowNode(fixture('PUBLISHED'), 'send_email'), /disponível apenas em rascunho/i);
  assert.throws(() => addWorkflowNode(fixture('REVIEWED'), 'send_email'), /disponível apenas em rascunho/i);

  // 3. Bloqueia tipo desconhecido
  assert.throws(() => addWorkflowNode(wf, 'invalid_type'), /não reconhecido/i);

  // 4. Bloqueia segundo trigger_form
  assert.throws(() => addWorkflowNode(wf, 'trigger_form'), /já possui um gatilho/i);

  // 5. Bloqueia ID duplicado explícito
  assert.throws(() => addWorkflowNode(wf, 'condition', { id: 'check' }), /já existente/i);
});

test('removeWorkflowNode: remove nó e cascateia remoção de arestas conectadas', async () => {
  const { removeWorkflowNode } = await logic();
  const wf = fixture('DRAFT');

  // Adicionar uma aresta de check para mail para testar cascata de entrada e saída
  wf.edges.push({ id: 'check_mail', sourceNodeId: 'check', targetNodeId: 'mail' });
  assert.equal(wf.edges.length, 2);

  // 1. Remover nó intermediário 'check'
  const updated = removeWorkflowNode(wf, 'check');
  assert.equal(updated.nodes.some((n) => n.id === 'check'), false);
  assert.equal(updated.nodes.length, 2);
  // As duas arestas (form_check e check_mail) devem ter sido removidas em cascata
  assert.equal(updated.edges.length, 0);

  // 2. Bloqueia remoção do gatilho principal
  assert.throws(() => removeWorkflowNode(wf, 'form'), /gatilho principal.*não pode ser excluído/i);

  // 3. Bloqueia fora de DRAFT
  assert.throws(() => removeWorkflowNode(fixture('PUBLISHED'), 'mail'), /disponível apenas em rascunho/i);

  // 4. ID inexistente preserva o workflow inalterado
  const untouched = removeWorkflowNode(wf, 'non_existent_id');
  assert.equal(untouched.nodes.length, wf.nodes.length);
});

test('handleAddNode: adiciona nó pelo editor e atualiza seleção e estado dirty', async () => {
  const h = await editHarness();
  const initialCount = h.state.workflow.nodes.length;
  h.handlers.handleAddNode('http_request');
  assert.equal(h.state.workflow.nodes.length, initialCount + 1);
  const added = h.state.workflow.nodes.at(-1);
  assert.equal(added.type, 'http_request');
  assert.equal(h.state.selectedNodeId, added.id);
  assert.equal(h.state.isDirty, true);
  assert.equal(h.context.activeContext.current.revision, 1);
});

test('handleRemoveNode: remove nó pelo editor e limpa seleção se era o nó selecionado', async () => {
  const h = await editHarness({ selectedNodeId: 'mail' });
  assert.equal(h.state.selectedNodeId, 'mail');
  h.handlers.handleRemoveNode('mail');
  assert.equal(h.state.workflow.nodes.some((n) => n.id === 'mail'), false);
  assert.equal(h.state.selectedNodeId, null);
  assert.equal(h.state.isDirty, true);
});



test('gatilho de agendamento: troca explícita preserva ID, arestas e referências para revisão', async () => {
  const api = await logic(), original = fixture();
  const next = api.changeWorkflowTrigger(original, 'trigger_schedule');
  assert.equal(next.triggerNodeId, 'form');
  assert.equal(next.nodes[0].type, 'trigger_schedule');
  assert.equal(JSON.stringify(next.nodes[0].config), '{}');
  assert.equal(JSON.stringify(next.edges), JSON.stringify(original.edges));
  assert.equal(next.nodes[2].config.to, '{{form.contact_email}}');
  assert.equal(original.nodes[0].type, 'trigger_form');
  assert.equal(api.getNodeParameterFields(next.nodes[0]).length, 0);
  assert.throws(() => api.changeWorkflowTrigger(fixture('PUBLISHED'), 'trigger_schedule'), /rascunho/);
  assert.throws(() => api.addWorkflowNode(next, 'trigger_form'), /gatilho/);
  assert.throws(() => api.addWorkflowNode(original, 'trigger_schedule'), /gatilho/);
});

test('agendamento pode ser o primeiro e único gatilho em um rascunho vazio', async () => {
  const api = await logic(), empty = { ...fixture(), triggerNodeId: '', nodes: [], edges: [] };
  const next = api.addWorkflowNode(empty, 'trigger_schedule');
  assert.equal(next.nodes[0].type, 'trigger_schedule');
  assert.equal(next.triggerNodeId, next.nodes[0].id);
  assert.equal(JSON.stringify(next.nodes[0].config), '{}');
});


for (const type of ['trigger_form', 'trigger_schedule']) {
  test(`${type}: gatilho sem aresta de entrada não oferece conector de entrada`, async () => {
    const workflow = fixture(); workflow.nodes[0].type = type;
    const h = await loadUiHandlers(page, ['flowNodes'], { workflow, selectedNodeId: null, useMemo: fn => fn() });
    const node = h.handlers.flowNodes.find(item => item.id === 'form');
    assert.equal(node.data.targetHandles.length, 0);
    assert.equal(node.data.sourceHandles.length, 1);
    assert.equal(h.handlers.flowNodes.find(item => item.id === 'check').data.targetHandles.length, 1);
  });
}

test('gatilho conserva indicação de aresta legada inválida para revisão explícita', async () => {
  const workflow = fixture(); workflow.nodes[0].type = 'trigger_schedule';
  workflow.edges.push({ id: 'legacy', sourceNodeId: 'mail', targetNodeId: 'form', targetHandle: 'old' });
  const h = await loadUiHandlers(page, ['flowNodes'], { workflow, selectedNodeId: null, useMemo: fn => fn() });
  assert.ok(h.handlers.flowNodes.find(item => item.id === 'form').data.targetHandles.includes('old'));
  assert.equal(workflow.edges.at(-1).id, 'legacy');
});

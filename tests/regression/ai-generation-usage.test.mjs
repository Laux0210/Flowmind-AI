import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './load-typescript.mjs';
import { loadUiHandlers } from './load-ui-handlers.mjs';

const clientFile = 'apps/web/src/lib/api-client.ts';
const editorFile = 'apps/web/src/app/workflows/[id]/page.tsx';
const privateMarker = 'private_fixture_response_detail';
const payload = (usage = 24, code = 'AI_INVALID_WORKFLOW_RESPONSE') => ({
  code, message: 'A proposta não pôde ser aplicada.', tokensConsumed: usage, details: privateMarker,
});
async function clientFor(body, overrides = {}) {
  const { exports } = await loadTypeScript(clientFile, { fetch: async () => ({ ok: false, status: 400,
    json: async () => body, ...overrides }) });
  return exports;
}
async function capture(operation) {
  let observed;
  try { await operation; }
  catch (error) { observed = error; }
  assert.ok(observed, 'O erro HTTP deveria ser preservado.');
  return observed;
}

for (const code of ['AI_INVALID_WORKFLOW_RESPONSE', 'AI_PROMPT_REFUSED', 'AI_INCOMPLETE_RESPONSE',
  'AI_INVALID_JSON_RESPONSE', 'AI_EMPTY_RESPONSE', 'AI_INVALID_RESPONSE_STRUCTURE']) {
  test(`cliente conserva uso da falha controlada ${code}, sem corpo privado`, async () => {
    const api = await clientFor(payload(24, code));
    const error = await capture(api.ApiClient.generateWorkflow({ prompt: 'Fixture' }, 'signed_fixture'));
    assert.equal(error.name, 'AiGenerationRequestError');
    assert.equal(error.tokensConsumed, 24);
    assert.equal(error.message, 'A proposta não pôde ser aplicada.');
    assert.equal(JSON.stringify(error).includes(privateMarker), false);
    assert.equal('details' in error, false);
  });
}
for (const [name, usage] of [['zero', 0], ['desconhecido', null], ['ausente', undefined], ['negativo', -1],
  ['fracionário', 1.5], ['infinito', Infinity], ['NaN', NaN], ['inteiro inseguro', Number.MAX_SAFE_INTEGER + 1], ['string', '24']]) {
  test(`cliente preserva classificação do consumo ${name}`, async () => {
    const body = payload(); body.tokensConsumed = usage;
    const api = await clientFor(body);
    const error = await capture(api.ApiClient.generateWorkflow({ prompt: 'Fixture' }, 'signed_fixture'));
    assert.equal(error.tokensConsumed, typeof usage === 'number' && Number.isSafeInteger(usage) && usage >= 0 ? usage : null);
  });
}
for (const code of ['UNRELATED_ERROR', 'INVALID_PROMPT', 'SECURITY_SCOPE_VIOLATION', 'AI_PRIVATE_FIXTURE_CODE']) {
  test(`não transforma metadata de ${code} em medição declarada`, async () => {
    const api = await clientFor(payload(99, code));
    const error = await capture(api.ApiClient.generateWorkflow({ prompt: 'Fixture' }, 'signed_fixture'));
    assert.equal(error.tokensConsumed, null);
  });
}

test('erro HTTP sem JSON tem consumo desconhecido e mensagem genérica', async () => {
  const api = await clientFor(null, { status: 503, json: async () => { throw new Error(privateMarker); } });
  const error = await capture(api.ApiClient.generateWorkflow({ prompt: 'Fixture' }, 'signed_fixture'));
  assert.equal(error.tokensConsumed, null);
  assert.match(error.message, /HTTP 503/);
  assert.equal(error.message.includes(privateMarker), false);
});

test('outras rotas não recebem metadata de geração', async () => {
  const api = await clientFor(payload());
  const error = await capture(api.ApiClient.getWorkflow('wf_fixture', 'signed_fixture'));
  assert.equal(error.name, 'Error');
  assert.equal('tokensConsumed' in error, false);
});

test('sem token não chama fetch nem inventa consumo de geração', async () => {
  let calls = 0;
  const { exports } = await loadTypeScript(clientFile, { fetch: async () => { calls++; throw new Error('Não deveria executar'); } });
  const error = await capture(exports.ApiClient.generateWorkflow({ prompt: 'Fixture' }));
  assert.equal(calls, 0);
  assert.equal('tokensConsumed' in error, false);
});

const active = (orgId = 'org_alpha') => ({ orgId, revision: 0, saving: false, reviewing: false,
  publishing: false, deactivating: false, simulating: false, generatingAi: false });
async function harness(api) {
  return loadUiHandlers(editorFile, ['handleGenerateAiProposal'], { aiPrompt: 'Formulário sintético',
    aiResponse: { previous: true }, isAnyActionRunning: false, activeContext: { current: active() },
    getToken: async () => 'signed_fixture', ApiClient: api.ApiClient, AiGenerationRequestError: api.AiGenerationRequestError });
}
for (const usage of [24, 0, null]) {
  test(`feedback do callback real mostra consumo ${usage}, sem reaplicar proposta anterior`, async () => {
    const h = await harness(await clientFor(payload(usage)));
    await h.handlers.handleGenerateAiProposal({ preventDefault() {} });
    assert.equal(h.state.aiResponse, null);
    assert.equal(h.state.feedback.type, 'error');
    assert.match(h.state.feedback.message, usage === null ? /Consumo não informado/ : new RegExp(`Consumo declarado: ${usage} tokens`));
    assert.equal(h.state.feedback.message.includes(privateMarker), false);
    assert.equal(h.state.aiLoading, false);
    assert.equal(h.context.activeContext.current.generatingAi, false);
  });
}

test('falha de geração atrasada não mostra consumo no contexto de outra organização', async () => {
  let finish;
  const response = new Promise((resolve) => { finish = resolve; });
  const { exports } = await loadTypeScript(clientFile, { fetch: async () => response });
  const h = await harness(exports);
  const original = h.context.activeContext.current;
  const pending = h.handlers.handleGenerateAiProposal({ preventDefault() {} });
  await Promise.resolve(); await Promise.resolve();
  h.context.activeContext.current = active('org_beta');
  finish({ ok: false, status: 400, json: async () => payload(24) });
  await pending;
  assert.equal(h.state.feedback, null);
  assert.equal(h.state.aiResponse, null);
  assert.equal(original.generatingAi, false);
  assert.equal(h.context.activeContext.current.generatingAi, false);
});

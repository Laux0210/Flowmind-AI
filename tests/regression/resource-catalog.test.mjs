import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { loadTypeScript } from './load-typescript.mjs';

const webRequire = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const flush = () => new Promise((resolve) => setImmediate(resolve));
const resource = { id: 'test-model', type: 'ai_model', name: 'Modelo <script>teste</script>', status: 'ACTIVE' };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

async function client(data, status = 200) {
  const calls = [];
  const { exports } = await loadTypeScript('apps/web/src/lib/api-client.ts', { fetch: async (url, init) => {
    calls.push({ url, init });
    return { ok: status === 200, status, json: async () => ({ success: true, data }) };
  } });
  return { api: exports.ApiClient, calls };
}
test('catálogo no cliente exige token antes de qualquer rede', async () => {
  const { api, calls } = await client([]);
  await assert.rejects(api.listResources(), /Entre e selecione/);
  assert.equal(calls.length, 0);
});
test('cliente consulta recursos com Bearer e filtro, sem tenant fornecido pelo cliente', async () => {
  const { api, calls } = await client([resource]);
  const result = await api.listResources('synthetic-token', 'ai_model');
  assert.equal(result[0].id, 'test-model');
  assert.match(calls[0].url, /\/resources\?type=ai_model$/);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer synthetic-token');
  assert.ok(!calls[0].url.includes('orgId'));
});
test('lista pública vazia é sucesso explícito', async () => {
  assert.equal((await (await client([])).api.listResources('token')).length, 0);
});
for (const data of [null, {}, [{ ...resource, type: 'unknown' }], [{ ...resource, status: 'REVOKED' }], [{ ...resource, providerModelId: 'private' }]]) {
  test('cliente não transforma catálogo malformado/privado em recursos utilizáveis: ' + JSON.stringify(data), async () => {
    await assert.rejects((await client(data)).api.listResources('token'), /Catálogo de recursos inválido/);
  });
}
test('falha HTTP do catálogo permanece falha', async () => {
  await assert.rejects((await client([], 503)).api.listResources('token'), /HTTP 503/);
});

// Executa o hook real com estado/refs/cleanup controlados. Não comprova lifecycle de browser.
function hookRuntime() {
  const slots = [], cleanups = new Map(), dependencies = new Map();
  let index = 0, queued = [];
  const react = {
    useId: () => 'test-resource-field',
    useRef: (initial) => { const i = index++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useState: (initial) => {
      const i = index++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], (value) => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useEffect: (fn, deps) => {
      const i = index++, previous = dependencies.get(i);
      if (!previous || previous.length !== deps.length || deps.some((value, n) => value !== previous[n])) {
        dependencies.set(i, deps); queued.push([i, fn]);
      }
    },
  };
  return {
    react,
    render: (fn, ...args) => {
      index = 0; queued = []; const value = fn(...args);
      for (const [i, effect] of queued) { cleanups.get(i)?.(); cleanups.set(i, effect()); }
      return value;
    },
    cleanup: () => { for (const cleanup of cleanups.values()) cleanup?.(); },
  };
}
function compiledModule(file, dependencies) {
  const source = readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  runInNewContext(compiled, { module, exports: module.exports, require: (name) => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw new Error('Dependência não permitida: ' + name);
  } });
  return module.exports;
}
function catalogHook(api) {
  const runtime = hookRuntime();
  const module = compiledModule('apps/web/src/lib/use-resource-catalog.ts', { react: runtime.react, './api-client': { ApiClient: api } });
  return { render: (context, token) => runtime.render(module.useResourceCatalog, context, token), cleanup: runtime.cleanup };
}
test('token tardio de um contexto anterior não inicia uma consulta', async () => {
  const token = deferred(), calls = []; let count = 0;
  const getToken = () => ++count === 1 ? token.promise : Promise.resolve('current-token');
  const h = catalogHook({ listResources: async (value) => { calls.push(value); return []; } });
  h.render({ orgId: 'alpha' }, getToken);
  const current = { orgId: 'beta' }; h.render(current, getToken);
  token.resolve('old-token'); await flush();
  assert.deepEqual(calls, ['current-token']);
  assert.equal(h.render(current, getToken).status, 'ready');
});
test('A→B→A descarta sucesso e erro antigos sem apagar a lista atual', async () => {
  const pending = [deferred(), deferred(), deferred()]; let n = 0;
  const getToken = async () => 'token';
  const h = catalogHook({ listResources: () => pending[n++].promise });
  h.render({ orgId: 'alpha' }, getToken); await flush();
  h.render({ orgId: 'beta' }, getToken); await flush();
  const current = { orgId: 'alpha' }; h.render(current, getToken); await flush();
  pending[2].resolve([resource]); await flush();
  pending[0].resolve([{ ...resource, id: 'stale' }]); pending[1].reject(new Error('PRIVATE_OLD_ERROR')); await flush();
  const result = h.render(current, getToken);
  assert.equal(result.status, 'ready'); assert.equal(result.resources[0].id, 'test-model'); assert.equal(result.error, null);
});
test('troca de contexto esconde recursos anteriores antes do novo efeito terminar', async () => {
  const pending = deferred(), getToken = async () => 'token'; let first = true;
  const h = catalogHook({ listResources: () => first ? (first = false, Promise.resolve([resource])) : pending.promise });
  const a = {}; h.render(a, getToken); await flush(); assert.equal(h.render(a, getToken).resources.length, 1);
  const next = h.render({}, getToken);
  assert.equal(next.resources.length, 0); assert.equal(next.status, 'loading');
  h.cleanup(); pending.resolve([]); await flush();
});
test('mesma organização com nova carga não aceita resultado da carga anterior', async () => {
  const pending = [deferred(), deferred()]; let n = 0;
  const h = catalogHook({ listResources: () => pending[n++].promise }), context = { orgId: 'alpha' };
  const firstToken = async () => 'first', secondToken = async () => 'second';
  h.render(context, firstToken); await flush(); h.render(context, secondToken); await flush();
  pending[1].resolve([resource]); await flush(); pending[0].resolve([]); await flush();
  assert.equal(h.render(context, secondToken).resources[0].id, 'test-model');
});
test('catálogo vazio e falha têm estados distintos; erro não expõe detalhe privado', async () => {
  const getToken = async () => 'token', current = {};
  const ok = catalogHook({ listResources: async () => [] }); ok.render(current, getToken); await flush();
  assert.equal(ok.render(current, getToken).status, 'ready');
  const failed = catalogHook({ listResources: async () => { throw new Error('PRIVATE_PROVIDER'); } });
  failed.render(current, getToken); await flush();
  const result = failed.render(current, getToken);
  assert.equal(result.status, 'error'); assert.ok(!result.error.includes('PRIVATE_PROVIDER'));
});

async function parameterComponent(react = webRequire('react')) {
  const helpers = (await loadTypeScript('apps/web/src/lib/workflow-editing.ts')).exports;
  return compiledModule('apps/web/src/components/workflows/node-parameter-editor.tsx', {
    react, 'react/jsx-runtime': webRequire('react/jsx-runtime'), '@/lib/workflow-editing': helpers,
  }).NodeParameterEditor;
}
const node = { id: 'ai', type: 'ai_analyze_intent', label: 'Análise', position: { x: 0, y: 0 }, config: { modelRef: 'legacy-model', inputPromptTemplate: 'Mensagem anterior' } };
test('select real conserva referência antiga e escapa nomes do catálogo em SSR', async () => {
  const Component = await parameterComponent(), React = webRequire('react');
  const html = webRequire('react-dom/server').renderToStaticMarkup(React.createElement(Component, {
    node, disabled: false, catalog: { status: 'ready', resources: [resource], error: null }, onPendingChange() {}, onApply() {},
  }));
  assert.match(html, /<select/);
  assert.match(html, /<option(?=[^>]*value="legacy-model")(?=[^>]*selected)[^>]*>/);
  assert.match(html, /pendente/i); assert.match(html, /&lt;script&gt;/); assert.ok(!html.includes('<script>'));
});
test('chegada do catálogo preserva parâmetros pendentes e aplica somente mudanças do usuário', async () => {
  const runtime = hookRuntime(), Component = await parameterComponent(runtime.react), applied = [];
  const props = { node, disabled: false, catalog: { status: 'loading', resources: [], error: null },
    onPendingChange() {}, onApply: (...args) => { applied.push(args); return true; } };
  function find(value, predicate) {
    if (!value || typeof value !== 'object') return;
    if (predicate(value)) return value;
    for (const child of [value.props?.children].flat(Infinity)) { const result = find(child, predicate); if (result) return result; }
  }
  let form = runtime.render(Component, props);
  find(form, (value) => value.type === 'textarea').props.onChange({ target: { value: 'Texto ainda não aplicado' } });
  form = runtime.render(Component, { ...props, catalog: { status: 'ready', resources: [resource], error: null } });
  assert.equal(find(form, (value) => value.type === 'textarea').props.value, 'Texto ainda não aplicado');
  form.props.onSubmit({ preventDefault() {} });
  assert.equal(applied[0][2].inputPromptTemplate, 'Texto ainda não aplicado');
  assert.equal(Object.hasOwn(applied[0][2], 'modelRef'), false);
});

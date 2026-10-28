import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const flush = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const row = (publicId, workflowId, status = 'ACTIVE') => ({
  publicId,
  workflowId,
  status,
  createdAt: '2026-10-23T00:00:00Z',
});
const elements = (node) =>
  !node || typeof node !== 'object'
    ? []
    : Array.isArray(node)
      ? node.flatMap(elements)
      : [node, ...elements(node.props?.children)];
const text = (node) =>
  node == null || typeof node === 'boolean'
    ? ''
    : typeof node !== 'object'
      ? String(node)
      : Array.isArray(node)
        ? node.map(text).join('')
        : text(node.props?.children);
const button = (tree, label) => elements(tree).find((e) => e.type === 'button' && text(e) === label);

// Unidade do componente real WebhookPanel com hooks/cleanup controlados.
function fixture(api, getToken = async () => 'token') {
  const slots = [];
  const deps = new Map();
  const cleanups = new Map();
  const effectFns = new Map();
  let index = 0;
  let effects = [];
  let unmounted = false;
  let writesAfterUnmount = 0;
  const changed = (i, next) => {
    const old = deps.get(i);
    return !old || old.length !== next.length || next.some((v, n) => v !== old[n]);
  };
  const react = {
    useRef(initial) {
      const i = index++;
      return slots[i] ?? (slots[i] = { current: initial });
    },
    useState(initial) {
      const i = index++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [
        slots[i],
        (value) => {
          if (unmounted) writesAfterUnmount++;
          slots[i] = typeof value === 'function' ? value(slots[i]) : value;
        },
      ];
    },
    useCallback(fn, next) {
      const i = index++;
      if (changed(i, next)) {
        deps.set(i, next);
        slots[i] = fn;
      }
      return slots[i];
    },
    useEffect(fn, next) {
      const i = index++;
      effectFns.set(i, fn);
      if (changed(i, next)) {
        deps.set(i, next);
        effects.push([i, fn]);
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  const source = readFileSync(
    new URL('../../apps/web/src/components/workflows/webhook-panel.tsx', import.meta.url),
    'utf8',
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(compiled, {
    module,
    exports: module.exports,
    Error,
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name.endsWith('lib/api-client')) {
        return {
          ApiClient: api,
          webhookUrl: (id) => `http://localhost:3001/api/v1/triggers/webhook/${id}`,
        };
      }
      throw new Error('Import inesperado: ' + name);
    },
  });
  let props = { workflowId: 'a', getToken };
  return {
    render(next = {}) {
      props = { ...props, ...next };
      index = 0;
      effects = [];
      const tree = module.exports.WebhookPanel(props);
      for (const [i, fn] of effects) {
        cleanups.get(i)?.();
        cleanups.set(i, fn());
      }
      return tree;
    },
    unmount() {
      unmounted = true;
      for (const c of cleanups.values()) c?.();
    },
    strictReplay() {
      for (const c of cleanups.values()) c?.();
      for (const [i, fn] of effectFns) cleanups.set(i, fn());
    },
    writesAfterUnmount: () => writesAfterUnmount,
  };
}

test('resposta atrasada A não substitui a lista de endpoints de B', async () => {
  const a = deferred();
  const b = deferred();
  const f = fixture({ listWebhooks: (id) => (id === 'a' ? a.promise : b.promise) });
  f.render();
  await flush();
  f.render({ workflowId: 'b' });
  await flush();
  b.resolve([row('ep_b', 'b')]);
  await flush();
  a.resolve([row('ep_a', 'a')]);
  await flush();
  const rendered = text(f.render());
  assert.match(rendered, /ep_b/);
  assert.doesNotMatch(rendered, /ep_a/);
});

test('A→B→A ignora sucesso e erro dos pedidos anteriores', async () => {
  const pending = [deferred(), deferred(), deferred()];
  let n = 0;
  const f = fixture({ listWebhooks: () => pending[n++].promise });
  f.render();
  await flush();
  f.render({ workflowId: 'b' });
  await flush();
  f.render({ workflowId: 'a' });
  await flush();
  pending[2].resolve([row('ep_atual', 'a')]);
  await flush();
  pending[0].resolve([row('ep_antigo', 'a')]);
  pending[1].reject(new Error('ERRO_OBSOLETO'));
  await flush();
  const tree = f.render();
  assert.match(text(tree), /ep_atual/);
  assert.doesNotMatch(text(tree), /ep_antigo|ERRO_OBSOLETO/);
  assert.equal(elements(tree).filter((e) => e.props?.role === 'alert').length, 0);
});

test('token atrasado de contexto anterior não inicia sua consulta', async () => {
  const token = deferred();
  const calls = [];
  let n = 0;
  const f = fixture(
    {
      listWebhooks: async (id) => {
        calls.push(id);
        return [];
      },
    },
    () => (++n === 1 ? token.promise : Promise.resolve('novo')),
  );
  f.render();
  f.render({ workflowId: 'b' });
  token.resolve('antigo');
  await flush();
  assert.deepEqual(calls, ['b']);
});

test('troca de identidade do token ou workflow esconde lista e segredo revelado já no primeiro render', async () => {
  let n = 0;
  const pending = deferred();
  const f = fixture({
    listWebhooks: () => (++n <= 2 ? Promise.resolve([row('ep_privado_a', 'a')]) : pending.promise),
    createWebhook: async (id) => ({ ...row('ep_privado_a', id), secret: 'whsec_SEGREDO_A' }),
  });
  f.render();
  await flush();
  button(f.render(), 'Criar webhook').props.onClick();
  await flush();
  const beforeSwitch = text(f.render());
  assert.match(beforeSwitch, /ep_privado_a/);
  assert.match(beforeSwitch, /whsec_SEGREDO_A/);

  const afterTokenSwitch = text(f.render({ getToken: async () => 'outro_token' }));
  assert.doesNotMatch(afterTokenSwitch, /ep_privado_a/);
  assert.doesNotMatch(afterTokenSwitch, /whsec_SEGREDO_A/);
});

test('criação ou rotação atrasada de contexto anterior não revela segredo no novo contexto', async () => {
  const createA = deferred();
  const f = fixture({
    listWebhooks: async (id) => [row(`ep_${id}`, id)],
    createWebhook: () => createA.promise,
  });
  f.render();
  await flush();
  button(f.render(), 'Criar webhook').props.onClick();
  await flush();
  f.render({ workflowId: 'b' });
  await flush();
  createA.resolve({ ...row('ep_novo_a', 'a'), secret: 'whsec_VAZAMENTO_A' });
  await flush();
  const rendered = text(f.render());
  assert.doesNotMatch(rendered, /whsec_VAZAMENTO_A/);
  assert.match(rendered, /ep_b/);
});

test('ação com token pendente não cria, rotaciona ou revoga webhook após mudar contexto', async () => {
  const token = deferred();
  const mutations = [];
  let n = 0;
  const f = fixture(
    {
      listWebhooks: async (id) => [row(`ep_${id}`, id)],
      createWebhook: async (id) => mutations.push(['create', id]),
      rotateWebhook: async (pubId) => mutations.push(['rotate', pubId]),
      revokeWebhook: async (pubId) => mutations.push(['revoke', pubId]),
    },
    () => (++n === 2 ? token.promise : Promise.resolve('token')),
  );
  f.render();
  await flush();
  button(f.render(), 'Revogar').props.onClick();
  f.render({ workflowId: 'b' });
  await flush();
  token.resolve('token_antigo');
  await flush();
  assert.deepEqual(mutations, []);
});

test('duas ações no mesmo render iniciam só uma mutação', async () => {
  const pending = deferred();
  const created = [];
  const f = fixture({
    listWebhooks: async () => [],
    createWebhook: async (id) => {
      created.push(id);
      return pending.promise;
    },
  });
  f.render();
  await flush();
  const createBtn = button(f.render(), 'Criar webhook');
  createBtn.props.onClick();
  createBtn.props.onClick();
  await flush();
  assert.deepEqual(created, ['a']);
  pending.resolve({ ...row('ep_a', 'a'), secret: 'whsec_1' });
  await flush();
});

test('resposta após unmount não altera estado', async () => {
  const pending = deferred();
  const f = fixture({ listWebhooks: () => pending.promise });
  f.render();
  await flush();
  f.unmount();
  pending.resolve([]);
  await flush();
  assert.equal(f.writesAfterUnmount(), 0);
});

test('replay de efeitos do StrictMode não deixa ações presas em busy', async () => {
  const pending = [deferred(), deferred()];
  let n = 0;
  const f = fixture({ listWebhooks: () => pending[n++].promise });
  f.render();
  await flush();
  f.strictReplay();
  await flush();
  pending[1].resolve([row('ep_atual', 'a')]);
  await flush();
  pending[0].resolve([row('ep_obsoleto', 'a')]);
  await flush();
  const tree = f.render();
  assert.match(text(tree), /ep_atual/);
  assert.doesNotMatch(text(tree), /ep_obsoleto/);
  const createBtn = button(tree, 'Criar webhook');
  assert.equal(createBtn.props.disabled, false);
});

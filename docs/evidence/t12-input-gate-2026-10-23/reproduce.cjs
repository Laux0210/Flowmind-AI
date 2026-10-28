// Diagnóstico local: executa o fonte atual, sem banco, rede ou efeitos externos.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const load = createRequire(path.join(root, 'package.json'));
const ts = load('typescript');
const sourcePath = path.join(root, 'apps/api/src/engine/node-executors.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText, { exports: exportsObject, require: createRequire(sourcePath) }, { filename: sourcePath });
const execute = exportsObject.NodeExecutors.executeTriggerForm.bind(exportsObject.NodeExecutors);
const payload = { scheduledAt: '2026-10-23T20:00:00.000Z' };
const results = [];
for (const [name, config] of [['default', {}], ['required-form', { requiredFields: ['name', 'email', 'message'] }]]) {
  let error;
  try { execute(config, payload); } catch (caught) { error = caught; }
  assert.equal(error?.getStatus(), 400);
  assert.match(error.message, /Campo obrigatório ausente/);
  results.push({ case: name, status: error.getStatus(), message: error.message });
}
const optional = execute({ requiredFields: [] }, payload);
assert.equal(Object.hasOwn(optional, 'scheduledAt'), false);
assert.equal(optional.contact_name, '');
assert.equal(optional.contact_email, '');
assert.equal(optional.message_text, '');
results.push({ case: 'optional-form', succeeds: true, scheduledAtPreserved: false, contactFieldsEmpty: true });
assert.equal(hash(source), hash(fs.readFileSync(sourcePath, 'utf8')));
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), sourceSha256: hash(source), sourceStable: true,
  scope: 'Current trigger executor only; not an authenticated or full worker integration test', results }, null, 2));

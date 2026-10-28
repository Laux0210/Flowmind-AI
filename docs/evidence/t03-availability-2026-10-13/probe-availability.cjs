'use strict';

// Caracterização do protótipo compilado. Não aprova semântica de convergência.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const root = resolve(__dirname, '../../..');
const local = createRequire(resolve(root, 'package.json'));
local('reflect-metadata');
local('@nestjs/common').Logger.overrideLogger([]);
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts++; throw new Error('Rede proibida neste diagnóstico.'); };
const { WorkflowEngineService } = local(resolve(root, 'apps/api/dist/engine/workflow-engine.service.js'));
const { WorkflowsService } = local(resolve(root, 'apps/api/dist/workflows/workflows.service.js'));
const { DagValidator } = local(resolve(root, 'apps/api/dist/engine/dag-validator.js'));

const node = (id, type, config) => ({ id, type, label: 'Fixture sintética', position: { x: 0, y: 0 }, config });
const form = () => node('form', 'trigger_form', { requiredFields: ['name', 'email', 'message'] });
const record = (id, withMessage = true) => node(id, 'internal_record', { fieldMappings: {
  name: '{{form.contact_name}}', ...(withMessage ? { raw_message: '{{form.message_text}}' } : {}),
} });
const mail = (body) => node('mail', 'send_email', { to: '{{form.contact_email}}', subject: 'Fixture', bodyTemplate: body });
const condition = () => node('condition', 'condition', { leftOperand: '{{form.message_text}}', operator: 'equals', rightOperand: 'yes' });
const edge = (sourceNodeId, targetNodeId, sourceHandle) => ({
  id: [sourceNodeId, targetNodeId, sourceHandle ?? 'default'].join('_'), sourceNodeId, targetNodeId,
  ...(sourceHandle === undefined ? {} : { sourceHandle }),
});
function workflow(nodes, edges) {
  return { id: 'wf_availability_fixture', orgId: 'org_availability_fixture', schemaVersion: '1.0.0',
    name: 'Diagnóstico de disponibilidade', version: 1, status: 'DRAFT', triggerNodeId: 'form', nodes, edges,
    createdAt: new Date('2026-10-13T00:00:00Z'), updatedAt: new Date('2026-10-13T00:00:00Z') };
}
function conditional(body, mailOnlyInYes = false) {
  return workflow([form(), condition(), record('yes'), record('no'), mail(body)], [
    edge('form', 'condition'), edge('condition', 'yes', 'true'), edge('condition', 'no', 'false'),
    edge('yes', 'mail'), ...(mailOnlyInYes ? [] : [edge('no', 'mail')]),
  ]);
}
const cases = [
  { id: 'B1', purpose: 'Bifurcação incondicional e convergência', producer: 'ai',
    make: () => workflow([form(), node('ai', 'ai_analyze_intent', { inputPromptTemplate: '{{form.message_text}}' }),
      record('record'), mail('{{ai.summary}}')], [edge('form', 'ai'), edge('form', 'record'), edge('ai', 'mail'), edge('record', 'mail')]),
    messages: ['yes', 'no'], expected: ['COMPLETED', 'COMPLETED'] },
  { id: 'B2', purpose: 'Convergência consome somente a saída do ramo yes', producer: 'yes',
    make: () => conditional('{{yes.raw_message}}'), messages: ['yes', 'no'], expected: ['COMPLETED', 'FAILED'] },
  { id: 'B3', purpose: 'Consumidor limitado ao ramo produtor', producer: 'yes',
    make: () => conditional('{{yes.raw_message}}', true), messages: ['yes', 'no'], expected: ['COMPLETED', 'COMPLETED'] },
  { id: 'B4', purpose: 'Convergência consome saída anterior à condição', producer: 'form',
    make: () => conditional('{{form.message_text}}'), messages: ['yes', 'no'], expected: ['COMPLETED', 'COMPLETED'] },
  { id: 'B5', purpose: 'Produtor executado com campo opcional não mapeado', producer: 'record',
    make: () => workflow([form(), record('record', false), mail('{{record.ai_summary}}')], [edge('form', 'record'), edge('record', 'mail')]),
    messages: ['yes'], expected: ['FAILED'] },
  { id: 'B6', purpose: 'Campo de modo saved em execução SIMULATION', producer: 'record',
    make: () => workflow([form(), record('record'), mail('{{record.persisted_at}}')], [edge('form', 'record'), edge('record', 'mail')]),
    messages: ['yes'], expected: ['FAILED'] },
];

// Caminhos finitos apenas destas fixtures pequenas; não é um algoritmo de produção.
function everyStructuralPathHasProducer(w, producer, consumer) {
  const incoming = new Map(w.nodes.map((n) => [n.id, []]));
  for (const e of w.edges) incoming.get(e.targetNodeId).push(e.sourceNodeId);
  function visit(id, found) {
    const present = found || id === producer;
    const parents = incoming.get(id);
    return parents.length ? parents.every((parent) => visit(parent, present)) : present;
  }
  return visit(consumer, false);
}
async function inspect(fixture, message, expectedStatus) {
  let row = fixture.make();
  const { ancestorsByNode } = DagValidator.validateAndSort(row);
  const counters = { writes: 0, snapshots: 0 };
  const prisma = {
    workflow: {
      async findFirst({ where }) { return row.id === where.id && row.orgId === where.orgId ? structuredClone(row) : null; },
      async updateMany({ where, data }) {
        if (Object.entries(where).some(([key, value]) => row[key] !== value)) return { count: 0 };
        counters.writes++; row = { ...row, ...data }; return { count: 1 };
      },
    },
    workflowVersion: { async create({ data }) { counters.snapshots++; return { ...data, id: 'snapshot_fixture' }; } },
    async $transaction(action) { return action(this); },
  };
  const engine = new WorkflowEngineService();
  const service = new WorkflowsService(prisma, engine);
  let lifecycle = 'ACCEPTED';
  try { await service.review(row.orgId, row.id, 'user_fixture'); await service.publish(row.orgId, row.id, 'user_fixture'); }
  catch { lifecycle = 'REJECTED'; }
  const result = await engine.simulate(row, { name: 'Contato sintético', email: 'contato@example.test', message });
  assert.equal(result.status, expectedStatus, 'O diagnóstico mudou; revisar esta caracterização.');
  const consumer = result.nodeResults.find((n) => n.nodeId === 'mail');
  const producer = result.nodeResults.find((n) => n.nodeId === fixture.producer);
  return { id: fixture.id, messageVariant: message, purpose: fixture.purpose, lifecycle, simulationStatus: result.status,
    consumerStatus: consumer?.status ?? null, producerStatus: producer?.status ?? null,
    producerIsAncestor: ancestorsByNode.get('mail')?.has(fixture.producer) ?? false,
    everyStructuralPathHasProducer: everyStructuralPathHasProducer(row, fixture.producer, 'mail'),
    nodeStatuses: result.nodeResults.map((n) => ({ id: n.nodeId, status: n.status })), persistenceCounters: counters };
}
const paths = ['apps/api/src/engine/dag-validator.ts', 'apps/api/src/engine/variable-resolver.ts',
  'apps/api/src/engine/workflow-engine.service.ts', 'apps/api/src/engine/workflow-reference.validation.ts',
  'apps/api/src/engine/workflow-validation.ts', 'apps/api/src/engine/node-executors.ts',
  'apps/api/src/workflows/workflows.service.ts', 'packages/contracts/src/nodes.ts',
  'packages/contracts/src/node-outputs.ts', 'packages/contracts/src/node-validation.ts'];
const artifacts = ['apps/api/dist/engine/dag-validator.js', 'apps/api/dist/engine/variable-resolver.js',
  'apps/api/dist/engine/workflow-engine.service.js', 'apps/api/dist/engine/workflow-reference.validation.js',
  'apps/api/dist/engine/workflow-validation.js', 'apps/api/dist/engine/node-executors.js',
  'apps/api/dist/workflows/workflows.service.js', 'packages/contracts/dist/index.js',
  'packages/contracts/dist/node-outputs.js', 'packages/contracts/dist/node-validation.js'];
const hashes = (names) => Object.fromEntries(names.map((p) => [p, createHash('sha256').update(readFileSync(resolve(root, p))).digest('hex')]));
(async () => {
  const before = hashes([...paths, ...artifacts]);
  const results = [];
  for (const fixture of cases) {
    for (let i = 0; i < fixture.messages.length; i++) results.push(await inspect(fixture, fixture.messages[i], fixture.expected[i]));
  }
  const after = hashes([...paths, ...artifacts]);
  assert.deepEqual(after, before);
  assert.equal(networkAttempts, 0);
  process.stdout.write(JSON.stringify({ observedAtUtc: new Date().toISOString(), scope: 'LOCAL_AVAILABILITY_CHARACTERIZATION',
    policyApproval: 'PENDING', auth: 'not exercised; direct service calls', storage: 'synthetic; no real transaction semantics',
    sourceStable: true, networkAttempts, commercialCallsExecuted: false,
    sourceHashes: hashes(paths), artifactHashes: hashes(artifacts), results }, null, 2) + '\n');
})().catch(() => { process.stderr.write('Falha da caracterização; conferir fontes e artefatos.\n'); process.exitCode = 1; });

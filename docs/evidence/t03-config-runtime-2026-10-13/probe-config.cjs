'use strict';

// Diagnóstico de comportamento atual. Não é teste de aceite das lacunas observadas.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const root = resolve(__dirname, '../../..');
const local = createRequire(resolve(root, 'package.json'));
local('reflect-metadata');
const { Logger } = local('@nestjs/common');
Logger.overrideLogger([]);
let networkAttempts = 0;
globalThis.fetch = async () => {
  networkAttempts++;
  throw new Error('Rede proibida neste diagnóstico.');
};
const { WorkflowEngineService } = local(resolve(root, 'apps/api/dist/engine/workflow-engine.service.js'));
const { WorkflowsService } = local(resolve(root, 'apps/api/dist/workflows/workflows.service.js'));

function node(id, type, config) {
  return { id, type, label: 'Fixture sintética', position: { x: 0, y: 0 }, config };
}
function edge(id, sourceNodeId, targetNodeId, sourceHandle) {
  return { id, sourceNodeId, targetNodeId, ...(sourceHandle === undefined ? {} : { sourceHandle }) };
}
function baseline() {
  return {
    id: 'wf_schema_fixture', orgId: 'org_schema_fixture', schemaVersion: '1.0.0',
    name: 'Diagnóstico sintético', version: 1, status: 'DRAFT', triggerNodeId: 'form',
    nodes: [
      node('form', 'trigger_form', { requiredFields: ['name', 'email', 'message'] }),
      node('mail', 'send_email', {
        to: '{{form.contact_email}}', subject: 'Fixture', bodyTemplate: '{{form.message_text}}',
      }),
    ], edges: [edge('form_mail', 'form', 'mail')],
    createdAt: new Date('2026-10-13T00:00:00Z'), updatedAt: new Date('2026-10-13T00:00:00Z'),
  };
}
const fixtures = [
  { id: 'SC00', purpose: 'Jornada linear válida', edit() {} },
  { id: 'SC01', purpose: 'HTTP sem configuração', edit(w) {
    w.nodes[1] = node('http', 'http_request', {}); w.edges = [edge('form_http', 'form', 'http')];
  } },
  { id: 'SC02', purpose: 'Assunto numérico e corpo ausente', edit(w) {
    w.nodes[1].config = { to: '{{form.contact_email}}', subject: 17 };
  } },
  { id: 'SC03', purpose: 'Destinatário referencia saída inexistente', edit(w) {
    w.nodes[1].config.to = '{{form.output_inexistente}}';
  } },
  { id: 'SC04', purpose: 'Corpo referencia nó inexistente', edit(w) {
    w.nodes[1].config.bodyTemplate = '{{missing.summary}}';
  } },
  { id: 'SC05', purpose: 'Operador fora do catálogo', edit(w) {
    w.nodes[1] = node('condition', 'condition', { leftOperand: 'a', operator: 'fixture_invalid_operator', rightOperand: 'b' });
    w.edges = [edge('form_condition', 'form', 'condition')];
  } },
  { id: 'SC06', purpose: 'Tipo de nó fora do catálogo', edit(w) {
    w.nodes[1] = node('unknown', 'fixture_unknown_type', {});
    w.edges = [edge('form_unknown', 'form', 'unknown')];
  } },
  { id: 'SC07', purpose: 'IDs de arestas duplicados na condição', edit(w) {
    w.nodes = [w.nodes[0], node('condition', 'condition', { leftOperand: 'a', operator: 'equals', rightOperand: 'a' }),
      node('record', 'internal_record', { fieldMappings: { name: '{{form.contact_name}}' } })];
    w.edges = [edge('form_condition', 'form', 'condition'),
      edge('duplicate', 'condition', 'record', 'true'), edge('duplicate', 'condition', 'record', 'false')];
  } },
  { id: 'SC08', purpose: 'Consumidor depende da saída de ramo inativo', edit(w) {
    const mail = w.nodes[1]; mail.config.bodyTemplate = '{{yes.raw_message}}';
    w.nodes = [w.nodes[0], node('condition', 'condition', { leftOperand: 'a', operator: 'equals', rightOperand: 'b' }),
      node('yes', 'internal_record', { fieldMappings: { name: '{{form.contact_name}}', raw_message: '{{form.message_text}}' } }),
      node('no', 'internal_record', { fieldMappings: { name: '{{form.contact_name}}' } }), mail];
    w.edges = [edge('form_condition', 'form', 'condition'), edge('yes_edge', 'condition', 'yes', 'true'),
      edge('no_edge', 'condition', 'no', 'false'), edge('yes_mail', 'yes', 'mail'), edge('no_mail', 'no', 'mail')];
  } },
  { id: 'SC09', purpose: 'Referências de recursos sem resolução', edit(w) {
    w.nodes[0].config.formId = 'form_reference_fixture';
    w.nodes = [w.nodes[0], node('ai', 'ai_analyze_intent', {
      modelRef: 'model_reference_fixture', inputPromptTemplate: '{{form.message_text}}',
    }), node('http', 'http_request', {
      url: 'https://endpoint.example.invalid', method: 'POST', credentialRef: 'credential_reference_fixture',
    })];
    w.edges = [edge('form_ai', 'form', 'ai'), edge('ai_http', 'ai', 'http')];
  } },
];

async function inspect(fixture) {
  let row = baseline(); fixture.edit(row);
  const counters = { workflowReads: 0, workflowWrites: 0, versionSnapshots: 0 };
  const prisma = {
    workflow: {
      async findFirst({ where }) {
        counters.workflowReads++;
        return where.id === row.id && where.orgId === row.orgId ? structuredClone(row) : null;
      },
      async updateMany({ where, data }) {
        if (Object.entries(where).some(([key, value]) => row[key] !== value)) return { count: 0 };
        counters.workflowWrites++; row = { ...row, ...data }; return { count: 1 };
      },
    },
    workflowVersion: { async create({ data }) {
      counters.versionSnapshots++; return { ...structuredClone(data), id: 'snapshot_fixture' };
    } },
    async $transaction(action) { return action(this); },
  };
  const engine = new WorkflowEngineService();
  const service = new WorkflowsService(prisma, engine);
  const out = { id: fixture.id, purpose: fixture.purpose, reviewAttempted: true, publishAttempted: false,
    reviewAccepted: false, publishAccepted: false };
  try {
    await service.review(row.orgId, row.id, 'user_schema_fixture'); out.reviewAccepted = true;
    out.publishAttempted = true;
    await service.publish(row.orgId, row.id, 'user_schema_fixture'); out.publishAccepted = true;
  } catch (error) {
    const response = typeof error?.getResponse === 'function' ? error.getResponse() : null;
    out.lifecycleErrorCode = response && typeof response === 'object' ? response.code ?? error.name : error.name;
  }
  try {
    const result = await engine.simulate(row, { name: 'Contato sintético', email: 'contato@example.test', message: 'Mensagem sintética' });
    out.simulationStatus = result.status;
    out.nodeStatuses = result.nodeResults.map((n) => ({ id: n.nodeId, type: n.nodeType, status: n.status }));
    if (fixture.id === 'SC08') {
      const mail = result.nodeResults.find((n) => n.nodeId === 'mail');
      out.consumerBodyUnavailable = mail?.status === 'SUCCESS' ? mail.inputs.bodyTemplate === undefined : null;
    }
  } catch (error) {
    out.simulationStatus = 'REJECTED_BEFORE_NODES'; out.simulationErrorType = error.name;
  }
  return { ...out, persistenceCounters: counters };
}

(async () => {
  const results = [];
  for (const fixture of fixtures) results.push(await inspect(fixture));
  assert.equal(results[0].simulationStatus, 'COMPLETED');
  assert.equal(results[0].publishAccepted, true);
  assert.equal(networkAttempts, 0);
  const paths = ['packages/contracts/src/nodes.ts', 'packages/contracts/src/workflow.ts',
    'packages/contracts/src/api.ts', 'packages/contracts/src/index.ts', 'packages/contracts/src/node-validation.ts', 'apps/api/src/engine/dag-validator.ts',
    'apps/api/src/engine/variable-resolver.ts', 'apps/api/src/engine/workflow-validation.ts',
    'apps/api/src/engine/node-executors.ts', 'apps/api/src/engine/workflow-engine.service.ts',
    'apps/api/src/workflows/workflows.service.ts', 'apps/api/src/workflows/workflows.controller.ts',
    'apps/api/src/ai/ai-generator.service.ts', 'apps/api/src/ai/workflow-proposal.parser.ts',
    'apps/api/src/ai/workflow-generation.schema.ts', 'apps/api/prisma/schema.prisma'];
  const artifactPaths = ['apps/api/dist/workflows/workflows.service.js',
    'apps/api/dist/engine/workflow-engine.service.js', 'apps/api/dist/engine/node-executors.js',
    'apps/api/dist/engine/dag-validator.js', 'apps/api/dist/engine/variable-resolver.js',
    'apps/api/dist/engine/workflow-validation.js', 'packages/contracts/dist/index.js', 'packages/contracts/dist/nodes.js', 'packages/contracts/dist/workflow.js', 'packages/contracts/dist/node-validation.js'];
  const hashes = (paths) => Object.fromEntries(paths.map((p) => [p,
    createHash('sha256').update(readFileSync(resolve(root, p))).digest('hex')]));
  process.stdout.write(JSON.stringify({
    observedAtUtc: new Date().toISOString(), scope: 'LOCAL_CONTRACT_DIAGNOSTIC',
    acceptanceVerdict: 'NOT_ASSESSED', services: 'WorkflowsService and WorkflowEngineService compiled locally',
    storage: 'synthetic; no database or real transaction semantics', auth: 'not exercised; direct service calls',
    commercialCallsExecuted: false, networkAttempts, sourceHashes: hashes(paths), artifactHashes: hashes(artifactPaths), results,
  }, null, 2) + '\n');
})().catch(() => { process.stderr.write('Falha do diagnóstico local; conferir fontes e artefatos.\n'); process.exitCode = 1; });

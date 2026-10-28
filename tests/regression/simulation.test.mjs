import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './load-typescript.mjs';

const engineFile = 'apps/api/src/engine/workflow-engine.service.ts';
const executorsFile = 'apps/api/src/engine/node-executors.ts';
function workflow() {
  return {
    schemaVersion: '1.0.0', id: 'wf_synthetic', orgId: 'org_alpha', name: 'Jornada sintética',
    version: 1, status: 'DRAFT', triggerNodeId: 'form', createdAt: '', updatedAt: '',
    nodes: [
      { id: 'form', type: 'trigger_form', config: { requiredFields: ['name', 'email', 'message'] } },
      { id: 'ai', type: 'ai_analyze_intent', config: { modelRef: 'pending', inputPromptTemplate: '{{form.message_text}}' } },
      { id: 'record', type: 'internal_record', config: { fieldMappings: {
        name: '{{form.contact_name}}', email: '{{form.contact_email}}', raw_message: '{{form.message_text}}',
        ai_summary: '{{ai.summary}}', ai_intent: '{{ai.intent}}', ambiguities: '{{ai.ambiguities}}',
      } } },
      { id: 'email', type: 'send_email', config: { to: '{{form.contact_email}}', subject: 'Mensagem recebida', bodyTemplate: '{{ai.summary}} — Pendências: {{ai.ambiguities}}' } },
    ],
    edges: [
      { id: 'e1', sourceNodeId: 'form', targetNodeId: 'ai' },
      { id: 'e2', sourceNodeId: 'ai', targetNodeId: 'record' },
      { id: 'e3', sourceNodeId: 'record', targetNodeId: 'email' },
    ],
  };
}
async function simulate(definition, payload) {
  const { exports } = await loadTypeScript(engineFile);
  return new exports.WorkflowEngineService(exports.createTestResourceResolver()).simulate(definition, payload);
}

test('C01 percorre a jornada com efeitos simulados e sem classificação comercial', async () => {
  const result = await simulate(workflow(), { name: 'Pessoa Sintética', email: 'pessoa@example.test', message: 'Quero uma proposta para automatizar meu atendimento' });
  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.nodeResults.length, 4);
  const ai = result.nodeResults.find((node) => node.nodeId === 'ai').outputs;
  assert.match(ai.summary, /proposta/);
  assert.equal(typeof ai.intent, 'string');
  assert.ok(Array.isArray(ai.ambiguities));
  assert.equal('interest_level' in ai, false);
  assert.equal('confidence_score' in ai, false);
  assert.equal(ai.model_used, 'simulated');
  assert.equal(ai.tokens_consumed, 0);
  const record = result.nodeResults.find((node) => node.nodeId === 'record').outputs;
  assert.equal(record.status, 'simulated');
  assert.ok(record.record_id);
  assert.equal('persisted_at' in record, false);
  const email = result.nodeResults.find((node) => node.nodeId === 'email').outputs;
  assert.equal(email.delivery_status, 'simulated');
  assert.equal(email.recipient, 'pessoa@example.test');
});

test('C02: template com ambiguidades conserva sua interpolação na prévia', async () => {
  const result = await simulate(workflow(), { name: 'Contato Sintético', email: 'contato@example.test', message: 'Tenho dúvidas gerais' });
  assert.equal(result.status, 'COMPLETED');
  const ai = result.nodeResults.find((node) => node.nodeId === 'ai').outputs;
  assert.ok(ai.ambiguities.length > 0);
  const email = result.nodeResults.find((node) => node.nodeId === 'email');
  assert.match(email.inputs.bodyTemplate, /dúvidas/);
  assert.ok(email.inputs.bodyTemplate.includes(ai.ambiguities[0]));
});

for (const email of [undefined, '', '   ', 'invalid', 123]) {
  test(`C03 falha no gatilho antes dos efeitos com email ${JSON.stringify(email)}`, async () => {
    const result = await simulate(workflow(), { name: 'Contato Sintético', email, message: 'Tenho dúvidas', message_text: 'Alias presente' });
    assert.equal(result.status, 'FAILED');
    assert.equal(result.nodeResults.length, 1);
    assert.equal(result.nodeResults[0].nodeId, 'form');
  });
}

test('campos distintos e aliases não preenchem dados obrigatórios ausentes', async () => {
  const result = await simulate(workflow(), { message_text: 'Só mensagem' });
  assert.equal(result.status, 'FAILED');
  assert.equal(result.nodeResults.length, 1);
});

test('referência antiga falha explicitamente em vez de produzir valor vazio', async () => {
  const definition = workflow();
  definition.nodes[2].config.fieldMappings.ai_intent = '{{ai.interest_level}}';
  await assert.rejects(
    simulate(definition, { name: 'Teste', email: 'teste@example.test', message: 'Olá' }),
    (error) => error.getResponse().code === 'WORKFLOW_INVALID_REFERENCE' &&
      error.getResponse().issues.some((issue) => issue.code === 'OUTPUT_NOT_DECLARED'),
  );
});

test('DAG rejeita ciclos, gatilho divergente e nós desconectados', async () => {
  const payload = { name: 'Teste', email: 'teste@example.test', message: 'Olá' };
  const cycle = workflow();
  cycle.edges.push({ id: 'cycle', sourceNodeId: 'email', targetNodeId: 'ai' });
  await assert.rejects(simulate(cycle, payload), /Ciclo/);
  const divergent = workflow();
  divergent.triggerNodeId = 'email';
  await assert.rejects(simulate(divergent, payload), /gatilho/);
  const disconnected = workflow();
  disconnected.edges = disconnected.edges.slice(1);
  await assert.rejects(simulate(disconnected, payload), /desconectado/);
});

test('schema ausente ou de outra versão impede a simulação', async () => {
  for (const version of [undefined, 'legacy-version']) {
    const definition = { ...workflow(), schemaVersion: version };
    await assert.rejects(simulate(definition, {}), /schema/);
  }
});

test('executores de simulação rejeitam LIVE sem afirmar efeitos reais', async () => {
  const { exports } = await loadTypeScript(executorsFile);
  const context = { mode: 'LIVE', orgId: 'org_alpha' };
  await assert.rejects(exports.NodeExecutors.executeAiAnalyzeIntent({}, {}, context), /não implementad/);
  assert.throws(() => exports.NodeExecutors.executeInternalRecord({}, {}, context), /não implementad/);
  assert.throws(() => exports.NodeExecutors.executeSendEmail({}, {}, context), /não implementad/);
  assert.throws(() => exports.NodeExecutors.executeHttpRequest({}, {}, context), /não implementad/);
});

test('motor suporta ramificação e convergência (OR-Join), executando nó convergente', async () => {
  const branchingWf = {
    schemaVersion: '1.0.0', id: 'wf_or_join', orgId: 'org_alpha', name: 'Convergência',
    version: 1, status: 'DRAFT', triggerNodeId: 'form', createdAt: '', updatedAt: '',
    nodes: [
      { id: 'form', type: 'trigger_form', config: { requiredFields: ['name', 'email', 'message'] } },
      { id: 'cond', type: 'condition', config: { leftOperand: '{{form.contact_name}}', operator: 'equals', rightOperand: 'VIP' } },
      { id: 'vip_branch', type: 'send_email', config: { to: 'vip@example.test', subject: 'VIP', bodyTemplate: 'Fixture do ramo VIP' } },
      { id: 'common_branch', type: 'internal_record', config: { fieldMappings: { name: '{{form.contact_name}}', email: '{{form.contact_email}}' } } },
      { id: 'join_node', type: 'send_email', config: { to: '{{form.contact_email}}', subject: 'Confirmado', bodyTemplate: 'Fixture da convergência' } },
    ],
    edges: [
      { id: 'e1', sourceNodeId: 'form', targetNodeId: 'cond' },
      { id: 'e_true', sourceNodeId: 'cond', targetNodeId: 'vip_branch', sourceHandle: 'true' },
      { id: 'e_false', sourceNodeId: 'cond', targetNodeId: 'common_branch', sourceHandle: 'false' },
      { id: 'e_join_1', sourceNodeId: 'vip_branch', targetNodeId: 'join_node' },
      { id: 'e_join_2', sourceNodeId: 'common_branch', targetNodeId: 'join_node' },
    ],
  };

  const resVip = await simulate(branchingWf, { name: 'VIP', email: 'vip@example.test', message: 'Oi' });
  assert.equal(resVip.status, 'COMPLETED');
  assert.equal(resVip.nodeResults.find((n) => n.nodeId === 'vip_branch').status, 'SUCCESS');
  assert.equal(resVip.nodeResults.find((n) => n.nodeId === 'common_branch').status, 'SKIPPED');
  assert.equal(resVip.nodeResults.find((n) => n.nodeId === 'join_node').status, 'SUCCESS');

  const resCommon = await simulate(branchingWf, { name: 'Comum', email: 'comum@example.test', message: 'Oi' });
  assert.equal(resCommon.status, 'COMPLETED');
  assert.equal(resCommon.nodeResults.find((n) => n.nodeId === 'vip_branch').status, 'SKIPPED');
  assert.equal(resCommon.nodeResults.find((n) => n.nodeId === 'common_branch').status, 'SUCCESS');
  assert.equal(resCommon.nodeResults.find((n) => n.nodeId === 'join_node').status, 'SUCCESS');
});

test('interpolação resolve variáveis de internal_record para nós downstream e avalia starts_with', async () => {
  const chainWf = {
    schemaVersion: '1.0.0', id: 'wf_record_downstream', orgId: 'org_alpha', name: 'Resolução Record',
    version: 1, status: 'DRAFT', triggerNodeId: 'form', createdAt: '', updatedAt: '',
    nodes: [
      { id: 'form', type: 'trigger_form', config: { requiredFields: ['name', 'email', 'message'] } },
      { id: 'record', type: 'internal_record', config: { fieldMappings: { name: '{{form.contact_name}}', email: '{{form.contact_email}}', raw_message: '{{form.message_text}}' } } },
      { id: 'cond', type: 'condition', config: { leftOperand: '{{record.name}}', operator: 'starts_with', rightOperand: 'Dr.' } },
      { id: 'email', type: 'send_email', config: { to: '{{record.email}}', subject: 'Registro {{record.record_id}}', bodyTemplate: 'Status do registro: {{record.status}}' } },
    ],
    edges: [
      { id: 'e1', sourceNodeId: 'form', targetNodeId: 'record' },
      { id: 'e2', sourceNodeId: 'record', targetNodeId: 'cond' },
      { id: 'e3', sourceNodeId: 'cond', targetNodeId: 'email' },
    ],
  };

  const res = await simulate(chainWf, { name: 'Dr. Silva', email: 'silva@example.test', message: 'Consulta' });
  assert.equal(res.status, 'COMPLETED');
  const condRes = res.nodeResults.find((n) => n.nodeId === 'cond');
  assert.equal(condRes.outputs.result, true);
  const emailRes = res.nodeResults.find((n) => n.nodeId === 'email');
  assert.equal(emailRes.outputs.recipient, 'silva@example.test');
  assert.match(emailRes.inputs.subject, /^Registro sim_record_/);
});


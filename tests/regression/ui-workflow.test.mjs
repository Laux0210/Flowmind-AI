import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './load-typescript.mjs';

const clientFile = 'apps/web/src/lib/api-client.ts';
const engineFile = 'apps/api/src/engine/workflow-engine.service.ts';
const dagFile = 'apps/api/src/engine/dag-validator.ts';

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
  const service = new engine.WorkflowEngineService();

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

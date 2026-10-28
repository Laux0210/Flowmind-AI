import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './load-typescript.mjs';

const generationFile = 'apps/api/src/ai/ai-generator.service.ts';
const clientFile = 'apps/web/src/lib/api-client.ts';

function providerFixture() {
  return {
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
      workflow: {
        schemaVersion: '1.0.0', name: 'Formulário sintético', description: 'Fixture local', triggerNodeId: 'trigger',
        nodes: [{ id: 'trigger', type: 'trigger_form', label: 'Formulário', position: { x: 0, y: 0 }, config: '{"requiredFields":["name","email","message"]}' }],
        edges: [],
      },
      reasoning: 'Proposta para revisão.', warnings: [],
    }) } }],
    usage: { total_tokens: 24 },
  };
}

async function fakeProvider(body) {
  const { exports } = await loadTypeScript('apps/api/src/ai/openai-structured-client.ts');
  return new exports.OpenAiStructuredClient('test-only-not-a-real-key', {
    model: 'fixture-only-not-approved',
    fetchFn: async () => ({ ok: true, status: 200, json: async () => body }),
  });
}

test('template gera rascunho compatível com o motor, sem modelo/tokens fictícios', async () => {
  const { exports } = await loadTypeScript(generationFile);
  const result = await new exports.AiGeneratorService(exports.createTestResourceResolver()).generateFromNaturalLanguage({
    prompt: 'Quando cliente enviar formulário, analise resumo e intenção com IA, registre internamente e envie e-mail.',
  }, 'org_alpha');
  assert.equal(result.requiresHumanReview, true);
  assert.equal(result.modelUsed, 'not-used/local-template');
  assert.equal(result.tokensConsumed, 0);
  assert.equal(result.workflow.schemaVersion, '1.0.0');
  assert.deepEqual(Array.from(result.workflow.nodes, (node) => node.type), ['trigger_form', 'ai_analyze_intent', 'internal_record', 'send_email']);
  const { exports: engine } = await loadTypeScript('apps/api/src/engine/workflow-engine.service.ts');
  const simulation = await new engine.WorkflowEngineService(engine.createTestResourceResolver()).simulate({
    ...result.workflow, id: 'wf_test', orgId: 'org_alpha', version: 1, status: 'DRAFT',
  }, { name: 'Teste', email: 'teste@example.test', message: 'Tenho dúvidas gerais' });
  assert.equal(simulation.status, 'COMPLETED');
});

test('gerador rejeita condição não interpretada em vez de criar score comercial', async () => {
  const { exports } = await loadTypeScript(generationFile);
  await assert.rejects(new exports.AiGeneratorService(exports.createTestResourceResolver()).generateFromNaturalLanguage({
    prompt: 'Ao receber formulário, se o interesse for alto, envie e-mail.',
  }, 'org_alpha'), (error) => error.getResponse().code === 'CONDITION_REQUIRES_REVIEW');
});

test('gerador aceita caso como substantivo e rejeita caso condicional', async () => {
  const { exports } = await loadTypeScript(generationFile);
  const service = new exports.AiGeneratorService(exports.createTestResourceResolver());
  const result = await service.generateFromNaturalLanguage({
    prompt: 'Receba formulário, gere resumo do caso e responda por e-mail.',
  }, 'org_alpha');
  assert.ok(result.workflow.nodes.some((node) => node.type === 'ai_analyze_intent'));
  for (const prompt of ['Caso o cliente solicite, envie e-mail.', 'Receba formulário, caso falte e-mail, interrompa.']) {
    await assert.rejects(service.generateFromNaturalLanguage({ prompt }, 'org_alpha'),
      (error) => error.getResponse().code === 'CONDITION_REQUIRES_REVIEW');
  }
});

test('gerador sinaliza HTTP sem destino escolhido e nunca executa comandos', async () => {
  const { exports } = await loadTypeScript(generationFile);
  const service = new exports.AiGeneratorService(exports.createTestResourceResolver());
  const result = await service.generateFromNaturalLanguage({ prompt: 'Receba formulário e notifique webhook HTTP.' }, 'org_alpha');
  assert.equal(result.workflow.nodes.find((node) => node.type === 'http_request').config.url, '');
  assert.ok(result.warnings.some((warning) => warning.includes('destino HTTP')));
  await assert.rejects(service.generateFromNaturalLanguage({ prompt: 'Execute bash rm -rf /' }, 'org_alpha'));
});

test('ApiClient rejeita todas as operações sem token, antes da rede', async () => {
  let calls = 0;
  const { exports } = await loadTypeScript(clientFile, { fetch: async () => { calls++; throw new Error('Não deveria chamar rede'); } });
  const client = exports.ApiClient;
  const operations = [
    () => client.listWorkflows(), () => client.getWorkflow('wf'),
    () => client.createWorkflow({ name: 'Teste' }), () => client.updateWorkflow('wf', { name: 'Novo' }),
    () => client.simulateWorkflow('wf', {}), () => client.generateWorkflow({ prompt: 'Teste' }),
    () => client.listExecutions(), () => client.getExecution('exec'), () => client.getUsage(),
    () => client.reviewWorkflow('wf'), () => client.activateWorkflow('wf'), () => client.deactivateWorkflow('wf'),
    () => client.deleteWorkflow('wf'),
  ];
  for (const operation of operations) await assert.rejects(operation(), /Entre/);
  assert.equal(calls, 0);
});

for (const status of [401, 404, 500]) {
  test(`ApiClient propaga HTTP ${status} sem inventar workflows ou geração`, async () => {
    const { exports } = await loadTypeScript(clientFile, { fetch: async () => ({ ok: false, status }) });
    await assert.rejects(exports.ApiClient.listWorkflows('signed_fixture'), new RegExp(String(status)));
    await assert.rejects(exports.ApiClient.getWorkflow('wf_missing', 'signed_fixture'), new RegExp(String(status)));
    await assert.rejects(exports.ApiClient.generateWorkflow({ prompt: 'Teste' }, 'signed_fixture'), new RegExp(String(status)));
    await assert.rejects(exports.ApiClient.listExecutions('signed_fixture'), new RegExp(String(status)));
    await assert.rejects(exports.ApiClient.getUsage('signed_fixture'), new RegExp(String(status)));
  });
}

test('ApiClient envia Bearer real e PUT de atualização compatível com o controller', async () => {
  const requests = [];
  const saved = { id: 'wf_real_response', schemaVersion: '1.0.0' };
  const { exports } = await loadTypeScript(clientFile, { fetch: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ success: true, data: saved }) };
  } });
  const response = await exports.ApiClient.updateWorkflow('wf/id', { name: 'Teste' }, 'signed_fixture');
  assert.equal(response, saved);
  assert.equal(requests[0].options.headers.Authorization, 'Bearer signed_fixture');
  assert.equal(requests[0].options.method, 'PUT');
  assert.ok(requests[0].url.endsWith('/workflows/wf%2Fid'));
});

test('ApiClient envia POST correto para rotas de ciclo de vida (review, activate, deactivate)', async () => {
  const requests = [];
  const { exports } = await loadTypeScript(clientFile, { fetch: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => ({ success: true, data: { status: 'OK' } }) };
  } });
  await exports.ApiClient.reviewWorkflow('wf/1', 'signed_fixture');
  await exports.ApiClient.activateWorkflow('wf/1', 'signed_fixture');
  await exports.ApiClient.deactivateWorkflow('wf/1', 'signed_fixture');
  assert.equal(requests.length, 3);
  assert.ok(requests[0].url.endsWith('/workflows/wf%2F1/review'));
  assert.equal(requests[0].options.method, 'POST');
  assert.ok(requests[1].url.endsWith('/workflows/wf%2F1/activate'));
  assert.equal(requests[1].options.method, 'POST');
  assert.ok(requests[2].url.endsWith('/workflows/wf%2F1/deactivate'));
  assert.equal(requests[2].options.method, 'POST');
});

test('ApiClient envia DELETE correto para exclusão de workflow e aceita HTTP 204', async () => {
  const requests = [];
  const { exports } = await loadTypeScript(clientFile, { fetch: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 204 };
  } });
  await exports.ApiClient.deleteWorkflow('wf/del_1', 'signed_fixture');
  assert.equal(requests.length, 1);
  assert.ok(requests[0].url.endsWith('/workflows/wf%2Fdel_1'));
  assert.equal(requests[0].options.method, 'DELETE');
});

test('OpenAiStructuredClient gera draft com JSON Schema estrito e trata recusa (refusal)', async () => {
  const openAiFile = 'apps/api/src/ai/openai-structured-client.ts';
  const mockPayload = {
    choices: [
      {
        finish_reason: 'stop',
        message: {
          content: JSON.stringify({
            workflow: {
              schemaVersion: '1.0.0',
              name: 'Automação Estruturada IA',
              description: 'Fluxo com OpenAI gpt-4o-mini',
              triggerNodeId: 'trigger_1',
              nodes: [
                {
                  id: 'trigger_1',
                  type: 'trigger_form',
                  label: 'Envio Form',
                  position: { x: 50, y: 150 },
                  config: JSON.stringify({ requiredFields: ['name', 'email'] }),
                },
                {
                  id: 'ai_node',
                  type: 'ai_analyze_intent',
                  label: 'Análise IA',
                  position: { x: 350, y: 150 },
                  config: JSON.stringify({ modelRef: 'gpt-4o-mini' }),
                },
              ],
              edges: [
                { id: 'e1', sourceNodeId: 'trigger_1', targetNodeId: 'ai_node', sourceHandle: null, targetHandle: null },
              ],
            },
            reasoning: 'Separando gatilho e nó de IA',
            warnings: ['Verificar e-mail configurado'],
          }),
        },
      },
    ],
    usage: { total_tokens: 280 },
  };

  const { exports } = await loadTypeScript(openAiFile);
  const client = new exports.OpenAiStructuredClient('mock_key_token', {
    fetchFn: async () => ({
      ok: true,
      status: 200,
      json: async () => mockPayload,
    }),
  });

  const result = await client.generateWorkflow('Gere automação com IA', 'org_alpha');
  assert.equal(result.modelUsed, 'openai/gpt-4o-mini');
  assert.equal(result.tokensConsumed, 280);
  assert.deepEqual(JSON.parse(JSON.stringify(result.draft.nodes[0].config)), { requiredFields: ['name', 'email'] });

  // Teste de recusa (refusal)
  const refusalClient = new exports.OpenAiStructuredClient('mock_key_token', {
    fetchFn: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { refusal: 'Recusado por política de segurança' } }],
      }),
    }),
  });
  await assert.rejects(
    refusalClient.generateWorkflow('prompt que gera recusa', 'org_alpha'),
    (err) => err.getResponse().code === 'AI_PROMPT_REFUSED',
  );
});

test('AiGeneratorService suporta cliente de IA customizado via injeção mantendo validação DAG', async () => {
  const { exports: genExports } = await loadTypeScript(generationFile);
  const mockAdapter = {
    async generateWorkflow() {
      return {
        draft: {
          schemaVersion: '1.0.0',
          name: 'Fluxo Injetado Teste',
          description: 'Descrição de teste',
          triggerNodeId: 'trigger_1',
          nodes: [
            { id: 'trigger_1', type: 'trigger_form', label: 'Form', position: { x: 0, y: 0 }, config: {} },
            { id: 'rec_1', type: 'internal_record', label: 'Registro', position: { x: 100, y: 0 }, config: {} },
          ],
          edges: [
            { id: 'e1', sourceNodeId: 'trigger_1', targetNodeId: 'rec_1' },
          ],
        },
        reasoning: 'Raciocínio mock',
        warnings: [],
        modelUsed: 'mock-model',
        tokensConsumed: 120,
      };
    },
  };

  const service = new genExports.AiGeneratorService(genExports.createTestResourceResolver(), mockAdapter);
  const response = await service.generateFromNaturalLanguage({ prompt: 'Gerar automação mock válida' }, 'org_alpha');
  assert.equal(response.requiresHumanReview, true);
  assert.equal(response.modelUsed, 'mock-model');
  assert.equal(response.tokensConsumed, 120);
  assert.equal(response.workflow.name, 'Fluxo Injetado Teste');
});

test('uso ausente permanece null do provedor até a serialização da proposta', async () => {
  const body = providerFixture(); delete body.usage;
  const client = await fakeProvider(body);
  const { exports } = await loadTypeScript(generationFile);
  const result = await new exports.AiGeneratorService(exports.createTestResourceResolver(), client).generateFromNaturalLanguage({ prompt: 'Formulário sintético' }, 'org_synthetic');
  assert.equal(result.tokensConsumed, null);
  assert.equal(JSON.parse(JSON.stringify(result)).tokensConsumed, null);
  assert.equal(result.requiresHumanReview, true);
});

test('JSON válido com término incompleto não vira proposta e conserva uso informado', async () => {
  const body = providerFixture(); body.choices[0].finish_reason = 'length';
  const client = await fakeProvider(body);
  await assert.rejects(client.generateWorkflow('Formulário sintético', 'org_synthetic'), (error) => {
    assert.equal(error.getResponse().code, 'AI_INCOMPLETE_RESPONSE');
    assert.equal(error.getResponse().tokensConsumed, 24);
    return true;
  });
});

test('configuração JSON inválida não é substituída silenciosamente por objeto vazio', async () => {
  const body = providerFixture();
  const proposal = JSON.parse(body.choices[0].message.content);
  proposal.workflow.nodes[0].config = '{TEST_ONLY_PRIVATE_DETAIL';
  body.choices[0].message.content = JSON.stringify(proposal);
  const client = await fakeProvider(body);
  await assert.rejects(client.generateWorkflow('Formulário sintético', 'org_synthetic'), (error) => {
    assert.equal(error.getResponse().code, 'AI_INVALID_WORKFLOW_RESPONSE');
    assert.equal(error.getResponse().tokensConsumed, 24);
    assert.equal(JSON.stringify(error.getResponse()).includes('TEST_ONLY_PRIVATE_DETAIL'), false);
    return true;
  });
});

test('recusa não revela mensagem privada nem descarta a medição de uso', async () => {
  const body = providerFixture(); body.choices[0].message = { refusal: 'TEST_ONLY_PRIVATE_DETAIL' };
  const client = await fakeProvider(body);
  await assert.rejects(client.generateWorkflow('Formulário sintético', 'org_synthetic'), (error) => {
    assert.equal(error.getResponse().code, 'AI_PROMPT_REFUSED');
    assert.equal(error.getResponse().tokensConsumed, 24);
    assert.equal(JSON.stringify(error.getResponse()).includes('TEST_ONLY_PRIVATE_DETAIL'), false);
    return true;
  });
});

import { createTestResourceResolver } from '../../test/resource-fixtures';
import { BadRequestException } from '@nestjs/common';
import { OpenAiStructuredClient } from './openai-structured-client';
import { AiGeneratorService } from './ai-generator.service';
import { AiEvaluator } from './evaluation/ai-evaluator';
import { AI_EVALUATION_DATASET } from './evaluation/ai-evaluation-dataset';

type JsonObject = Record<string, unknown>;
const privateMarker = 'TEST_ONLY_PRIVATE_PROVIDER_DETAIL';

function proposal(): JsonObject {
  return {
    workflow: {
      schemaVersion: '1.0.0', name: 'Formulário sintético', description: 'Proposta para revisão',
      triggerNodeId: 'trigger',
      nodes: [{
        id: 'trigger', type: 'trigger_form', label: 'Formulário', position: { x: 0, y: 0 },
        config: JSON.stringify({ requiredFields: ['name', 'email', 'message'] }),
      }],
      edges: [],
    },
    reasoning: 'Proposta sintética para revisão.', warnings: [],
  };
}

const workflow = (value: JsonObject) => value.workflow as JsonObject;
const node = (value: JsonObject) => (workflow(value).nodes as JsonObject[])[0];

function envelope(content = proposal()): JsonObject {
  return {
    choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(content), refusal: null } }],
    usage: { total_tokens: 24 },
  };
}

function clientFor(body: unknown): OpenAiStructuredClient {
  const fetchFn = jest.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
  return new OpenAiStructuredClient('test-only-not-a-real-key', {
    model: 'fixture-only-not-approved', fetchFn,
  });
}

async function rejected(pending: Promise<unknown>, code: string, tokens: number | null = 24) {
  const error = await pending.then(() => null, (value: unknown) => value);
  expect(error).toBeInstanceOf(BadRequestException);
  const response = (error as BadRequestException).getResponse();
  expect(response).toMatchObject({ code, tokensConsumed: tokens });
  expect(JSON.stringify(response)).not.toContain(privateMarker);
}

describe('T10 — integridade da resposta e consumo do provedor', () => {
  let network: jest.SpyInstance;
  beforeEach(() => {
    network = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Rede real proibida'));
  });
  afterEach(() => {
    expect(network).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it.each(['length', 'content_filter'])('rejeita JSON completo quando finish_reason é %s', async (reason) => {
    const body = envelope();
    (body.choices as JsonObject[])[0].finish_reason = reason;
    await rejected(clientFor(body).generateWorkflow('Formulário sintético', 'org_synthetic'), 'AI_INCOMPLETE_RESPONSE');
  });

  it.each([undefined, null, 'tool_calls', 'function_call', 'unexpected'])('não aceita estado terminal não previsto: %s', async (reason) => {
    const body = envelope();
    (body.choices as JsonObject[])[0].finish_reason = reason;
    await rejected(clientFor(body).generateWorkflow('Formulário sintético', 'org_synthetic'), 'AI_INVALID_RESPONSE_STRUCTURE');
  });

  it.each([null, [], {}, { choices: [] }, { choices: 'invalid' }, { choices: [null] }])('rejeita envelope inválido %#', async (body) => {
    await rejected(clientFor(body).generateWorkflow('Formulário sintético', 'org_synthetic'), 'AI_INVALID_RESPONSE_STRUCTURE', null);
  });

  const invalidProposals: Array<[string, (value: JsonObject) => void]> = [
    ['workflow ausente', (value) => { delete value.workflow; }],
    ['workflow nulo', (value) => { value.workflow = null; }],
    ['organização escolhida pelo modelo', (value) => { workflow(value).orgId = 'org_other_synthetic'; }],
    ['schema desconhecido', (value) => { workflow(value).schemaVersion = '2.0.0'; }],
    ['nome inválido', (value) => { workflow(value).name = 17; }],
    ['gatilho vazio', (value) => { workflow(value).triggerNodeId = ''; }],
    ['nós ausentes', (value) => { workflow(value).nodes = null; }],
    ['lista de nós vazia', (value) => { workflow(value).nodes = []; }],
    ['tipo fora do catálogo', (value) => { node(value).type = 'execute_script'; }],
    ['ID vazio', (value) => { node(value).id = ''; }],
    ['posição inválida', (value) => { node(value).position = { x: 'zero', y: 0 }; }],
    ['configuração JSON inválida', (value) => { node(value).config = '{' + privateMarker; }],
    ['configuração em objeto no lugar de string', (value) => { node(value).config = {}; }],
    ['configuração nula', (value) => { node(value).config = 'null'; }],
    ['configuração em array', (value) => { node(value).config = '[]'; }],
    ['configuração escalar', (value) => { node(value).config = '12'; }],
    ['chave de protótipo', (value) => { node(value).config = '{"nested":{"__proto__":{"polluted":true}}}'; }],
    ['número não finito', (value) => { node(value).config = '{"value":1e400}'; }],
    ['arestas inválidas', (value) => { workflow(value).edges = [{ id: 'edge', sourceNodeId: 'trigger', targetNodeId: 7, sourceHandle: null, targetHandle: null }]; }],
    ['campo de aresta ausente', (value) => { workflow(value).edges = [{ id: 'edge', sourceNodeId: 'trigger', targetNodeId: 'trigger' }]; }],
    ['warnings inválidos', (value) => { value.warnings = [17]; }],
    ['reasoning ausente', (value) => { delete value.reasoning; }],
    ['campo inesperado', (value) => { value.extra = privateMarker; }],
  ];

  it.each(invalidProposals)('bloqueia proposta com %s, sem substituir por valores vazios', async (_name, change) => {
    const value = proposal();
    change(value);
    await rejected(clientFor(envelope(value)).generateWorkflow('Formulário sintético', 'org_synthetic'), 'AI_INVALID_WORKFLOW_RESPONSE');
  });

  it.each([undefined, null, {}, { total_tokens: null }, { total_tokens: '12' }, { total_tokens: -1 }, { total_tokens: 2.5 }, { total_tokens: Number.MAX_SAFE_INTEGER + 1 }])('preserva consumo ausente/inválido como desconhecido %#', async (usage) => {
    const body = envelope(); body.usage = usage;
    const result = await clientFor(body).generateWorkflow('Formulário sintético', 'org_synthetic');
    expect(result.tokensConsumed).toBeNull();
    expect(result.draft.nodes[0].config).toEqual({ requiredFields: ['name', 'email', 'message'] });
  });

  it.each([0, 24])('preserva medição válida de %s tokens', async (tokens) => {
    const body = envelope(); body.usage = { total_tokens: tokens };
    const result = await clientFor(body).generateWorkflow('Formulário sintético', 'org_synthetic');
    expect(result.tokensConsumed).toBe(tokens);
  });

  it('não soma novamente componentes de uso', async () => {
    const body = envelope();
    body.usage = { total_tokens: 24, prompt_tokens: 12, completion_tokens: 12, completion_tokens_details: { reasoning_tokens: 5 } };
    expect((await clientFor(body).generateWorkflow('Formulário sintético', 'org_synthetic')).tokensConsumed).toBe(24);
  });

  it('preserva uso da recusa sem publicar a justificativa privada do provedor', async () => {
    const body = envelope();
    (body.choices as JsonObject[])[0].message = { refusal: privateMarker, content: null };
    await rejected(clientFor(body).generateWorkflow('Formulário sintético', 'org_synthetic'), 'AI_PROMPT_REFUSED');
  });

  it('transporta consumo desconhecido pelo gerador e JSON da API', async () => {
    const body = envelope(); delete body.usage;
    const response = await new AiGeneratorService(createTestResourceResolver(), clientFor(body)).generateFromNaturalLanguage({ prompt: 'Formulário sintético' }, 'org_synthetic');
    expect(response.tokensConsumed).toBeNull();
    expect(JSON.parse(JSON.stringify(response)).tokensConsumed).toBeNull();
    expect(response.requiresHumanReview).toBe(true);
  });

  it('avalia uso desconhecido como controle não exercitado, sem inventar zero', async () => {
    const body = envelope(); delete body.usage;
    const scenario = AI_EVALUATION_DATASET.find((entry) => entry.id === 'IA08')!;
    const response = await new AiEvaluator(createTestResourceResolver()).evaluateScenario(scenario, clientFor(body));
    expect(response.tokensConsumed).toBeNull();
    expect(response.ruleResults.find((rule) => rule.rule === 'ACCURATE_TOKEN_REPORTING')?.passed).toBeNull();
  });

  it('mantém uso observado em falha no relatório de avaliação', async () => {
    const body = envelope(); (body.choices as JsonObject[])[0].finish_reason = 'length';
    const scenario = AI_EVALUATION_DATASET.find((entry) => entry.id === 'IA07')!;
    const response = await new AiEvaluator(createTestResourceResolver()).evaluateScenario(scenario, clientFor(body));
    expect(response.error).toBe('AI_INCOMPLETE_RESPONSE');
    expect(response.tokensConsumed).toBe(24);
    expect(response.rubricScore).toBeNull();
  });

  it('preserva uso em grafo rejeitado e não publica IDs privados do rascunho', async () => {
    const value = proposal();
    node(value).id = privateMarker;
    workflow(value).triggerNodeId = privateMarker;
    (workflow(value).nodes as JsonObject[]).push({ ...node(value) });
    await rejected(
      new AiGeneratorService(createTestResourceResolver(), clientFor(envelope(value))).generateFromNaturalLanguage({ prompt: 'Formulário sintético' }, 'org_synthetic'),
      'AI_INVALID_WORKFLOW_RESPONSE',
    );
  });

  it('mantém uso disponível na avaliação de grafo rejeitado', async () => {
    const value = proposal();
    (workflow(value).nodes as JsonObject[]).push({ ...node(value) });
    const scenario = AI_EVALUATION_DATASET.find((entry) => entry.id === 'IA07')!;
    const response = await new AiEvaluator(createTestResourceResolver()).evaluateScenario(scenario, clientFor(envelope(value)));
    expect(response.error).toBe('AI_INVALID_WORKFLOW_RESPONSE');
    expect(response.tokensConsumed).toBe(24);
    expect(response.rubricScore).toBeNull();
  });
});

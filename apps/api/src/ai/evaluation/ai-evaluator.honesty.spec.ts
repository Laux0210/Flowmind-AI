import { createTestResourceResolver } from '../../../test/resource-fixtures';
import { BadRequestException } from '@nestjs/common';
import type { AiClient, AiGenerationResult } from '../ai-client.interface';
import { DeterministicAiClient } from '../deterministic-ai-client';
import { AiEvaluator } from './ai-evaluator';
import { AI_EVALUATION_DATASET, type AiEvaluationScenario } from './ai-evaluation-dataset';

const scenario = (id: AiEvaluationScenario['id']) =>
  AI_EVALUATION_DATASET.find((entry) => entry.id === id)!;

function rejectingClient(error: unknown): AiClient {
  return { generateWorkflow: jest.fn().mockRejectedValue(error) };
}

describe('T10 — limites e integridade das evidências', () => {
  const evaluator = new AiEvaluator(createTestResourceResolver());

  afterEach(() => jest.restoreAllMocks());

  async function resultWith(change: (result: AiGenerationResult) => void): Promise<AiClient> {
    const result = await new DeterministicAiClient().generateWorkflow(scenario('IA01').prompt, 'org_eval_alpha');
    change(result);
    return { generateWorkflow: jest.fn().mockResolvedValue(result) };
  }

  it('não atribui nota semântica a grafo gerado por template', async () => {
    const result = await evaluator.evaluateScenario(scenario('IA01'), new DeterministicAiClient());
    expect(result.rubricScore).toBeNull();
  });

  it('não agrega notas humanas que não foram coletadas', async () => {
    const report = await evaluator.evaluateAll(new DeterministicAiClient());
    expect(report.totalScore).toBeNull();
    expect(report.averageRubricScore).toBeNull();
  });

  it('preserva uso desconhecido quando o cliente falha e não publica seu erro privado', async () => {
    const result = await evaluator.evaluateScenario(
      scenario('IA08'), rejectingClient(new Error('TEST_ONLY_PRIVATE_PROVIDER_DETAIL')),
    );
    expect(result.tokensConsumed).toBeNull();
    expect(JSON.stringify(result)).not.toContain('TEST_ONLY_PRIVATE_PROVIDER_DETAIL');
  });

  it('não afirma que um template exercitou recusa ou JSON inválido', async () => {
    const result = await evaluator.evaluateScenario(scenario('IA07'), new DeterministicAiClient());
    expect(result.ruleResults.find((entry) => entry.rule === 'GRACEFUL_FAILURE_HANDLING')?.passed).toBeNull();
  });

  it('não trata qualquer BadRequest como recusa válida do provedor', async () => {
    const result = await evaluator.evaluateScenario(
      scenario('IA07'), rejectingClient(new BadRequestException({ code: 'UNRELATED_VALIDATION_ERROR' })),
    );
    expect(result.ruleResults.find((entry) => entry.rule === 'GRACEFUL_FAILURE_HANDLING')?.passed).toBe(false);
  });

  it('não chama um erro genérico de timeout tratado', async () => {
    const result = await evaluator.evaluateScenario(scenario('IA08'), rejectingClient(new Error('generic')));
    expect(result.ruleResults.find((entry) => entry.rule === 'TIMEOUT_HANDLING')?.passed).toBe(false);
  });

  it('não prova isolamento de organizações por busca de uma string no grafo', async () => {
    const result = await evaluator.evaluateScenario(scenario('IA05'), new DeterministicAiClient());
    expect(result.ruleResults.find((entry) => entry.rule === 'CROSS_ORG_ISOLATION')?.passed).toBeNull();
  });

  it('nega campo score desconhecido mesmo com ID, label e descrição neutros', async () => {
    const client = await resultWith((result) => {
      result.draft.description = 'Fluxo sintético';
      const ai = result.draft.nodes.find((node) => node.type === 'ai_analyze_intent')!;
      ai.config = { ...ai.config, score: 90 };
    });
    const result = await evaluator.evaluateScenario(scenario('IA01'), client);
    expect(result.error).toBe('AI_INVALID_WORKFLOW_RESPONSE');
    expect(result.ruleResults.find((entry) => entry.rule === 'NO_COMMERCIAL_SCORING')?.passed).toBeNull();
  });

  it('continua detectando score em JSON permitido de operando, sem nota humana', async () => {
    const client = await resultWith((result) => {
      result.draft.nodes.push({ id: 'fixture_value', type: 'condition', label: 'Fixture', position: { x: 0, y: 0 },
        config: { leftOperand: { score: 90 }, operator: 'equals', rightOperand: {} } });
      result.draft.edges.push({ id: 'fixture_edge', sourceNodeId: result.draft.triggerNodeId, targetNodeId: 'fixture_value' });
    });
    const result = await evaluator.evaluateScenario(scenario('IA01'), client);
    expect(result.error).toBeUndefined();
    expect(result.passed).toBe(false);
    expect(result.ruleResults.find((entry) => entry.rule === 'NO_COMMERCIAL_SCORING')?.passed).toBe(false);
    expect(result.rubricScore).toBeNull();
  });

  it('não confunde termo citado em descrição com um campo de pontuação atribuído', async () => {
    const client = await resultWith((result) => {
      result.draft.description = 'Não classifique o contato como quente ou frio; preserve a mensagem.';
    });
    const result = await evaluator.evaluateScenario(scenario('IA01'), client);
    expect(result.ruleResults.find((entry) => entry.rule === 'NO_COMMERCIAL_SCORING')?.passed).toBe(true);
    expect(result.rubricScore).toBeNull();
  });

  it('não certifica ausência de endpoint inventado se omitiu o nó HTTP solicitado', async () => {
    const client = await resultWith(() => undefined);
    const result = await evaluator.evaluateScenario(scenario('IA02'), client);
    expect(result.ruleResults.find((entry) => entry.rule === 'NO_INVENTED_ENDPOINTS')?.passed).toBe(false);
  });

  it('mantém infinito normalizado como uso desconhecido, sem inventar uma medição', async () => {
    const client = await resultWith((result) => { result.tokensConsumed = Infinity; });
    const result = await evaluator.evaluateScenario(scenario('IA08'), client);
    expect(result.tokensConsumed).toBeNull();
    expect(result.ruleResults.find((entry) => entry.rule === 'ACCURATE_TOKEN_REPORTING')?.passed).toBeNull();
  });

  it('não aceita regra desconhecida por um default permissivo', async () => {
    const entry = {
      ...scenario('IA01'), deterministicRules: ['UNKNOWN_TEST_RULE'],
    } as unknown as AiEvaluationScenario;
    const result = await evaluator.evaluateScenario(entry, new DeterministicAiClient());
    expect(result.ruleResults[0].passed).toBe(false);
  });
});

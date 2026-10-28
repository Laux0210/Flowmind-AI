import { createTestResourceResolver } from '../../../test/resource-fixtures';
import { AiEvaluator } from './ai-evaluator';
import { DeterministicAiClient } from '../deterministic-ai-client';
import { AI_EVALUATION_DATASET } from './ai-evaluation-dataset';
import { AiGeneratorService } from '../ai-generator.service';

describe('AiEvaluator (T10)', () => {
  let evaluator: AiEvaluator;
  let deterministicClient: DeterministicAiClient;
  let generatorService: AiGeneratorService;

  beforeEach(() => {
    evaluator = new AiEvaluator(createTestResourceResolver());
    deterministicClient = new DeterministicAiClient();
    generatorService = new AiGeneratorService(createTestResourceResolver(), deterministicClient);
  });

  it('verifica estrutura de IA01 e mantém a rubrica humana pendente', async () => {
    const ia01 = AI_EVALUATION_DATASET.find((s) => s.id === 'IA01');
    expect(ia01).toBeDefined();

    const result = await evaluator.evaluateScenario(ia01!, deterministicClient, 'org_eval_test');
    expect(result.scenarioId).toBe('IA01');
    expect(result.passed).toBe(true);
    expect(result.rubricScore).toBeNull();
    expect(result.semanticReview).toBe('PENDING');
    expect(result.ruleResults.every((r) => r.passed)).toBe(true);
  });

  it('nega campo comercial inválido antes da avaliação da proposta', async () => {
    const ia01 = AI_EVALUATION_DATASET.find((s) => s.id === 'IA01')!;

    // Cliente que tenta injetar score comercial no draft
    const maliciousScoringClient = {
      async generateWorkflow() {
        return {
          draft: {
            schemaVersion: '1.0.0' as const,
            name: 'Fluxo com Lead Score',
            description: 'Fluxo',
            triggerNodeId: 'trig',
            nodes: [
              {
                id: 'trig',
                type: 'trigger_form' as const,
                label: 'Trigger',
                position: { x: 0, y: 0 },
                config: {},
              },
              {
                id: 'ai_lead_score',
                type: 'ai_analyze_intent' as const,
                label: 'Lead Score 90 quente',
                position: { x: 200, y: 0 },
                config: { score: 90, rating: 'quente' },
              },
            ],
            edges: [{ id: 'e1', sourceNodeId: 'trig', targetNodeId: 'ai_lead_score' }],
          },
          reasoning: 'Atribuindo nota comercial',
          warnings: [],
          modelUsed: 'mock',
          tokensConsumed: 10,
        };
      },
    };

    const result = await evaluator.evaluateScenario(ia01, maliciousScoringClient, 'org_eval_test');
    expect(result.error).toBe('AI_INVALID_WORKFLOW_RESPONSE');
    expect(result.tokensConsumed).toBe(10);
    expect(result.passed).toBeNull();
    expect(result.rubricScore).toBeNull();
    const scoringRule = result.ruleResults.find((r) => r.rule === 'NO_COMMERCIAL_SCORING');
    expect(scoringRule?.passed).toBeNull(); // Proposta rejeitada: esta regra não foi exercitada.
  });

  it('valida que IA04 bloqueia injeção de comandos de terminal', async () => {
    const ia04 = AI_EVALUATION_DATASET.find((s) => s.id === 'IA04')!;
    const result = await evaluator.evaluateScenario(ia04, deterministicClient, 'org_eval_test');

    expect(result.scenarioId).toBe('IA04');
    expect(result.passed).toBe(true);
    expect(result.rubricScore).toBeNull();
    const antiInjRule = result.ruleResults.find((r) => r.rule === 'ANTI_INJECTION_BLOCK');
    expect(antiInjRule?.passed).toBe(true);
  });

  it('executa evaluateAll e gera relatório agregado de avaliação', async () => {
    const report = await evaluator.evaluateAll(deterministicClient, 'org_eval_test');

    expect(report.totalScenarios).toBe(9);
    expect(report.results).toHaveLength(9);
    expect(report.maxPossibleScore).toBeNull();
    expect(report.totalScore).toBeNull();
    expect(report.averageRubricScore).toBeNull();
    expect(report.notEvaluatedScenarios).toBeGreaterThan(0);
    expect(report.passRatePercentage).toBeNull();
    expect(report.passedScenarios + report.failedScenarios + report.notEvaluatedScenarios).toBe(9);
  });
});

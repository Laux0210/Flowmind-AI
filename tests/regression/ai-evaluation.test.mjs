import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './load-typescript.mjs';

const evaluatorFile = 'apps/api/src/ai/evaluation/ai-evaluator.ts';
const datasetFile = 'apps/api/src/ai/evaluation/ai-evaluation-dataset.ts';
const clientFile = 'apps/api/src/ai/deterministic-ai-client.ts';

test('dataset canônico de avaliação sintética contém exatamente 9 cenários (IA01 a IA09)', async () => {
  const { exports: datasetExports } = await loadTypeScript(datasetFile);
  const dataset = datasetExports.AI_EVALUATION_DATASET;

  assert.equal(Array.isArray(dataset), true);
  assert.equal(dataset.length, 9);
  const ids = Array.from(dataset, (s) => s.id);
  assert.equal(ids.join(','), 'IA01,IA02,IA03,IA04,IA05,IA06,IA07,IA08,IA09');

  for (const scenario of dataset) {
    assert.ok(scenario.name.length > 5);
    assert.ok(scenario.deterministicRules.length > 0);
    assert.ok(scenario.rubricCriteria.score0);
    assert.ok(scenario.rubricCriteria.score1);
    assert.ok(scenario.rubricCriteria.score2);
  }
});

test('AiEvaluator verifica IA01 sem fabricar nota semântica', async () => {
  const { exports: evalExports } = await loadTypeScript(evaluatorFile);
  const { exports: datasetExports } = await loadTypeScript(datasetFile);
  const { exports: clientExports } = await loadTypeScript(clientFile);

  const evaluator = new evalExports.AiEvaluator(evalExports.createTestResourceResolver());
  const client = new clientExports.DeterministicAiClient();
  const ia01 = datasetExports.AI_EVALUATION_DATASET.find((s) => s.id === 'IA01');

  const result = await evaluator.evaluateScenario(ia01, client, 'org_eval_reg');
  assert.equal(result.scenarioId, 'IA01');
  assert.equal(result.passed, true);
  assert.equal(result.rubricScore, null);
  assert.equal(result.semanticReview, 'PENDING');
  assert.ok(result.ruleResults.every((r) => r.passed));
});

test('AiEvaluator registra campo comercial rejeitado antes da proposta, sem nota humana', async () => {
  const { exports: evalExports } = await loadTypeScript(evaluatorFile);
  const { exports: datasetExports } = await loadTypeScript(datasetFile);

  const evaluator = new evalExports.AiEvaluator(evalExports.createTestResourceResolver());
  const ia01 = datasetExports.AI_EVALUATION_DATASET.find((s) => s.id === 'IA01');

  const maliciousScoringClient = {
    async generateWorkflow() {
      return {
        draft: {
          schemaVersion: '1.0.0',
          name: 'Fluxo com Lead Score Comercial',
          description: 'Fluxo',
          triggerNodeId: 'trig',
          nodes: [
            { id: 'trig', type: 'trigger_form', label: 'Form', position: { x: 0, y: 0 }, config: {} },
            { id: 'ai_node', type: 'ai_analyze_intent', label: 'Score Lead: 95', position: { x: 100, y: 0 }, config: { lead_score: 95 } },
          ],
          edges: [{ id: 'e1', sourceNodeId: 'trig', targetNodeId: 'ai_node' }],
        },
        reasoning: 'Atribuindo nota',
        warnings: [],
        modelUsed: 'mock',
        tokensConsumed: 10,
      };
    },
  };

  const result = await evaluator.evaluateScenario(ia01, maliciousScoringClient, 'org_eval_reg');
  assert.equal(result.error, 'AI_INVALID_WORKFLOW_RESPONSE');
  assert.equal(result.tokensConsumed, 10);
  assert.equal(result.passed, null);
  assert.equal(result.rubricScore, null);
  const scoringRule = result.ruleResults.find((r) => r.rule === 'NO_COMMERCIAL_SCORING');
  assert.equal(scoringRule.passed, null);
});

test('AiEvaluator valida que IA04 bloqueia injeções com SECURITY_SCOPE_VIOLATION', async () => {
  const { exports: evalExports } = await loadTypeScript(evaluatorFile);
  const { exports: datasetExports } = await loadTypeScript(datasetFile);
  const { exports: clientExports } = await loadTypeScript(clientFile);

  const evaluator = new evalExports.AiEvaluator(evalExports.createTestResourceResolver());
  const client = new clientExports.DeterministicAiClient();
  const ia04 = datasetExports.AI_EVALUATION_DATASET.find((s) => s.id === 'IA04');

  const result = await evaluator.evaluateScenario(ia04, client, 'org_eval_reg');
  assert.equal(result.scenarioId, 'IA04');
  assert.equal(result.passed, true);
  assert.equal(result.rubricScore, null);
  const antiInjRule = result.ruleResults.find((r) => r.rule === 'ANTI_INJECTION_BLOCK');
  assert.equal(antiInjRule.passed, true);
});

test('AiEvaluator gera relatório agregado de avaliação (evaluateAll)', async () => {
  const { exports: evalExports } = await loadTypeScript(evaluatorFile);
  const { exports: clientExports } = await loadTypeScript(clientFile);

  const evaluator = new evalExports.AiEvaluator(evalExports.createTestResourceResolver());
  const client = new clientExports.DeterministicAiClient();

  const report = await evaluator.evaluateAll(client, 'org_eval_reg');
  assert.equal(report.totalScenarios, 9);
  assert.equal(report.maxPossibleScore, null);
  assert.equal(report.totalScore, null);
  assert.equal(report.averageRubricScore, null);
  assert.equal(report.passRatePercentage, null);
  assert.ok(report.notEvaluatedScenarios > 0);
  assert.equal(report.passedScenarios + report.failedScenarios + report.notEvaluatedScenarios, 9);
  assert.ok(report.evaluatedAt);
});

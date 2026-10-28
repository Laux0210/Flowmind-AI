import {
  AI_EVALUATION_DATASET,
  AiEvaluationScenario,
} from './ai-evaluation-dataset';

describe('AI Evaluation Dataset (T10)', () => {
  it('contém exatamente os 9 cenários formais previstos (IA01 a IA09)', () => {
    expect(AI_EVALUATION_DATASET).toBeDefined();
    expect(AI_EVALUATION_DATASET).toHaveLength(9);

    const ids = AI_EVALUATION_DATASET.map((s) => s.id);
    expect(ids).toEqual([
      'IA01',
      'IA02',
      'IA03',
      'IA04',
      'IA05',
      'IA06',
      'IA07',
      'IA08',
      'IA09',
    ]);
  });

  it('cada cenário possui propriedades obrigatórias e rubrica estruturada', () => {
    for (const scenario of AI_EVALUATION_DATASET) {
      expect(scenario.id).toMatch(/^IA0[1-9]$/);
      expect(typeof scenario.name).toBe('string');
      expect(scenario.name.trim().length).toBeGreaterThan(5);
      expect(typeof scenario.category).toBe('string');
      expect(typeof scenario.prompt).toBe('string');
      expect(typeof scenario.expectedBehavior).toBe('string');
      expect(Array.isArray(scenario.deterministicRules)).toBe(true);
      expect(scenario.deterministicRules.length).toBeGreaterThan(0);

      // Rubrica estruturada (escala 0, 1, 2)
      expect(scenario.rubricCriteria).toBeDefined();
      expect(typeof scenario.rubricCriteria.score0).toBe('string');
      expect(typeof scenario.rubricCriteria.score1).toBe('string');
      expect(typeof scenario.rubricCriteria.score2).toBe('string');
    }
  });

  it('contempla proibição de pontuação comercial e conformidade do catálogo em IA01 e IA09', () => {
    const ia01 = AI_EVALUATION_DATASET.find((s) => s.id === 'IA01');
    const ia09 = AI_EVALUATION_DATASET.find((s) => s.id === 'IA09');

    expect(ia01).toBeDefined();
    expect(ia09).toBeDefined();
    expect(ia01?.deterministicRules).toContain('NO_COMMERCIAL_SCORING');
    expect(ia09?.deterministicRules).toContain('NO_COMMERCIAL_SCORING');
    expect(ia01?.deterministicRules).toContain('DAG_CONNECTED');
  });

  it('contempla regras de segurança anti-injeção e isolamento em IA04 e IA05', () => {
    const ia04 = AI_EVALUATION_DATASET.find((s) => s.id === 'IA04');
    const ia05 = AI_EVALUATION_DATASET.find((s) => s.id === 'IA05');

    expect(ia04).toBeDefined();
    expect(ia05).toBeDefined();
    expect(ia04?.deterministicRules).toContain('ANTI_INJECTION_BLOCK');
    expect(ia05?.deterministicRules).toContain('CROSS_ORG_ISOLATION');
  });
});

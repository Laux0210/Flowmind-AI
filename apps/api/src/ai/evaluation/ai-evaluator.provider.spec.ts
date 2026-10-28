import { createTestResourceResolver } from '../../../test/resource-fixtures';
import { AiEvaluator } from './ai-evaluator';
import { AI_EVALUATION_DATASET } from './ai-evaluation-dataset';
import { OpenAiStructuredClient } from '../openai-structured-client';
import { DeterministicAiClient } from '../deterministic-ai-client';

const ia07 = AI_EVALUATION_DATASET.find((scenario) => scenario.id === 'IA07')!;
const ia08 = AI_EVALUATION_DATASET.find((scenario) => scenario.id === 'IA08')!;

describe('T10 — fixtures locais do adaptador, sem transporte de rede', () => {
  const evaluator = new AiEvaluator(createTestResourceResolver());
  let network: jest.SpyInstance;

  beforeEach(() => {
    network = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Rede proibida nesta suíte'));
  });
  afterEach(() => {
    expect(network).not.toHaveBeenCalled();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function fakeClient(body: unknown, status = 200) {
    const fetchFn = jest.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })) as any;
    const client = new OpenAiStructuredClient('test-only-no-real-key', {
      model: 'fixture-only-model-not-approved', fetchFn,
    });
    return { client, fetchFn };
  }

  it.each([
    ['recusa explícita', { choices: [{ message: { refusal: 'Recusa sintética.' } }] }, 'AI_PROMPT_REFUSED'],
    ['JSON inválido', { choices: [{ finish_reason: 'stop', message: { content: '{invalid-fixture' } }] }, 'AI_INVALID_JSON_RESPONSE'],
  ])('observa %s sem converter ausência de uso em zero', async (_name, body, code) => {
    const { client, fetchFn } = fakeClient(body);
    const result = await evaluator.evaluateScenario(ia07, client);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result.error).toBe(code);
    expect(result.ruleResults[0].passed).toBe(true);
    expect(result.tokensConsumed).toBeNull();
    expect(result.rubricScore).toBeNull();
  });

  it('exercita 429 real do adaptador com resposta HTTP falsa', async () => {
    const { client, fetchFn } = fakeClient({ error: { message: 'Rate limit sintético' } }, 429);
    const result = await evaluator.evaluateScenario(ia08, client);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result.error).toBe('AI_RATE_LIMIT_EXCEEDED');
    expect(result.ruleResults.find((rule) => rule.rule === 'TIMEOUT_HANDLING')?.passed).toBe(true);
    expect(result.ruleResults.find((rule) => rule.rule === 'ACCURATE_TOKEN_REPORTING')?.passed).toBeNull();
    expect(result.tokensConsumed).toBeNull();
  });

  it('exercita AbortController com relógio falso e limpa o timer', async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    const fetchFn = jest.fn().mockImplementation(async (_url, init) => {
      signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal!.addEventListener('abort', () => reject(new DOMException('Fixture abortada', 'AbortError')), { once: true });
      });
    }) as any;
    const client = new OpenAiStructuredClient('test-only-no-real-key', {
      model: 'fixture-only-model-not-approved', timeoutMs: 20, fetchFn,
    });
    const pending = evaluator.evaluateScenario(ia08, client);
    await jest.advanceTimersByTimeAsync(20);
    const result = await pending;
    expect(signal?.aborted).toBe(true);
    expect(result.error).toBe('AI_REQUEST_TIMEOUT');
    expect(result.ruleResults.find((rule) => rule.rule === 'TIMEOUT_HANDLING')?.passed).toBe(true);
    expect(result.tokensConsumed).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('bloqueia resposta parcial mesmo com JSON aparentemente completo', async () => {
    const local = await new DeterministicAiClient().generateWorkflow(
      AI_EVALUATION_DATASET[0].prompt, 'org_eval_alpha',
    );
    const { client } = fakeClient({
      choices: [{ finish_reason: 'length', message: { content: JSON.stringify({ workflow: local.draft, warnings: [] }) } }],
      usage: { total_tokens: 25 },
    });
    const result = await evaluator.evaluateScenario(ia07, client);
    expect(result.error).toBe('AI_INCOMPLETE_RESPONSE');
    expect(result.ruleResults[0].passed).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.tokensConsumed).toBe(25);
    expect(result.rubricScore).toBeNull();
  });
});

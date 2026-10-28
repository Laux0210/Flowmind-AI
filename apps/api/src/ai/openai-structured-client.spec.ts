import { BadRequestException } from '@nestjs/common';
import { OpenAiStructuredClient } from './openai-structured-client';

describe('OpenAiStructuredClient (T10 — OpenAI Structured Outputs)', () => {
  const fakeApiKey = 'test_mock_ai_key_value';
  const orgId = 'org_test_open_ai';

  it('deve gerar proposta estruturada com schema estrito e extrair tokens consumidos', async () => {
    const mockPayload = {
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({
              workflow: {
                schemaVersion: '1.0.0',
                name: 'Triagem de Formulário com IA',
                description: 'Fluxo para triagem automática de leads',
                triggerNodeId: 'trigger_1',
                nodes: [
                  {
                    id: 'trigger_1',
                    type: 'trigger_form',
                    label: 'Novo Envio',
                    position: { x: 50, y: 150 },
                    config: JSON.stringify({ requiredFields: ['name', 'email'] }),
                  },
                  {
                    id: 'ai_1',
                    type: 'ai_analyze_intent',
                    label: 'Resumo e Intenção',
                    position: { x: 350, y: 150 },
                    config: JSON.stringify({ modelRef: 'gpt-4o-mini' }),
                  },
                ],
                edges: [
                  {
                    id: 'e_1',
                    sourceNodeId: 'trigger_1',
                    targetNodeId: 'ai_1',
                    sourceHandle: null,
                    targetHandle: null,
                  },
                ],
              },
              reasoning: 'Arquitetura com separação clara de papéis e resumo de intenção.',
              warnings: ['Verifique as configurações do formulário.'],
            }),
          },
        },
      ],
      usage: {
        total_tokens: 385,
      },
    };

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockPayload,
    } as any);

    const client = new OpenAiStructuredClient(fakeApiKey, {
      fetchFn: mockFetch,
    });

    const result = await client.generateWorkflow('Gere triagem de formulário com IA', orgId);

    expect(result).toBeDefined();
    expect(result.modelUsed).toBe('openai/gpt-4o-mini');
    expect(result.tokensConsumed).toBe(385);
    expect(result.draft.name).toBe('Triagem de Formulário com IA');
    expect(result.draft.nodes[0].config).toEqual({ requiredFields: ['name', 'email'] });
    expect(result.reasoning).toBe('Arquitetura com separação clara de papéis e resumo de intenção.');
    expect(result.warnings).toContain('Verifique as configurações do formulário.');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe('https://api.openai.com/v1/chat/completions');
    expect(callArgs[1].method).toBe('POST');
    expect(callArgs[1].headers.Authorization).toBe(`Bearer ${fakeApiKey}`);
  });

  it('deve rejeitar e lançar erro estruturado quando o modelo reportar recusa (refusal)', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            finish_reason: 'stop',
          message: {
              refusal: 'O pedido não pôde ser atendido devido a diretrizes de segurança.',
            },
          },
        ],
      }),
    } as any);

    const client = new OpenAiStructuredClient(fakeApiKey, {
      fetchFn: mockFetch,
    });

    await expect(client.generateWorkflow('prompt malicioso', orgId)).rejects.toThrow(
      BadRequestException,
    );

    try {
      await client.generateWorkflow('prompt malicioso', orgId);
    } catch (err: any) {
      expect(err.getResponse().code).toBe('AI_PROMPT_REFUSED');
      expect(err.getResponse().message).toContain('diretrizes de segurança');
    }
  });

  it('deve tratar rate limit (HTTP 429) do provedor de IA com código específico', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Too many requests' } }),
    } as any);

    const client = new OpenAiStructuredClient(fakeApiKey, {
      fetchFn: mockFetch,
    });

    try {
      await client.generateWorkflow('Qualquer prompt', orgId);
      fail('Deveria ter lançado exceção');
    } catch (err: any) {
      expect(err.getResponse().code).toBe('AI_RATE_LIMIT_EXCEEDED');
    }
  });

  it('deve tratar falha de autenticação (HTTP 401) do provedor de IA com código específico', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API Key' } }),
    } as any);

    const client = new OpenAiStructuredClient(fakeApiKey, {
      fetchFn: mockFetch,
    });

    try {
      await client.generateWorkflow('Qualquer prompt', orgId);
      fail('Deveria ter lançado exceção');
    } catch (err: any) {
      expect(err.getResponse().code).toBe('AI_AUTHENTICATION_ERROR');
    }
  });

  it('deve lançar erro quando a resposta contiver JSON inválido', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            finish_reason: 'stop',
          message: {
              content: 'isto nao e um json valido',
            },
          },
        ],
      }),
    } as any);

    const client = new OpenAiStructuredClient(fakeApiKey, {
      fetchFn: mockFetch,
    });

    try {
      await client.generateWorkflow('Prompt de teste', orgId);
      fail('Deveria ter lançado exceção');
    } catch (err: any) {
      expect(err.getResponse().code).toBe('AI_INVALID_JSON_RESPONSE');
    }
  });
});

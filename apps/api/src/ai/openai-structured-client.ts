import { Injectable, BadRequestException } from '@nestjs/common';
import type { AiClient, AiGenerationResult } from './ai-client.interface';
import { WORKFLOW_GENERATION_JSON_SCHEMA } from './workflow-generation.schema';

const SYSTEM_PROMPT = `Você é o Arquiteto de Automação com IA do FlowMind AI.
Sua missão é converter a descrição do usuário em linguagem natural em uma proposta de workflow executável em formato JSON estrito.

Regras Obrigatórias e Inegociáveis:
1. O workflow DEVE ser um Grafo Acíclico Dirigido (DAG) conectado a partir do nó de gatilho.
2. O catálogo de tipos de nós é restrito e fechado ao MVP:
   - trigger_form: Gatilho inicial ao receber envio de formulário web.
   - ai_analyze_intent: Analisa resumo, intenção e ambiguidades com IA. NÃO atribui score comercial, nota ou pontuação de lead.
   - internal_record: Salva dados internamente na organização (nome, e-mail, mensagem original, resumo de IA, intenção, ambiguidades).
   - send_email: Envia e-mail de resposta ou notificação ao autor do contato.
   - condition: Bifurcação condicional por operadores estritos (igualdade, presença, etc.).
   - http_request: Requisição HTTP declarativa para integração ou webhook externo.
3. Proibições Absolutas:
   - JAMAIS crie scores comerciais, classificações de qualificação de leads ou pontuações numéricas na análise de IA.
   - JAMAIS gere comandos de sistema operacional (bash, sh, powershell, rm, drop table, eval).
4. O campo "config" em cada nó deve ser um JSON serializado como string contendo os parâmetros declarativos do nó.
5. Em "reasoning", forneça uma justificativa concisa da arquitetura adotada.
6. Em "warnings", aponte pendências que o operador humano deve revisar (ex: configurar URLs de webhooks ou chaves externas).`;

@Injectable()
export class OpenAiStructuredClient implements AiClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(
    apiKey: string,
    options?: {
      model?: string;
      timeoutMs?: number;
      fetchFn?: typeof fetch;
    },
  ) {
    this.apiKey = apiKey;
    this.model = options?.model ?? 'gpt-4o-mini';
    this.timeoutMs = options?.timeoutMs ?? 15000;
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
  }

  async generateWorkflow(prompt: string, _orgId: string): Promise<AiGenerationResult> {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutHandle =
      controller && typeof setTimeout !== 'undefined'
        ? setTimeout(() => controller.abort(), this.timeoutMs)
        : null;

    try {
      const response = await this.fetchFn('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: WORKFLOW_GENERATION_JSON_SCHEMA,
          },
        }),
        signal: controller?.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new BadRequestException({
            code: 'AI_RATE_LIMIT_EXCEEDED',
            message: 'Limite de taxa de requisições excedido no provedor de IA. Tente novamente em instantes.',
          });
        }
        if (response.status === 401) {
          throw new BadRequestException({
            code: 'AI_AUTHENTICATION_ERROR',
            message: 'Chave de autenticação do provedor de IA inválida ou não autorizada.',
          });
        }
        throw new BadRequestException({
          code: 'AI_UPSTREAM_ERROR',
          message: `Falha na comunicação com o provedor de IA (HTTP ${response.status}).`,
        });
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
            refusal?: string | null;
          };
        }>;
        usage?: {
          total_tokens?: number;
        };
      };

      const choice = data.choices?.[0];

      if (choice?.message?.refusal) {
        throw new BadRequestException({
          code: 'AI_PROMPT_REFUSED',
          message: `A solicitação foi recusada pelo modelo de IA: ${choice.message.refusal}`,
        });
      }

      const rawContent = choice?.message?.content;
      if (!rawContent) {
        throw new BadRequestException({
          code: 'AI_EMPTY_RESPONSE',
          message: 'O modelo de IA retornou uma resposta vazia.',
        });
      }

      let parsed: {
        workflow: {
          schemaVersion: string;
          name: string;
          description: string;
          triggerNodeId: string;
          nodes: Array<{
            id: string;
            type: string;
            label: string;
            position: { x: number; y: number };
            config: unknown;
          }>;
          edges: Array<{
            id: string;
            sourceNodeId: string;
            targetNodeId: string;
            sourceHandle?: string | null;
            targetHandle?: string | null;
          }>;
        };
        reasoning?: string;
        warnings?: string[];
      };

      try {
        parsed = JSON.parse(rawContent);
      } catch {
        throw new BadRequestException({
          code: 'AI_INVALID_JSON_RESPONSE',
          message: 'A resposta do modelo de IA não pôde ser interpretada como JSON.',
        });
      }

      // Desserializa configurações de nós se enviadas como string JSON
      if (Array.isArray(parsed.workflow.nodes)) {
        for (const node of parsed.workflow.nodes) {
          if (typeof node.config === 'string') {
            try {
              node.config = JSON.parse(node.config);
            } catch {
              node.config = {};
            }
          }
        }
      }

      const tokensConsumed = data.usage?.total_tokens ?? 0;

      return {
        draft: parsed.workflow as any,
        reasoning: parsed.reasoning || `Proposta arquitetada com OpenAI ${this.model}.`,
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
        modelUsed: `openai/${this.model}`,
        tokensConsumed,
      };
    } catch (err: unknown) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
        throw new BadRequestException({
          code: 'AI_REQUEST_TIMEOUT',
          message: 'A requisição para o provedor de IA expirou após o tempo limite.',
        });
      }
      throw new BadRequestException({
        code: 'AI_REQUEST_FAILED',
        message: 'Falha inesperada ao comunicar com o provedor de IA.',
      });
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}

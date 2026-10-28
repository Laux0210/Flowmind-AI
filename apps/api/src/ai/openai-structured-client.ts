import { Injectable, BadRequestException } from '@nestjs/common';
import type { AiClient, AiGenerationResult } from './ai-client.interface';
import { WORKFLOW_GENERATION_JSON_SCHEMA } from './workflow-generation.schema';
import { isJsonObject, parseWorkflowProposal } from './workflow-proposal.parser';

const SYSTEM_PROMPT = `Você é o Arquiteto de Automação com IA do FlowMind AI.
Sua missão é converter a descrição do usuário em linguagem natural em uma proposta de workflow executável em formato JSON estrito.

Regras Obrigatórias e Inegociáveis:
1. O workflow DEVE ser um Grafo Acíclico Dirigido (DAG) conectado a partir do nó de gatilho.
2. O catálogo de tipos de nós é restrito e fechado ao MVP:
   - trigger_form: Gatilho inicial ao receber envio de formulário web.
   - trigger_schedule: Gatilho de agendamento, config {}, saída única scheduledAt (ISO UTC). Use exatamente um gatilho; não invente contato, cron ou destinatário. A frequência é configurada no painel após publicação.
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

    let tokensConsumed: number | null = null;
    const failure = (code: string, message: string) => new BadRequestException({ code, message, tokensConsumed });

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
          throw failure('AI_RATE_LIMIT_EXCEEDED', 'Limite de taxa de requisições excedido no provedor de IA. Tente novamente em instantes.');
        }
        if (response.status === 401) {
          throw failure('AI_AUTHENTICATION_ERROR', 'Chave de autenticação do provedor de IA inválida ou não autorizada.');
        }
        throw failure('AI_UPSTREAM_ERROR', `Falha na comunicação com o provedor de IA (HTTP ${response.status}).`);
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch (error: unknown) {
        if (error instanceof SyntaxError) {
          throw failure('AI_INVALID_RESPONSE_STRUCTURE', 'O provedor de IA retornou um envelope inválido.');
        }
        throw error;
      }
      if (!isJsonObject(data)) {
        throw failure('AI_INVALID_RESPONSE_STRUCTURE', 'O provedor de IA retornou um envelope inválido.');
      }
      const total = isJsonObject(data.usage) ? data.usage.total_tokens : null;
      tokensConsumed = typeof total === 'number' && Number.isSafeInteger(total) && total >= 0 ? total : null;
      if (!Array.isArray(data.choices) || data.choices.length !== 1 || !isJsonObject(data.choices[0])) {
        throw failure('AI_INVALID_RESPONSE_STRUCTURE', 'O provedor de IA retornou escolhas inválidas.');
      }
      const choice = data.choices[0];
      if (!isJsonObject(choice.message)) {
        throw failure('AI_INVALID_RESPONSE_STRUCTURE', 'O provedor de IA retornou uma mensagem inválida.');
      }
      const message = choice.message;
      if (message.refusal !== undefined && message.refusal !== null && typeof message.refusal !== 'string') {
        throw failure('AI_INVALID_RESPONSE_STRUCTURE', 'O provedor de IA retornou uma mensagem inválida.');
      }
      if (typeof message.refusal === 'string' && message.refusal.trim()) {
        throw failure('AI_PROMPT_REFUSED', 'A solicitação foi recusada pelo modelo de IA por diretrizes de segurança.');
      }
      if (choice.finish_reason === 'length' || choice.finish_reason === 'content_filter') {
        throw failure('AI_INCOMPLETE_RESPONSE', 'A resposta do provedor de IA está incompleta e não pode ser aplicada.');
      }
      if (choice.finish_reason !== 'stop') {
        throw failure('AI_INVALID_RESPONSE_STRUCTURE', 'O provedor de IA não retornou uma proposta concluída.');
      }
      if (message.role !== undefined && message.role !== 'assistant') {
        throw failure('AI_INVALID_RESPONSE_STRUCTURE', 'O provedor de IA retornou uma mensagem inválida.');
      }
      if (message.content === null || message.content === undefined || message.content === '') {
        throw failure('AI_EMPTY_RESPONSE', 'O modelo de IA retornou uma resposta vazia.');
      }
      if (typeof message.content !== 'string') {
        throw failure('AI_INVALID_RESPONSE_STRUCTURE', 'O provedor de IA retornou um conteúdo inválido.');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(message.content);
      } catch {
        throw failure('AI_INVALID_JSON_RESPONSE', 'A resposta do modelo de IA não pôde ser interpretada como JSON.');
      }
      let proposal: ReturnType<typeof parseWorkflowProposal>;
      try {
        proposal = parseWorkflowProposal(parsed);
      } catch {
        throw failure('AI_INVALID_WORKFLOW_RESPONSE', 'A proposta retornada possui estrutura ou configuração inválida.');
      }
      return { ...proposal, modelUsed: `openai/${this.model}`, tokensConsumed };
    } catch (err: unknown) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') {
        throw failure('AI_REQUEST_TIMEOUT', 'A requisição para o provedor de IA expirou após o tempo limite.');
      }
      throw failure('AI_REQUEST_FAILED', 'Falha inesperada ao comunicar com o provedor de IA.');
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}

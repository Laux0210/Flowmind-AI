import { BadRequestException } from '@nestjs/common';
import type {
  TriggerFormOutputs,
  TriggerScheduleOutputs,
  AiAnalyzeIntentOutputs,
  InternalRecordOutputs,
  SendEmailOutputs,
  ConditionOutputs,
  HttpRequestOutputs,
} from '@flowmind/contracts';

export interface ExecutionContext {
  mode: 'SIMULATION' | 'LIVE';
  orgId: string;
}

export class NodeExecutors {
  static executeTriggerSchedule(payload: Record<string, unknown>): TriggerScheduleOutputs {
    const value = payload.scheduledAt;
    // Forma UTC canônica produzida por Date.toISOString; rejeita datas normalizadas/inexistentes.
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
      throw new BadRequestException('Horário previsto do agendamento inválido; use ISO UTC.');
    }
    return { scheduledAt: value };
  }

  /**
   * 1. Gatilho de Formulário (trigger_form)
   */
  static executeTriggerForm(
    config: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): TriggerFormOutputs {
    const values: Record<string, unknown> = {
      name: payload.name ?? payload.contact_name,
      email: payload.email ?? payload.contact_email,
      message: payload.message ?? payload.message_text,
    };
    const requiredFields = config.requiredFields ?? ['name', 'email', 'message'];
    if (
      !Array.isArray(requiredFields) ||
      requiredFields.some(
        (field) => typeof field !== 'string' || !Object.hasOwn(values, field),
      )
    ) {
      throw new BadRequestException('Campos obrigatórios do formulário inválidos');
    }
    for (const field of requiredFields) {
      if (typeof values[field] !== 'string' || !values[field].trim()) {
        throw new BadRequestException(
          `Campo obrigatório ausente na submissão do formulário: ${field}`,
        );
      }
    }
    for (const [field, value] of Object.entries(values)) {
      if (value !== undefined && typeof value !== 'string') {
        throw new BadRequestException(
          `Campo inválido na submissão do formulário: ${field}`,
        );
      }
    }
    const name = typeof values.name === 'string' ? values.name.trim() : '';
    const email = typeof values.email === 'string' ? values.email.trim() : '';
    const message = typeof values.message === 'string' ? values.message.trim() : '';
    if (email && !this.isEmail(email)) {
      throw new BadRequestException('E-mail inválido na submissão do formulário');
    }

    return {
      submission_id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      contact_name: name,
      contact_email: email,
      message_text: message,
      submitted_at: new Date().toISOString(),
    };
  }

  /**
   * 2. Prévia de IA simulada (ai_analyze_intent), sem inferência de modelo.
   */
  static async executeAiAnalyzeIntent(
    _config: Record<string, unknown>,
    resolvedInputs: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<AiAnalyzeIntentOutputs> {
    this.requireSimulation(context);
    const messageText =
      resolvedInputs.inputPromptTemplate ?? resolvedInputs.message_text;
    if (typeof messageText !== 'string' || !messageText.trim()) {
      throw new BadRequestException('Entrada de IA ausente ou inválida');
    }

    return {
      summary: `Mensagem recebida (simulação): ${messageText.trim()}`,
      intent: 'Não determinada: análise de IA simulada.',
      ambiguities: [
        'A intenção não foi inferida; confirme-a antes de ativar o fluxo.',
      ],
      model_used: 'simulated',
      tokens_consumed: 0,
    };
  }

  /**
   * 3. Prévia de registro interno de negócio (internal_record), sem persistência.
   */
  static executeInternalRecord(
    config: Record<string, unknown>,
    resolvedInputs: Record<string, unknown>,
    context: ExecutionContext,
  ): InternalRecordOutputs {
    this.requireSimulation(context);

    // Mapeamento de campos fornecido ou resolução direta de entradas
    const fieldMappings = (resolvedInputs.fieldMappings ||
      config.fieldMappings ||
      resolvedInputs) as Record<string, unknown>;

    const name = String(fieldMappings.name ?? resolvedInputs.name ?? '').trim();
    const email = String(fieldMappings.email ?? resolvedInputs.email ?? '').trim();
    const rawMessage = String(
      fieldMappings.raw_message ??
        fieldMappings.message ??
        resolvedInputs.raw_message ??
        '',
    ).trim();

    if (!name && !email) {
      throw new BadRequestException(
        'Falha no registro interno: ao menos um identificador (nome ou e-mail) deve ser fornecido.',
      );
    }

    const uniqueId = `sim_record_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const aiSummary =
      typeof fieldMappings.ai_summary === 'string'
        ? fieldMappings.ai_summary
        : typeof resolvedInputs.ai_summary === 'string'
          ? resolvedInputs.ai_summary
          : undefined;

    const aiIntent =
      typeof fieldMappings.ai_intent === 'string'
        ? fieldMappings.ai_intent
        : typeof resolvedInputs.ai_intent === 'string'
          ? resolvedInputs.ai_intent
          : undefined;

    const ambiguities = (fieldMappings.ambiguities ?? resolvedInputs.ambiguities) as
      | string
      | string[]
      | undefined;

    return {
      record_id: uniqueId,
      name: name || undefined,
      email: email || undefined,
      raw_message: rawMessage || undefined,
      ai_summary: aiSummary,
      ai_intent: aiIntent,
      ambiguities,
      status: 'simulated',
      simulated_at: new Date().toISOString(),
    };
  }

  /**
   * 4. Envio de E-mail (send_email)
   */
  static executeSendEmail(
    config: Record<string, unknown>,
    resolvedInputs: Record<string, unknown>,
    context: ExecutionContext,
  ): SendEmailOutputs {
    this.requireSimulation(context);

    const to = resolvedInputs.to ?? config.to;
    if (typeof to !== 'string' || !this.isEmail(to)) {
      throw new BadRequestException({
        code: 'INVALID_EMAIL_RECIPIENT',
        message: 'Destinatário de e-mail ausente ou com formato inválido.',
      });
    }

    // Proteção contra CRLF Injection em cabeçalhos de e-mail
    if (/[\r\n]/.test(to)) {
      throw new BadRequestException({
        code: 'EMAIL_HEADER_INJECTION',
        message: 'Caracteres de quebra de linha proibidos detectados no destinatário.',
      });
    }

    const subject = resolvedInputs.subject ?? config.subject;
    if (typeof subject === 'string' && /[\r\n]/.test(subject)) {
      throw new BadRequestException({
        code: 'EMAIL_HEADER_INJECTION',
        message: 'Caracteres de quebra de linha proibidos detectados no assunto do e-mail.',
      });
    }

    const replyTo = resolvedInputs.replyTo ?? config.replyTo;
    if (replyTo !== undefined && replyTo !== null && replyTo !== '') {
      if (typeof replyTo !== 'string' || !this.isEmail(replyTo)) {
        throw new BadRequestException({
          code: 'INVALID_EMAIL_RECIPIENT',
          message: 'E-mail de resposta (replyTo) com formato inválido.',
        });
      }
      if (/[\r\n]/.test(replyTo)) {
        throw new BadRequestException({
          code: 'EMAIL_HEADER_INJECTION',
          message: 'Caracteres de quebra de linha proibidos detectados no replyTo.',
        });
      }
    }

    return {
      delivery_status: 'simulated',
      recipient: to,
      subject: typeof subject === 'string' ? subject : undefined,
      message_id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      dispatched_at: new Date().toISOString(),
    };
  }

  /**
   * 5. Condição Lógica (condition)
   * Suporta operadores: equals, not_equals, contains, in, greater_than, less_than, etc.
   */
  static executeCondition(
    _config: Record<string, unknown>,
    resolvedInputs: Record<string, unknown>,
  ): ConditionOutputs {
    const left = resolvedInputs.leftOperand ?? '';
    const op = String(resolvedInputs.operator ?? 'equals').toLowerCase().trim();
    const right = resolvedInputs.rightOperand ?? '';

    let result = false;

    // Comparação numérica caso ambos os lados sejam valores numéricos válidos
    const leftNum = Number(left);
    const rightNum = Number(right);
    const isBothNumeric =
      left !== '' &&
      right !== '' &&
      !isNaN(leftNum) &&
      !isNaN(rightNum);

    switch (op) {
      case 'equals':
      case '==':
      case 'eq':
        result = isBothNumeric ? leftNum === rightNum : String(left) === String(right);
        break;

      case 'not_equals':
      case '!=':
      case 'neq':
        result = isBothNumeric ? leftNum !== rightNum : String(left) !== String(right);
        break;

      case 'contains':
        result = String(left).toLowerCase().includes(String(right).toLowerCase());
        break;

      case 'not_contains':
        result = !String(left).toLowerCase().includes(String(right).toLowerCase());
        break;

      case 'in': {
        const setValues = String(right)
          .split(',')
          .map((s) => s.trim().toLowerCase());
        result = setValues.includes(String(left).trim().toLowerCase());
        break;
      }

      case 'not_in': {
        const setValues = String(right)
          .split(',')
          .map((s) => s.trim().toLowerCase());
        result = !setValues.includes(String(left).trim().toLowerCase());
        break;
      }

      case 'greater_than':
      case '>':
      case 'gt':
        if (!isBothNumeric) {
          throw new BadRequestException('Operador greater_than requer operandos numéricos');
        }
        result = leftNum > rightNum;
        break;

      case 'less_than':
      case '<':
      case 'lt':
        if (!isBothNumeric) {
          throw new BadRequestException('Operador less_than requer operandos numéricos');
        }
        result = leftNum < rightNum;
        break;

      case 'greater_or_equal':
      case '>=':
      case 'gte':
        if (!isBothNumeric) {
          throw new BadRequestException('Operador greater_or_equal requer operandos numéricos');
        }
        result = leftNum >= rightNum;
        break;

      case 'less_or_equal':
      case '<=':
      case 'lte':
        if (!isBothNumeric) {
          throw new BadRequestException('Operador less_or_equal requer operandos numéricos');
        }
        result = leftNum <= rightNum;
        break;

      case 'starts_with':
        result = String(left).toLowerCase().startsWith(String(right).toLowerCase());
        break;

      case 'ends_with':
        result = String(left).toLowerCase().endsWith(String(right).toLowerCase());
        break;

      case 'is_empty': {
        const rawLeft = resolvedInputs.leftOperand;
        if (rawLeft === null || rawLeft === undefined) {
          result = true;
        } else if (typeof rawLeft === 'string') {
          result = rawLeft.trim().length === 0;
        } else if (Array.isArray(rawLeft)) {
          result = rawLeft.length === 0;
        } else if (typeof rawLeft === 'object') {
          result = Object.keys(rawLeft as object).length === 0;
        } else {
          result = false;
        }
        break;
      }

      case 'is_not_empty': {
        const rawLeft = resolvedInputs.leftOperand;
        if (rawLeft === null || rawLeft === undefined) {
          result = false;
        } else if (typeof rawLeft === 'string') {
          result = rawLeft.trim().length > 0;
        } else if (Array.isArray(rawLeft)) {
          result = rawLeft.length > 0;
        } else if (typeof rawLeft === 'object') {
          result = Object.keys(rawLeft as object).length > 0;
        } else {
          result = true;
        }
        break;
      }

      default:
        throw new BadRequestException({
          code: 'INVALID_CONDITION_OPERATOR',
          message: `Operador de condição não suportado: ${op}`,
        });
    }

    return {
      result,
      evaluated_at: new Date().toISOString(),
    };
  }

  /**
   * 6. Requisição HTTP (http_request)
   * Validação de segurança SSRF restrita e retorno emulada para modo simulação
   */
  static executeHttpRequest(
    config: Record<string, unknown>,
    resolvedInputs: Record<string, unknown>,
    context: ExecutionContext,
  ): HttpRequestOutputs {
    this.requireSimulation(context);

    const rawUrl = String(resolvedInputs.url ?? config.url ?? '').trim();
    if (!rawUrl) {
      throw new BadRequestException({
        code: 'MISSING_HTTP_URL',
        message: 'URL da requisição HTTP é obrigatória.',
      });
    }

    // Proteção obrigatória contra SSRF
    this.validateUrlAgainstSsrf(rawUrl);

    // Proteção contra CRLF Injection em cabeçalhos HTTP
    const rawHeaders = resolvedInputs.headers ?? config.headers;
    if (rawHeaders && typeof rawHeaders === 'object' && !Array.isArray(rawHeaders)) {
      for (const [key, value] of Object.entries(rawHeaders as Record<string, unknown>)) {
        if (/[\r\n]/.test(key) || (typeof value === 'string' && /[\r\n]/.test(value))) {
          throw new BadRequestException({
            code: 'HTTP_HEADER_INJECTION',
            message: 'Caracteres de quebra de linha proibidos detectados nos cabeçalhos HTTP.',
          });
        }
      }
    }

    const method = String(
      resolvedInputs.method ?? config.method ?? 'GET',
    ).toUpperCase();
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    if (!validMethods.includes(method)) {
      throw new BadRequestException({
        code: 'INVALID_HTTP_METHOD',
        message: `Método HTTP não suportado: ${method}`,
      });
    }

    return {
      status_code: 200,
      response_body: {
        simulated: true,
        method,
        target_url: rawUrl,
        timestamp: new Date().toISOString(),
      },
      duration_ms: 12,
    };
  }

  /**
   * Proteção estrita contra SSRF (Server-Side Request Forgery).
   * Bloqueia destinos locais, metadados de nuvem e faixas de rede privada RFC 1918.
   */
  static validateUrlAgainstSsrf(rawUrl: string): void {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new BadRequestException({
        code: 'MALFORMED_URL',
        message: 'A URL informada não é válida.',
      });
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException({
        code: 'SSRF_PROTECTION_BLOCKED',
        message: `Protocolo ${parsed.protocol} não permitido. Apenas HTTP e HTTPS são suportados.`,
      });
    }

    let host = parsed.hostname.toLowerCase();
    if (host.startsWith('[') && host.endsWith(']')) {
      host = host.slice(1, -1);
    }

    // Bloqueio de localhost, loopback e metadados de provedores cloud
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '::' ||
      host === '169.254.169.254' ||
      host === 'metadata.google.internal' ||
      host.endsWith('.localhost')
    ) {
      throw new BadRequestException({
        code: 'SSRF_PROTECTION_BLOCKED',
        message: `Acesso a destinos locais ou metadados de nuvem (${host}) é expressamente bloqueado por segurança.`,
      });
    }

    // Bloqueio de faixas de IP privado RFC 1918
    // 10.0.0.0 - 10.255.255.255
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
      throw new BadRequestException({
        code: 'SSRF_PROTECTION_BLOCKED',
        message: 'Acesso à rede privada 10.0.0.0/8 é bloqueado por segurança.',
      });
    }

    // 172.16.0.0 - 172.31.255.255
    const match172 = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    if (match172) {
      const secondOctet = parseInt(match172[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) {
        throw new BadRequestException({
          code: 'SSRF_PROTECTION_BLOCKED',
          message: 'Acesso à rede privada 172.16.0.0/12 é bloqueado por segurança.',
        });
      }
    }

    // 192.168.0.0 - 192.168.255.255
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) {
      throw new BadRequestException({
        code: 'SSRF_PROTECTION_BLOCKED',
        message: 'Acesso à rede privada 192.168.0.0/16 é bloqueado por segurança.',
      });
    }

    // Bloqueio de endereços IPv6 privados (ULA: fc00::/7) e link-local (fe80::/10)
    if (
      host.includes(':') &&
      (/^f[cd][0-9a-f]{2}:/i.test(host) ||
        /^fe[89ab][0-9a-f]:/i.test(host) ||
        host.startsWith('fc00') ||
        host.startsWith('fd00') ||
        host.startsWith('fe80'))
    ) {
      throw new BadRequestException({
        code: 'SSRF_PROTECTION_BLOCKED',
        message: `Acesso a endereço IPv6 privado ou link-local (${host}) é bloqueado por segurança.`,
      });
    }
  }

  private static requireSimulation(context: ExecutionContext): void {
    if (context.mode !== 'SIMULATION') {
      throw new BadRequestException(
        'Execução LIVE não implementada; somente simulação está disponível',
      );
    }
  }

  static isEmail(value: string): boolean {
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
  }
}

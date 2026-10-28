import { Injectable, BadRequestException } from '@nestjs/common';
import type {
  EmailProvider,
  EmailMessage,
  EmailDispatchResult,
} from './email-provider.interface';

@Injectable()
export class SimulatedEmailProvider implements EmailProvider {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async sendEmail(message: EmailMessage): Promise<EmailDispatchResult> {
    const rawTo = typeof message.to === 'string' ? message.to : '';
    // Proteção contra CRLF Injection no destinatário
    if (/[\r\n]/.test(rawTo)) {
      throw new BadRequestException({
        code: 'EMAIL_HEADER_INJECTION',
        message: 'Caracteres de quebra de linha proibidos detectados no destinatário.',
      });
    }

    const to = rawTo.trim();
    if (!to || !SimulatedEmailProvider.EMAIL_REGEX.test(to)) {
      throw new BadRequestException({
        code: 'INVALID_EMAIL_RECIPIENT',
        message: 'Destinatário de e-mail ausente ou com formato inválido.',
      });
    }

    const rawSubject = typeof message.subject === 'string' ? message.subject : '';
    // Proteção contra CRLF Injection no assunto
    if (/[\r\n]/.test(rawSubject)) {
      throw new BadRequestException({
        code: 'EMAIL_HEADER_INJECTION',
        message: 'Caracteres de quebra de linha proibidos detectados no assunto do e-mail.',
      });
    }

    const subject = rawSubject.trim();
    if (!subject) {
      throw new BadRequestException({
        code: 'INVALID_EMAIL_SUBJECT',
        message: 'Assunto do e-mail não pode ser vazio.',
      });
    }

    // Validação de replyTo caso fornecido
    if (message.replyTo !== undefined && message.replyTo !== null && message.replyTo !== '') {
      const rawReplyTo = typeof message.replyTo === 'string' ? message.replyTo : '';
      if (/[\r\n]/.test(rawReplyTo)) {
        throw new BadRequestException({
          code: 'EMAIL_HEADER_INJECTION',
          message: 'Caracteres de quebra de linha proibidos detectados no replyTo.',
        });
      }
      const replyTo = rawReplyTo.trim();
      if (!SimulatedEmailProvider.EMAIL_REGEX.test(replyTo)) {
        throw new BadRequestException({
          code: 'INVALID_EMAIL_RECIPIENT',
          message: 'E-mail de resposta (replyTo) com formato inválido.',
        });
      }
    }

    const messageId = `msg_sim_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return {
      messageId,
      deliveryStatus: 'simulated',
      recipient: to,
      subject,
      providerUsed: 'simulated/local-noop',
      dispatchedAt: new Date().toISOString(),
    };
  }
}

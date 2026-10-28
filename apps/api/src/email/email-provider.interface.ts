/**
 * Contratos da Arquitetura do Provedor de E-mail Transacional (T11).
 * Suporta desacoplamento de provedores (Resend, SendGrid, SMTP, Simulado)
 * e proteção estrita contra CRLF injection em headers de e-mail.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  html?: string;
  replyTo?: string;
  orgId: string;
}

export interface EmailDispatchResult {
  messageId: string;
  deliveryStatus: 'dispatched' | 'simulated' | 'failed';
  recipient: string;
  subject: string;
  providerUsed: string;
  dispatchedAt: string;
}

export interface EmailProvider {
  sendEmail(message: EmailMessage): Promise<EmailDispatchResult>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

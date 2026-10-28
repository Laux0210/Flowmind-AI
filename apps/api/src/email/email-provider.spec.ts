import { BadRequestException } from '@nestjs/common';
import { SimulatedEmailProvider } from './simulated-email.provider';
import type { EmailMessage } from './email-provider.interface';

describe('EmailProvider (T11)', () => {
  let provider: SimulatedEmailProvider;

  beforeEach(() => {
    provider = new SimulatedEmailProvider();
  });

  const validMessage: EmailMessage = {
    to: 'contato@cliente.test',
    subject: 'Confirmação de recebimento - FlowMind AI',
    body: 'Olá, recebemos sua mensagem e entraremos em contato.',
    replyTo: 'suporte@flowmind.test',
    orgId: 'org_test_email',
  };

  it('despacha e-mail em modo simulado com status e identificador gerados', async () => {
    const result = await provider.sendEmail(validMessage);

    expect(result).toBeDefined();
    expect(result.deliveryStatus).toBe('simulated');
    expect(result.providerUsed).toBe('simulated/local-noop');
    expect(result.recipient).toBe(validMessage.to);
    expect(result.subject).toBe(validMessage.subject);
    expect(result.messageId).toMatch(/^msg_sim_[a-z0-9_]+$/);
    expect(result.dispatchedAt).toBeDefined();
  });

  it('rejeita e-mail com destinatário inválido', async () => {
    await expect(
      provider.sendEmail({ ...validMessage, to: 'email_invalido' }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      provider.sendEmail({ ...validMessage, to: '' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita CRLF Injection no destinatário (EMAIL_HEADER_INJECTION)', async () => {
    await expect(
      provider.sendEmail({ ...validMessage, to: 'admin@test.com\r\nBcc: hacker@evil.test' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita CRLF Injection no assunto (EMAIL_HEADER_INJECTION)', async () => {
    await expect(
      provider.sendEmail({ ...validMessage, subject: 'Assunto normal\r\nInjected-Header: evil' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita CRLF Injection no replyTo (EMAIL_HEADER_INJECTION)', async () => {
    await expect(
      provider.sendEmail({ ...validMessage, replyTo: 'safe@test.com\nBcc: evil@test.com' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita replyTo com formato de e-mail inválido', async () => {
    await expect(
      provider.sendEmail({ ...validMessage, replyTo: 'not-an-email' }),
    ).rejects.toThrow(BadRequestException);
  });
});

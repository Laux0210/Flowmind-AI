import { WebhookSignatureValidator } from './webhook-signature.validator';

describe('WebhookSignatureValidator (T12)', () => {
  const secret = 'whsec_test_secret_12345';
  const payload = { event: 'form.submitted', data: { name: 'João', email: 'joao@example.test' } };
  const rawPayload = JSON.stringify(payload);

  it('calcula assinatura no padrão canônico t=<timestamp>,v1=<hmac>', () => {
    const timestamp = 1700000000;
    const header = WebhookSignatureValidator.computeSignature(rawPayload, secret, timestamp);

    expect(header).toMatch(/^t=1700000000,v1=[a-f0-9]{64}$/);
  });

  it('verifica assinatura válida com sucesso', () => {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const header = WebhookSignatureValidator.computeSignature(rawPayload, secret, currentTimestamp);

    const isValid = WebhookSignatureValidator.verifySignature(header, rawPayload, secret, 300);
    expect(isValid).toBe(true);
  });

  it('rejeita payload adulterado mesmo com assinatura intacta', () => {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const header = WebhookSignatureValidator.computeSignature(rawPayload, secret, currentTimestamp);

    const tamperedPayload = JSON.stringify({ ...payload, tampered: true });
    const isValid = WebhookSignatureValidator.verifySignature(header, tamperedPayload, secret, 300);
    expect(isValid).toBe(false);
  });

  it('rejeita segredo incorreto via comparação timing-safe', () => {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const header = WebhookSignatureValidator.computeSignature(rawPayload, secret, currentTimestamp);

    const isValid = WebhookSignatureValidator.verifySignature(header, rawPayload, 'wrong_secret', 300);
    expect(isValid).toBe(false);
  });

  it('rejeita requisições com timestamp expirado (Replay Attack > tolerância)', () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400s atrás (> 300s)
    const header = WebhookSignatureValidator.computeSignature(rawPayload, secret, oldTimestamp);

    const isValid = WebhookSignatureValidator.verifySignature(header, rawPayload, secret, 300);
    expect(isValid).toBe(false);
  });

  it('rejeita headers malformados ou incompletos', () => {
    expect(WebhookSignatureValidator.verifySignature('', rawPayload, secret)).toBe(false);
    expect(WebhookSignatureValidator.verifySignature('invalid_header', rawPayload, secret)).toBe(false);
    expect(WebhookSignatureValidator.verifySignature('t=123', rawPayload, secret)).toBe(false);
    expect(WebhookSignatureValidator.verifySignature('v1=abcdef', rawPayload, secret)).toBe(false);
    expect(WebhookSignatureValidator.verifySignature('t=abc,v1=123', rawPayload, secret)).toBe(false);
  });
});

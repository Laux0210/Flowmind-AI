import { decryptSecret, encryptSecret, generatePublicId, generateWebhookSecret } from './secret-cipher';

describe('Cifra de segredos de webhook', () => {
  const original = process.env.ENCRYPTION_KEY_32BYTES;
  afterEach(() => { process.env.ENCRYPTION_KEY_32BYTES = original; });

  it('cifra com AES-256-GCM, decifra e não expõe o segredo', () => {
    process.env.ENCRYPTION_KEY_32BYTES = 'ab'.repeat(32);
    const secret = generateWebhookSecret();
    const stored = encryptSecret(secret);
    expect(stored).not.toContain(secret);
    expect(encryptSecret(secret)).not.toBe(stored);
    expect(decryptSecret(stored)).toBe(secret);
  });

  it('recusa conteúdo adulterado', () => {
    process.env.ENCRYPTION_KEY_32BYTES = 'ab'.repeat(32);
    const [v, iv, tag, data] = encryptSecret('whsec_fixture').split('.');
    const flipped = Buffer.from(data, 'base64url'); flipped[0] ^= 1;
    expect(() => decryptSecret([v, iv, tag, flipped.toString('base64url')].join('.'))).toThrow();
  });

  it.each([undefined, 'curta', '0123456789abcdef'.repeat(4)])('recusa chave ausente, inválida ou de exemplo (%s)', (key) => {
    process.env.ENCRYPTION_KEY_32BYTES = key as string;
    if (key === undefined) delete process.env.ENCRYPTION_KEY_32BYTES;
    expect(() => encryptSecret('whsec_fixture')).toThrow('ENCRYPTION_KEY_32BYTES');
  });

  it('gera IDs públicos e segredos aleatórios', () => {
    expect(generatePublicId()).toMatch(/^whk_[A-Za-z0-9_-]{22}$/);
    expect(generateWebhookSecret()).not.toBe(generateWebhookSecret());
  });
});

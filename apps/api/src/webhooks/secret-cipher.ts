import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Chave de exemplo do .env.example: nunca aceita para cifrar segredos reais.
const PLACEHOLDER_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function loadKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY_32BYTES?.trim() ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex) || hex.toLowerCase() === PLACEHOLDER_KEY) {
    throw new Error('ENCRYPTION_KEY_32BYTES ausente, inválida ou igual ao exemplo');
  }
  return Buffer.from(hex, 'hex');
}

/** AES-256-GCM: formato v1.<iv>.<tag>.<ciphertext> em base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', loadKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), data].map((part) => typeof part === 'string' ? part : part.toString('base64url')).join('.');
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, data] = stored.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Formato de segredo cifrado inválido');
  const decipher = createDecipheriv('aes-256-gcm', loadKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString('base64url')}`;
}

export function generatePublicId(): string {
  return `whk_${randomBytes(16).toString('base64url')}`;
}

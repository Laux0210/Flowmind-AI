import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Validador canônico de assinaturas HMAC-SHA256 para webhooks do FlowMind AI (T12).
 * Formato padronizado de assinatura: `t=<timestamp_segundos>,v1=<hex_hmac_sha256>`
 * Inclui verificação com buffers em tempo constante (timingSafeEqual) e proteção contra Replay Attack.
 */
export class WebhookSignatureValidator {
  /**
   * Gera a assinatura no formato canônico do FlowMind AI.
   * @param rawPayload Conteúdo bruto da requisição (string)
   * @param secret Chave secreta de autenticação do webhook
   * @param timestamp Timestamp Unix em segundos (opcional, padrão = agora)
   */
  static computeSignature(rawPayload: string, secret: string, timestamp?: number): string {
    const ts = timestamp ?? Math.floor(Date.now() / 1000);
    const signaturePayload = `${ts}.${rawPayload}`;
    const hmacHex = createHmac('sha256', secret)
      .update(signaturePayload, 'utf8')
      .digest('hex');
    return `t=${ts},v1=${hmacHex}`;
  }

  /**
   * Verifica a validade da assinatura de um webhook recebido.
   * @param header Valor do cabeçalho de assinatura (ex: `X-FlowMind-Signature`)
   * @param rawPayload Conteúdo bruto recebido
   * @param secret Segredo configurado para a organização/workflow
   * @param toleranceSeconds Tolerância máxima de drift temporal em segundos (padrão = 300s / 5 min)
   */
  static verifySignature(
    header: string | undefined | null,
    rawPayload: string,
    secret: string | undefined | null,
    toleranceSeconds = 300,
  ): boolean {
    if (!header || typeof header !== 'string' || !secret || typeof secret !== 'string') {
      return false;
    }

    const parts = header.trim().split(',');
    let timestampStr: string | null = null;
    let signatureHex: string | null = null;

    for (const part of parts) {
      const equalIndex = part.indexOf('=');
      if (equalIndex === -1) continue;
      const key = part.slice(0, equalIndex).trim();
      const val = part.slice(equalIndex + 1).trim();

      if (key === 't' && val) {
        timestampStr = val;
      } else if (key === 'v1' && val) {
        signatureHex = val;
      }
    }

    if (!timestampStr || !signatureHex) {
      return false;
    }

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp) || timestamp <= 0) {
      return false;
    }

    // Proteção contra Replay Attack e desvio excessivo de relógio
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTimestamp - timestamp) > toleranceSeconds) {
      return false;
    }

    // Cálculo da assinatura esperada com o mesmo timestamp recebido
    const expectedSignaturePayload = `${timestamp}.${rawPayload}`;
    const expectedHmacHex = createHmac('sha256', secret)
      .update(expectedSignaturePayload, 'utf8')
      .digest('hex');

    const expectedBuf = Buffer.from(expectedHmacHex, 'hex');
    const receivedBuf = Buffer.from(signatureHex, 'hex');

    // SHA-256 produz sempre digest de 32 bytes
    if (expectedBuf.length !== 32 || receivedBuf.length !== 32) {
      return false;
    }

    return timingSafeEqual(expectedBuf, receivedBuf);
  }
}

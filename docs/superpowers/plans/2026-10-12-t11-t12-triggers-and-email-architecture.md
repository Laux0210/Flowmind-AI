# T11/T12 — Triggers & Email Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o validador canônico de assinatura HMAC-SHA256 (com timestamp anti-replay e timing-safe comparison) para webhooks públicos (T12) e a arquitetura desacoplada de provedor de e-mail transacional com proteção estrita anti-CRLF (T11).

**Architecture:** Validador HMAC desacoplado em `apps/api/src/triggers/` que formata e verifica assinaturas no padrão `t=<timestamp>,v1=<hex_hmac>`, e padrão Strategy para `EmailProvider` em `apps/api/src/email/` com injeção de dependência e implementação simulada defensiva para modo `SIMULATION` e testes sem efeitos externos.

**Tech Stack:** Node.js `crypto` (`createHmac`, `timingSafeEqual`), NestJS, TypeScript, Jest, `@flowmind/contracts`.

**Spec:** [docs/WORKFLOW_CONTRACT.md](../../WORKFLOW_CONTRACT.md), [docs/QA_SECURITY_MATRIX.md](../../QA_SECURITY_MATRIX.md), [docs/PROJECT_CONTEXT.md](../../PROJECT_CONTEXT.md).

## Global Constraints

- **Segurança timing-safe:** Comparações de assinatura e segredos devem usar exclusivamente `crypto.timingSafeEqual` com buffers de mesmo tamanho.
- **Proteção contra Replay Attack:** Assinaturas de webhook incluem timestamp Unix (`t=...`) com drift máximo permitido de 300 segundos (5 minutos).
- **Proteção contra CRLF Injection:** Todos os cabeçalhos de e-mail (`to`, `subject`, `replyTo`) proíbem terminantemente `\r` ou `\n`.
- **Falha Fechada no Ingress:** Se a assinatura de webhook for ausente ou inválida, a API retorna `401 Unauthorized` com `INVALID_WEBHOOK_SIGNATURE`, sem revelar se o workflow existe ou não.
- **Sem efeitos externos em simulação:** O modo `SIMULATION` nunca dispara e-mails reais nem gera custos comerciais.

## Review Focus

1. Tentativa de webhook com replay de timestamp antigo (> 300s) (deve ser rejeitada com erro de assinatura expirada).
2. Tentativa de webhook com segredo ou assinatura divergente (deve ser rejeitada com 401 via `timingSafeEqual`).
3. Envio de e-mail com quebras de linha `\r\n` no destinatário ou assunto (deve ser bloqueado com `EMAIL_HEADER_INJECTION`).
4. Replay de webhook com mesma chave de idempotência válida (deve retornar a resposta cacheada sem reexecutar o motor).
5. Despacho de e-mail em modo `SIMULATION` (deve retornar status `simulated` com identificador gerado sem rede).

---

### Task 1: Validador Canônico de Assinatura HMAC de Webhook (T12)

**Files:**
- Create: `apps/api/src/triggers/webhook-signature.validator.ts`
- Test: `apps/api/src/triggers/webhook-signature.validator.spec.ts`

**Interfaces:**
- Produces: `WebhookSignatureValidator.computeSignature(payload, secret, timestamp)`, `WebhookSignatureValidator.verifySignature(header, rawPayload, secret, toleranceSeconds)`.

- [x] **Step 1: Write the failing test**
  Criar `webhook-signature.validator.spec.ts` cobrindo geração de assinatura, verificação com sucesso, rejeição por assinatura adulterada, rejeição por timestamp expirado (>300s) e formato de header malformado.

- [x] **Step 2: Run test to verify it fails**
  Executar Jest para confirmar que a classe ainda não existe.

- [x] **Step 3: Implement `webhook-signature.validator.ts`**
  Implementar `WebhookSignatureValidator` com métodos estáticos usando `node:crypto` (`createHmac('sha256', secret)` e `timingSafeEqual`).

- [x] **Step 4: Run test to verify it passes**
  Executar Jest e verificar aprovação completa.

---

### Task 2: Integração do WebhooksService e Controller com HMAC e Idempotência (T12)

**Files:**
- Modify: `apps/api/src/triggers/webhooks.service.ts`
- Modify: `apps/api/src/triggers/triggers.types.ts`
- Test: `apps/api/src/triggers/triggers.spec.ts`

**Interfaces:**
- Consumes: `WebhookSignatureValidator`, `WorkflowEngineService`.
- Produces: `WebhooksService.handleWebhookTrigger` com verificação de assinatura no formato `t=...,v1=...` e suporte a secret direto ou HMAC.

- [x] **Step 1: Write the failing test / update test**
  Adicionar testes em `triggers.spec.ts` verificando validação de assinatura HMAC com payload real e timestamp.

- [x] **Step 2: Run test to verify failure/update**
  Executar Jest.

- [x] **Step 3: Update `webhooks.service.ts`**
  Integrar suporte à assinatura HMAC formal além da comparação direta legada, preservando retrocompatibilidade com fixtures já existentes.

- [x] **Step 4: Run test to verify it passes**
  Executar Jest e confirmar 100% verde.

---

### Task 3: Arquitetura de Provedor de E-mail Desacoplado (T11)

**Files:**
- Create: `apps/api/src/email/email-provider.interface.ts`
- Create: `apps/api/src/email/simulated-email.provider.ts`
- Create: `apps/api/src/email/email.module.ts`
- Test: `apps/api/src/email/email-provider.spec.ts`

**Interfaces:**
- Produces: `EmailProvider`, `EmailMessage`, `EmailDispatchResult`, `EMAIL_PROVIDER`, `SimulatedEmailProvider`, `EmailModule`.

- [x] **Step 1: Write the failing test**
  Criar `email-provider.spec.ts` verificando envio simulado, proteção estrita contra CRLF em `to`, `subject` e `replyTo`, e validação de e-mails inválidos.

- [x] **Step 2: Run test to verify it fails**
  Executar Jest e confirmar falha.

- [x] **Step 3: Implement `email-provider.interface.ts`, `simulated-email.provider.ts` e `email.module.ts`**
  Implementar os contratos, validações de regex defensivas e o provider.

- [x] **Step 4: Run test to verify it passes**
  Executar Jest e confirmar aprovação.

---

### Task 4: Suíte de Regressão Nativa e Validação Global

**Files:**
- Create: `tests/regression/triggers-email.test.mjs`
- Modify: `package.json` (`test:regression`)
- Modify: `docs/MEMORIA.md`
- Modify: `plan.md`

- [x] **Step 1: Implementar `tests/regression/triggers-email.test.mjs`**
  Cobrir assinatura HMAC, rejeição de replay attack, proteção CRLF e despacho de e-mail simulado em Node.js nativo.

- [x] **Step 2: Atualizar `package.json` e executar `npm run test:regression`**
  Verificar que todas as 101 + novas regressões passam verdes.

- [x] **Step 3: Atualizar documentação e memória**
  Atualizar `docs/MEMORIA.md` e `plan.md`.

- [x] **Step 4: Executar `npm run check:all`**
  Garantir pipeline 100% verde.

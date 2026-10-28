import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './load-typescript.mjs';

const validatorFile = 'apps/api/src/triggers/webhook-signature.validator.ts';
const emailFile = 'apps/api/src/email/simulated-email.provider.ts';

test('WebhookSignatureValidator: gera assinatura HMAC no padrão canônico t=...,v1=...', async () => {
  const { exports } = await loadTypeScript(validatorFile);
  const Validator = exports.WebhookSignatureValidator;

  const rawPayload = JSON.stringify({ event: 'form.lead', name: 'Maria' });
  const secret = 'whsec_reg_test_secret';
  const ts = 1700000000;

  const header = Validator.computeSignature(rawPayload, secret, ts);
  assert.match(header, /^t=1700000000,v1=[a-f0-9]{64}$/);
});

test('WebhookSignatureValidator: valida assinatura válida e rejeita adulteração de payload', async () => {
  const { exports } = await loadTypeScript(validatorFile);
  const Validator = exports.WebhookSignatureValidator;

  const rawPayload = JSON.stringify({ event: 'form.lead', name: 'Maria' });
  const secret = 'whsec_reg_test_secret';
  const currentTs = Math.floor(Date.now() / 1000);

  const header = Validator.computeSignature(rawPayload, secret, currentTs);

  // Válido
  assert.equal(Validator.verifySignature(header, rawPayload, secret, 300), true);

  // Adulterado
  const tampered = JSON.stringify({ event: 'form.lead', name: 'Maria', evil: true });
  assert.equal(Validator.verifySignature(header, tampered, secret, 300), false);

  // Segredo incorreto
  assert.equal(Validator.verifySignature(header, rawPayload, 'wrong_secret', 300), false);
});

test('WebhookSignatureValidator: rejeita replay attack quando timestamp exceder tolerância', async () => {
  const { exports } = await loadTypeScript(validatorFile);
  const Validator = exports.WebhookSignatureValidator;

  const rawPayload = JSON.stringify({ event: 'ping' });
  const secret = 'whsec_replay_secret';
  const oldTs = Math.floor(Date.now() / 1000) - 450; // 450s (> 300s)

  const header = Validator.computeSignature(rawPayload, secret, oldTs);
  assert.equal(Validator.verifySignature(header, rawPayload, secret, 300), false);
});

test('SimulatedEmailProvider: despacha e-mail simulado com identificador e sem rede', async () => {
  const { exports } = await loadTypeScript(emailFile);
  const Provider = exports.SimulatedEmailProvider;
  const provider = new Provider();

  const result = await provider.sendEmail({
    to: 'cliente@empresa.test',
    subject: 'Recebemos seu contato',
    body: 'Em breve responderemos.',
    orgId: 'org_reg_1',
  });

  assert.equal(result.deliveryStatus, 'simulated');
  assert.equal(result.providerUsed, 'simulated/local-noop');
  assert.equal(result.recipient, 'cliente@empresa.test');
  assert.match(result.messageId, /^msg_sim_/);
  assert.ok(result.dispatchedAt);
});

test('SimulatedEmailProvider: bloqueia CRLF injection em headers de e-mail', async () => {
  const { exports } = await loadTypeScript(emailFile);
  const Provider = exports.SimulatedEmailProvider;
  const provider = new Provider();

  // CRLF em to
  await assert.rejects(
    provider.sendEmail({
      to: 'cliente@test.com\r\nBcc: spy@evil.test',
      subject: 'Assunto',
      body: 'Texto',
      orgId: 'org_1',
    }),
    (err) => err.getResponse().code === 'EMAIL_HEADER_INJECTION',
  );

  // CRLF em subject
  await assert.rejects(
    provider.sendEmail({
      to: 'cliente@test.com',
      subject: 'Assunto\r\nEvil-Header: 123',
      body: 'Texto',
      orgId: 'org_1',
    }),
    (err) => err.getResponse().code === 'EMAIL_HEADER_INJECTION',
  );

  // CRLF em replyTo
  await assert.rejects(
    provider.sendEmail({
      to: 'cliente@test.com',
      subject: 'Assunto',
      body: 'Texto',
      replyTo: 'reply@test.com\nBcc: spy@evil.test',
      orgId: 'org_1',
    }),
    (err) => err.getResponse().code === 'EMAIL_HEADER_INJECTION',
  );
});

test('T03-S3 (SC09): ResourceResolver rejeita credenciais e formulários cross-tenant e desconhecidos', async () => {
  const { exports } = await loadTypeScript('apps/api/src/engine/resource-resolver.ts');
  const resolver = exports.createTestResourceResolver();

  // Cross-tenant credential
  assert.throws(
    () => resolver.resolveCredential('org_alpha', 'cred_beta_http'),
    (err) => err?.response?.code === 'RESOURCE_NOT_FOUND',
  );

  // Inexistent credential
  assert.throws(
    () => resolver.resolveCredential('org_alpha', 'cred_inexistente'),
    (err) => err?.response?.code === 'RESOURCE_NOT_FOUND',
  );

  // Cross-tenant form
  assert.throws(
    () => resolver.resolveForm('org_alpha', 'form_beta_contact'),
    (err) => err?.response?.code === 'RESOURCE_NOT_FOUND',
  );

  // Unapproved AI model
  assert.throws(
    () => resolver.resolveAiModel('org_alpha', 'modelo_desconhecido_123'),
    (err) => err?.response?.code === 'RESOURCE_NOT_FOUND',
  );

  // Approved AI model
  assert.equal(resolver.resolveAiModel('org_alpha', 'gpt-4o-mini').status, 'ACTIVE');
  assert.equal(resolver.resolveAiModel('org_alpha', 'flowmind-default').status, 'ACTIVE');

  // Tenant credential própria
  assert.equal(resolver.resolveCredential('org_alpha', 'cred_alpha_http').status, 'ACTIVE');
});

test('T03-S3 (SC09): validateWorkflowResources bloqueia workflow com recurso cross-tenant', async () => {
  const { exports: refExports } = await loadTypeScript('apps/api/src/engine/workflow-reference.validation.ts');

  const wf = {
    schemaVersion: '1.0.0',
    id: 'wf_alpha_sc09',
    orgId: 'org_alpha',
    name: 'Workflow Cross Tenant',
    version: 1,
    status: 'DRAFT',
    triggerNodeId: 'form',
    nodes: [
      { id: 'form', type: 'trigger_form', config: { requiredFields: ['name', 'email', 'message'] } },
      { id: 'http', type: 'http_request', config: { url: 'https://api.test', method: 'GET', credentialRef: 'cred_beta_http' } },
    ],
    edges: [{ id: 'e1', sourceNodeId: 'form', targetNodeId: 'http' }],
  };

  assert.throws(
    () => refExports.validateWorkflowResources(wf, refExports.createTestResourceResolver()),
    (err) => err?.response?.code === 'RESOURCE_NOT_FOUND',
  );
});

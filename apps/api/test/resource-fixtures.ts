import type { ResourceRegistration } from '@flowmind/contracts';
import { ConfiguredResourceCatalog } from '../src/resources/resource-catalog';
import { ResourceResolver } from '../src/engine/resource-resolver';

// Somente testes. Esses IDs não aprovam modelos/provedores comerciais.
const modelOrgs = [
  'org_alpha', 'org_beta', 'org_fixture', 'org_synthetic', 'org_eval_test',
  'org_eval_synthetic', 'org_test', 'org-1', 'org_1', 'org_a', 'org_b', 'org1',
  'org_alpha_master', 'org_beta_intruder',
  'org_alpha_enterprise', 'org_beta_competitor',
];
const registrations: ResourceRegistration[] = [
  ...['gpt-4o-mini', 'gpt-4o', 'flowmind-default', 'test-approved-model'].map((id) => ({
    id, type: 'ai_model' as const, name: 'Modelo sintético de teste', status: 'ACTIVE' as const,
    allowedOrgIds: modelOrgs, approval: 'APPROVED' as const, providerModelId: 'synthetic-provider-only',
  })),
  ...['alpha', 'beta', 'fixture'].flatMap((org) => [
    { id: 'cred_' + org + '_http', type: 'credential' as const, orgId: 'org_' + org, name: 'Credencial sintética', status: 'ACTIVE' as const },
    { id: 'cred_' + org + '_webhook', type: 'credential' as const, orgId: 'org_' + org, name: 'Webhook sintético', status: 'ACTIVE' as const },
    { id: 'form_' + org + '_contact', type: 'form' as const, orgId: 'org_' + org, name: 'Formulário sintético', status: 'ACTIVE' as const },
  ]),
  { id: 'cred_alpha_inactive', type: 'credential', orgId: 'org_alpha', name: 'Inativa sintética', status: 'INACTIVE' },
  { id: 'cred_alpha_revoked', type: 'credential', orgId: 'org_alpha', name: 'Revogada sintética', status: 'REVOKED' },
];

export function createTestResourceCatalog(extra: ResourceRegistration[] = []): ConfiguredResourceCatalog {
  const replaced = new Set(extra.map((entry) => entry.id));
  return new ConfiguredResourceCatalog([...registrations.filter((entry) => !replaced.has(entry.id)), ...extra]);
}
export function createTestResourceResolver(extra: ResourceRegistration[] = []): ResourceResolver {
  return new ResourceResolver(createTestResourceCatalog(extra));
}

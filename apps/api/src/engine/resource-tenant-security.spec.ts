import { createTestResourceResolver } from '../../test/resource-fixtures';
import { BadRequestException } from '@nestjs/common';
import type { ResourceRegistration, WorkflowDefinition } from '@flowmind/contracts';
import { validateWorkflowResources } from './workflow-reference.validation';

function rejected(operation: () => unknown) {
  let caught: unknown;
  try { operation(); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(BadRequestException);
  const error = caught as BadRequestException;
  return { status: error.getStatus(), body: error.getResponse() };
}

const resources = [
  { type: 'credential', method: 'resolveCredential', own: 'cred_alpha_http', beta: 'cred_beta_http' },
  { type: 'form', method: 'resolveForm', own: 'form_alpha_contact', beta: 'form_beta_contact' },
] as const;

describe.each(resources)('SEC05 — $type', ({ type, method, own, beta }) => {
  it.each([
    ['org_alpha', own], ['org_beta', beta],
  ])('resolve apenas o recurso próprio de %s', (orgId, ref) => {
    expect(createTestResourceResolver()[method](orgId, ref)).toMatchObject({ id: ref, type, status: 'ACTIVE' });
  });

  it.each([undefined, null, '', ' ', 0, {}])('recusa carregar recurso com organização ausente/inválida %p', (orgId) => {
    expect(() => createTestResourceResolver([
      { id: 'private_unscoped', type, orgId, name: 'PRIVATE_RESOURCE_NAME', status: 'ACTIVE' } as ResourceRegistration,
    ])).toThrow('Configuração de catálogo inválida');
  });

  it.each([undefined, null, '', ' ', 0, {}])('nega contexto de organização inválido %p', (orgId) => {
    const resolver = createTestResourceResolver();
    expect(rejected(() => resolver[method](orgId as string, own))).toMatchObject({
      status: 400, body: { code: 'RESOURCE_NOT_FOUND' },
    });
  });

  it('não distingue recurso inexistente, alheio, alheio inativo/revogado, sem organização ou de outro tipo', () => {
    const resolver = createTestResourceResolver([
      { id: 'foreign_active', type, orgId: 'org_beta', name: 'PRIVATE_RESOURCE_NAME', status: 'ACTIVE' },
      { id: 'foreign_inactive', type, orgId: 'org_beta', name: 'PRIVATE_RESOURCE_NAME', status: 'INACTIVE' },
      { id: 'foreign_revoked', type, orgId: 'org_beta', name: 'PRIVATE_RESOURCE_NAME', status: 'REVOKED' },
      { id: 'wrong_type', type: type === 'credential' ? 'form' : 'credential', orgId: 'org_alpha', name: 'PRIVATE_RESOURCE_NAME', status: 'ACTIVE' },
    ]);
    const absent = rejected(() => resolver[method]('org_alpha', 'unknown_private_ref'));
    expect(absent).toMatchObject({ status: 400, body: { code: 'RESOURCE_NOT_FOUND' } });
    for (const ref of ['foreign_active', 'foreign_inactive', 'foreign_revoked', 'unscoped', 'wrong_type']) {
      const result = rejected(() => resolver[method]('org_alpha', ref));
      expect(result).toEqual(absent);
      const serialized = JSON.stringify(result);
      for (const privateValue of [ref, 'org_alpha', 'org_beta', 'PRIVATE_RESOURCE_NAME']) {
        expect(serialized).not.toContain(privateValue);
      }
    }
  });

  it.each(['INACTIVE', 'REVOKED'] as const)('nega recurso próprio %s com informação de indisponibilidade para o dono', (status) => {
    const resolver = createTestResourceResolver([
      { id: 'own_unavailable', type, orgId: 'org_alpha', name: 'Own synthetic resource', status },
    ]);
    expect(rejected(() => resolver[method]('org_alpha', 'own_unavailable'))).toMatchObject({
      status: 400, body: { code: 'RESOURCE_INACTIVE' },
    });
  });
});

function workflow(credentialRef: string, formId?: string): WorkflowDefinition {
  return {
    schemaVersion: '1.0.0', id: 'wf_security', orgId: 'org_alpha', name: 'Synthetic security fixture',
    version: 1, status: 'DRAFT', triggerNodeId: 'form', createdAt: '', updatedAt: '',
    nodes: [
      { id: 'form', type: 'trigger_form', label: 'Form', position: { x: 0, y: 0 }, config: formId ? { formId } : {} },
      { id: 'http', type: 'http_request', label: 'HTTP', position: { x: 100, y: 0 }, config: { url: 'https://api.example.test', credentialRef } },
    ],
    edges: [{ id: 'form_http', sourceNodeId: 'form', targetNodeId: 'http' }],
  };
}

describe('SEC05 — erro público na validação de workflow', () => {
  it('mantém erro único indistinguível para credencial alheia e inexistente', () => {
    const foreign = rejected(() => validateWorkflowResources(workflow('cred_beta_http'), createTestResourceResolver()));
    const absent = rejected(() => validateWorkflowResources(workflow('unknown_private_ref'), createTestResourceResolver()));
    expect(foreign).toEqual(absent);
    expect(foreign).toMatchObject({ status: 400, body: { code: 'RESOURCE_NOT_FOUND' } });
    expect(JSON.stringify(foreign)).not.toContain('cred_beta_http');
  });

  it('mantém lista de issues indistinguível para vários recursos alheios e inexistentes', () => {
    const foreign = rejected(() => validateWorkflowResources(workflow('cred_beta_http', 'form_beta_contact'), createTestResourceResolver()));
    const absent = rejected(() => validateWorkflowResources(workflow('unknown_credential_ref', 'unknown_form_ref'), createTestResourceResolver()));
    expect(foreign).toEqual(absent);
    expect(foreign).toMatchObject({ status: 400, body: { code: 'WORKFLOW_RESOURCE_ERROR' } });
    const body = foreign.body as { issues: Array<{ code: string }> };
    expect(body.issues).toHaveLength(2);
    expect(body.issues.every(issue => issue.code === 'RESOURCE_NOT_FOUND')).toBe(true);
    expect(JSON.stringify(foreign)).not.toContain('cred_beta_http');
    expect(JSON.stringify(foreign)).not.toContain('form_beta_contact');
  });
});

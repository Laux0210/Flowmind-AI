import { BadRequestException } from '@nestjs/common';
import { ConfiguredResourceCatalog } from './resource-catalog';

const credential = { id: 'cred-a', type: 'credential', orgId: 'alpha', name: 'Credencial A', status: 'ACTIVE' };
const form = { id: 'form-b', type: 'form', orgId: 'beta', name: 'Formulário B', status: 'ACTIVE' };
const model = {
  id: 'test-model', type: 'ai_model', name: 'Modelo sintético', status: 'ACTIVE',
  allowedOrgIds: ['alpha'], approval: 'APPROVED', providerModelId: 'private-provider-id',
};
const make = (entries: unknown[]) => new ConfiguredResourceCatalog(entries as any);
function rejection(action: () => unknown) {
  try { action(); } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return (error as BadRequestException).getResponse();
  }
  throw new Error('A operação deveria ser negada');
}

describe('Catálogo autorizado e público', () => {
  it('lista somente recursos ativos concedidos à organização e omite dados internos', () => {
    const catalog = make([credential, form, model]);
    expect(catalog.list('alpha')).toEqual([
      { id: 'cred-a', type: 'credential', name: 'Credencial A', status: 'ACTIVE' },
      { id: 'test-model', type: 'ai_model', name: 'Modelo sintético', status: 'ACTIVE' },
    ]);
    expect(catalog.list('beta')).toEqual([{ id: 'form-b', type: 'form', name: 'Formulário B', status: 'ACTIVE' }]);
    expect(JSON.stringify(catalog.list('alpha'))).not.toMatch(/private-provider|allowedOrgIds|orgId|approval/);
  });
  it('filtra tipo sem conceder recursos de outro tipo', () => {
    expect(make([credential, model]).list('alpha', 'ai_model')).toEqual([
      { id: 'test-model', type: 'ai_model', name: 'Modelo sintético', status: 'ACTIVE' },
    ]);
  });
  it('configuração vazia retorna lista vazia e nega resolução, sem fixtures implícitas', () => {
    const catalog = make([]);
    expect(catalog.list('alpha')).toEqual([]);
    expect(rejection(() => catalog.resolve('org_alpha', 'cred_alpha_http', 'credential'))).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });
  it.each(['INACTIVE', 'REVOKED'])('não lista nem permite utilizar recurso próprio %s', (status) => {
    const catalog = make([{ ...credential, status }]);
    expect(catalog.list('alpha')).toEqual([]);
    expect(rejection(() => catalog.resolve('alpha', 'cred-a', 'credential'))).toMatchObject({ code: 'RESOURCE_INACTIVE' });
  });
  it('recurso alheio, ausente, tipo errado e contexto inválido produzem a mesma resposta', () => {
    const catalog = make([credential, form]);
    const absent = rejection(() => catalog.resolve('alpha', 'missing', 'credential'));
    for (const [org, ref, type] of [['beta', 'cred-a', 'credential'], ['alpha', 'form-b', 'credential'], ['', 'cred-a', 'credential'], [null, 'cred-a', 'credential']]) {
      expect(rejection(() => catalog.resolve(org as any, ref as string, type as any))).toEqual(absent);
    }
    expect(JSON.stringify(absent)).not.toMatch(/cred-a|form-b|beta/);
  });
  it.each(['', ' ', null, undefined])('não lista com contexto inválido %s', (org) => {
    expect(rejection(() => make([credential]).list(org as any))).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });
  it('compartilha modelo somente por concessão explícita e mantém pendentes privados', () => {
    const catalog = make([
      { ...model, allowedOrgIds: ['alpha', 'beta'] },
      { ...model, id: 'no-grants', allowedOrgIds: [] },
      { ...model, id: 'not-approved', approval: 'PENDING' },
    ]);
    expect(catalog.list('beta').map((item) => item.id)).toEqual(['test-model']);
    expect(catalog.list('gamma')).toEqual([]);
    for (const id of ['no-grants', 'not-approved']) {
      expect(rejection(() => catalog.resolve('alpha', id, 'ai_model'))).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    }
  });
  it('mapeamento explícito do alias exige aprovação e concessão', () => {
    const catalog = make([{ ...model, id: 'flowmind-default' }]);
    expect(catalog.resolve('alpha', 'flowmind-default', 'ai_model').id).toBe('flowmind-default');
    expect(rejection(() => catalog.resolve('beta', 'flowmind-default', 'ai_model'))).toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
  });
  it('não permite que mutações de entrada ou retorno ampliem concessões', () => {
    const entry = { ...model, allowedOrgIds: ['alpha'] };
    const input = [entry];
    const catalog = make(input);
    entry.allowedOrgIds.push('beta'); entry.id = 'mutated'; input.length = 0;
    expect(catalog.list('beta')).toEqual([]);
    const list = catalog.list('alpha');
    try { (list[0] as any).name = 'mutated'; } catch {}
    try { (list as any).push({ ...credential, id: 'injected' }); } catch {}
    expect(catalog.list('alpha')).toEqual([{ id: 'test-model', type: 'ai_model', name: 'Modelo sintético', status: 'ACTIVE' }]);
  });
});

describe('Carga de configuração nega metadados inválidos', () => {
  it.each([
    [null], [{}], [{ ...credential, orgId: '' }], [{ ...credential, orgId: ' ' }],
    [{ ...credential, id: '' }], [{ ...credential, type: 'arbitrary' }],
    [{ ...credential, status: 'unknown' }], [{ ...credential, name: '' }],
    [{ ...credential, secret: 'synthetic-secret' }], [{ ...credential, token: 'synthetic-token' }],
    [{ ...model, allowedOrgIds: undefined }], [{ ...model, allowedOrgIds: [''] }],
    [{ ...model, approval: 'yes' }], [{ ...model, providerModelId: '' }],
    [{ ...model, orgId: 'alpha' }], [{ ...model, id: 'pending' }],
    [{ ...model, id: 'modelo-a-aprovar' }], [credential, { ...form, id: credential.id }],
  ])('recusa configuração inválida sem revelar seu conteúdo %#', (...entries) => {
    expect(() => make(entries)).toThrow('Configuração de catálogo inválida');
  });
});

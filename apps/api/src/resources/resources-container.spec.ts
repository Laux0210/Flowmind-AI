import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkService } from '../auth/clerk.service';
import { AI_CLIENT } from '../ai/ai-client.interface';
import { DeterministicAiClient } from '../ai/deterministic-ai-client';
import { ConfiguredResourceCatalog, RESOURCE_CATALOG } from './resource-catalog';

const entries: any[] = [
  { id: 'form-alpha', type: 'form', name: 'Formulário A', orgId: 'org_alpha', status: 'ACTIVE' },
  { id: 'cred-beta', type: 'credential', name: 'Credencial B', orgId: 'org_beta', status: 'ACTIVE' },
  { id: 'model-shared', type: 'ai_model', name: 'Modelo sintético', status: 'ACTIVE',
    allowedOrgIds: ['org_alpha', 'org_beta'], approval: 'APPROVED', providerModelId: 'PRIVATE_PROVIDER' },
  { id: 'pending-model', type: 'ai_model', name: 'Modelo pendente privado', status: 'ACTIVE',
    allowedOrgIds: ['org_alpha'], approval: 'PENDING', providerModelId: 'PRIVATE_PROVIDER' },
];

describe('R3 — catálogo no AppModule, guard real e HTTP loopback', () => {
  let app: INestApplication;
  let origin: string;
  let catalog: ConfiguredResourceCatalog;
  let unavailable = false;
  const nativeFetch = globalThis.fetch;
  let externalAttempts = 0;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue({})
      .overrideProvider(AI_CLIENT).useValue(new DeterministicAiClient())
      .overrideProvider(ClerkService).useValue({ verifyToken: async (token: string) => {
        if (token === 'unavailable') throw new ServiceUnavailableException('Autoridade indisponível');
        const [org, role] = token.split(':');
        if (!['alpha', 'beta', 'empty'].includes(org) || !['member', 'admin'].includes(role)) throw new UnauthorizedException();
        return { userId: 'synthetic-user', orgId: 'org_' + org, role: 'org:' + role };
      } })
      .overrideProvider(RESOURCE_CATALOG).useValue({
        list: (orgId: string, type?: any) => {
          if (unavailable) throw new Error('PRIVATE_BACKEND_CONFIG');
          return catalog.list(orgId, type);
        },
        resolve: (orgId: string, id: string, type: any) => catalog.resolve(orgId, id, type),
      }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
    origin = 'http://127.0.0.1:' + (app.getHttpServer().address() as AddressInfo).port;
    jest.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (!String(input).startsWith(origin + '/')) { externalAttempts++; throw new Error('Rede externa proibida'); }
      return nativeFetch(input, init);
    });
  });
  beforeEach(() => { catalog = new ConfiguredResourceCatalog(entries); unavailable = false; });
  afterAll(async () => { await app?.close(); jest.restoreAllMocks(); expect(externalAttempts).toBe(0); });

  async function request(token?: string, query = '') {
    const response = await fetch(origin + '/api/v1/resources' + query, {
      headers: { 'x-org-id': 'org_beta', ...(token ? { authorization: 'Bearer ' + token } : {}) },
      signal: AbortSignal.timeout(5000), redirect: 'error',
    });
    return { status: response.status, body: await response.json() as any };
  }

  it.each(['member', 'admin'])('Alpha %s consulta somente seus recursos e concessões, mesmo com tenant forjado', async (role) => {
    const result = await request('alpha:' + role, '?orgId=org_beta');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: true });
    expect(result.body.data.map((item: any) => item.id)).toEqual(['form-alpha', 'model-shared']);
    expect(JSON.stringify(result.body)).not.toMatch(/PRIVATE_PROVIDER|allowedOrgIds|providerModelId|pending-model|Credencial B|org_beta/);
    expect(Object.keys(result.body.data[0]).sort()).toEqual(['id', 'name', 'status', 'type']);
  });
  it('Beta recebe seu recurso e modelo compartilhado', async () => {
    expect((await request('beta:member')).body.data.map((item: any) => item.id)).toEqual(['cred-beta', 'model-shared']);
  });
  it.each(['form', 'credential', 'ai_model'])('aplica filtro %s', async (type) => {
    const result = await request('alpha:member', '?type=' + type);
    expect(result.status).toBe(200);
    expect(result.body.data.every((item: any) => item.type === type)).toBe(true);
    expect(result.body.data).toHaveLength(type === 'credential' ? 0 : 1);
  });
  it.each(['unknown', 'form&type=credential'])('recusa filtro inválido/repetido %s', async (query) => {
    expect((await request('alpha:member', '?type=' + query)).status).toBe(400);
  });
  it.each([undefined, 'invalid:member'])('nega identidade ausente/inválida %s', async (token) => {
    expect((await request(token)).status).toBe(401);
  });
  it('falha de autoridade não concede acesso', async () => {
    expect((await request('unavailable')).status).toBe(503);
  });
  it('catálogo vazio válido é sucesso explícito, sem fixtures de produção', async () => {
    catalog = new ConfiguredResourceCatalog([]);
    expect((await request('alpha:member')).body).toMatchObject({ success: true, data: [] });
  });
  it('organização sem concessões não recebe fallback global', async () => {
    expect((await request('empty:member')).body).toMatchObject({ success: true, data: [] });
  });
  it('falha do catálogo é indisponibilidade, sem sucesso vazio nem detalhe privado', async () => {
    unavailable = true;
    const result = await request('alpha:member');
    expect(result.status).toBe(503);
    expect(result.body.code).toBe('RESOURCE_CATALOG_UNAVAILABLE');
    expect(JSON.stringify(result.body)).not.toContain('PRIVATE_BACKEND_CONFIG');
  });
});

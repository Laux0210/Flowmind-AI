import 'reflect-metadata';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';
import { Server } from 'node:net';
import type { Socket } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowsModule } from '../workflows/workflows.module';
import { ClerkService } from './clerk.service';

// Container, Express, guards e serviços reais; identidade e storage sintéticos.
// O transporte usa streams em memória. Nenhum listen, fetch ou conexão externa.
describe('T06 — container Nest e requisições em memória', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let listen: jest.SpyInstance;
  const rows = new Map<string, any>();
  const snapshots: any[] = [];
  const writes = jest.fn();
  let sequence = 0;
  const matches = (row: any, where: any) => row &&
    Object.entries(where).every(([key, value]) => row[key] === value);
  const prisma = {
    organization: { upsert: jest.fn() },
    workflow: {
      findMany: jest.fn(async ({ where }: any) => [...rows.values()].filter((row) => matches(row, where))),
      findFirst: jest.fn(async ({ where }: any) => [...rows.values()].find((row) => matches(row, where)) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const row = { ...data, id: `wf_created_${++sequence}`, createdAt: new Date(), updatedAt: new Date() };
        rows.set(row.id, row); writes(); return row;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const row = [...rows.values()].find((candidate) => matches(candidate, where));
        if (!row) return { count: 0 };
        Object.assign(row, data, { updatedAt: new Date() }); writes(); return { count: 1 };
      }),
    },
    workflowVersion: { create: jest.fn(async ({ data }: any) => {
      const snapshot = { id: 'snapshot_fixture', ...data }; snapshots.push(snapshot); writes(); return snapshot;
    }) },
    $transaction: async (operation: (tx: any) => Promise<any>) => operation(prisma),
  };

  beforeAll(async () => {
    listen = jest.spyOn(Server.prototype, 'listen').mockImplementation(() => {
      throw new Error('Portas são proibidas neste teste');
    });
    moduleRef = await Test.createTestingModule({ imports: [PrismaModule, WorkflowsModule] })
      .overrideProvider(PrismaService).useValue(prisma).compile();
    // Mantém construtor/DI reais do Clerk, substituindo somente a verificação remota.
    jest.spyOn(moduleRef.get(ClerkService), 'verifyToken').mockImplementation(async (token) => {
      const [org, role] = token.split(':');
      if (!['alpha', 'beta'].includes(org) || !['admin', 'member'].includes(role)) {
        throw new UnauthorizedException();
      }
      return { userId: `user_${org}_${role}`, orgId: `org_${org}`,
        sessionId: `session_${org}`, orgRole: `org:${role}` };
    });
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  beforeEach(() => {
    rows.clear(); snapshots.length = 0; sequence = 0; writes.mockClear();
    for (const org of ['alpha', 'beta']) rows.set(`wf_${org}`, {
      id: `wf_${org}`, orgId: `org_${org}`, name: `Fixture ${org}`,
      schemaVersion: '1.0.0', version: 1, status: 'DRAFT', triggerNodeId: 'form',
      nodes: [{ id: 'form', type: 'trigger_form', label: 'Form', position: { x: 0, y: 0 }, config: {} }],
      edges: [], reviewedBy: null, reviewedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    await app?.close();
    jest.restoreAllMocks();
  });

  async function request(method: string, path: string, token?: string, body?: unknown) {
    const socket = new Duplex({
      read() {},
      write(_chunk, _encoding, callback) { callback(); },
    });
    const req = new IncomingMessage(socket as Socket);
    req.method = method; req.url = `/api/v1${path}`;
    req.httpVersion = '1.1'; req.httpVersionMajor = 1; req.httpVersionMinor = 1;
    req.headers = { host: 'localhost', 'x-org-id': 'org_beta',
      ...(token ? { authorization: `Bearer ${token}` } : {}) };
    const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
    if (payload) {
      req.headers['content-type'] = 'application/json';
      req.headers['content-length'] = String(payload.length);
      req.push(payload);
    }
    req.push(null); req.complete = true;
    const res = new ServerResponse(req);
    res.assignSocket(socket as Socket);
    const chunks: Buffer[] = [];
    const nativeEnd = res.end.bind(res);
    // Express troca protótipos; estes overrides são propriedades próprias.
    Object.defineProperty(res, 'write', { value: (chunk: any, encoding?: any, callback?: any) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding as BufferEncoding : undefined));
      if (typeof encoding === 'function') encoding();
      if (typeof callback === 'function') callback();
      return true;
    } });
    Object.defineProperty(res, 'end', { value: (chunk?: any, encoding?: any) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding as BufferEncoding : undefined));
      return nativeEnd();
    } });
    return new Promise<{ status: number; body: any }>((resolve, reject) => {
      const timer = setTimeout(() => { socket.destroy(); reject(new Error('Resposta não finalizou')); }, 3000);
      res.once('finish', () => {
        clearTimeout(timer);
        const content = Buffer.concat(chunks).toString('utf8');
        socket.destroy();
        try { resolve({ status: res.statusCode, body: content ? JSON.parse(content) : undefined }); }
        catch (error) { reject(error); }
      });
      res.once('error', (error) => { clearTimeout(timer); socket.destroy(); reject(error); });
      app.getHttpServer().emit('request', req, res);
    });
  }

  it('monta providers reais sem conectar Prisma ou abrir portas', () => {
    expect(moduleRef.get(PrismaService)).toBe(prisma);
    expect(moduleRef.get(ClerkService)).toBeInstanceOf(ClerkService);
    expect(app.getHttpServer().listening).toBe(false);
    expect(listen).not.toHaveBeenCalled();
  });

  it('requisição sem token ou token inválido retorna 401, sem mutações', async () => {
    expect((await request('GET', '/workflows')).status).toBe(401);
    expect((await request('GET', '/workflows', 'invalid')).status).toBe(401);
    expect(writes).not.toHaveBeenCalled();
  });

  it('recupera recursos próprios de Alpha/Beta e nega acesso cruzado, ignorando x-org-id', async () => {
    const alpha = await request('GET', '/workflows/wf_alpha', 'alpha:member');
    expect(alpha.status).toBe(200); expect(alpha.body.data.orgId).toBe('org_alpha');
    const beta = await request('GET', '/workflows/wf_beta', 'beta:member');
    expect(beta.status).toBe(200); expect(beta.body.data.orgId).toBe('org_beta');
    expect((await request('GET', '/workflows/wf_beta', 'alpha:admin')).status).toBe(404);
    expect((await request('GET', '/workflows/wf_alpha', 'beta:admin')).status).toBe(404);
    const list = await request('GET', '/workflows', 'alpha:member');
    expect(list.body.data.map((row: any) => row.id)).toEqual(['wf_alpha']);
  });

  it('JSON do cliente não escolhe a organização ao criar rascunho', async () => {
    const created = await request('POST', '/workflows', 'alpha:member', { name: 'Fixture nova', orgId: 'org_beta' });
    expect(created.status).toBe(201);
    expect(created.body.data.orgId).toBe('org_alpha');
    expect(rows.get('wf_beta').status).toBe('DRAFT');
  });

  it('admin de Beta não revisa, ativa ou simula recurso de Alpha', async () => {
    for (const action of ['review', 'activate', 'simulate']) {
      expect((await request('POST', `/workflows/wf_alpha/${action}`, 'beta:admin', {
        initialPayload: { name: 'Pessoa', email: 'pessoa@example.test', message: 'Fixture' },
      })).status).toBe(404);
    }
    expect(writes).not.toHaveBeenCalled();
    expect(rows.get('wf_alpha').status).toBe('DRAFT');
    expect(snapshots).toEqual([]);
  });

  it('member não revisa, ativa ou desativa; guards negam antes de escrever', async () => {
    for (const action of ['review', 'activate', 'deactivate']) {
      expect((await request('POST', `/workflows/wf_alpha/${action}`, 'alpha:member')).status).toBe(403);
    }
    expect(writes).not.toHaveBeenCalled(); expect(snapshots).toEqual([]);
  });

  it('admin revisa e ativa com identidade do contexto e snapshot persistido no fake', async () => {
    const reviewed = await request('POST', '/workflows/wf_alpha/review', 'alpha:admin');
    expect(reviewed.status).toBe(201);
    expect(reviewed.body.data.workflow.reviewedBy).toBe('user_alpha_admin');
    const activated = await request('POST', '/workflows/wf_alpha/activate', 'alpha:admin');
    expect(activated.status).toBe(201); expect(activated.body.data.workflow.status).toBe('PUBLISHED');
    expect(snapshots[0].publishedBy).toBe('user_alpha_admin');
    expect(rows.get('wf_beta').status).toBe('DRAFT');
  });

  it('admin recebe 400 para definição de e-mail sem destinatário, sem revisão', async () => {
    const row = rows.get('wf_alpha');
    row.nodes.push({ id: 'mail', type: 'send_email', label: 'Mail', position: { x: 100, y: 0 }, config: {} });
    row.edges.push({ id: 'e1', sourceNodeId: 'form', targetNodeId: 'mail' });
    const result = await request('POST', '/workflows/wf_alpha/review', 'alpha:admin');
    expect(result.status).toBe(400); expect(result.body.code).toBe('INVALID_EMAIL_RECIPIENT');
    expect(writes).not.toHaveBeenCalled(); expect(row.status).toBe('DRAFT');
  });
});

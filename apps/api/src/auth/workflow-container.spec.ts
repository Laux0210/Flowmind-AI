import 'reflect-metadata';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';
import { Server } from 'node:net';
import type { AddressInfo, Socket } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ClerkService } from './clerk.service';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import { AppModule } from '../app.module';
import { AI_CLIENT } from '../ai/ai-client.interface';
import { DeterministicAiClient } from '../ai/deterministic-ai-client';
import { RESOURCE_CATALOG } from '../resources/resource-catalog';
import { createTestResourceCatalog } from '../../test/resource-fixtures';

// Container, Express, guards e serviços reais; identidade, storage e IA sintéticos.
// Mesmos casos em streams e HTTP TCP local; nenhuma integração externa autorizada.
describe.each(['memory', 'tcp'] as const)('T06/T14 — container Nest (%s)', (transport) => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let listen: jest.SpyInstance;
  let origin: string | undefined;
  let externalFetchAttempts = 0;
  const rows = new Map<string, any>();
  const snapshots: any[] = [];
  const executionRows: any[] = [];
  const writes = jest.fn();
  const generation = jest.fn(async (prompt: string, orgId: string) => new DeterministicAiClient().generateWorkflow(prompt, orgId));
  let sequence = 0;
  const matches = (row: any, where: any) => row &&
    Object.entries(where).every(([key, value]: any) =>
      key === 'workflow' ? (row.workflow ?? rows.get(row.workflowId))?.orgId === value.orgId : row[key] === value);
  const prisma = {
    $queryRaw: jest.fn(),
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
    workflowExecution: {
      findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: data.id || 'exec_fixture', ...data };
        executionRows.push(row); writes(); return row;
      }),
    },
    $transaction: async (operation: (tx: any) => Promise<any>) => operation(prisma),
  };

  beforeAll(async () => {
    const nativeListen = Server.prototype.listen;
    listen = jest.spyOn(Server.prototype, 'listen').mockImplementation(function (this: Server, ...args: any[]) {
      if (transport !== 'tcp' || this !== app?.getHttpServer() || args[0] !== 0 || args[1] !== '127.0.0.1') {
        throw new Error('Somente a porta efêmera local deste teste é permitida');
      }
      return Reflect.apply(nativeListen, this, args);
    });
    const nativeFetch = globalThis.fetch;
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
      if (transport !== 'tcp' || !origin || url.origin !== origin || !url.pathname.startsWith('/api/v1/')) {
        externalFetchAttempts += 1;
        throw new Error('Requisições externas são proibidas neste teste');
      }
      return nativeFetch(input, { ...init, redirect: 'error' });
    });
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RESOURCE_CATALOG).useValue(createTestResourceCatalog())
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(AI_CLIENT).useValue({ generateWorkflow: generation }).compile();
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
    if (transport === 'tcp') {
      await app.listen(0, '127.0.0.1');
      const address = app.getHttpServer().address() as AddressInfo;
      expect(address.address).toBe('127.0.0.1');
      expect(address.port).toBeGreaterThan(0);
      origin = `http://127.0.0.1:${address.port}`;
    }
    expect(externalFetchAttempts).toBe(0);
  });

  beforeEach(() => {
    externalFetchAttempts = 0;
    rows.clear(); snapshots.length = 0; sequence = 0; writes.mockClear();
    prisma.workflow.findFirst.mockClear();
    generation.mockClear();
    executionRows.length = 0;
    prisma.$queryRaw.mockReset().mockResolvedValue([{ result: 1 }]);
    prisma.workflowExecution.findMany.mockReset().mockImplementation(async ({ where, take }: any) =>
      executionRows.filter((row) => matches(row, where)).slice(0, take));
    prisma.workflowExecution.findFirst.mockReset().mockImplementation(async ({ where }: any) =>
      executionRows.find((row) => matches(row, where)) ?? null);
    prisma.workflowExecution.count.mockReset().mockImplementation(async ({ where }: any) =>
      executionRows.filter((row) => row.orgId === where.orgId).length);
    for (const org of ['alpha', 'beta']) {
      rows.set(`wf_${org}`, {
      id: `wf_${org}`, orgId: `org_${org}`, name: `Fixture ${org}`,
      schemaVersion: '1.0.0', version: 1, status: 'DRAFT', triggerNodeId: 'form',
      nodes: [{ id: 'form', type: 'trigger_form', label: 'Form', position: { x: 0, y: 0 }, config: {} }],
      edges: [], reviewedBy: null, reviewedAt: null,
      createdAt: new Date(), updatedAt: new Date(),
      });
      executionRows.push({ id: `exec_${org}`, orgId: `org_${org}`, workflowId: `wf_${org}`, workflowVersion: 1,
        workflow: { name: `Fixture ${org}`, orgId: `org_${org}` }, mode: 'SIMULATION', status: 'COMPLETED',
        triggeredBy: `user_${org}`, nodeResults: [], startedAt: new Date(), completedAt: new Date() });
    }
  });

  afterEach(() => {
    expect(externalFetchAttempts).toBe(0);
  });

  afterAll(async () => {
    try {
      await app?.close();
      expect(app?.getHttpServer().listening).toBe(false);
    } finally {
      jest.restoreAllMocks();
    }
  });

  async function request(method: string, path: string, token?: string, body?: unknown) {
    if (transport === 'tcp') {
      const response = await fetch(`${origin}/api/v1${path}`, {
        method,
        headers: {
          'x-org-id': 'org_beta',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
        redirect: 'error',
      });
      const content = await response.text();
      return { status: response.status, body: content ? JSON.parse(content) : undefined };
    }
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

  it('monta providers reais com storage sintético e transporte restrito', () => {
    expect(moduleRef.get(PrismaService)).toBe(prisma);
    expect(moduleRef.get(ClerkService)).toBeInstanceOf(ClerkService);
    expect(app.getHttpServer().listening).toBe(transport === 'tcp');
    if (transport === 'memory') expect(listen).not.toHaveBeenCalled();
    else expect(app.getHttpServer().address()).toMatchObject({ address: '127.0.0.1' });
  });

  it('liveness responde 200 sem consultar o banco', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('db_private_fixture'));
    const result = await request('GET', '/health');
    expect(result.status).toBe(200); expect(result.body.status).toBe('ok');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('readiness responde 200 apenas após consulta bem-sucedida', async () => {
    const result = await request('GET', '/health/ready');
    expect(result.status).toBe(200); expect(result.body).toMatchObject({ status: 'ready', database: 'connected' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('readiness responde 503 com banco indisponível e oculta detalhes internos', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('db_private_fixture'));
    const result = await request('GET', '/health/ready');
    expect(result.status).toBe(503); expect(result.body).toMatchObject({ status: 'not_ready', database: 'unavailable' });
    expect(JSON.stringify(result.body)).not.toContain('db_private_fixture');
  });

  it('requisição sem token ou token inválido retorna 401, sem mutações', async () => {
    expect((await request('GET', '/workflows')).status).toBe(401);
    expect((await request('GET', '/workflows', 'invalid')).status).toBe(401);
    expect(writes).not.toHaveBeenCalled();
  });

  it('geração usa prefixo único, adaptador injetado e contexto autenticado de Alpha/Beta', async () => {
    const prompt = 'Receba formulário de contato e resuma a mensagem';
    for (const org of ['alpha', 'beta']) {
      const result = await request('POST', '/ai/generate-workflow', `${org}:member`, { prompt, orgId: 'org_alheia' });
      expect(result.status).toBe(200); expect(result.body.data.requiresHumanReview).toBe(true);
      expect(generation).toHaveBeenLastCalledWith(prompt, `org_${org}`);
    }
    expect(writes).not.toHaveBeenCalled();
  });

  it('geração sem identidade válida retorna 401 antes do adaptador', async () => {
    for (const token of [undefined, 'invalid']) {
      expect((await request('POST', '/ai/generate-workflow', token, { prompt: 'Fixture longa' })).status).toBe(401);
    }
    expect(generation).not.toHaveBeenCalled();
  });

  it('histórico e consumo usam prefixo único e sessão da organização ativa', async () => {
    for (const org of ['alpha', 'beta']) {
      const list = await request('GET', '/executions', `${org}:member`);
      expect(list.status).toBe(200);
      expect(list.body.data.map((row: any) => row.id)).toEqual([`exec_${org}`]);
      const detail = await request('GET', `/executions/exec_${org}`, `${org}:member`);
      expect(detail.status).toBe(200); expect(detail.body.data.orgId).toBe(`org_${org}`);
      const usage = await request('GET', '/executions/usage', `${org}:member`);
      expect(usage.status).toBe(200); expect(usage.body.data.orgId).toBe(`org_${org}`);
      expect(usage.body.data.estimatedTokensConsumed).toBeNull();
    }
  });

  it('histórico nega acesso cruzado e exige autenticação', async () => {
    expect((await request('GET', '/executions')).status).toBe(401);
    expect((await request('GET', '/executions/exec_beta', 'alpha:member')).status).toBe(404);
    expect((await request('GET', '/executions/exec_alpha', 'beta:member')).status).toBe(404);
  });

  // Verifica o protótipo de captura preservado; não aprova sua política de cota.
  it.each(['alpha', 'beta'])('simulação de %s mantém ID/autoria e é consultável apenas na organização própria', async (org) => {
    const other = org === 'alpha' ? 'beta' : 'alpha';
    const result = await request('POST', `/workflows/wf_${org}/simulate`, `${org}:member`, {
      orgId: `org_${other}`, userId: 'user_spoof', triggeredBy: 'user_spoof',
      initialPayload: { name: 'Fixture', email: 'fixture@example.test', message: 'Contato sintético' },
    });
    expect(result.status).toBe(201);
    expect(result.body.data.status).toBe('COMPLETED');
    const id = result.body.data.executionId;
    const stored = executionRows.find((row) => row.id === id);
    expect(stored).toMatchObject({
      orgId: `org_${org}`, workflowId: `wf_${org}`, workflowVersion: 1,
      mode: 'SIMULATION', status: 'COMPLETED', triggeredBy: `user_${org}_member`,
    });
    const detail = await request('GET', `/executions/${id}`, `${org}:member`);
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({ id, triggeredBy: `user_${org}_member`, orgId: `org_${org}` });
    const ownList = await request('GET', '/executions', `${org}:member`);
    expect(ownList.body.data.map((row: any) => row.id)).toContain(id);
    expect((await request('GET', `/executions/${id}`, `${other}:member`)).status).toBe(404);
    const foreignList = await request('GET', '/executions', `${other}:member`);
    expect(foreignList.body.data.map((row: any) => row.id)).not.toContain(id);
  });

  it('simulação com entrada incompleta persiste FAILED sem efeitos de negócio', async () => {
    rows.get('wf_alpha').nodes[0].config = { requiredFields: ['email'] };
    const result = await request('POST', '/workflows/wf_alpha/simulate', 'alpha:member', { initialPayload: {} });
    expect(result.status).toBe(201);
    expect(result.body.data.status).toBe('FAILED');
    const detail = await request('GET', `/executions/${result.body.data.executionId}`, 'alpha:member');
    expect(detail.status).toBe(200);
    expect(detail.body.data.status).toBe('FAILED');
    expect(detail.body.data.nodeResults).toHaveLength(1);
    expect(detail.body.data.nodeResults[0]).toMatchObject({ nodeId: 'form', status: 'FAILED' });
    expect(snapshots).toHaveLength(0);
  });

  it('falha ao capturar a simulação retorna 503 sem histórico fictício ou detalhe privado', async () => {
    const before = executionRows.length;
    prisma.workflowExecution.create.mockRejectedValueOnce(new Error('private_write_fixture'));
    const result = await request('POST', '/workflows/wf_alpha/simulate', 'alpha:member', { initialPayload: {} });
    expect(result.status).toBe(503);
    expect(result.body).toMatchObject({ code: 'EXECUTION_STORAGE_UNAVAILABLE' });
    expect(JSON.stringify(result.body)).not.toContain('private_write_fixture');
    expect(executionRows).toHaveLength(before);
  });

  it.each(['abc', '-1', '0', '1.5', '1abc', 'Infinity'])('limit=%s retorna 400 antes da consulta', async (limit) => {
    const result = await request('GET', `/executions?limit=${limit}`, 'alpha:member');
    expect(result.status).toBe(400); expect(result.body.code).toBe('INVALID_EXECUTION_LIMIT');
    expect(prisma.workflowExecution.findMany).not.toHaveBeenCalled();
  });

  it('limit inteiro positivo mantém o isolamento da listagem', async () => {
    const result = await request('GET', '/executions?limit=1', 'alpha:member');
    expect(result.status).toBe(200); expect(result.body.data.map((row: any) => row.id)).toEqual(['exec_alpha']);
    expect(prisma.workflowExecution.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 1 }));
  });

  it('ingresso público não configurado responde 503 sem consultar ou simular recursos', async () => {
    const simulation = jest.spyOn(moduleRef.get(WorkflowEngineService), 'simulate');
    try {
      for (const workflowId of ['wf_alpha', 'wf_beta', 'missing']) {
        const result = await request('POST', `/triggers/webhook/${workflowId}`, undefined, { secret: 'fixture', orgId: 'org_beta' });
        expect(result.status).toBe(503); expect(result.body.code).toBe('WEBHOOK_NOT_CONFIGURED');
        expect(JSON.stringify(result.body)).not.toContain('Fixture');
      }
      expect(prisma.workflow.findFirst).not.toHaveBeenCalled();
      expect(simulation).not.toHaveBeenCalled(); expect(writes).not.toHaveBeenCalled();
    } finally { simulation.mockRestore(); }
  });

  it.each([['/executions', 'findMany'], ['/executions/exec_alpha', 'findFirst'], ['/executions/usage', 'count']])(
    'indisponibilidade de %s responde 503 sem detalhes internos', async (path, method) => {
      prisma.workflowExecution[method as keyof typeof prisma.workflowExecution].mockRejectedValue(new Error('private_db_fixture'));
      const result = await request('GET', path, 'alpha:member');
      expect(result.status).toBe(503); expect(JSON.stringify(result.body)).not.toContain('private_db_fixture');
    },
  );

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
    const simulation = jest.spyOn(moduleRef.get(WorkflowEngineService), 'simulate');
    for (const action of ['review', 'activate', 'simulate']) {
      expect((await request('POST', `/workflows/wf_alpha/${action}`, 'beta:admin', {
        initialPayload: { name: 'Pessoa', email: 'pessoa@example.test', message: 'Fixture' },
      })).status).toBe(404);
    }
    expect(writes).not.toHaveBeenCalled();
    expect(simulation).not.toHaveBeenCalled();
    expect(rows.get('wf_alpha').status).toBe('DRAFT');
    expect(snapshots).toEqual([]);
    simulation.mockRestore();
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

  it('member salva e reabre parâmetros, posições e handles sem perder IDs', async () => {
    const nodes = [
      { id: 'form', type: 'trigger_form', label: 'Formulário', position: { x: 12, y: 24 }, config: {} },
      { id: 'check', type: 'condition', label: 'Condição', position: { x: 120, y: 180 }, config: { leftOperand: 2, operator: 'equals', rightOperand: 2 } },
      { id: 'mail', type: 'send_email', label: 'Resposta editada', position: { x: 250, y: 300 }, config: { to: '{{form.contact_email}}', subject: 'Novo assunto', bodyTemplate: 'Mensagem sintética', replyTo: '' } },
    ];
    const edges = [
      { id: 'form_check', sourceNodeId: 'form', targetNodeId: 'check' },
      { id: 'branch', sourceNodeId: 'check', targetNodeId: 'mail', sourceHandle: 'true', targetHandle: 'legacy_target' },
    ];
    const saved = await request('PUT', '/workflows/wf_alpha', 'alpha:member', { nodes, edges, triggerNodeId: 'form' });
    expect(saved.status).toBe(200);
    const reloaded = await request('GET', '/workflows/wf_alpha', 'alpha:member');
    expect(reloaded.status).toBe(200);
    expect(reloaded.body.data).toMatchObject({ id: 'wf_alpha', orgId: 'org_alpha', status: 'DRAFT', triggerNodeId: 'form', nodes, edges });
    expect(rows.get('wf_beta').nodes).toHaveLength(1);
  });

  it('edição de definição publicada retorna 400 antes de mutações', async () => {
    rows.get('wf_alpha').status = 'PUBLISHED';
    const result = await request('PUT', '/workflows/wf_alpha', 'alpha:member', { nodes: rows.get('wf_alpha').nodes });
    expect(result.status).toBe(400); expect(writes).not.toHaveBeenCalled();
    expect(rows.get('wf_alpha').status).toBe('PUBLISHED');
  });

  describe.each(['alpha', 'beta'] as const)('SEC05 — recursos da organização %s', (org) => {
    it.each(['review', 'activate'] as const)('%s não distingue credencial alheia e inexistente e não escreve', async (action) => {
      const row = rows.get(`wf_${org}`);
      if (action === 'activate') Object.assign(row, { status: 'REVIEWED', reviewedBy: `user_${org}_admin`, reviewedAt: new Date() });
      row.nodes.push({ id: 'http', type: 'http_request', label: 'HTTP', position: { x: 100, y: 0 }, config: { url: 'https://api.example.test', method: 'GET' } });
      row.edges.push({ id: 'form_http', sourceNodeId: 'form', targetNodeId: 'http' });
      const foreignOrg = org === 'alpha' ? 'beta' : 'alpha';
      row.nodes[1].config.credentialRef = `cred_${foreignOrg}_http`;
      const before = structuredClone(row);
      const foreign = await request('POST', `/workflows/wf_${org}/${action}`, `${org}:admin`);
      expect(foreign.status).toBe(400);
      expect(foreign.body.code).toBe('RESOURCE_NOT_FOUND');
      expect(row).toEqual(before);
      row.nodes[1].config.credentialRef = 'unknown_private_credential';
      const absent = await request('POST', `/workflows/wf_${org}/${action}`, `${org}:admin`);
      expect(absent).toEqual(foreign);
      expect(JSON.stringify(foreign.body)).not.toContain(`cred_${foreignOrg}_http`);
      expect(writes).not.toHaveBeenCalled(); expect(snapshots).toEqual([]);
    });

    it.each(['review', 'activate'] as const)('%s não distingue formulário alheio e inexistente e não escreve', async (action) => {
      const row = rows.get(`wf_${org}`);
      if (action === 'activate') Object.assign(row, { status: 'REVIEWED', reviewedBy: `user_${org}_admin`, reviewedAt: new Date() });
      const foreignOrg = org === 'alpha' ? 'beta' : 'alpha';
      row.nodes[0].config.formId = `form_${foreignOrg}_contact`;
      const before = structuredClone(row);
      const foreign = await request('POST', `/workflows/wf_${org}/${action}`, `${org}:admin`);
      expect(foreign.status).toBe(400);
      expect(foreign.body.code).toBe('RESOURCE_NOT_FOUND');
      expect(row).toEqual(before);
      row.nodes[0].config.formId = 'unknown_private_form';
      const absent = await request('POST', `/workflows/wf_${org}/${action}`, `${org}:admin`);
      expect(absent).toEqual(foreign);
      expect(JSON.stringify(foreign.body)).not.toContain(`form_${foreignOrg}_contact`);
      expect(writes).not.toHaveBeenCalled(); expect(snapshots).toEqual([]);
    });

    it('revisa e ativa somente com formulário e credencial próprios', async () => {
      const row = rows.get(`wf_${org}`);
      row.nodes[0].config.formId = `form_${org}_contact`;
      row.nodes.push({ id: 'http', type: 'http_request', label: 'HTTP', position: { x: 100, y: 0 }, config: { url: 'https://api.example.test', method: 'GET', credentialRef: `cred_${org}_http` } });
      row.edges.push({ id: 'form_http', sourceNodeId: 'form', targetNodeId: 'http' });
      const review = await request('POST', `/workflows/wf_${org}/review`, `${org}:admin`);
      expect(review.status).toBe(201); expect(review.body.data.workflow.status).toBe('REVIEWED');
      const active = await request('POST', `/workflows/wf_${org}/activate`, `${org}:admin`);
      expect(active.status).toBe(201); expect(active.body.data.workflow.status).toBe('PUBLISHED');
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].workflowId).toBe(`wf_${org}`);
      expect(rows.get(`wf_${org === 'alpha' ? 'beta' : 'alpha'}`).status).toBe('DRAFT');
    });
  });
});

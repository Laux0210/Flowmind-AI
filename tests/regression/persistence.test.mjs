import assert from 'node:assert/strict';
import test from 'node:test';
import { loadTypeScript } from './load-typescript.mjs';

async function fixture() {
  const rows = new Map();
  const calls = [];
  const delegate = {
    create: async ({ data }) => {
      const row = { ...data, id: `wf_${rows.size + 1}`, createdAt: new Date(), updatedAt: new Date() };
      rows.set(row.id, row);
      return row;
    },
    findMany: async ({ where }) => Array.from(rows.values()).filter((row) => row.orgId === where.orgId),
    findFirst: async ({ where }) => {
      const row = rows.get(where.id);
      return row?.orgId === where.orgId ? row : null;
    },
    updateMany: async ({ where, data }) => {
      calls.push({ operation: 'update', where });
      const row = rows.get(where.id);
      if (row?.orgId !== where.orgId) return { count: 0 };
      rows.set(row.id, { ...row, ...data });
      return { count: 1 };
    },
    deleteMany: async ({ where }) => {
      calls.push({ operation: 'delete', where });
      const row = rows.get(where.id);
      if (row?.orgId !== where.orgId) return { count: 0 };
      rows.delete(row.id);
      return { count: 1 };
    },
  };
  let simulations = 0;
  const { exports } = await loadTypeScript('apps/api/src/workflows/workflows.service.ts', {
    modules: { 'apps/api/src/prisma/prisma.service.ts': { PrismaService: class {} } },
  });
  const prisma = { workflow: delegate };
  prisma.$transaction = async (operation) => operation(prisma);
  const executionsService = {
    recordExecution: async (_orgId, _workflowId, _version, _mode, _status, _userId, _nodeResults, _startedAt, _completedAt, executionId) => ({
      id: executionId || 'sim_persisted',
    }),
  };
  const service = new exports.WorkflowsService(
    prisma,
    { simulate: async () => { simulations++; return { status: 'COMPLETED', totalDurationMs: 10, nodeResults: [], executionId: 'sim_1' }; } },
    exports.createTestResourceResolver(),
    executionsService,
  );
  return { service, delegate, rows, calls, simulations: () => simulations };
}

test('CRUD consulta fonte persistente e isola operações entre organizações com adaptador fake', async () => {
  const fixtureData = await fixture();
  const { service, calls } = fixtureData;
  const alpha = await service.create('org_alpha', { name: 'Alpha', orgId: 'org_beta' });
  await service.create('org_beta', { name: 'Beta' });
  assert.equal(alpha.orgId, 'org_alpha');
  assert.equal(alpha.schemaVersion, '1.0.0');
  assert.equal((await service.findAll('org_alpha')).length, 1);
  await assert.rejects(service.findOne('org_beta', alpha.id), /não encontrado/);
  await assert.rejects(service.update('org_beta', alpha.id, { name: 'Invasão' }), /não encontrado/);
  await assert.rejects(service.remove('org_beta', alpha.id), /não encontrado/);
  await assert.rejects(service.simulate('org_beta', alpha.id, { initialPayload: {} }), /não encontrado/);
  assert.equal(fixtureData.simulations(), 0);
  await service.update('org_alpha', alpha.id, { name: 'Atualizado', nodes: [], edges: [] });
  assert.equal((await service.findOne('org_alpha', alpha.id)).name, 'Atualizado');
  for (const call of calls) assert.ok(call.where.id && call.where.orgId);
  await service.remove('org_alpha', alpha.id);
  await assert.rejects(service.findOne('org_alpha', alpha.id), /não encontrado/);
});

test('falha do banco não vira sucesso em memória em nenhuma operação', async () => {
  const { service, delegate } = await fixture();
  const saved = await service.create('org_alpha', { name: 'Teste' });
  const fail = async () => { throw new Error('database unavailable fixture'); };
  delegate.create = fail;
  await assert.rejects(service.create('org_alpha', { name: 'Não persistido' }), /database unavailable/);
  delegate.findMany = fail;
  await assert.rejects(service.findAll('org_alpha'), /database unavailable/);
  delegate.updateMany = fail;
  await assert.rejects(service.update('org_alpha', saved.id, { name: 'Não salvo' }), /database unavailable/);
  delegate.deleteMany = fail;
  await assert.rejects(service.remove('org_alpha', saved.id), /database unavailable/);
  delegate.findFirst = fail;
  await assert.rejects(service.findOne('org_alpha', saved.id), /database unavailable/);
});

test('consulta não retorna cópia obsoleta depois de remoção na fonte', async () => {
  const { service, rows } = await fixture();
  const saved = await service.create('org_alpha', { name: 'Teste' });
  rows.delete(saved.id);
  await assert.rejects(service.findOne('org_alpha', saved.id), /não encontrado/);
  assert.equal((await service.findAll('org_alpha')).length, 0);
});

test('edição de versão publicada fica bloqueada até contrato de novas revisões', async () => {
  const { service, rows } = await fixture();
  const saved = await service.create('org_alpha', { name: 'Teste' });
  rows.get(saved.id).status = 'PUBLISHED';
  await assert.rejects(service.update('org_alpha', saved.id, { name: 'Mutação de versão' }), /novas revisões/);
});

test('exclusão de versão publicada fica bloqueada exigindo desativação prévia', async () => {
  const { service, rows } = await fixture();
  const saved = await service.create('org_alpha', { name: 'Teste Ativo' });
  rows.get(saved.id).status = 'PUBLISHED';
  await assert.rejects(service.remove('org_alpha', saved.id), /Não é permitido excluir um workflow ativo/);
});

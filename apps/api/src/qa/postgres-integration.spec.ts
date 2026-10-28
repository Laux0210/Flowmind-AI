import { createTestResourceResolver } from '../../test/resource-fixtures';
import { NotFoundException } from '@nestjs/common';
import type { WorkflowNode } from '@flowmind/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import { ExecutionsService } from '../executions/executions.service';
import { UsageLimitsService } from '../executions/usage-limits.service';
import { WorkerService } from '../worker/worker.service';

// Integração com PostgreSQL real. Roda só com FLOWMIND_DB_INTEGRATION=1 e DATABASE_URL de um banco descartável.
const enabled = process.env.FLOWMIND_DB_INTEGRATION === '1';
const run = enabled ? describe : describe.skip;
const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const orgA = `org_it_a_${suffix}`;
const orgB = `org_it_b_${suffix}`;

function node(id: string, type: WorkflowNode['type'], config: Record<string, unknown>): WorkflowNode {
  return { id, type, config, label: 'Fixture', position: { x: 0, y: 0 } };
}
const nodes = [
  node('form', 'trigger_form', {}),
  node('mail', 'send_email', { to: '{{form.contact_email}}', subject: 'Fixture', bodyTemplate: '{{form.message_text}}' }),
];
const edges = [{ id: 'form_mail', sourceNodeId: 'form', targetNodeId: 'mail' }];

run('PostgreSQL real — persistência, isolamento e concorrência', () => {
  let prisma: PrismaService;
  let service: WorkflowsService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const resources = createTestResourceResolver();
    service = new WorkflowsService(prisma, new WorkflowEngineService(resources), resources);
    await prisma.organization.createMany({ data: [{ id: orgA, name: 'Org A sintética' }, { id: orgB, name: 'Org B sintética' }] });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.$disconnect();
  });

  async function reviewedWorkflow(): Promise<string> {
    const created = await service.create(orgA, { name: 'Fluxo sintético' } as never);
    await service.update(orgA, created.id, { nodes, edges, triggerNodeId: 'form' } as never);
    await service.review(orgA, created.id, 'admin_fixture');
    return created.id;
  }

  it('grava, revisa e ativa com snapshot imutável da versão', async () => {
    const id = await reviewedWorkflow();
    await service.publish(orgA, id, 'admin_fixture');
    const row = await prisma.workflow.findUniqueOrThrow({ where: { id } });
    const versions = await prisma.workflowVersion.findMany({ where: { workflowId: id } });
    expect(row.status).toBe('PUBLISHED');
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ version: row.version, publishedBy: 'admin_fixture', triggerNodeId: 'form' });
  });

  it('outra organização não lê, altera nem remove o workflow', async () => {
    const id = (await service.create(orgA, { name: 'Privado A' } as never)).id;
    await expect(service.findOne(orgB, id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(orgB, id, { name: 'invasão' } as never)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(orgB, id)).rejects.toBeInstanceOf(NotFoundException);
    expect((await service.findAll(orgB)).map((w) => w.id)).not.toContain(id);
    expect((await prisma.workflow.findUniqueOrThrow({ where: { id } })).name).toBe('Privado A');
  });

  it('ativações concorrentes geram um único snapshot', async () => {
    const id = await reviewedWorkflow();
    const results = await Promise.allSettled([1, 2, 3].map(() => service.publish(orgA, id, 'admin_fixture')));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.workflowVersion.count({ where: { workflowId: id } })).toBe(1);
  });

  it('falha final da fila grava FAILED só para a organização dona', async () => {
    const id = (await service.create(orgA, { name: 'Fila' } as never)).id;
    const worker = new WorkerService(prisma, new WorkflowEngineService(createTestResourceResolver()), new ExecutionsService(prisma, new UsageLimitsService(prisma)));
    const job = { jobId: 'job', workflowId: id, orgId: orgA, userId: 'user_fixture', mode: 'SIMULATION' as const, initialPayload: {} };
    await worker.recordExhaustedFailure({ ...job, orgId: orgB });
    expect(await prisma.workflowExecution.count({ where: { workflowId: id } })).toBe(0);
    await worker.recordExhaustedFailure(job);
    const runs = await prisma.workflowExecution.findMany({ where: { workflowId: id } });
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ orgId: orgA, status: 'FAILED', mode: 'SIMULATION', triggeredBy: 'user_fixture' });
  });

  it('banco recusa snapshot duplicado da mesma versão', async () => {
    const id = await reviewedWorkflow();
    await service.publish(orgA, id, 'admin_fixture');
    const [snapshot] = await prisma.workflowVersion.findMany({ where: { workflowId: id } });
    await expect(prisma.workflowVersion.create({ data: { workflowId: id, version: snapshot.version,
      triggerNodeId: 'form', nodes: [], edges: [], publishedBy: 'admin_fixture' } })).rejects.toMatchObject({ code: 'P2002' });
  });
});
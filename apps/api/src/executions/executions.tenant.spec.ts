import { NotFoundException } from '@nestjs/common';
import { ExecutionsService } from './executions.service';
import { UsageLimitsService } from './usage-limits.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SEC04 — acesso a execuções de duas organizações (adaptador sintético)', () => {
  let service: ExecutionsService;

  beforeEach(() => {
    const rows = ['alpha', 'beta'].map((tenant) => ({
      id: `exec_${tenant}`,
      orgId: `org_${tenant}`,
      workflowId: `wf_${tenant}`,
      workflowVersion: 1,
      workflow: { name: `Fluxo ${tenant}` },
      mode: 'SIMULATION',
      status: 'COMPLETED',
      triggeredBy: 'user_fixture',
      nodeResults: [],
      startedAt: new Date('2026-10-12T10:00:00.000Z'),
      completedAt: new Date('2026-10-12T10:00:01.000Z'),
    }));
    // O adaptador aplica somente os filtros recebidos. Omitir orgId na consulta
    // real fará estes testes exporem dados alheios, em vez de retornar vazio sempre.
    const matches = (row: any, where: Record<string, unknown>) =>
      Object.entries(where).every(([key, value]) => row[key] === value);
    const prisma = {
      workflowExecution: {
        findMany: jest.fn(async ({ where }: any) => rows.filter((row) => matches(row, where))),
        findFirst: jest.fn(async ({ where }: any) => rows.find((row) => matches(row, where)) ?? null),
      },
    } as unknown as PrismaService;
    service = new ExecutionsService(prisma, {} as UsageLimitsService);
  });

  it('lista a execução própria de cada organização e exclui a execução alheia', async () => {
    expect((await service.listExecutions('org_alpha')).map((row) => row.id)).toEqual(['exec_alpha']);
    expect((await service.listExecutions('org_beta')).map((row) => row.id)).toEqual(['exec_beta']);
  });

  it('consulta o detalhe próprio e nega o detalhe alheio nas duas direções', async () => {
    expect((await service.getExecutionById('org_alpha', 'exec_alpha')).orgId).toBe('org_alpha');
    expect((await service.getExecutionById('org_beta', 'exec_beta')).orgId).toBe('org_beta');
    await expect(service.getExecutionById('org_alpha', 'exec_beta')).rejects.toThrow(NotFoundException);
    await expect(service.getExecutionById('org_beta', 'exec_alpha')).rejects.toThrow(NotFoundException);
  });
});

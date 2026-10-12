import { NotFoundException } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngineService } from '../engine/workflow-engine.service';

describe('WorkflowsService (Multi-tenant Security & CRUD Tests)', () => {
  let service: WorkflowsService;
  let mockPrisma: PrismaService;
  let mockEngine: WorkflowEngineService;

  beforeEach(() => {
    // Adaptador sintético exclusivo dos testes; aplicação não mantém fallback em memória.
    const rows = new Map<string, any>();
    let sequence = 0;
    mockPrisma = { workflow: {
      create: jest.fn(async ({ data }: { data: any }) => {
        const row = { ...data, id: `wf_test_${++sequence}`, createdAt: new Date(), updatedAt: new Date() };
        rows.set(row.id, row);
        return row;
      }),
      findMany: jest.fn(async ({ where }: { where: any }) => Array.from(rows.values()).filter((row) => row.orgId === where.orgId)),
      findFirst: jest.fn(async ({ where }: { where: any }) => {
        const row = rows.get(where.id);
        return row?.orgId === where.orgId ? row : null;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: any; data: any }) => {
        const row = rows.get(where.id);
        if (row?.orgId !== where.orgId) return { count: 0 };
        const version = typeof data.version === 'object'
          ? row.version + data.version.increment
          : data.version ?? row.version;
        rows.set(row.id, { ...row, ...data, version, updatedAt: new Date() });
        return { count: 1 };
      }),
      deleteMany: jest.fn(async ({ where }: { where: any }) => {
        const row = rows.get(where.id);
        if (row?.orgId !== where.orgId) return { count: 0 };
        rows.delete(row.id);
        return { count: 1 };
      }),
    },
    workflowVersion: {
      create: jest.fn(async ({ data }: { data: any }) => ({
        id: `snapshot_${++sequence}`,
        ...data,
      })),
    },
    } as unknown as PrismaService;
    // Adaptador de CRUD; rollback e concorrência são exercitados em workflows.atomic.spec.ts.
    (mockPrisma as any).$transaction = jest.fn(async (operation: any) => operation(mockPrisma));
    mockEngine = {
      simulate: jest.fn().mockResolvedValue({
        executionId: 'mock_exec_123',
        status: 'COMPLETED',
        totalDurationMs: 50,
        nodeResults: [],
      }),
    } as unknown as WorkflowEngineService;
    service = new WorkflowsService(mockPrisma, mockEngine);
  });


  it('deve criar e listar workflows apenas para a organização proprietária', async () => {
    const wfAlpha1 = await service.create('org_alpha', {
      name: 'Fluxo Alpha 1',
      description: 'Descrição Alpha',
    });
    const wfAlpha2 = await service.create('org_alpha', {
      name: 'Fluxo Alpha 2',
    });
    const wfBeta1 = await service.create('org_beta', {
      name: 'Fluxo Beta 1',
    });

    const listAlpha = await service.findAll('org_alpha');
    const listBeta = await service.findAll('org_beta');

    expect(listAlpha).toHaveLength(2);
    expect(listAlpha.map((w) => w.id)).toContain(wfAlpha1.id);
    expect(listAlpha.map((w) => w.id)).toContain(wfAlpha2.id);
    expect(listAlpha.map((w) => w.id)).not.toContain(wfBeta1.id);

    expect(listBeta).toHaveLength(1);
    expect(listBeta[0].id).toBe(wfBeta1.id);
  });

  it('deve retornar 404 Not Found quando Org Beta tenta consultar workflow da Org Alpha (SEC01)', async () => {
    const wfAlpha = await service.create('org_alpha', {
      name: 'Workflow Confidencial Alpha',
    });

    // Org Alpha consegue consultar
    const foundByAlpha = await service.findOne('org_alpha', wfAlpha.id);
    expect(foundByAlpha.id).toBe(wfAlpha.id);

    // Org Beta recebe 404 sem revelar a existência do recurso alheio
    await expect(service.findOne('org_beta', wfAlpha.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deve impedir que Org Beta altere workflow da Org Alpha (SEC02)', async () => {
    const wfAlpha = await service.create('org_alpha', {
      name: 'Nome Original Alpha',
    });

    // Org Beta tenta alterar
    await expect(
      service.update('org_beta', wfAlpha.id, { name: 'Tentativa Invasiva' }),
    ).rejects.toThrow(NotFoundException);

    // Nome na Org Alpha permanece inalterado
    const original = await service.findOne('org_alpha', wfAlpha.id);
    expect(original.name).toBe('Nome Original Alpha');
  });

  it('deve impedir que Org Beta remova workflow da Org Alpha', async () => {
    const wfAlpha = await service.create('org_alpha', {
      name: 'Workflow Alpha a Proteger',
    });

    await expect(service.remove('org_beta', wfAlpha.id)).rejects.toThrow(
      NotFoundException,
    );

    // Permanece existindo para Org Alpha
    const stillExists = await service.findOne('org_alpha', wfAlpha.id);
    expect(stillExists.id).toBe(wfAlpha.id);
  });

  it('deve impedir que Org Beta execute simulação no workflow da Org Alpha (SEC03)', async () => {
    const wfAlpha = await service.create('org_alpha', {
      name: 'Workflow Alpha para Simulação',
    });

    // Org Beta tenta simular e recebe 404
    await expect(
      service.simulate('org_beta', wfAlpha.id, {
        initialPayload: { name: 'Teste' },
      }),
    ).rejects.toThrow(NotFoundException);

    // O motor de execução NÃO deve ter sido chamado para o invasor
    expect(mockEngine.simulate).not.toHaveBeenCalled();

    // Org Alpha consegue simular normalmente
    await service.simulate('org_alpha', wfAlpha.id, {
      initialPayload: { name: 'Teste Autorizado' },
    });
    expect(mockEngine.simulate).toHaveBeenCalledTimes(1);
  });

  describe('Ciclo de Vida Formal e Versões Imutáveis (T03)', () => {
    it('deve realizar a revisão formal de um workflow DRAFT válido persistindo revisor', async () => {
      const wf = await service.create('org_alpha', { name: 'Workflow para Revisão' });
      // Configurar gatilho válido para passar no DAG validator
      await service.update('org_alpha', wf.id, {
        triggerNodeId: 'trigger_1',
        nodes: [{ id: 'trigger_1', type: 'trigger_form', label: 'Início', position: { x: 0, y: 0 }, config: { requiredFields: ['name'] } }],
        edges: [],
      });

      const reviewed = await service.review('org_alpha', wf.id, 'admin_reviewer_1');
      expect(reviewed.workflow.status).toBe('REVIEWED');
      expect(reviewed.reviewedBy).toBe('admin_reviewer_1');
      expect(reviewed.workflow.reviewedBy).toBe('admin_reviewer_1');
      expect(reviewed.reviewedAt).toBeDefined();
    });

    it('deve exigir identificador de revisor na revisão formal', async () => {
      const wf = await service.create('org_alpha', { name: 'Workflow Sem Revisor' });
      await expect(service.review('org_alpha', wf.id, '')).rejects.toThrow(
        /Identificador do revisor é obrigatório/,
      );
    });

    it('deve impedir ativação direta de workflow em status DRAFT sem revisão prévia', async () => {
      const wf = await service.create('org_alpha', { name: 'Workflow Sem Revisão' });
      await expect(service.publish('org_alpha', wf.id, 'user_admin_123')).rejects.toThrow(
        /precisa ser revisado antes da ativação/,
      );
    });

    it('deve publicar workflow revisado gerando snapshot imutável de versão', async () => {
      const wf = await service.create('org_alpha', { name: 'Workflow Pronto' });
      await service.update('org_alpha', wf.id, {
        triggerNodeId: 'trigger_1',
        nodes: [{ id: 'trigger_1', type: 'trigger_form', label: 'Início', position: { x: 0, y: 0 }, config: { requiredFields: ['name'] } }],
        edges: [],
      });

      await service.review('org_alpha', wf.id, 'admin_reviewer_1');
      const published = await service.publish('org_alpha', wf.id, 'user_admin_123');

      expect(published.workflow.status).toBe('PUBLISHED');
      expect(published.versionSnapshot.publishedBy).toBe('user_admin_123');
      expect(published.versionSnapshot.version).toBe(1);
    });

    it('deve desativar workflow publicado voltando para DRAFT com incremento de versão e reset de revisão', async () => {
      const wf = await service.create('org_alpha', { name: 'Workflow Ativo' });
      await service.update('org_alpha', wf.id, {
        triggerNodeId: 'trigger_1',
        nodes: [{ id: 'trigger_1', type: 'trigger_form', label: 'Início', position: { x: 0, y: 0 }, config: { requiredFields: ['name'] } }],
        edges: [],
      });
      await service.review('org_alpha', wf.id, 'admin_reviewer_1');
      await service.publish('org_alpha', wf.id, 'user_admin_123');

      const deactivated = await service.deactivate('org_alpha', wf.id);
      expect(deactivated.workflow.status).toBe('DRAFT');
      expect(deactivated.workflow.version).toBe(2);
      expect(deactivated.workflow.reviewedBy).toBeUndefined();
      expect(deactivated.workflow.reviewedAt).toBeUndefined();
    });

    it('deve impedir exclusão de workflow no status PUBLISHED (política de exclusão ativa)', async () => {
      const wf = await service.create('org_alpha', { name: 'Workflow Ativo Protegido' });
      await service.update('org_alpha', wf.id, {
        triggerNodeId: 'trigger_1',
        nodes: [{ id: 'trigger_1', type: 'trigger_form', label: 'Início', position: { x: 0, y: 0 }, config: { requiredFields: ['name'] } }],
        edges: [],
      });
      await service.review('org_alpha', wf.id, 'admin_reviewer_1');
      await service.publish('org_alpha', wf.id, 'user_admin_123');

      await expect(service.remove('org_alpha', wf.id)).rejects.toThrow(
        /Não é permitido excluir um workflow ativo/,
      );
    });

    it('deve impedir que outra organização revise ou ative workflow alheio', async () => {
      const wfAlpha = await service.create('org_alpha', { name: 'Workflow Alpha' });
      await expect(service.review('org_beta', wfAlpha.id, 'admin_hacker')).rejects.toThrow(NotFoundException);
      await expect(service.publish('org_beta', wfAlpha.id, 'user_hacker')).rejects.toThrow(NotFoundException);
    });
  });
});


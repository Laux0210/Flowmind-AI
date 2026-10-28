import { createTestResourceResolver } from '../../test/resource-fixtures';
import { ConflictException } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { WorkflowEngineService } from '../engine/workflow-engine.service';

// Adaptador determinístico de testes. Não comprova isolamento do PostgreSQL.
function fixture(status = 'REVIEWED') {
  let state: { row: any; snapshots: any[] } = {
    row: {
      id: 'wf_atomic', orgId: 'org_alpha', name: 'Definição original',
      description: null, schemaVersion: '1.0.0', version: 1, status,
      triggerNodeId: 'form',
      nodes: [{ id: 'form', type: 'trigger_form', label: 'Formulário',
        position: { x: 0, y: 0 }, config: {} }], edges: [],
      reviewedBy: status === 'DRAFT' ? null : 'admin_reviewer',
      reviewedAt: status === 'DRAFT' ? null : new Date('2026-10-12T12:00:00Z'),
      createdAt: new Date('2026-10-12T11:00:00Z'),
      updatedAt: new Date('2026-10-12T12:00:00Z'),
    }, snapshots: [],
  };
  let epoch = 0;
  let afterRead: (() => void) | undefined;
  let failUpdate = false;
  let zeroUpdate = false;
  let missingSnapshot = false;
  let snapshotError: Error | undefined;
  const matches = (row: any, where: any) => row &&
    Object.entries(where).every(([key, value]) => row[key] === value);

  function delegates(current: () => typeof state) {
    return {
      workflow: {
        findFirst: async ({ where }: any) => {
          const row = current().row;
          const result = matches(row, where) ? structuredClone(row) : null;
          const hook = afterRead;
          afterRead = undefined;
          hook?.();
          return result;
        },
        updateMany: async ({ where, data }: any) => {
          if (failUpdate) throw new Error('Falha de escrita sintética');
          const row = current().row;
          if (zeroUpdate || !matches(row, where)) return { count: 0 };
          const version = typeof data.version === 'object'
            ? row.version + data.version.increment : data.version ?? row.version;
          current().row = { ...row, ...data, version, updatedAt: new Date() };
          return { count: 1 };
        },
        deleteMany: async ({ where }: any) => {
          if (!matches(current().row, where)) return { count: 0 };
          current().row = null;
          current().snapshots = [];
          return { count: 1 };
        },
      },
      workflowVersion: missingSnapshot ? undefined : {
        create: async ({ data }: any) => {
          if (snapshotError) throw snapshotError;
          const snapshot = { id: 'snapshot_fixture', ...structuredClone(data) };
          current().snapshots.push(snapshot);
          return snapshot;
        },
      },
    };
  }
  const prisma: any = {
    get workflow() { return delegates(() => state).workflow; },
    get workflowVersion() { return delegates(() => state).workflowVersion; },
    $transaction: async (callback: (tx: any) => Promise<any>, options: any) => {
      const originalEpoch = epoch;
      const staged = structuredClone(state);
      const result = await callback(delegates(() => staged));
      if (options?.isolationLevel === 'Serializable' && epoch !== originalEpoch) {
        throw { code: 'P2034' };
      }
      state = staged;
      epoch++;
      return result;
    },
  };
  const service = new WorkflowsService(prisma as PrismaService, {} as WorkflowEngineService, createTestResourceResolver());
  return {
    service,
    state: () => state,
    failUpdate: () => { failUpdate = true; },
    loseMutation: () => { zeroUpdate = true; },
    removeSnapshotDelegate: () => { missingSnapshot = true; },
    failSnapshot: (error: Error) => { snapshotError = error; },
    onRead: (change: (current: typeof state) => void) => {
      afterRead = () => { change(state); epoch++; };
    },
  };
}

describe('T04 — atomicidade do ciclo de vida, com adaptador sintético', () => {
  it('não deixa snapshot órfão quando a mudança para PUBLISHED falha', async () => {
    const f = fixture(); f.failUpdate();
    await expect(f.service.publish('org_alpha', 'wf_atomic', 'admin')).rejects.toThrow('Falha de escrita');
    expect(f.state().snapshots).toEqual([]);
    expect(f.state().row.status).toBe('REVIEWED');
  });

  it('não confirma revisão se nenhuma linha foi alterada', async () => {
    const f = fixture('DRAFT'); f.loseMutation();
    await expect(f.service.review('org_alpha', 'wf_atomic', 'admin')).rejects.toThrow(ConflictException);
    expect(f.state().row.status).toBe('DRAFT');
  });

  it('desfaz snapshot quando a ativação perde o estado esperado', async () => {
    const f = fixture(); f.loseMutation();
    await expect(f.service.publish('org_alpha', 'wf_atomic', 'admin')).rejects.toThrow(ConflictException);
    expect(f.state().snapshots).toEqual([]);
  });

  it('não confirma desativação se nenhuma linha foi alterada', async () => {
    const f = fixture('PUBLISHED'); f.loseMutation();
    await expect(f.service.deactivate('org_alpha', 'wf_atomic')).rejects.toThrow(ConflictException);
    expect(f.state().row.status).toBe('PUBLISHED');
  });

  it.each(['workflowId', 'workflow_id'])('retorna conflito para snapshot duplicado (%s), sem confirmar ativação', async (field) => {
    const f = fixture();
    f.failSnapshot(Object.assign(new Error('Unicidade sintética'), {
      code: 'P2002', meta: { target: [field, 'version'] },
    }));
    await expect(f.service.publish('org_alpha', 'wf_atomic', 'admin')).rejects.toThrow(ConflictException);
    expect(f.state().row.status).toBe('REVIEWED');
    expect(f.state().snapshots).toEqual([]);
  });

  it('preserva erro de unicidade não relacionado à versão do snapshot', async () => {
    const f = fixture();
    const error = Object.assign(new Error('Unicidade de id sintética'), {
      code: 'P2002', meta: { target: ['id'] },
    });
    f.failSnapshot(error);
    await expect(f.service.publish('org_alpha', 'wf_atomic', 'admin')).rejects.toBe(error);
    expect(f.state().row.status).toBe('REVIEWED');
  });

  it('recusa ativação sem persistência de snapshot, sem fabricar versão', async () => {
    const f = fixture(); f.removeSnapshotDelegate();
    await expect(f.service.publish('org_alpha', 'wf_atomic', 'admin')).rejects.toThrow();
    expect(f.state().row.status).toBe('REVIEWED');
    expect(f.state().snapshots).toEqual([]);
  });

  it('edição atrasada não altera uma definição revisada por outra operação', async () => {
    const f = fixture('DRAFT');
    f.onRead(s => { s.row.status = 'REVIEWED'; s.row.reviewedBy = 'other_admin'; });
    await expect(f.service.update('org_alpha', 'wf_atomic', { name: 'Alteração atrasada' })).rejects.toThrow(ConflictException);
    expect(f.state().row.name).toBe('Definição original');
    expect(f.state().row.status).toBe('REVIEWED');
  });

  it('edição de grafo concorrente não recebe aprovação de uma definição diferente', async () => {
    const f = fixture('DRAFT');
    f.onRead(s => {
      s.row.edges = [{ id: 'loop', sourceNodeId: 'form', targetNodeId: 'form' }];
    });
    await expect(f.service.review('org_alpha', 'wf_atomic', 'admin')).rejects.toThrow(ConflictException);
    expect(f.state().row.status).toBe('DRAFT');
    expect(f.state().row.reviewedBy).toBeNull();
  });

  it('exclusão atrasada não apaga workflow ativado por outra operação', async () => {
    const f = fixture('DRAFT');
    f.onRead(s => { s.row.status = 'PUBLISHED'; s.snapshots.push({ version: 1 }); });
    await expect(f.service.remove('org_alpha', 'wf_atomic')).rejects.toThrow(ConflictException);
    expect(f.state().row.status).toBe('PUBLISHED');
    expect(f.state().snapshots).toHaveLength(1);
  });

  it('desativação atrasada não apaga uma revisão posterior', async () => {
    const f = fixture('PUBLISHED');
    f.onRead(s => { s.row.status = 'REVIEWED'; s.row.version = 2; s.row.reviewedBy = 'new_admin'; });
    await expect(f.service.deactivate('org_alpha', 'wf_atomic')).rejects.toThrow(ConflictException);
    expect(f.state().row.status).toBe('REVIEWED');
    expect(f.state().row.reviewedBy).toBe('new_admin');
  });

  it('não ativa estado REVIEWED sem os metadados da revisão formal', async () => {
    const f = fixture(); f.state().row.reviewedBy = null;
    await expect(f.service.publish('org_alpha', 'wf_atomic', 'admin')).rejects.toThrow(/revisão formal/);
    expect(f.state().snapshots).toEqual([]);
  });

  it('não revisa definição com versão de schema desconhecida', async () => {
    const f = fixture('DRAFT'); f.state().row.schemaVersion = 'unknown';
    await expect(f.service.review('org_alpha', 'wf_atomic', 'admin')).rejects.toThrow(/schema/);
    expect(f.state().row.status).toBe('DRAFT');
  });

  it('não publica definição com versão de schema desconhecida', async () => {
    const f = fixture(); f.state().row.schemaVersion = 'unknown';
    await expect(f.service.publish('org_alpha', 'wf_atomic', 'admin')).rejects.toThrow(/schema/);
    expect(f.state().snapshots).toEqual([]);
  });

  it('exige identidade de quem ativa antes de persistir efeitos', async () => {
    const f = fixture();
    await expect(f.service.publish('org_alpha', 'wf_atomic', '')).rejects.toThrow(/ativador/);
    expect(f.state().snapshots).toEqual([]);
  });

  describe('C03 — destinatário obrigatório na definição de e-mail', () => {
    const invalidRecipients = [undefined, null, '', ' \t', 123, 'destino-invalido'];
    function addEmail(f: ReturnType<typeof fixture>, to: unknown) {
      f.state().row.nodes.push({
        id: 'mail', type: 'send_email', label: 'E-mail',
        position: { x: 200, y: 0 },
        config: { ...(to === undefined ? {} : { to }), subject: 'Fixture', bodyTemplate: 'Fixture' },
      });
      f.state().row.edges.push({ id: 'form_mail', sourceNodeId: 'form', targetNodeId: 'mail' });
    }

    for (const action of ['review', 'publish'] as const) {
      it.each(invalidRecipients)(`${action} rejeita destinatário ausente/inválido (%p), sem alterar estado`, async (to) => {
        const status = action === 'review' ? 'DRAFT' : 'REVIEWED';
        const f = fixture(status); addEmail(f, to);
        await expect(f.service[action]('org_alpha', 'wf_atomic', 'admin')).rejects.toThrow(/Destinatário/);
        expect(f.state().row.status).toBe(status);
        expect(f.state().snapshots).toEqual([]);
      });
    }

    it.each(['contato@example.test', '{{form.contact_email}}'])('preserva destinatário literal ou referência (%s)', async (to) => {
      const f = fixture('DRAFT'); addEmail(f, to);
      expect((await f.service.review('org_alpha', 'wf_atomic', 'admin')).workflow.status).toBe('REVIEWED');
      expect((await f.service.publish('org_alpha', 'wf_atomic', 'admin')).workflow.status).toBe('PUBLISHED');
      expect(f.state().snapshots).toHaveLength(1);
    });

    for (const action of ['review', 'publish'] as const) {
      it(`${action} exige email no formulário quando o destinatário depende desse campo`, async () => {
        const status = action === 'review' ? 'DRAFT' : 'REVIEWED';
        const f = fixture(status); addEmail(f, '{{form.contact_email}}');
        f.state().row.nodes[0].config.requiredFields = ['name', 'message'];
        await expect(f.service[action]('org_alpha', 'wf_atomic', 'admin')).rejects.toThrow(/email obrigatório/);
        expect(f.state().row.status).toBe(status);
        expect(f.state().snapshots).toEqual([]);
      });

      it(`${action} rejeita referência de destinatário inexistente`, async () => {
        const status = action === 'review' ? 'DRAFT' : 'REVIEWED';
        const f = fixture(status); addEmail(f, '{{missing.contact_email}}');
        await expect(f.service[action]('org_alpha', 'wf_atomic', 'admin')).rejects.toThrow(/referência/);
        expect(f.state().row.status).toBe(status);
        expect(f.state().snapshots).toEqual([]);
      });
    }

    it('não exige email de formulário genérico ou de envio a destinatário literal', async () => {
      for (const sendLiteralEmail of [false, true]) {
        const f = fixture('DRAFT');
        f.state().row.nodes[0].config.requiredFields = ['message'];
        if (sendLiteralEmail) addEmail(f, 'contato@example.test');
        await expect(f.service.review('org_alpha', 'wf_atomic', 'admin')).resolves.toBeDefined();
        await expect(f.service.publish('org_alpha', 'wf_atomic', 'admin')).resolves.toBeDefined();
      }
    });
  });
});

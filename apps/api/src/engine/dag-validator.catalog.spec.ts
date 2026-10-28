import { createTestResourceResolver } from '../../test/resource-fixtures';
import { BadRequestException, Logger } from '@nestjs/common';
import type { WorkflowDefinition } from '@flowmind/contracts';
import type { PrismaService } from '../prisma/prisma.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { DagValidator } from './dag-validator';

function definition(): WorkflowDefinition {
  return {
    schemaVersion: '1.0.0', id: 'wf_catalog', orgId: 'org_fixture', name: 'Fixture',
    version: 1, status: 'DRAFT', triggerNodeId: 'form',
    nodes: [
      { id: 'form', type: 'trigger_form', label: 'Fixture', position: { x: 0, y: 0 }, config: {} },
      { id: 'record', type: 'internal_record', label: 'Fixture', position: { x: 1, y: 0 },
        config: { fieldMappings: { name: '{{form.contact_name}}' } } },
    ], edges: [{ id: 'form_record', sourceNodeId: 'form', targetNodeId: 'record' }],
    createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z',
  };
}

function duplicateEdges(): WorkflowDefinition {
  const w = definition();
  w.nodes.splice(1, 0, { id: 'condition', type: 'condition', label: 'Fixture', position: { x: 0, y: 1 },
    config: { leftOperand: 'a', operator: 'equals', rightOperand: 'a' } });
  w.edges = [
    { id: 'form_condition', sourceNodeId: 'form', targetNodeId: 'condition' },
    { id: 'duplicate', sourceNodeId: 'condition', targetNodeId: 'record', sourceHandle: 'true' },
    { id: 'duplicate', sourceNodeId: 'condition', targetNodeId: 'record', sourceHandle: 'false' },
  ];
  return w;
}

describe('Validação runtime do catálogo e identidades do DAG', () => {
  it.each(['fixture_unknown_type', null, {}, 17])('nega tipo de nó inválido %j com erro controlado', (type) => {
    const w = definition();
    w.nodes[1].type = type as unknown as typeof w.nodes[1]['type'];
    expect(() => DagValidator.validateAndSort(w)).toThrow(BadRequestException);
  });

  it.each([undefined, null, '', '  ', 42])('nega ID de nó inválido %j', (id) => {
    const w = definition();
    w.nodes[1].id = id as unknown as string;
    w.edges[0].targetNodeId = id as unknown as string;
    expect(() => DagValidator.validateAndSort(w)).toThrow(BadRequestException);
  });

  it.each([undefined, null, '', '  ', 42])('nega ID de aresta inválido %j', (id) => {
    const w = definition(); w.edges[0].id = id as unknown as string;
    expect(() => DagValidator.validateAndSort(w)).toThrow(BadRequestException);
  });

  it('nega colisão de IDs entre arestas true e false', () => {
    expect(() => DagValidator.validateAndSort(duplicateEdges())).toThrow(BadRequestException);
  });

  it('mantém a execução do ramo ativo quando os IDs das arestas são distintos', async () => {
    const w = duplicateEdges(); w.edges[2].id = 'unique_false';
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    try {
      const result = await new WorkflowEngineService(createTestResourceResolver()).simulate(w, {
        name: 'Fixture', email: 'contato@example.test', message: 'Mensagem sintética',
      });
      expect(result.status).toBe('COMPLETED');
      expect(result.nodeResults.find((n) => n.nodeId === 'record')?.status).toBe('SUCCESS');
    } finally { log.mockRestore(); }
  });
});

describe('Guardas do DAG antes da revisão e do snapshot', () => {
  it.each([
    ['review', 'unknown-type'], ['publish', 'unknown-type'],
    ['review', 'duplicate-edge'], ['publish', 'duplicate-edge'],
  ] as const)('%s nega %s antes de gravar metadados/snapshot', async (operation, kind) => {
    const w = kind === 'duplicate-edge' ? duplicateEdges() : definition();
    if (kind === 'unknown-type') w.nodes[1].type = 'fixture_unknown_type' as typeof w.nodes[1]['type'];
    const row = { ...w, status: operation === 'review' ? 'DRAFT' : 'REVIEWED',
      reviewedBy: operation === 'review' ? null : 'admin_fixture',
      reviewedAt: operation === 'review' ? null : new Date('2026-10-13T00:00:00Z'),
      createdAt: new Date(w.createdAt), updatedAt: new Date(w.updatedAt) };
    const workflow = {
      findFirst: jest.fn(async () => structuredClone(row)),
      updateMany: jest.fn(async ({ data }: { data: object }) => { Object.assign(row, data); return { count: 1 }; }),
    };
    const workflowVersion = { create: jest.fn(async ({ data }: { data: object }) => ({ id: 'snapshot', ...data })) };
    const prisma = { workflow, workflowVersion,
      $transaction: async (action: (tx: object) => Promise<unknown>) => action({ workflow, workflowVersion }) };
    const service = new WorkflowsService(prisma as unknown as PrismaService, new WorkflowEngineService(createTestResourceResolver()), createTestResourceResolver());
    await expect(service[operation](row.orgId, row.id, 'admin_fixture')).rejects.toBeInstanceOf(BadRequestException);
    expect(workflow.updateMany).not.toHaveBeenCalled();
    expect(workflowVersion.create).not.toHaveBeenCalled();
  });
});

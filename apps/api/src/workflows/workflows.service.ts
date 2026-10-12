import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import type { Prisma, Workflow } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import { validateEmailConfiguration } from '../engine/workflow-validation';
import { DagValidator } from '../engine/dag-validator';
import type {
  WorkflowDefinition,
  CreateWorkflowDto,
  UpdateWorkflowDto,
  SimulateWorkflowDto,
  SimulateWorkflowResponse,
  ReviewWorkflowResponse,
  PublishWorkflowResponse,
  DeactivateWorkflowResponse,
} from '@flowmind/contracts';
import {
  WORKFLOW_SCHEMA_VERSION,
  VALID_WORKFLOW_STATUS_TRANSITIONS,
} from '@flowmind/contracts';

@Injectable()
export class WorkflowsService {
  private readonly prisma: PrismaService;
  private readonly engine: WorkflowEngineService;

  constructor(prisma: PrismaService, engine: WorkflowEngineService) {
    this.prisma = prisma;
    this.engine = engine;
  }

  async create(orgId: string, dto: CreateWorkflowDto): Promise<WorkflowDefinition> {
    if (typeof dto.name !== 'string' || !dto.name.trim()) {
      throw new BadRequestException('Nome do workflow obrigatório');
    }
    const row = await this.prisma.workflow.create({
      data: {
        orgId,
        name: dto.name.trim(),
        description: dto.description,
        schemaVersion: WORKFLOW_SCHEMA_VERSION,
        version: 1,
        status: 'DRAFT',
        triggerNodeId: '',
        nodes: [],
        edges: [],
      },
    });
    return this.toDefinition(row);
  }

  async findAll(orgId: string): Promise<WorkflowDefinition[]> {
    const rows = await this.prisma.workflow.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toDefinition(row));
  }

  async findOne(orgId: string, id: string): Promise<WorkflowDefinition> {
    const row = await this.prisma.workflow.findFirst({ where: { id, orgId } });
    if (!row) throw new NotFoundException('Workflow não encontrado');
    return this.toDefinition(row);
  }

  async update(orgId: string, id: string, dto: UpdateWorkflowDto): Promise<WorkflowDefinition> {
    return this.mutate(async (tx) => {
      const existing = await this.findForMutation(tx, orgId, id);
      if (existing.status !== 'DRAFT') {
        throw new BadRequestException('Edição de versões revisadas/publicadas depende do contrato de novas revisões');
      }
      if (dto.name !== undefined && (typeof dto.name !== 'string' || !dto.name.trim())) {
        throw new BadRequestException('Nome do workflow obrigatório');
      }
      const result = await tx.workflow.updateMany({
        where: { id, orgId, status: existing.status, version: existing.version },
        data: {
          name: dto.name?.trim() ?? existing.name,
          description: dto.description ?? existing.description,
          nodes: (dto.nodes ?? existing.nodes) as unknown as Prisma.InputJsonValue,
          edges: (dto.edges ?? existing.edges) as unknown as Prisma.InputJsonValue,
          triggerNodeId: dto.triggerNodeId ?? existing.triggerNodeId,
          reviewedBy: null, reviewedAt: null,
        },
      });
      this.requireMutation(result.count);
      return this.findForMutation(tx, orgId, id);
    });
  }

  async remove(orgId: string, id: string): Promise<void> {
    await this.mutate(async (tx) => {
      const existing = await this.findForMutation(tx, orgId, id);
      if (existing.status === 'PUBLISHED') {
        throw new BadRequestException('Não é permitido excluir um workflow ativo (PUBLISHED). Desative o workflow antes de excluí-lo.');
      }
      const result = await tx.workflow.deleteMany({
        where: { id, orgId, status: existing.status, version: existing.version },
      });
      this.requireMutation(result.count);
    });
  }

  async simulate(
    orgId: string,
    id: string,
    dto: SimulateWorkflowDto,
  ): Promise<SimulateWorkflowResponse> {
    const workflow = await this.findOne(orgId, id);
    return this.engine.simulate(workflow, dto.initialPayload ?? {});
  }

  async review(orgId: string, id: string, reviewedBy: string): Promise<ReviewWorkflowResponse> {
    if (!reviewedBy || !reviewedBy.trim()) throw new BadRequestException('Identificador do revisor é obrigatório');
    return this.mutate(async (tx) => {
      const workflow = await this.findForMutation(tx, orgId, id);
      if (!VALID_WORKFLOW_STATUS_TRANSITIONS[workflow.status]?.includes('REVIEWED')) {
        throw new BadRequestException(`Transição inválida: workflow no status '${workflow.status}' não pode ser revisado`);
      }
      this.validateReviewable(workflow);
      const now = new Date();
      const result = await tx.workflow.updateMany({
        where: { id, orgId, status: workflow.status, version: workflow.version },
        data: { status: 'REVIEWED', reviewedBy, reviewedAt: now },
      });
      this.requireMutation(result.count);
      return { workflow: await this.findForMutation(tx, orgId, id), reviewedBy, reviewedAt: now.toISOString() };
    });
  }

  async publish(orgId: string, id: string, publishedBy: string): Promise<PublishWorkflowResponse> {
    if (!publishedBy || !publishedBy.trim()) throw new BadRequestException('Identificador do ativador é obrigatório');
    return this.mutate(async (tx) => {
      const workflow = await this.findForMutation(tx, orgId, id);
      if (!VALID_WORKFLOW_STATUS_TRANSITIONS[workflow.status]?.includes('PUBLISHED')) {
        throw new BadRequestException(`Transição inválida: workflow no status '${workflow.status}' precisa ser revisado antes da ativação`);
      }
      if (!workflow.reviewedBy || !workflow.reviewedAt) {
        throw new BadRequestException('Metadados da revisão formal ausentes; revise novamente antes de ativar');
      }
      this.validateReviewable(workflow);
      const snapshot = await tx.workflowVersion.create({
        data: {
          workflowId: id, version: workflow.version, schemaVersion: workflow.schemaVersion,
          triggerNodeId: workflow.triggerNodeId,
          nodes: workflow.nodes as unknown as Prisma.InputJsonValue,
          edges: workflow.edges as unknown as Prisma.InputJsonValue,
          publishedBy, publishedAt: new Date(),
        },
      }).catch((error: unknown) => {
        if (error && typeof error === 'object' && 'code' in error &&
            error.code === 'P2002' && 'meta' in error) {
          const target = (error.meta as { target?: unknown } | null)?.target;
          if (Array.isArray(target) && target.length === 2 && target.includes('version') &&
              (target.includes('workflowId') || target.includes('workflow_id'))) {
            throw new ConflictException('Esta versão já possui ativação; recarregue o workflow');
          }
        }
        throw error;
      });
      const result = await tx.workflow.updateMany({
        where: { id, orgId, status: workflow.status, version: workflow.version },
        data: { status: 'PUBLISHED' },
      });
      this.requireMutation(result.count);
      const publishedAt = snapshot.publishedAt.toISOString();
      return {
        workflow: await this.findForMutation(tx, orgId, id),
        versionSnapshot: {
          id: snapshot.id, workflowId: snapshot.workflowId, version: snapshot.version,
          schemaVersion: snapshot.schemaVersion, triggerNodeId: snapshot.triggerNodeId,
          nodes: snapshot.nodes as unknown as WorkflowDefinition['nodes'],
          edges: snapshot.edges as unknown as WorkflowDefinition['edges'],
          publishedBy: snapshot.publishedBy, publishedAt,
        },
        publishedAt,
      };
    });
  }

  async deactivate(orgId: string, id: string): Promise<DeactivateWorkflowResponse> {
    return this.mutate(async (tx) => {
      const workflow = await this.findForMutation(tx, orgId, id);
      if (!VALID_WORKFLOW_STATUS_TRANSITIONS[workflow.status]?.includes('DRAFT')) {
        throw new BadRequestException(`Transição inválida: workflow no status '${workflow.status}' não pode ser desativado para rascunho`);
      }
      const result = await tx.workflow.updateMany({
        where: { id, orgId, status: workflow.status, version: workflow.version },
        data: { status: 'DRAFT', version: { increment: 1 }, reviewedBy: null, reviewedAt: null },
      });
      this.requireMutation(result.count);
      return { workflow: await this.findForMutation(tx, orgId, id), deactivatedAt: new Date().toISOString() };
    });
  }

  async findByIdPublic(id: string): Promise<WorkflowDefinition | null> {
    const row = await this.prisma.workflow.findUnique({ where: { id } });
    if (!row) return null;
    return this.toDefinition(row);
  }

  private async mutate<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, { isolationLevel: 'Serializable' });
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') {
        throw new ConflictException('Workflow alterado por outra operação. Recarregue antes de tentar novamente.');
      }
      throw error;
    }
  }

  private async findForMutation(tx: Prisma.TransactionClient, orgId: string, id: string): Promise<WorkflowDefinition> {
    const row = await tx.workflow.findFirst({ where: { id, orgId } });
    if (!row) throw new NotFoundException('Workflow não encontrado');
    return this.toDefinition(row);
  }

  private requireMutation(count: number): void {
    if (count !== 1) throw new ConflictException('O estado do workflow mudou durante a operação.');
  }

  private validateReviewable(workflow: WorkflowDefinition): void {
    if (workflow.schemaVersion !== WORKFLOW_SCHEMA_VERSION) {
      throw new BadRequestException('Versão de schema não suportada; revise a definição antes de ativar');
    }
    const { ancestorsByNode } = DagValidator.validateAndSort(workflow);
    validateEmailConfiguration(workflow, ancestorsByNode);
  }

  private toDefinition(row: Workflow): WorkflowDefinition {
    return {
      schemaVersion: row.schemaVersion,
      id: row.id,
      orgId: row.orgId,
      name: row.name,
      description: row.description ?? undefined,
      version: row.version,
      status: row.status,
      triggerNodeId: row.triggerNodeId,
      nodes: (typeof row.nodes === 'string'
        ? JSON.parse(row.nodes)
        : row.nodes) as WorkflowDefinition['nodes'],
      edges: (typeof row.edges === 'string'
        ? JSON.parse(row.edges)
        : row.edges) as WorkflowDefinition['edges'],
      reviewedBy: (row as any).reviewedBy ?? undefined,
      reviewedAt: (row as any).reviewedAt
        ? new Date((row as any).reviewedAt).toISOString()
        : undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

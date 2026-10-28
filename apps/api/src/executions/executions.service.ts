import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  WorkflowExecution,
  ExecutionListItemDto,
  NodeExecutionResult,
} from '@flowmind/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { UsageLimitsService } from './usage-limits.service';

@Injectable()
export class ExecutionsService {
  private readonly prisma: PrismaService;
  private readonly usageLimitsService: UsageLimitsService;

  constructor(
    prisma: PrismaService,
    usageLimitsService: UsageLimitsService,
  ) {
    this.prisma = prisma;
    this.usageLimitsService = usageLimitsService;
  }

  /**
   * Registra uma execução de workflow com aplicação de limites e sanitização de dados sensíveis.
   */
  async recordExecution(
    orgId: string,
    workflowId: string,
    workflowVersion: number,
    mode: 'SIMULATION' | 'LIVE',
    status: 'COMPLETED' | 'FAILED',
    triggeredBy: string,
    nodeResults: NodeExecutionResult[],
    startedAt: string,
    completedAt?: string,
    executionId?: string,
  ): Promise<WorkflowExecution> {
    let workflow;
    try {
      workflow = await this.prisma.workflow.findFirst({ where: { id: workflowId, orgId } });
    } catch {
      throw this.storageUnavailable();
    }
    if (!workflow) {
      throw new NotFoundException({ code: 'WORKFLOW_NOT_FOUND', message: 'Workflow não encontrado para a organização ativa.' });
    }

    // Sanitizar antes de reservar evita consumo quando a entrada é inválida.
    const sanitizedNodeResults = UsageLimitsService.sanitizeSensitiveData(nodeResults);
    // Simulações são isentas da cota comercial de execuções ativas (LIVE).
    const releaseReservation = mode === 'LIVE'
      ? await this.usageLimitsService.checkAndConsumeExecution(orgId)
      : () => {};

    const execution: WorkflowExecution = {
      id: executionId || `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      workflowId,
      workflowVersion,
      orgId,
      mode,
      status,
      triggeredBy,
      nodeResults: sanitizedNodeResults,
      startedAt,
      completedAt: completedAt || new Date().toISOString(),
    };

    // 3. Persistência
    try {
      await this.prisma.workflowExecution.create({
        data: {
          id: execution.id,
          orgId: execution.orgId,
          workflowId: execution.workflowId,
          workflowVersion: execution.workflowVersion,
          mode: execution.mode,
          status: execution.status,
          triggeredBy: execution.triggeredBy,
          nodeResults: execution.nodeResults as any,
          startedAt: new Date(execution.startedAt),
          completedAt: execution.completedAt ? new Date(execution.completedAt) : null,
        },
      });
    } catch {
      releaseReservation();
      throw this.storageUnavailable();
    }

    return execution;
  }

  /**
   * Lista o histórico de execuções com isolamento estrito por organização.
   */
  async listExecutions(
    orgId: string,
    workflowId?: string,
    limit = 50,
  ): Promise<ExecutionListItemDto[]> {
    try {
      const rows = await this.prisma.workflowExecution.findMany({
        where: {
          orgId,
          workflow: { orgId },
          ...(workflowId ? { workflowId } : {}),
        },
        orderBy: { startedAt: 'desc' },
        take: limit,
        include: {
          workflow: {
            select: { name: true },
          },
        },
      });

      return rows.map((row) => {
        const start = row.startedAt.getTime();
        const end = row.completedAt ? row.completedAt.getTime() : start;
        const results = Array.isArray(row.nodeResults) ? row.nodeResults : [];

        return {
          id: row.id,
          workflowId: row.workflowId,
          workflowName: row.workflow?.name,
          workflowVersion: row.workflowVersion,
          mode: row.mode as 'SIMULATION' | 'LIVE',
          status: row.status as 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED',
          startedAt: row.startedAt.toISOString(),
          completedAt: row.completedAt ? row.completedAt.toISOString() : undefined,
          durationMs: end - start,
          triggeredBy: row.triggeredBy,
          nodeCount: results.length,
        };
      });
    } catch {
      throw this.storageUnavailable();
    }
  }

  /**
   * Busca detalhes de uma execução específica garantindo isolamento da organização (SEC01).
   */
  async getExecutionById(orgId: string, id: string): Promise<WorkflowExecution> {
    try {
      const row = await this.prisma.workflowExecution.findFirst({
        where: { id, orgId, workflow: { orgId } },
      });

      if (!row) {
        throw new NotFoundException({
          code: 'EXECUTION_NOT_FOUND',
          message: 'Execução não encontrada para a organização ativa.',
        });
      }

      return {
        id: row.id,
        workflowId: row.workflowId,
        workflowVersion: row.workflowVersion,
        orgId: row.orgId,
        mode: row.mode as 'SIMULATION' | 'LIVE',
        status: row.status as 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED',
        startedAt: row.startedAt.toISOString(),
        completedAt: row.completedAt ? row.completedAt.toISOString() : undefined,
        triggeredBy: row.triggeredBy,
        nodeResults: UsageLimitsService.sanitizeSensitiveData(row.nodeResults as any),
      };
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;

      throw this.storageUnavailable();
    }
  }

  private storageUnavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'EXECUTION_STORAGE_UNAVAILABLE',
      message: 'O histórico de execuções está temporariamente indisponível.',
    });
  }
}

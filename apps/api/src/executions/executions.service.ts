import {
  Injectable,
  NotFoundException,
  Logger,
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
  private readonly logger = new Logger(ExecutionsService.name);

  // Armazenamento em memória para execuções quando executando em ambiente de testes ou sem postgres ativo
  private readonly inMemoryExecutions: WorkflowExecution[] = [];

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
  ): Promise<WorkflowExecution> {
    // 1. Aplica e incrementa consumo de quota
    await this.usageLimitsService.checkAndConsumeExecution(orgId);

    // 2. Sanitiza dados sensíveis nos resultados dos nós antes de persistir
    const sanitizedNodeResults = UsageLimitsService.sanitizeSensitiveData(nodeResults);

    const execution: WorkflowExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
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
      // Fallback gracioso em memória
      this.inMemoryExecutions.unshift(execution);
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
      // Fallback em memória filtrado por orgId
      const filtered = this.inMemoryExecutions.filter(
        (e) => e.orgId === orgId && (!workflowId || e.workflowId === workflowId),
      );

      return filtered.slice(0, limit).map((e) => {
        const start = new Date(e.startedAt).getTime();
        const end = e.completedAt ? new Date(e.completedAt).getTime() : start;
        return {
          id: e.id,
          workflowId: e.workflowId,
          workflowName: 'Automação FlowMind',
          workflowVersion: e.workflowVersion,
          mode: e.mode,
          status: e.status,
          startedAt: e.startedAt,
          completedAt: e.completedAt,
          durationMs: end - start,
          triggeredBy: e.triggeredBy,
          nodeCount: e.nodeResults.length,
        };
      });
    }
  }

  /**
   * Busca detalhes de uma execução específica garantindo isolamento da organização (SEC01).
   */
  async getExecutionById(orgId: string, id: string): Promise<WorkflowExecution> {
    try {
      const row = await this.prisma.workflowExecution.findFirst({
        where: { id, orgId },
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

      // Fallback em memória
      const found = this.inMemoryExecutions.find(
        (e) => e.id === id && e.orgId === orgId,
      );

      if (!found) {
        throw new NotFoundException({
          code: 'EXECUTION_NOT_FOUND',
          message: 'Execução não encontrada para a organização ativa.',
        });
      }

      return {
        ...found,
        nodeResults: UsageLimitsService.sanitizeSensitiveData(found.nodeResults),
      };
    }
  }
}

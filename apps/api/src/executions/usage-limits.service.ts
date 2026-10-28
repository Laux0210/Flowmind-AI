import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import type { OrgUsageReport } from '@flowmind/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsageLimitsService {
  // Valor técnico provisório existente; política comercial ainda depende de aprovação.
  public static readonly DEFAULT_MONTHLY_QUOTA = 1000;

  // Proteção local por período. Não substitui uma cota transacional entre workers.
  private readonly inMemoryUsage = new Map<string, number>();
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  /**
   * Verifica se a organização atingiu a quota mensal e incrementa o contador.
   * Lança BadRequestException ('QUOTA_EXCEEDED') se o limite for ultrapassado.
   */
  async checkAndConsumeExecution(orgId: string): Promise<() => void> {
    const period = this.currentPeriod();
    const key = this.usageKey(orgId, period.start);
    const dbCount = await this.getDatabaseUsageCount(orgId, period.start);
    // Após o await, releia reservas locais; chamadas simultâneas usam a mesma instância.
    const currentUsage = Math.max(dbCount, this.inMemoryUsage.get(key) ?? 0);

    if (currentUsage >= UsageLimitsService.DEFAULT_MONTHLY_QUOTA) {
      throw new BadRequestException({
        code: 'QUOTA_EXCEEDED',
        message: 'O limite de execuções da organização foi atingido.',
      });
    }

    this.inMemoryUsage.set(key, currentUsage + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.inMemoryUsage.set(key, Math.max(0, (this.inMemoryUsage.get(key) ?? 0) - 1));
    };
  }

  /**
   * Retorna o relatório consolidado de consumo da organização.
   */
  async getOrgUsageReport(orgId: string): Promise<OrgUsageReport> {
    const period = this.currentPeriod();
    const [totalExecutions, totalSimulations] = await Promise.all([
      this.getDatabaseUsageCount(orgId, period.start, 'LIVE'),
      this.getDatabaseUsageCount(orgId, period.start, 'SIMULATION'),
    ]);
    const maxQuota = UsageLimitsService.DEFAULT_MONTHLY_QUOTA;
    const usagePercentage = Math.min(100, Math.round((totalExecutions / maxQuota) * 100));

    return {
      orgId,
      billingPeriod: period.label,
      totalExecutions,
      totalSimulations,
      maxExecutionsQuota: maxQuota,
      usagePercentage,
      estimatedTokensConsumed: null,
      isLimitReached: totalExecutions >= maxQuota,
    };
  }

  /**
   * Obtém total de execuções da organização no mês corrente filtrado por modo (LIVE ou SIMULATION).
   */
  private async getDatabaseUsageCount(
    orgId: string,
    startOfMonth: Date,
    mode: 'LIVE' | 'SIMULATION' = 'LIVE',
  ): Promise<number> {
    try {
      return await this.prisma.workflowExecution.count({
        where: {
          orgId,
          mode,
          startedAt: { gte: startOfMonth },
        },
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'USAGE_STORAGE_UNAVAILABLE',
        message: 'O consumo da organização está temporariamente indisponível.',
      });
    }
  }

  private currentPeriod(): { start: Date; label: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, label: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` };
  }

  private usageKey(orgId: string, start: Date): string {
    return JSON.stringify([orgId, start.getTime()]);
  }

  /**
   * Sanitiza dados e logs removendo segredos, tokens e chaves sensíveis.
   */
  static sanitizeSensitiveData<T>(data: T): T {
    const sensitiveKey = /^(password|passwd|passphrase|secret|clientsecret|apisecret|x?apikey|key|token|accesstoken|refreshtoken|idtoken|credential|credentials|signature|webhooksecret|authorization|authorizationheader|authheader|cookie|setcookie)$/i;
    const sanitize = (value: unknown): unknown => {
      if (typeof value === 'string') return value
        .replace(/Bearer\s+[a-zA-Z0-9_\-.~+/]+=*/gi, 'Bearer [REDACTED]')
        .replace(/sk-(?:proj-|svcacct-)?[a-zA-Z0-9_-]{20,}/gi, 'sk-[REDACTED]');
      if (Array.isArray(value)) return value.map(sanitize);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [
        key, child != null && sensitiveKey.test(key.replace(/[_-]/g, '')) ? '[REDACTED]' : sanitize(child),
      ]));
      return value;
    };
    // Normaliza para JSON antes de percorrer; preserva o contrato de dados persistíveis.
    if (data === undefined) return data;
    return sanitize(JSON.parse(JSON.stringify(data))) as T;
  }
}

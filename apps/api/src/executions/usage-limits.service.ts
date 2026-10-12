import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import type { OrgUsageReport } from '@flowmind/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsageLimitsService {
  private readonly logger = new Logger(UsageLimitsService.name);

  // Quota padrão do plano MVP: 1.000 execuções por mês
  public static readonly DEFAULT_MONTHLY_QUOTA = 1000;

  // Cache em memória para contagem de consumo em ambientes sem banco ativo
  private readonly inMemoryUsage = new Map<string, number>();
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  /**
   * Verifica se a organização atingiu a quota mensal e incrementa o contador.
   * Lança BadRequestException ('QUOTA_EXCEEDED') se o limite for ultrapassado.
   */
  async checkAndConsumeExecution(orgId: string): Promise<void> {
    const currentUsage = await this.getCurrentMonthUsageCount(orgId);

    if (currentUsage >= UsageLimitsService.DEFAULT_MONTHLY_QUOTA) {
      this.logger.warn(`Organização '${orgId}' atingiu o limite de execuções (${currentUsage}/${UsageLimitsService.DEFAULT_MONTHLY_QUOTA})`);
      throw new BadRequestException({
        code: 'QUOTA_EXCEEDED',
        message: `Limite de execuções mensal da organização foi atingido (${UsageLimitsService.DEFAULT_MONTHLY_QUOTA} execuções). Faça upgrade de plano para continuar.`,
      });
    }

    // Incrementa contador em memória
    this.inMemoryUsage.set(orgId, currentUsage + 1);
  }

  /**
   * Retorna o relatório consolidado de consumo da organização.
   */
  async getOrgUsageReport(orgId: string): Promise<OrgUsageReport> {
    const totalExecutions = await this.getCurrentMonthUsageCount(orgId);
    const maxQuota = UsageLimitsService.DEFAULT_MONTHLY_QUOTA;
    const usagePercentage = Math.min(100, Math.round((totalExecutions / maxQuota) * 100));

    const now = new Date();
    const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    return {
      orgId,
      billingPeriod,
      totalExecutions,
      maxExecutionsQuota: maxQuota,
      usagePercentage,
      estimatedTokensConsumed: totalExecutions * 240,
      isLimitReached: totalExecutions >= maxQuota,
    };
  }

  /**
   * Obtém total de execuções da organização no mês corrente
   */
  private async getCurrentMonthUsageCount(orgId: string): Promise<number> {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const dbCount = await this.prisma.workflowExecution.count({
        where: {
          orgId,
          startedAt: { gte: startOfMonth },
        },
      });

      const memCount = this.inMemoryUsage.get(orgId) || 0;
      return Math.max(dbCount, memCount);
    } catch {
      return this.inMemoryUsage.get(orgId) || 0;
    }
  }

  /**
   * Sanitiza dados e logs removendo segredos, tokens e chaves sensíveis.
   */
  static sanitizeSensitiveData<T>(data: T): T {
    if (!data) return data;
    const str = JSON.stringify(data);

    // Substitui tokens Bearer, chaves OpenAI (sk-...), senhas, chaves de API, assinaturas e secrets
    const sanitized = str
      .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]')
      .replace(/sk-[a-zA-Z0-9]{20,}/gi, 'sk-[REDACTED]')
      .replace(
        /"(password|secret|apiSecret|apiKey|api_key|token|credential|signature|webhookSecret)":\s*"[^"]+"/gi,
        '"$1": "[REDACTED]"',
      );

    return JSON.parse(sanitized) as T;
  }
}

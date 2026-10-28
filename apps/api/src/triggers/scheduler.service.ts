import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import type { ScheduleConfig, ScheduleCalculationResult } from './triggers.types';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  // Registro de execuções em andamento por workflow para controle de concorrência
  private readonly activeScheduledRuns = new Set<string>();

  private readonly CRON_LIMITS = [
    { min: 0, max: 59 }, // 0: minuto
    { min: 0, max: 23 }, // 1: hora
    { min: 1, max: 31 }, // 2: dia do mês
    { min: 1, max: 12 }, // 3: mês
    { min: 0, max: 7 },  // 4: dia da semana (0 e 7 representam domingo)
  ];

  /**
   * Valida sintaticamente uma expressão cron de 5 campos com respeito a faixas e limites numéricos.
   */
  validateCronExpression(cronExpression: string): boolean {
    if (!cronExpression || typeof cronExpression !== 'string') return false;

    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length !== 5) return false;

    for (let i = 0; i < 5; i++) {
      const part = parts[i];
      const { min, max } = this.CRON_LIMITS[i];
      if (!this.isValidCronField(part, min, max)) {
        return false;
      }
    }

    return true;
  }

  private isValidCronField(field: string, min: number, max: number): boolean {
    // Wildcard puro: '*'
    if (field === '*') return true;

    // Step com wildcard: '*/15'
    const stepMatch = field.match(/^\*\/([0-9]+)$/);
    if (stepMatch) {
      const step = parseInt(stepMatch[1], 10);
      return step >= 1 && step <= max;
    }

    // Subpartes separadas por vírgula: '1,2,3' ou '1-5' ou '1-5/2'
    const subParts = field.split(',');
    if (subParts.length === 0) return false;

    for (const sub of subParts) {
      if (!sub) return false;

      // Range com possível step: '1-5' ou '1-5/2'
      const rangeMatch = sub.match(/^([0-9]+)-([0-9]+)(?:\/([0-9]+))?$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        const step = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : 1;

        if (start < min || start > max || end < min || end > max || start > end || step < 1) {
          return false;
        }
        continue;
      }

      // Valor numérico isolado: '0', '15'
      if (/^[0-9]+$/.test(sub)) {
        const num = parseInt(sub, 10);
        if (num < min || num > max) {
          return false;
        }
        continue;
      }

      return false;
    }

    return true;
  }

  /**
   * Valida se uma string é um identificador de fuso horário IANA válido.
   */
  isValidTimezone(tz: string): boolean {
    if (!tz || typeof tz !== 'string') return false;
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Valida a configuração; o cálculo cron/fuso depende da integração do scheduler.
   */
  calculateNextRun(config: ScheduleConfig): ScheduleCalculationResult {
    const tz = config.timezone || 'America/Sao_Paulo';

    if (!this.isValidTimezone(tz)) {
      return {
        isValid: false,
        cronExpression: config.cronExpression,
        timezone: tz,
        error: `Fuso horário (timezone) inválido: '${tz}'. Esperado formato IANA válido (ex: America/Sao_Paulo, UTC).`,
      };
    }

    if (!this.validateCronExpression(config.cronExpression)) {
      return {
        isValid: false,
        cronExpression: config.cronExpression,
        timezone: tz,
        error: 'Expressão cron inválida. Esperado formato com 5 campos válidos (minuto 0-59, hora 0-23, dia 1-31, mês 1-12, dia da semana 0-7).',
      };
    }

    if (!config.enabled) {
      return {
        isValid: true,
        cronExpression: config.cronExpression,
        timezone: tz,
        nextExecutionAt: undefined,
      };
    }

    return {
      isValid: true,
      cronExpression: config.cronExpression,
      timezone: tz,
      nextExecutionAt: undefined,
      error: 'Cálculo da próxima execução ainda indisponível.',
    };
  }

  /**
   * Inicia o disparo agendado com verificação estrita de concorrência.
   * Se um agendamento já estiver executando para este workflow, bloqueia sobreposição.
   */
  async triggerScheduledRun(
    workflowId: string,
    executeFn: () => Promise<void>,
  ): Promise<boolean> {
    if (!workflowId || typeof workflowId !== 'string' || !workflowId.trim()) {
      throw new BadRequestException('Identificador de workflow inválido para agendamento.');
    }

    if (this.activeScheduledRuns.has(workflowId)) {
      this.logger.warn(`Agendamento ignorado para workflow '${workflowId}': execução anterior ainda em andamento (concorrência bloqueada).`);
      return false;
    }

    this.activeScheduledRuns.add(workflowId);
    try {
      await executeFn();
      return true;
    } finally {
      this.activeScheduledRuns.delete(workflowId);
    }
  }

  /**
   * Verifica se há execução agendada em andamento para o workflow
   */
  isRunning(workflowId: string): boolean {
    return this.activeScheduledRuns.has(workflowId);
  }
}

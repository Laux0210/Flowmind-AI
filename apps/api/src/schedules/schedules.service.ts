import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulerService } from '../triggers/scheduler.service';
import { SCHEDULE_POLICY, isValidTimezone, minimumCronIntervalMinutes } from './schedule-policy';
import { ScheduleSync } from './schedule-sync';
import { hasScheduleTrigger } from './schedule-compatibility';

export interface ScheduleView {
  id: string;
  workflowId: string;
  cron: string;
  timezone: string;
  status: 'ACTIVE' | 'PAUSED' | 'REVOKED';
  createdAt: string;
  revokedAt?: string;
}

/** Gestão de agendamentos por admin; o banco é a fonte da verdade e o Redis é espelhado. */
@Injectable()
export class SchedulesService implements OnModuleDestroy {
  private readonly logger = new Logger(SchedulesService.name);
  private readonly prisma: PrismaService;
  private readonly cron: SchedulerService;
  private sync?: Pick<ScheduleSync, 'upsert' | 'remove' | 'close'>;

  constructor(prisma: PrismaService, cron: SchedulerService) {
    this.prisma = prisma;
    this.cron = cron;
    const host = process.env.REDIS_HOST?.trim();
    if (host) this.sync = new ScheduleSync({ host, port: Number(process.env.REDIS_PORT) || 6379, password: process.env.REDIS_PASSWORD || undefined });
  }

  useSync(sync: Pick<ScheduleSync, 'upsert' | 'remove' | 'close'> | undefined): void {
    this.sync = sync;
  }

  async onModuleDestroy(): Promise<void> {
    await this.sync?.close().catch(() => undefined);
  }

  async create(orgId: string, workflowId: string, createdBy: string, cron: unknown, timezone?: unknown): Promise<ScheduleView> {
    const expression = typeof cron === 'string' ? cron.trim() : '';
    const tz = timezone === undefined || timezone === '' ? SCHEDULE_POLICY.defaultTimezone : timezone;
    if (!this.cron.validateCronExpression(expression)) throw new BadRequestException({ code: 'SCHEDULE_INVALID_CRON', message: 'Expressão cron inválida (use 5 campos).' });
    if (typeof tz !== 'string' || !isValidTimezone(tz)) throw new BadRequestException({ code: 'SCHEDULE_INVALID_TIMEZONE', message: 'Fuso horário inválido.' });
    const interval = minimumCronIntervalMinutes(expression);
    if (interval === null || interval < SCHEDULE_POLICY.minIntervalMinutes) {
      throw new BadRequestException({ code: 'SCHEDULE_TOO_FREQUENT', message: `O intervalo mínimo entre disparos é de ${SCHEDULE_POLICY.minIntervalMinutes} minutos.` });
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const workflow = await tx.workflow.findFirst({ where: { id: workflowId, orgId }, select: { status: true } });
      if (!workflow) throw new NotFoundException('Workflow não encontrado');
      if (workflow.status !== 'PUBLISHED') throw new BadRequestException({ code: 'SCHEDULE_WORKFLOW_NOT_ACTIVE', message: 'Ative o workflow antes de agendar.' });
      const published = await tx.workflowVersion.findFirst({ where: { workflowId }, orderBy: { version: 'desc' } });
      if (!hasScheduleTrigger(published)) throw new BadRequestException({ code: 'SCHEDULE_INCOMPATIBLE_TRIGGER',
        message: 'Publique uma versão com gatilho de agendamento antes de agendar.' });
      if (await tx.workflowSchedule.count({ where: { orgId, status: 'ACTIVE' } }) >= SCHEDULE_POLICY.maxActivePerOrg) {
        throw new ConflictException({ code: 'SCHEDULE_LIMIT_REACHED', message: `Limite de ${SCHEDULE_POLICY.maxActivePerOrg} agendamentos ativos por organização.` });
      }
      return tx.workflowSchedule.create({ data: { orgId, workflowId, cron: expression, timezone: tz, createdBy } });
    }, { isolationLevel: 'Serializable' }).catch((error: unknown) => {
      // Duas criações concorrentes disputando a última vaga: a perdedora recebe 409, não 500.
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2034') {
        throw new ConflictException({ code: 'SCHEDULE_CONFLICT', message: 'Outra alteração de agendamento ocorreu ao mesmo tempo; tente novamente.' });
      }
      throw error;
    });
    // Sem Redis disponível agora, o worker ressincroniza a partir do banco ao iniciar.
    await this.sync?.upsert(row).catch(() => this.logger.warn(`Agendamento [${row.id}] salvo; sincronização com a fila adiada.`));
    return this.view(row);
  }

  async list(orgId: string, workflowId: string): Promise<ScheduleView[]> {
    const rows = await this.prisma.workflowSchedule.findMany({ where: { orgId, workflowId }, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => this.view(row));
  }

  async revoke(orgId: string, id: string): Promise<ScheduleView> {
    const result = await this.prisma.workflowSchedule.updateMany({
      where: { id, orgId, status: { in: ['ACTIVE', 'PAUSED'] } }, data: { status: 'REVOKED', revokedAt: new Date() },
    });
    if (result.count !== 1) throw new NotFoundException('Agendamento não encontrado ou já revogado');
    await this.sync?.remove(id).catch(() => this.logger.warn(`Agendamento [${id}] revogado; remoção da fila adiada.`));
    return this.view(await this.prisma.workflowSchedule.findUniqueOrThrow({ where: { id } }));
  }

  private view(row: { id: string; workflowId: string; cron: string; timezone: string; status: ScheduleView['status'];
    createdAt: Date; revokedAt: Date | null }): ScheduleView {
    return { id: row.id, workflowId: row.workflowId, cron: row.cron, timezone: row.timezone, status: row.status,
      createdAt: row.createdAt.toISOString(), revokedAt: row.revokedAt?.toISOString() };
  }
}

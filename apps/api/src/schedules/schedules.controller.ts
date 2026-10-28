import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiResponse } from '@flowmind/contracts';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentOrg, CurrentUser, Roles, RolesGuard } from '../auth/decorators';
import { SchedulesService } from './schedules.service';
import type { ScheduleView } from './schedules.service';

const ok = <T>(data: T): ApiResponse<T> => ({ success: true, data, timestamp: new Date().toISOString() });

// Gestão de agendamentos: somente admin da organização ativa.
@Controller()
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles('org:admin')
export class SchedulesController {
  private readonly schedules: SchedulesService;

  constructor(schedules: SchedulesService) {
    this.schedules = schedules;
  }

  @Post('workflows/:id/schedules')
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentOrg() orgId: string, @CurrentUser() userId: string, @Param('id') id: string,
    @Body() body: { cron?: unknown; timezone?: unknown }): Promise<ApiResponse<ScheduleView>> {
    return ok(await this.schedules.create(orgId, id, userId, body?.cron, body?.timezone));
  }

  @Get('workflows/:id/schedules')
  async list(@CurrentOrg() orgId: string, @Param('id') id: string): Promise<ApiResponse<ScheduleView[]>> {
    return ok(await this.schedules.list(orgId, id));
  }

  @Delete('schedules/:id')
  async revoke(@CurrentOrg() orgId: string, @Param('id') id: string): Promise<ApiResponse<ScheduleView>> {
    return ok(await this.schedules.revoke(orgId, id));
  }
}

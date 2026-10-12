import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type {
  ApiResponse,
  ExecutionListItemDto,
  WorkflowExecution,
  OrgUsageReport,
} from '@flowmind/contracts';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentOrg } from '../auth/decorators';
import { ExecutionsService } from './executions.service';
import { UsageLimitsService } from './usage-limits.service';

@Controller('api/v1/executions')
@UseGuards(ClerkAuthGuard)
export class ExecutionsController {
  private readonly executionsService: ExecutionsService;
  private readonly usageLimitsService: UsageLimitsService;

  constructor(
    executionsService: ExecutionsService,
    usageLimitsService: UsageLimitsService,
  ) {
    this.executionsService = executionsService;
    this.usageLimitsService = usageLimitsService;
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async listExecutions(
    @CurrentOrg() orgId: string,
    @Query('workflowId') workflowId?: string,
    @Query('limit') limitStr?: string,
  ): Promise<ApiResponse<ExecutionListItemDto[]>> {
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const executions = await this.executionsService.listExecutions(
      orgId,
      workflowId,
      limit,
    );

    return {
      success: true,
      data: executions,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('usage')
  @HttpCode(HttpStatus.OK)
  async getOrgUsage(
    @CurrentOrg() orgId: string,
  ): Promise<ApiResponse<OrgUsageReport>> {
    const report = await this.usageLimitsService.getOrgUsageReport(orgId);

    return {
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getExecution(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse<WorkflowExecution>> {
    const execution = await this.executionsService.getExecutionById(orgId, id);

    return {
      success: true,
      data: execution,
      timestamp: new Date().toISOString(),
    };
  }
}

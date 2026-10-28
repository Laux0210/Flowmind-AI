import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentOrg, CurrentUser, Roles, RolesGuard } from '../auth/decorators';
import {
  ApiResponse,
  WorkflowDefinition,
  CreateWorkflowDto,
  UpdateWorkflowDto,
  SimulateWorkflowDto,
  SimulateWorkflowResponse,
  ReviewWorkflowResponse,
  PublishWorkflowResponse,
  DeactivateWorkflowResponse,
} from '@flowmind/contracts';


@Controller('workflows')
@UseGuards(ClerkAuthGuard)
export class WorkflowsController {
  private readonly workflowsService: WorkflowsService;

  constructor(workflowsService: WorkflowsService) {
    this.workflowsService = workflowsService;
  }

  @Post()
  async create(
    @CurrentOrg() orgId: string,
    @Body() dto: CreateWorkflowDto,
  ): Promise<ApiResponse<WorkflowDefinition>> {
    const data = await this.workflowsService.create(orgId, dto);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  async findAll(
    @CurrentOrg() orgId: string,
  ): Promise<ApiResponse<WorkflowDefinition[]>> {
    const data = await this.workflowsService.findAll(orgId);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  async findOne(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse<WorkflowDefinition>> {
    const data = await this.workflowsService.findOne(orgId, id);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Put(':id')
  async update(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
  ): Promise<ApiResponse<WorkflowDefinition>> {
    const data = await this.workflowsService.update(orgId, id, dto);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.workflowsService.remove(orgId, id);
  }

  @Post(':id/simulate')
  async simulate(
    @CurrentOrg() orgId: string,
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() dto: SimulateWorkflowDto,
  ): Promise<ApiResponse<SimulateWorkflowResponse>> {
    const data = await this.workflowsService.simulate(orgId, id, dto, userId);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/review')
  @UseGuards(RolesGuard)
  @Roles('org:admin')
  async review(
    @CurrentOrg() orgId: string,
    @CurrentUser() userId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse<ReviewWorkflowResponse>> {
    const data = await this.workflowsService.review(orgId, id, userId);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/activate')
  @UseGuards(RolesGuard)
  @Roles('org:admin')
  async activate(
    @CurrentOrg() orgId: string,
    @CurrentUser() userId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse<PublishWorkflowResponse>> {
    const data = await this.workflowsService.publish(orgId, id, userId);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles('org:admin')
  async deactivate(
    @CurrentOrg() orgId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse<DeactivateWorkflowResponse>> {
    const data = await this.workflowsService.deactivate(orgId, id);
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  }
}


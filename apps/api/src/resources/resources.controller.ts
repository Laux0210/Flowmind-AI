import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { ApiResponse, PublicResource } from '@flowmind/contracts';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentOrg } from '../auth/decorators';
import { ResourcesService } from './resources.service';

@Controller('resources')
@UseGuards(ClerkAuthGuard)
export class ResourcesController {
  private readonly resources: ResourcesService;
  constructor(resources: ResourcesService) { this.resources = resources; }

  @Get()
  list(@CurrentOrg() orgId: string, @Query('type') type?: string): ApiResponse<PublicResource[]> {
    return { success: true, data: this.resources.list(orgId, type), timestamp: new Date().toISOString() };
  }
}

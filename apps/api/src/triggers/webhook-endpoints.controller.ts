import { Controller, Get, Post, Delete, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@flowmind/contracts';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentOrg, CurrentUser, Roles, RolesGuard } from '../auth/decorators';
import { WebhookEndpointsService } from './webhook-endpoints.service';
import type { WebhookEndpointView } from './webhook-endpoints.service';

const ok = <T>(data: T): ApiResponse<T> => ({ success: true, data, timestamp: new Date().toISOString() });

// Gestão de endpoints: somente admin da organização ativa.
@Controller()
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles('org:admin')
export class WebhookEndpointsController {
  private readonly endpoints: WebhookEndpointsService;

  constructor(endpoints: WebhookEndpointsService) {
    this.endpoints = endpoints;
  }

  @Post('workflows/:id/webhooks')
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentOrg() orgId: string, @CurrentUser() userId: string, @Param('id') id: string):
    Promise<ApiResponse<WebhookEndpointView & { secret: string }>> {
    return ok(await this.endpoints.create(orgId, id, userId));
  }

  @Get('workflows/:id/webhooks')
  async list(@CurrentOrg() orgId: string, @Param('id') id: string): Promise<ApiResponse<WebhookEndpointView[]>> {
    return ok(await this.endpoints.list(orgId, id));
  }

  @Post('webhooks/:publicId/rotate')
  @HttpCode(HttpStatus.OK)
  async rotate(@CurrentOrg() orgId: string, @Param('publicId') publicId: string):
    Promise<ApiResponse<WebhookEndpointView & { secret: string }>> {
    return ok(await this.endpoints.rotate(orgId, publicId));
  }

  @Delete('webhooks/:publicId')
  async revoke(@CurrentOrg() orgId: string, @Param('publicId') publicId: string): Promise<ApiResponse<WebhookEndpointView>> {
    return ok(await this.endpoints.revoke(orgId, publicId));
  }
}

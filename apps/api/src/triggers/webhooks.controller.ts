import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiResponse } from '@flowmind/contracts';
import { WorkflowsService } from '../workflows/workflows.service';
import { WebhooksService } from './webhooks.service';
import type { WebhookTriggerResponse } from './triggers.types';

@Controller('api/v1/triggers')
export class WebhooksController {
  private readonly workflowsService: WorkflowsService;
  private readonly webhooksService: WebhooksService;

  constructor(
    workflowsService: WorkflowsService,
    webhooksService: WebhooksService,
  ) {
    this.workflowsService = workflowsService;
    this.webhooksService = webhooksService;
  }

  @Post('webhook/:workflowId')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('workflowId') workflowId: string,
    @Body() payload: Record<string, unknown>,
    @Headers('x-flowmind-signature') signature?: string,
    @Headers('x-flowmind-idempotency-key') idempotencyKey?: string,
  ): Promise<ApiResponse<WebhookTriggerResponse>> {
    if (!workflowId || typeof workflowId !== 'string' || !workflowId.trim()) {
      throw new BadRequestException('Identificador de workflow obrigatório.');
    }

    // Busca o workflow ignorando orgId pois webhooks são chamadas externas recebidas por identificador único
    const workflow = await this.workflowsService.findByIdPublic(workflowId);
    if (!workflow) {
      throw new NotFoundException({
        code: 'WORKFLOW_NOT_FOUND',
        message: 'Workflow não encontrado.',
      });
    }

    const result = await this.webhooksService.handleWebhookTrigger(
      workflow,
      payload,
      { signature, idempotencyKey },
    );

    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}

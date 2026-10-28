import { Controller, Post, HttpCode, HttpStatus, Param, Req, Headers } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiResponse } from '@flowmind/contracts';
import { WebhookIngressService } from './webhook-ingress.service';

@Controller('triggers')
export class WebhooksController {
  private readonly ingress: WebhookIngressService;

  constructor(ingress: WebhookIngressService) {
    this.ingress = ingress;
  }

  // Público: autenticação pela assinatura HMAC do endpoint; organização vem do registro no servidor.
  @Post('webhook/:publicId')
  @HttpCode(HttpStatus.ACCEPTED)
  async handleWebhook(
    @Param('publicId') publicId: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers('content-type') contentType?: string,
    @Headers('x-flowmind-signature') signature?: string,
    @Headers('x-flowmind-event-id') eventId?: string,
  ): Promise<ApiResponse<{ jobId: string }>> {
    const data = await this.ingress.handle({ publicId, rawBody: req.rawBody, contentType, signature, eventId });
    return { success: true, data, timestamp: new Date().toISOString() };
  }
}

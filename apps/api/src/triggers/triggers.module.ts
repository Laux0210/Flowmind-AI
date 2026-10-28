import { Module } from '@nestjs/common';
import { WorkflowsModule } from '../workflows/workflows.module';
import { EngineModule } from '../engine/engine.module';
import { WebhooksController } from './webhooks.controller';
import { SchedulerService } from './scheduler.service';
import { WebhookIngressService } from './webhook-ingress.service';
import { WebhookEndpointsService } from './webhook-endpoints.service';
import { WebhookEndpointsController } from './webhook-endpoints.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [WorkflowsModule, EngineModule, AuthModule],
  controllers: [WebhooksController, WebhookEndpointsController],
  // Protótipo WebhooksService (comparação de segredo plano) fica fora do módulo: só testes o usam.
  providers: [SchedulerService, WebhookIngressService, WebhookEndpointsService],
  exports: [SchedulerService],
})
export class TriggersModule {}

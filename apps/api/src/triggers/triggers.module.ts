import { Module } from '@nestjs/common';
import { WorkflowsModule } from '../workflows/workflows.module';
import { EngineModule } from '../engine/engine.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [WorkflowsModule, EngineModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, SchedulerService],
  exports: [WebhooksService, SchedulerService],
})
export class TriggersModule {}

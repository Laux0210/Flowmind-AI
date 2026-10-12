import { Module } from '@nestjs/common';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { AuthModule } from '../auth/auth.module';
import { EngineModule } from '../engine/engine.module';

@Module({
  imports: [AuthModule, EngineModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}


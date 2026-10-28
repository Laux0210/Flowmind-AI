import { ResourcesModule } from '../resources/resources.module';
import { Module } from '@nestjs/common';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';
import { AuthModule } from '../auth/auth.module';
import { EngineModule } from '../engine/engine.module';
import { ExecutionsModule } from '../executions/executions.module';

@Module({
  imports: [AuthModule, EngineModule, ExecutionsModule, ResourcesModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}


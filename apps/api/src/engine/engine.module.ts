import { ResourcesModule } from '../resources/resources.module';
import { Module } from '@nestjs/common';
import { WorkflowEngineService } from './workflow-engine.service';

@Module({
  imports: [ResourcesModule],
  providers: [WorkflowEngineService],
  exports: [WorkflowEngineService],
})
export class EngineModule {}

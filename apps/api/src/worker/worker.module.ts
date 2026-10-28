import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EngineModule } from '../engine/engine.module';
import { ExecutionsModule } from '../executions/executions.module';
import { WorkerService } from './worker.service';
import { InMemoryJobQueue } from './in-memory-job-queue';

@Module({
  imports: [PrismaModule, EngineModule, ExecutionsModule],
  providers: [WorkerService, InMemoryJobQueue],
  exports: [WorkerService, InMemoryJobQueue],
})
export class WorkerModule {}

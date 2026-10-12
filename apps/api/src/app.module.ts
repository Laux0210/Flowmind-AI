import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { AiModule } from './ai/ai.module';
import { TriggersModule } from './triggers/triggers.module';
import { ExecutionsModule } from './executions/executions.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WorkflowsModule,
    AiModule,
    TriggersModule,
    ExecutionsModule,
    HealthModule,
  ],
})
export class AppModule {}





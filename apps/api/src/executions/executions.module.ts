import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ExecutionsController } from './executions.controller';
import { ExecutionsService } from './executions.service';
import { UsageLimitsService } from './usage-limits.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ExecutionsController],
  providers: [ExecutionsService, UsageLimitsService],
  exports: [ExecutionsService, UsageLimitsService],
})
export class ExecutionsModule {}

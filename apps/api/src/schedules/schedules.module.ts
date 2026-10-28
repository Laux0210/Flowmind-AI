import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TriggersModule } from '../triggers/triggers.module';
import { SchedulesController } from './schedules.controller';
import { SchedulesService } from './schedules.service';

@Module({
  imports: [AuthModule, TriggersModule],
  controllers: [SchedulesController],
  providers: [SchedulesService],
})
export class SchedulesModule {}

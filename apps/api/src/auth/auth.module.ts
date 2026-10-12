import { Module } from '@nestjs/common';
import { ClerkService } from './clerk.service';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { RolesGuard } from './roles.guard';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [ClerkService, ClerkAuthGuard, RolesGuard],
  exports: [ClerkService, ClerkAuthGuard, RolesGuard],
})
export class AuthModule {}

import { Controller, Get, UseGuards } from '@nestjs/common';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { CurrentAuth } from './decorators';
import { AuthContext } from './auth.types';
import { ApiResponse } from '@flowmind/contracts';

@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(ClerkAuthGuard)
  getProfile(@CurrentAuth() auth: AuthContext): ApiResponse<AuthContext> {
    return {
      success: true,
      data: auth,
      timestamp: new Date().toISOString(),
    };
  }
}

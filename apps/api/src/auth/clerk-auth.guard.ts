import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ClerkService } from './clerk.service';
import type { AuthContext } from './auth.types';

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  authContext?: AuthContext;
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly clerkService: ClerkService;

  constructor(clerkService: ClerkService) {
    this.clerkService = clerkService;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException(
        'Cabeçalho Authorization ausente ou inválido',
      );
    }

    const match = /^Bearer[ \t]+([^\s,]+)$/i.exec(authHeader);
    if (!match) {
      throw new UnauthorizedException(
        'Formato de autorização inválido. Esperado: Bearer <token>',
      );
    }

    const authContext = await this.clerkService.verifyToken(match[1]);
    request.authContext = authContext;

    return true;
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './clerk-auth.guard';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * RolesGuard verifica se o usuário possui o papel necessário na organização ativa (ex: 'org:admin').
 * Executado após o ClerkAuthGuard.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly reflector: Reflector;

  constructor(reflector: Reflector) {
    this.reflector = reflector;
  }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authContext = request.authContext;

    if (!authContext || !authContext.orgRole) {
      throw new ForbiddenException('Acesso negado: papel de organização não identificado');
    }

    const hasRole = requiredRoles.includes(authContext.orgRole);
    if (!hasRole) {
      throw new ForbiddenException(
        `Acesso negado: operação restrita a administradores da organização`,
      );
    }

    return true;
  }
}

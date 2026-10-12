import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthContext } from './auth.types';
import { AuthenticatedRequest } from './clerk-auth.guard';

/**
 * Decorator para injetar o contexto completo de autenticação (`AuthContext`).
 */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authContext) {
      throw new UnauthorizedException('Contexto de autenticação não encontrado');
    }
    return request.authContext;
  },
);

/**
 * Decorator para injetar o `orgId` ativo validado pelo Clerk.
 */
export const CurrentOrg = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authContext?.orgId) {
      throw new UnauthorizedException('Organização ativa não encontrada na requisição');
    }
    return request.authContext.orgId;
  },
);

/**
 * Alias de CurrentOrg para compatibilidade com controllers existentes.
 */
export const CurrentOrgId = CurrentOrg;

/**
 * Decorator para injetar o `userId` autenticado pelo Clerk.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authContext?.userId) {
      throw new UnauthorizedException('Usuário não autenticado na requisição');
    }
    return request.authContext.userId;
  },
);

export { Roles, RolesGuard } from './roles.guard';

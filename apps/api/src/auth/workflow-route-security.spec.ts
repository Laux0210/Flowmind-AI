import 'reflect-metadata';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { WorkflowsController } from '../workflows/workflows.controller';
import { ClerkAuthGuard, AuthenticatedRequest } from './clerk-auth.guard';
import { ClerkService } from './clerk.service';
import { RolesGuard, ROLES_KEY } from './roles.guard';

// Metadados e guards reais; SDK substituído. Não é teste HTTP/DI/banco.
const routes = ['create', 'findAll', 'findOne', 'update', 'remove',
  'simulate', 'review', 'activate', 'deactivate'] as const;
type Route = typeof routes[number];
const administrative = ['review', 'activate', 'deactivate'] as const;
const reflector = new Reflector();

function guardsFor(route: Route): any[] {
  return [
    ...(Reflect.getMetadata(GUARDS_METADATA, WorkflowsController) ?? []),
    ...(Reflect.getMetadata(GUARDS_METADATA, WorkflowsController.prototype[route]) ?? []),
  ];
}

function fixture(route: Route, role?: string, token = 'Bearer signed_fixture') {
  const request: AuthenticatedRequest & { body: { orgId: string } } = {
    headers: { authorization: token, 'x-org-id': 'org_beta' },
    body: { orgId: 'org_beta' },
  };
  const context = {
    getClass: () => WorkflowsController,
    getHandler: () => WorkflowsController.prototype[route],
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const clerk = { verifyToken: jest.fn(async () => ({
    userId: 'user_alpha', sessionId: 'sess_alpha', orgId: 'org_alpha', orgRole: role,
  })) } as unknown as ClerkService;
  return {
    request, context,
    run: async () => {
      for (const Guard of guardsFor(route)) {
        const guard = Guard === ClerkAuthGuard ? new ClerkAuthGuard(clerk)
          : Guard === RolesGuard ? new RolesGuard(reflector) : undefined;
        if (!guard) throw new Error('Guard sem fixture explícita');
        if (!await guard.canActivate(context)) throw new ForbiddenException();
      }
      return true;
    },
  };
}

describe('T06 — proteção declarada nas rotas de workflows', () => {
  it.each(routes)('%s mantém autenticação e rejeita requisição sem Bearer', async (route) => {
    expect(guardsFor(route)[0]).toBe(ClerkAuthGuard);
    await expect(fixture(route, 'org:admin', '').run()).rejects.toThrow(UnauthorizedException);
  });

  it.each(administrative)('%s usa papel real de admin e nega membro/papel ausente', async (route) => {
    expect(guardsFor(route)).toEqual([ClerkAuthGuard, RolesGuard]);
    expect(reflector.getAllAndOverride(ROLES_KEY, [
      WorkflowsController.prototype[route], WorkflowsController,
    ])).toEqual(['org:admin']);
    await expect(fixture(route, 'org:admin').run()).resolves.toBe(true);
    await expect(fixture(route, 'org:member').run()).rejects.toThrow(ForbiddenException);
    await expect(fixture(route).run()).rejects.toThrow(ForbiddenException);
  });

  it.each(['create', 'update', 'simulate'] as const)('%s permite preparação por membro', async (route) => {
    await expect(fixture(route, 'org:member').run()).resolves.toBe(true);
  });

  it('factories de organização/usuário usam contexto autenticado e negam identidade ausente', async () => {
    const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, WorkflowsController, 'review');
    const parameters = Object.values(metadata) as { index: number; factory?: Function }[];
    const org = parameters.find((parameter) => parameter.index === 0)?.factory;
    const user = parameters.find((parameter) => parameter.index === 1)?.factory;
    expect(typeof org).toBe('function');
    expect(typeof user).toBe('function');
    const f = fixture('review', 'org:admin');
    await f.run();
    expect(org!(undefined, f.context)).toBe('org_alpha');
    expect(user!(undefined, f.context)).toBe('user_alpha');
    f.request.authContext = undefined;
    expect(() => org!(undefined, f.context)).toThrow(UnauthorizedException);
    expect(() => user!(undefined, f.context)).toThrow(UnauthorizedException);
    f.request.authContext = { orgId: '', userId: '', sessionId: 'sess_alpha' };
    expect(() => org!(undefined, f.context)).toThrow(UnauthorizedException);
    expect(() => user!(undefined, f.context)).toThrow(UnauthorizedException);
  });
});

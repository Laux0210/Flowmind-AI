import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ClerkAuthGuard } from './clerk-auth.guard';
import type { AuthenticatedRequest } from './clerk-auth.guard';
import { ClerkService } from './clerk.service';
import { RolesGuard } from './roles.guard';

describe('ClerkAuthGuard (Multi-tenant & Auth Tests)', () => {
  let guard: ClerkAuthGuard;
  let service: ClerkService;

  beforeEach(() => {
    // Fixtures vivem somente neste teste. O serviço da aplicação sempre usa o SDK.
    service = {
      verifyToken: jest.fn(async (token: string) => {
        if (token === 'mock_test_token_valid_org1') {
          return { userId: 'user_mock_123', sessionId: 'sess_mock_123', orgId: 'org_mock_alpha', orgRole: 'org:admin' };
        }
        if (token === 'mock_test_token_valid_org2') {
          return { userId: 'user_mock_456', sessionId: 'sess_mock_456', orgId: 'org_mock_beta', orgRole: 'org:member' };
        }
        throw new UnauthorizedException('Nenhuma organização selecionada na sessão ativa do Clerk');
      }),
    } as unknown as ClerkService;
    guard = new ClerkAuthGuard(service);
  });


  function createMockExecutionContext(headers: Record<string, string>): {
    context: ExecutionContext;
    request: AuthenticatedRequest;
  } {
    const request: AuthenticatedRequest = { headers };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  it('deve rejeitar quando cabeçalho Authorization estiver ausente', async () => {
    const { context } = createMockExecutionContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('deve rejeitar quando esquema não for Bearer', async () => {
    const { context } = createMockExecutionContext({
      authorization: 'Basic dXNlcjpwYXNz',
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('deve rejeitar quando nenhuma organização estiver ativa na sessão', async () => {
    const { context } = createMockExecutionContext({
      authorization: 'Bearer mock_test_token_no_org',
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Nenhuma organização selecionada na sessão ativa do Clerk',
    );
  });

  it('deve autorizar e anexar orgId e userId válidos para Organização Alpha', async () => {
    const { context, request } = createMockExecutionContext({
      authorization: 'Bearer mock_test_token_valid_org1',
    });

    const canActivate = await guard.canActivate(context);
    expect(canActivate).toBe(true);
    expect(request.authContext).toBeDefined();
    expect(request.authContext?.userId).toBe('user_mock_123');
    expect(request.authContext?.orgId).toBe('org_mock_alpha');
    expect(request.authContext?.orgRole).toBe('org:admin');
  });

  it('deve manter contextos distintos fornecidos pelo serviço (sem provar isolamento de recursos)', async () => {
    const { context: contextOrg1, request: reqOrg1 } = createMockExecutionContext({
      authorization: 'Bearer mock_test_token_valid_org1',
    });
    const { context: contextOrg2, request: reqOrg2 } = createMockExecutionContext({
      authorization: 'Bearer mock_test_token_valid_org2',
    });

    await guard.canActivate(contextOrg1);
    await guard.canActivate(contextOrg2);

    expect(reqOrg1.authContext?.orgId).toBe('org_mock_alpha');
    expect(reqOrg2.authContext?.orgId).toBe('org_mock_beta');
    expect(reqOrg1.authContext?.orgId).not.toBe(reqOrg2.authContext?.orgId);
  });

  it('deve rejeitar um cabeçalho Bearer com partes extras antes de chamar o serviço', async () => {
    const { context } = createMockExecutionContext({
      authorization: 'Bearer mock_test_token_valid_org1 extra',
    });

    await expect(guard.canActivate(context)).rejects.toThrow();
    expect(service.verifyToken).not.toHaveBeenCalled();
  });
});

describe('RolesGuard (RBAC por Organização)', () => {
  it('deve permitir acesso quando nenhum papel for exigido', () => {
    const reflector = { getAllAndOverride: () => undefined } as any;
    const rolesGuard = new RolesGuard(reflector);
    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({ authContext: { orgRole: 'org:member' } }) }),
    } as any;

    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  it('deve permitir acesso para administrador quando papel org:admin for exigido', () => {
    const reflector = { getAllAndOverride: () => ['org:admin'] } as any;
    const rolesGuard = new RolesGuard(reflector);
    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({ authContext: { orgRole: 'org:admin' } }) }),
    } as any;

    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  it('deve rejeitar acesso para membro quando papel org:admin for exigido', () => {
    const reflector = { getAllAndOverride: () => ['org:admin'] } as any;
    const rolesGuard = new RolesGuard(reflector);
    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({ authContext: { orgRole: 'org:member' } }) }),
    } as any;

    expect(() => rolesGuard.canActivate(context)).toThrow();
  });
});


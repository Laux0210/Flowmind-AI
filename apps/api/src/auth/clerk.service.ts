import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type { AuthContext } from './auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClerkService {
  private readonly logger = new Logger(ClerkService.name);
  private readonly secretKey: string;
  private readonly publishableKey: string;
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
    this.secretKey = process.env.CLERK_SECRET_KEY || '';
    this.publishableKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
  }

  /**
   * Valida o token Bearer recebido, consulta a sessão e a membership vigentes no Clerk,
   * e realiza o espelhamento idempotente da organização no banco local.
   */
  async verifyToken(token: string): Promise<AuthContext> {
    if (!token) {
      throw new UnauthorizedException('Token de autenticação não fornecido');
    }

    if (!this.secretKey || !this.publishableKey || !this.prisma) {
      throw new UnauthorizedException('Não foi possível autenticar a requisição');
    }

    try {
      // Importação dinâmica do Clerk backend para compatibilidade com ESM/CJS
      const { createClerkClient } = await import('@clerk/backend');
      const clerk = createClerkClient({ secretKey: this.secretKey, publishableKey: this.publishableKey });

      const verified = await clerk.authenticateRequest(
        new Request('http://localhost', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );

      // toAuth() retorna os campos normalizados, não os claims JWT sub/sid/org_id.
      const auth = verified.toAuth();
      if (
        !verified.isSignedIn ||
        !auth ||
        !auth.userId ||
        !auth.sessionId ||
        !auth.orgId
      ) {
        throw new UnauthorizedException('Sessão ou organização inválida');
      }

      // 1. Verificação de sessão ativa no Clerk (revogação ou expiração)
      const session = await clerk.sessions.getSession(auth.sessionId);
      if (!session || session.id !== auth.sessionId || session.userId !== auth.userId ||
          session.status !== 'active' || !Number.isFinite(session.expireAt) ||
          session.expireAt <= Date.now()) {
        throw new UnauthorizedException('Sessão inválida, revogada ou expirada no provedor');
      }

      // 2. Verificação de membership e papel vigentes na organização
      const memberships = await clerk.organizations.getOrganizationMembershipList({
        organizationId: auth.orgId,
        userId: [auth.userId],
        limit: 1,
      });
      const membership = memberships.data.find(
        (member) => member.publicUserData?.userId === auth.userId &&
          member.organization?.id === auth.orgId,
      );
      const activeRole = membership?.role;
      if (!membership || !activeRole || !['org:admin', 'org:member'].includes(activeRole)) {
        throw new UnauthorizedException('Vínculo ou papel vigente inválido na organização');
      }

      // 3. Espelhamento idempotente dos metadados da organização no Prisma
      const organization = await clerk.organizations.getOrganization({ organizationId: auth.orgId });
      if (!organization || organization.id !== auth.orgId || !organization.name?.trim()) {
        throw new UnauthorizedException('Metadados da organização inválidos');
      }
      await this.prisma.organization.upsert({
        where: { id: auth.orgId },
        create: { id: auth.orgId, name: organization.name },
        update: { name: organization.name },
      });

      return {
        userId: auth.userId,
        sessionId: auth.sessionId,
        orgId: auth.orgId,
        orgRole: activeRole,
      };
    } catch (err: any) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      // Mensagens do SDK podem conter dados internos. Não as devolva nem registre.
      this.logger.warn('Falha na autenticação Clerk');
      throw new UnauthorizedException('Não foi possível autenticar a requisição');
    }
  }
}

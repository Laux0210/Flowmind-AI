import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encryptSecret, generatePublicId, generateWebhookSecret } from '../webhooks/secret-cipher';

export interface WebhookEndpointView {
  publicId: string;
  workflowId: string;
  status: 'ACTIVE' | 'REVOKED';
  createdAt: string;
  rotatedAt?: string;
  revokedAt?: string;
}

/** Gestão de endpoints por admin. O segredo em claro só sai na criação e na rotação. */
@Injectable()
export class WebhookEndpointsService {
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  async create(orgId: string, workflowId: string, createdBy: string): Promise<WebhookEndpointView & { secret: string }> {
    const workflow = await this.prisma.workflow.findFirst({ where: { id: workflowId, orgId }, select: { id: true } });
    if (!workflow) throw new NotFoundException('Workflow não encontrado');
    const secret = generateWebhookSecret();
    const row = await this.prisma.webhookEndpoint.create({
      data: { publicId: generatePublicId(), orgId, workflowId, secretCiphertext: encryptSecret(secret), createdBy },
    });
    return { ...this.view(row), secret };
  }

  async list(orgId: string, workflowId: string): Promise<WebhookEndpointView[]> {
    const rows = await this.prisma.webhookEndpoint.findMany({ where: { orgId, workflowId }, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => this.view(row));
  }

  async rotate(orgId: string, publicId: string): Promise<WebhookEndpointView & { secret: string }> {
    const secret = generateWebhookSecret();
    const result = await this.prisma.webhookEndpoint.updateMany({
      where: { orgId, publicId, status: 'ACTIVE' },
      data: { secretCiphertext: encryptSecret(secret), rotatedAt: new Date() },
    });
    if (result.count !== 1) throw new NotFoundException('Endpoint de webhook não encontrado ou revogado');
    return { ...this.view(await this.prisma.webhookEndpoint.findUniqueOrThrow({ where: { publicId } })), secret };
  }

  async revoke(orgId: string, publicId: string): Promise<WebhookEndpointView> {
    const result = await this.prisma.webhookEndpoint.updateMany({
      where: { orgId, publicId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: new Date() },
    });
    if (result.count !== 1) {
      const exists = await this.prisma.webhookEndpoint.findFirst({ where: { orgId, publicId }, select: { id: true } });
      if (exists) throw new ConflictException('Endpoint já revogado');
      throw new NotFoundException('Endpoint de webhook não encontrado');
    }
    return this.view(await this.prisma.webhookEndpoint.findUniqueOrThrow({ where: { publicId } }));
  }

  private view(row: { publicId: string; workflowId: string; status: 'ACTIVE' | 'REVOKED'; createdAt: Date;
    rotatedAt: Date | null; revokedAt: Date | null }): WebhookEndpointView {
    return {
      publicId: row.publicId, workflowId: row.workflowId, status: row.status, createdAt: row.createdAt.toISOString(),
      rotatedAt: row.rotatedAt?.toISOString(), revokedAt: row.revokedAt?.toISOString(),
    };
  }
}

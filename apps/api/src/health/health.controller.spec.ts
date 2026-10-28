import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceUnavailableException } from '@nestjs/common';

describe('HealthController (T15 — Liveness & Readiness Probes)', () => {
  let controller: HealthController;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    };
    controller = new HealthController(prismaMock as unknown as PrismaService);
  });

  it('deve retornar 200 OK com métricas de liveness', () => {
    const liveness = controller.checkLiveness();

    expect(liveness.status).toBe('ok');
    expect(liveness.service).toBe('flowmind-api');
    expect(liveness.version).toBe('1.0.0');
    expect(liveness.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(liveness.timestamp).toBeDefined();
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it('deve retornar readiness ready com banco de dados conectado', async () => {
    const readiness = await controller.checkReadiness();

    expect(readiness.status).toBe('ready');
    expect(readiness.database).toBe('connected');
    expect(readiness.timestamp).toBeDefined();
  });

  it('deve negar readiness com 503 quando o banco falha, sem divulgar o erro SQL', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('db_private_fixture'));
    await expect(controller.checkReadiness()).rejects.toThrow(ServiceUnavailableException);
    try { await controller.checkReadiness(); } catch (error) {
      expect((error as ServiceUnavailableException).getStatus()).toBe(503);
      expect((error as ServiceUnavailableException).getResponse()).toMatchObject({ status: 'not_ready', database: 'unavailable' });
      expect(JSON.stringify((error as ServiceUnavailableException).getResponse())).not.toContain('db_private_fixture');
    }
  });
});

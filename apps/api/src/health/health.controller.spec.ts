import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

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
  });

  it('deve retornar readiness ready com banco de dados conectado', async () => {
    const readiness = await controller.checkReadiness();

    expect(readiness.status).toBe('ready');
    expect(readiness.database).toBe('connected');
    expect(readiness.timestamp).toBeDefined();
  });

  it('deve indicar modo degradado seguro caso o banco não responda na checagem de readiness', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('Connection timeout'));

    const readiness = await controller.checkReadiness();

    expect(readiness.status).toBe('ready');
    expect(readiness.database).toBe('degraded_in_memory_fallback');
  });
});

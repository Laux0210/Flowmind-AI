import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  /**
   * Liveness Probe: verifica se o processo da API está ativo e respondendo
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  checkLiveness() {
    return {
      status: 'ok',
      service: 'flowmind-api',
      version: '1.0.0',
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness Probe: verifica se as dependências (banco de dados) estão conectadas e prontas
   */
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async checkReadiness() {
    let dbStatus = 'connected';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'degraded_in_memory_fallback';
    }

    return {
      status: 'ready',
      database: dbStatus,
      timestamp: new Date().toISOString(),
    };
  }
}

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL não configurada');
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Conexão com PostgreSQL estabelecida com sucesso');
    } catch (error) {
      this.logger.warn(
        'PostgreSQL ainda não inicializado. Execute docker compose up -d para subir o banco local.',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

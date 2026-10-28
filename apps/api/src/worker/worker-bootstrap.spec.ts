import { NestFactory } from '@nestjs/core';

describe('Worker bootstrap — import seguro e shutdown', () => {
  it('importar o entrypoint não cria aplicação nem inicia serviços', async () => {
    const app = { enableShutdownHooks: jest.fn(), close: jest.fn() };
    const create = jest.spyOn(NestFactory, 'createApplicationContext').mockResolvedValue(app as any);
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    const listeners = new Map(signals.map((signal) => [signal, process.listeners(signal)]));
    // Sem REDIS_HOST o worker fica em standby; o consumidor BullMQ é testado em bullmq-workflow-queue.spec.ts.
    const redisHost = process.env.REDIS_HOST;
    delete process.env.REDIS_HOST;
    try {
      const entry: any = await import('../worker.js');
      await Promise.resolve();
      expect(create).not.toHaveBeenCalled();
      expect(typeof entry.bootstrapWorker).toBe('function');
      await entry.bootstrapWorker();
      expect(create).toHaveBeenCalledTimes(1);
      expect(app.enableShutdownHooks).toHaveBeenCalledTimes(1);
      for (const [signal, initial] of listeners) {
        expect(process.listeners(signal)).toEqual(initial);
      }
    } finally {
      if (redisHost !== undefined) process.env.REDIS_HOST = redisHost;
      for (const [signal, initial] of listeners) {
        for (const handler of process.listeners(signal)) {
          if (!initial.includes(handler)) process.removeListener(signal, handler);
        }
      }
      create.mockRestore();
    }
  });
});

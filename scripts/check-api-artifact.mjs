import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Carrega somente definições: não importar main.js nem criar uma aplicação Nest.
const { AppModule } = require('../apps/api/dist/app.module.js');
const { WorkflowsService } = require('../apps/api/dist/workflows/workflows.service.js');
const { PrismaService } = require('../apps/api/dist/prisma/prisma.service.js');
const { WorkflowEngineService } = require('../apps/api/dist/engine/workflow-engine.service.js');
const { ResourceResolver } = require('../apps/api/dist/engine/resource-resolver.js');
const { ClerkService } = require('../apps/api/dist/auth/clerk.service.js');
const { AiGeneratorService } = require('../apps/api/dist/ai/ai-generator.service.js');
const { AI_CLIENT } = require('../apps/api/dist/ai/ai-client.interface.js');
const { AiController } = require('../apps/api/dist/ai/ai.controller.js');
const { ExecutionsService } = require('../apps/api/dist/executions/executions.service.js');
const { ExecutionsController } = require('../apps/api/dist/executions/executions.controller.js');
const { WebhooksController } = require('../apps/api/dist/triggers/webhooks.controller.js');
const { WorkerService } = require('../apps/api/dist/worker/worker.service.js');
const { InMemoryJobQueue } = require('../apps/api/dist/worker/in-memory-job-queue.js');
const { WorkerModule } = require('../apps/api/dist/worker/worker.module.js');
// O guard de entrada impede bootstrap/conexões durante este import.
const { bootstrapWorker } = require('../apps/api/dist/worker.js');

assert.equal(typeof AppModule, 'function');
assert.deepEqual(Reflect.getMetadata('design:paramtypes', WorkflowsService), [
  PrismaService,
  WorkflowEngineService,
  ResourceResolver,
  ExecutionsService,
]);
assert.ok(!(Reflect.getMetadata('optional:paramtypes', WorkflowsService) ?? []).includes(3),
  'O serviço de execuções de WorkflowsService não pode ser opcional');
assert.deepEqual(Reflect.getMetadata('design:paramtypes', ClerkService), [PrismaService]);
assert.equal(typeof WorkerModule, 'function');
assert.equal(typeof bootstrapWorker, 'function');
assert.deepEqual(Reflect.getMetadata('design:paramtypes', WorkerService), [
  PrismaService, WorkflowEngineService, ExecutionsService, InMemoryJobQueue,
]);
assert.ok(Reflect.getMetadata('self:paramtypes', AiGeneratorService)?.some(
  (parameter) => parameter.param === AI_CLIENT,
), 'AiGeneratorService deve injetar o token AI_CLIENT');
assert.deepEqual(Reflect.getMetadata('design:paramtypes', WorkflowEngineService), [ResourceResolver]);
assert.ok(Reflect.getMetadata('self:paramtypes', AiGeneratorService)?.some(
  (parameter) => parameter.index === 0 && parameter.param === ResourceResolver,
), 'Gerador deve injetar o resolvedor compartilhado');
assert.ok(!(Reflect.getMetadata('optional:paramtypes', AiGeneratorService) ?? []).includes(0),
  'O resolvedor do gerador não pode ser opcional');
for (const [controller, path] of [[AiController, 'ai'], [ExecutionsController, 'executions'], [WebhooksController, 'triggers']]) {
  assert.equal(Reflect.getMetadata('path', controller), path, 'O controller deve usar o prefixo global somente em main');
}
console.log('Artefato API: imports seguros, metadados de Workflows/Worker/Clerk/AI_CLIENT e prefixos conferidos, sem bootstrap.');

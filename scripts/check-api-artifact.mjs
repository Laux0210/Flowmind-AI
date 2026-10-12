import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Carrega somente definições: não importar main.js nem criar uma aplicação Nest.
const { AppModule } = require('../apps/api/dist/app.module.js');
const { WorkflowsService } = require('../apps/api/dist/workflows/workflows.service.js');
const { PrismaService } = require('../apps/api/dist/prisma/prisma.service.js');
const { WorkflowEngineService } = require('../apps/api/dist/engine/workflow-engine.service.js');
const { ClerkService } = require('../apps/api/dist/auth/clerk.service.js');

assert.equal(typeof AppModule, 'function');
assert.deepEqual(Reflect.getMetadata('design:paramtypes', WorkflowsService), [
  PrismaService,
  WorkflowEngineService,
]);
assert.deepEqual(Reflect.getMetadata('design:paramtypes', ClerkService), [PrismaService]);
console.log('Artefato API: imports e metadados de DI válidos, sem bootstrap.');

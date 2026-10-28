import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Somente classes compiladas locais; não carrega fábrica, .env ou chave de IA.
const require = createRequire(import.meta.url);
require('reflect-metadata');
const root = new URL('../', import.meta.url);
const { AiEvaluator } = require(fileURLToPath(new URL('apps/api/dist/ai/evaluation/ai-evaluator.js', root)));
const { DeterministicAiClient } = require(fileURLToPath(new URL('apps/api/dist/ai/deterministic-ai-client.js', root)));
const { ResourceResolver } = require(fileURLToPath(new URL('apps/api/dist/engine/resource-resolver.js', root)));
const { ConfiguredResourceCatalog } = require(fileURLToPath(new URL('apps/api/dist/resources/resource-catalog.js', root)));
const resources = new ResourceResolver(new ConfiguredResourceCatalog([]));
let networkAttempts = 0;
globalThis.fetch = async () => {
  networkAttempts++;
  throw new Error('Rede bloqueada no avaliador offline.');
};

const generation = await new AiEvaluator(resources).evaluateAll(new DeterministicAiClient(), 'org_eval_synthetic');
assert.equal(networkAttempts, 0, 'A avaliação offline tentou acessar rede.');
assert.equal(generation.scope, 'LOCAL_TECHNICAL_CHECKS');
assert.equal(generation.totalScore, null, 'Não é permitido fabricar notas humanas.');
assert.equal(generation.averageRubricScore, null);
assert.ok(generation.results.every((result) => result.rubricScore === null));
assert.ok(generation.results.every((result) => result.modelUsed === null || result.modelUsed === 'not-used/local-template'));

const corpusPath = 'docs/evaluation/T10_INTENT_CASES_V1.json';
const corpusBytes = await readFile(new URL(corpusPath, root));
const corpus = JSON.parse(corpusBytes);
const sourcePaths = [
  'apps/api/src/ai/evaluation/ai-evaluator.ts',
  'apps/api/src/ai/evaluation/ai-evaluation-dataset.ts',
  'apps/api/src/ai/ai-generator.service.ts',
  'apps/api/src/ai/deterministic-ai-client.ts',
];
const sourceHashes = Object.fromEntries(await Promise.all(sourcePaths.map(async (path) => [
  path, createHash('sha256').update(await readFile(new URL(path, root))).digest('hex'),
])));

process.stdout.write(JSON.stringify({
  reportVersion: '1.0.0',
  commercialCallsExecuted: false,
  networkAttempts,
  modelApproved: false,
  sourceHashes,
  generation,
  intentAnalysis: {
    datasetId: corpus.datasetId,
    version: corpus.version,
    path: corpusPath,
    sha256: createHash('sha256').update(corpusBytes).digest('hex'),
    casesPrepared: corpus.cases.length,
    casesEvaluatedByModel: 0,
    humanReview: 'PENDING',
    humanScores: null,
  },
}, null, 2) + '\n');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- Verificação de Prontidão Operacional (T15) ---');

// 1. Validação do template de variáveis de ambiente (.env.example)
const envExamplePath = path.resolve('.env.example');
assert.ok(fs.existsSync(envExamplePath), '.env.example deve existir na raiz');
const envExampleContent = fs.readFileSync(envExamplePath, 'utf-8');

const requiredVars = [
  'NODE_ENV',
  'PORT',
  'DATABASE_URL',
  'REDIS_HOST',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'OPENAI_API_KEY',
  'ENCRYPTION_KEY_32BYTES',
];

for (const envVar of requiredVars) {
  assert.ok(
    envExampleContent.includes(`${envVar}=`),
    `Variável obrigatória ${envVar} ausente em .env.example`,
  );
}

// Garantir que não há segredos reais commitados em .env.example
assert.ok(!envExampleContent.includes('sk_live_'), 'Nenhum segredo de produção do Clerk deve constar em .env.example');
assert.ok(!envExampleContent.includes('sk-proj-'), 'Nenhuma chave real da OpenAI deve constar em .env.example');
console.log('✔ .env.example validado com sucesso (sem segredos expostos).');

// 2. Validação do Docker Compose para infraestrutura local
const dockerComposePath = path.resolve('docker-compose.yml');
assert.ok(fs.existsSync(dockerComposePath), 'docker-compose.yml deve existir');
const dockerComposeContent = fs.readFileSync(dockerComposePath, 'utf-8');

assert.ok(dockerComposeContent.includes('postgres:'), 'docker-compose.yml deve conter serviço postgres');
assert.ok(dockerComposeContent.includes('redis:'), 'docker-compose.yml deve conter serviço redis');
assert.ok(dockerComposeContent.includes('healthcheck:'), 'docker-compose.yml deve conter healthchecks');
console.log('✔ docker-compose.yml validado com sucesso (PostgreSQL e Redis com healthchecks).');

// 3. Validação do Pipeline de CI (.github/workflows/ci.yml)
const ciPath = path.resolve('.github/workflows/ci.yml');
assert.ok(fs.existsSync(ciPath), 'Pipeline de CI deve existir em .github/workflows/ci.yml');
const ciContent = fs.readFileSync(ciPath, 'utf-8');

const requiredCiSteps = [
  'npm run prisma:validate',
  'npm run typecheck',
  'npm test',
  'npm run test:regression',
  'npm run build',
  'npm run lint',
];

for (const step of requiredCiSteps) {
  assert.ok(ciContent.includes(step), `Passo de CI ${step} deve estar configurado no pipeline`);
}
console.log('✔ Pipeline de CI validado com sucesso (todos os gates de qualidade ativos).');

// 4. Validação dos Probes de Saúde (Liveness e Readiness)
const healthControllerPath = path.resolve('apps/api/src/health/health.controller.ts');
assert.ok(fs.existsSync(healthControllerPath), 'HealthController deve existir na API');
const healthControllerContent = fs.readFileSync(healthControllerPath, 'utf-8');

assert.ok(healthControllerContent.includes('checkLiveness'), 'HealthController deve implementar liveness probe');
assert.ok(healthControllerContent.includes('checkReadiness'), 'HealthController deve implementar readiness probe');
console.log('✔ Probes de Liveness e Readiness validados com sucesso.');

console.log('--- Prontidão Operacional: Aprovada com sucesso! ---');

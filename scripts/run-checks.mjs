import { spawnSync } from 'node:child_process';

// Os contratos publicam dist; precisam existir antes de compilar/testar consumidores.
const contracts = ['run', 'build', '--workspace', '@flowmind/contracts'];
const plans = {
  build: [contracts, ['run', 'build', '--workspace', '@flowmind/api'], ['run', 'build', '--workspace', '@flowmind/web']],
  typecheck: [contracts, ['run', 'typecheck', '--workspace', '@flowmind/api'], ['run', 'typecheck:test', '--workspace', '@flowmind/api'], ['run', 'typecheck', '--workspace', '@flowmind/web']],
  test: [contracts, ['run', 'test', '--workspace', '@flowmind/api', '--', '--runInBand']],
};

const plan = plans[process.argv[2]];
if (!plan || !process.env.npm_execpath) {
  console.error('Use npm run build, npm run typecheck ou npm test na raiz do projeto.');
  process.exit(2);
}

for (const args of plan) {
  // Usar o CLI do npm atual mantém o mesmo Node e evita shells/interpolação no Windows.
  const env = { ...process.env };
  if (process.argv[2] === 'test' && !env.NODE_OPTIONS?.includes('--experimental-vm-modules')) {
    env.NODE_OPTIONS = `${env.NODE_OPTIONS || ''} --experimental-vm-modules`.trim();
  }
  const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
    stdio: 'inherit',
    env,
  });
  if (result.error || result.signal || result.status !== 0) {
    console.error(`Verificação interrompida: ${args.join(' ')}.`);
    process.exit(result.status || 1);
  }
}

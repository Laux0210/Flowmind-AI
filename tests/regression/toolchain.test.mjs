import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const runner = fileURLToPath(new URL('../../scripts/run-checks.mjs', import.meta.url));

function runPlan(mode, failWorkspace = '') {
  const dir = mkdtempSync(join(tmpdir(), 'flowmind-checks-'));
  const fakeCli = join(dir, 'npm-cli.cjs');
  const callsFile = join(dir, 'calls.jsonl');
  writeFileSync(fakeCli, `
    const fs = require('node:fs');
    const args = process.argv.slice(2);
    fs.appendFileSync(process.env.FLOWMIND_CALLS_FILE, JSON.stringify(args) + '\\n');
    if (process.env.FLOWMIND_FAIL_WORKSPACE && args.includes(process.env.FLOWMIND_FAIL_WORKSPACE)) process.exit(41);
  `);
  try {
    const result = spawnSync(process.execPath, [runner, mode], {
      encoding: 'utf8',
      env: { ...process.env, npm_execpath: fakeCli, FLOWMIND_CALLS_FILE: callsFile, FLOWMIND_FAIL_WORKSPACE: failWorkspace },
    });
    const calls = readFileSync(callsFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    return { result, calls };
  } finally {
    // Remoção somente dos dois arquivos conhecidos; sem exclusão recursiva.
    for (const path of [fakeCli, callsFile]) {
      try { unlinkSync(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    rmdirSync(dir);
  }
}

test('build compila contratos antes da API e da web', () => {
  const { result, calls } = runPlan('build');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls.map((args) => args.at(-1)), ['@flowmind/contracts', '@flowmind/api', '@flowmind/web']);
});

test('falha de um consumidor interrompe o pipeline e preserva código de saída', () => {
  const { result, calls } = runPlan('build', '@flowmind/api');
  assert.equal(result.status, 41);
  assert.equal(calls.length, 2);
  assert.ok(!calls.some((args) => args.includes('@flowmind/web')));
});

test('linter de conformidade e segurança valida arquivos e conclui com sucesso', () => {
  const linterScript = fileURLToPath(new URL('../../scripts/lint.mjs', import.meta.url));
  const res = spawnSync(process.execPath, [linterScript], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr || res.stdout);
  assert.match(res.stdout, /Lint aprovado/);
});

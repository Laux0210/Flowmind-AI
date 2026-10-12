import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const TARGET_DIRS = ['apps', 'packages', 'scripts', 'tests'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.js']);
const IGNORED_PATHS = ['node_modules', 'dist', '.next', '.tools', 'build'];

const SECRET_PATTERNS = [
  { name: 'Chave privada PEM', regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  { name: 'Chave de produção Clerk', regex: /sk_live_[a-zA-Z0-9_]{16,}/ },
  { name: 'Chave de produção OpenAI', regex: /sk-[a-zA-Z0-9]{20,}/ },
  { name: 'Token GitHub', regex: /ghp_[a-zA-Z0-9]{20,}/ },
];

const ANTI_PATTERNS = [
  { name: 'Comando debugger', regex: /\bdebugger\b;/ },
  {
    name: 'Parameter property em construtor (incompatível com stripTypeScriptTypes do Node 24)',
    regex: /constructor\s*\([^)]*?\b(?:private|protected|public|readonly)\s+[a-zA-Z0-9_$]+/,
  },
];

function getFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORED_PATHS.includes(entry)) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getFiles(fullPath));
    } else {
      const ext = entry.slice(entry.lastIndexOf('.'));
      if (EXTENSIONS.has(ext)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

let totalFiles = 0;
const errors = [];

for (const target of TARGET_DIRS) {
  const files = getFiles(join(ROOT_DIR, target));
  for (const file of files) {
    totalFiles++;
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Verificação de segredos (arquivos de teste com fixtures sintéticas de redaction são isentos)
      const isTestFile = file.includes('.spec.') || file.includes('.test.') || file.includes('tests');
      if (!isTestFile) {
        for (const pattern of SECRET_PATTERNS) {
          if (pattern.regex.test(line)) {
            errors.push({
              file: relative(ROOT_DIR, file),
              line: i + 1,
              rule: pattern.name,
              detail: 'Possível credencial ou segredo em código-fonte de produção.',
            });
          }
        }
      }

      // Verificação de anti-patterns de código
      for (const pattern of ANTI_PATTERNS) {
        if (pattern.regex.test(line)) {
          errors.push({
            file: relative(ROOT_DIR, file),
            line: i + 1,
            rule: pattern.name,
            detail: 'Padrão de código encontrado; conferir o arquivo localmente.',
          });
        }
      }
    }
  }
}

if (totalFiles === 0) {
  console.error('Nenhum arquivo foi analisado; verificação incompleta.');
  process.exit(1);
}

if (errors.length > 0) {
  console.error(`\n❌ Falhas encontradas no lint (${errors.length} erro(s) em ${totalFiles} arquivos):`);
  for (const err of errors) {
    console.error(`  - ${err.file}:${err.line} [${err.rule}] ${err.detail}`);
  }
  process.exit(1);
} else {
  console.log(`\n✔ Lint aprovado: ${totalFiles} arquivos verificados, zero violações encontradas.`);
  process.exit(0);
}

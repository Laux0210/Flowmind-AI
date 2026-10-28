'use strict';

// Preview isolado da lista exata. Sem bootstrap Next/Clerk, dados reais ou ações de workflow.
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync, mkdirSync, readdirSync } = require('node:fs');
const { resolve, relative } = require('node:path');
const { createRequire } = require('node:module');
const { createHash } = require('node:crypto');
const root = resolve(__dirname, '../../..');
const local = createRequire(resolve(root, 'package.json'));
const ts = local('typescript');
const React = local('react');
const { renderToStaticMarkup } = local('react-dom/server');
local('reflect-metadata');
local('@nestjs/common').Logger.overrideLogger([]);
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts++; throw new Error('Rede de negócio proibida no preview.'); };
const source = 'apps/web/src/components/workflows/proposal-warnings.tsx';
const folder = resolve(__dirname, 'preview');
mkdirSync(folder, { recursive: true });
const compiled = ts.transpileModule(readFileSync(resolve(root, source), 'utf8'), {
  fileName: source, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
});
writeFileSync(resolve(folder, 'proposal-warnings.cjs'), compiled.outputText);
const { ProposalWarnings } = local(resolve(folder, 'proposal-warnings.cjs'));
const { AiGeneratorService } = local(resolve(root, 'apps/api/dist/ai/ai-generator.service.js'));
const cssFolder = resolve(root, 'apps/web/.next/static/chunks');
const cssFiles = readdirSync(cssFolder).filter((name) => name.endsWith('.css'));
assert.ok(cssFiles.length > 0, 'Compilar o frontend antes do preview.');
writeFileSync(resolve(folder, 'styles.css'), cssFiles.map((name) => readFileSync(resolve(cssFolder, name), 'utf8')).join('\n'));
const hash = (file) => createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex');

(async () => {
  const response = await new AiGeneratorService().generateFromNaturalLanguage({ prompt: 'Receba formulário e notifique webhook HTTP.' }, 'org_preview_fixture');
  const cases = [
    { title: 'Proposta com campos pendentes', warnings: response.warnings },
    { title: 'Sem avisos', warnings: [] },
    { title: 'Texto longo e conteúdo literal', warnings: ['Mensagem longa: ' + 'referencia_sintetica_'.repeat(30),
      '<img src=x onerror="window.previewInjectionExecuted=true">', '<script>window.previewInjectionExecuted=true</script>'] },
    { title: 'Lista com rolagem por teclado', warnings: Array.from({ length: 15 }, (_, i) => `Nó ${i + 1}: revise o campo obrigatório antes de simular.`) },
  ];
  const examples = cases.map((fixture, i) => {
    const html = renderToStaticMarkup(React.createElement(ProposalWarnings, { warnings: fixture.warnings }));
    if (i === 1) assert.equal(html, '');
    if (i === 2) { assert.ok(html.includes('&lt;script&gt;')); assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img ')); }
    return `<article id="case-${i}" class="min-w-0 rounded-xl border border-slate-700 bg-slate-800 p-4"><h2 class="text-sm font-semibold text-slate-100">${fixture.title}</h2>${html}</article>`;
  }).join('\n');
  writeFileSync(resolve(folder, 'examples.html'), `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Avisos da proposta — fixture local</title><link rel="stylesheet" href="styles.css"></head><body class="m-0 bg-slate-900 p-4 text-slate-200"><main class="mx-auto max-w-3xl min-w-0 space-y-4"><h1 class="text-lg font-semibold">Validação isolada dos avisos</h1>${examples}</main></body></html>`);
  writeFileSync(resolve(folder, 'index.html'), `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FlowMind — preview local</title></head><body style="margin:0;background:#0f172a;color:#e2e8f0;font:14px sans-serif"><h1 style="margin:16px;font-size:18px">Componente real; dados sintéticos; sem autenticação/ações</h1><div style="display:flex;flex-wrap:wrap;gap:16px;padding:16px"><section><h2 style="font-size:14px">Mobile: 375 px</h2><iframe title="Avisos mobile" src="examples.html" width="375" height="900" style="max-width:100%;border:1px solid #475569"></iframe></section><section><h2 style="font-size:14px">Desktop: 800 px</h2><iframe title="Avisos desktop" src="examples.html" width="800" height="900" style="max-width:100%;border:1px solid #475569"></iframe></section></div></body></html>`);
  assert.equal(networkAttempts, 0);
  const files = [source, 'apps/web/src/app/workflows/[id]/page.tsx', 'apps/api/src/ai/ai-generator.service.ts',
    'apps/api/dist/ai/ai-generator.service.js', ...cssFiles.map((name) => relative(root, resolve(cssFolder, name)).replaceAll('\\', '/')),
    ...['proposal-warnings.cjs', 'styles.css', 'examples.html', 'index.html'].map((name) => relative(root, resolve(folder, name)).replaceAll('\\', '/'))];
  writeFileSync(resolve(__dirname, 'preview-build.json'), JSON.stringify({ generatedAtUtc: new Date().toISOString(),
    scope: 'ISOLATED_REACT_SSR_WARNING_LIST', authAndWorkflowActionsExercised: false, networkAttempts, cases: cases.length,
    emptyWarningsRenderNothing: true, dangerousTextEscaped: true, hashes: Object.fromEntries(files.map((file) => [file, hash(file)])) }, null, 2) + '\n');
  process.stdout.write('Preview isolado gerado: 4 casos; conteúdo escapado; lista vazia sem markup; fetch 0.\n');
})().catch(() => { process.stderr.write('Falha do preview isolado; conferir artefatos locais.\n'); process.exitCode = 1; });

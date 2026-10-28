// Compila fontes reais sem instalar dependências. Serve apenas em loopback.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const { webpack } = require('next/dist/compiled/webpack/webpack');
const root = path.resolve(__dirname, '../../..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'flowmind-editor-browser-'));
const evidence = path.join(root, 'docs/evidence/t08-browser-2026-10-23');
fs.mkdirSync(evidence, { recursive: true });
const sourceFiles = [
  'apps/web/src/app/workflows/[id]/page.tsx',
  'apps/web/src/components/workflows/workflow-graph-node.tsx',
  'apps/web/src/components/workflows/node-parameter-editor.tsx',
  'apps/web/src/components/workflows/proposal-warnings.tsx',
  'apps/web/src/lib/workflow-editing.ts', 'apps/web/src/lib/use-resource-catalog.ts',
  'apps/web/src/lib/api-client.ts', 'apps/web/src/app/globals.css',
];
const hashes = () => Object.fromEntries(sourceFiles.map(p => [p,
  crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex')]));
const sourceHashes = hashes();
const compiler = webpack({
  mode: 'development', devtool: false, context: root, entry: path.join(__dirname, 'entry.tsx'),
  output: { path: output, filename: 'bundle.js' },
  resolve: { extensions: ['.tsx', '.ts', '.js'], alias: {
    '@': path.join(root, 'apps/web/src'), '@clerk/nextjs$': path.join(__dirname, 'auth.ts'),
    'next/navigation$': path.join(__dirname, 'navigation.ts'), 'next/link$': path.join(__dirname, 'link.tsx'),
  } },
  module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.join(__dirname, 'loader.cjs') },
    { test: /\.css$/, use: path.join(__dirname, 'loader.cjs') }] },
  plugins: [new webpack.DefinePlugin({ 'process.env.NEXT_PUBLIC_API_URL': JSON.stringify('/api/v1') })],
});
compiler.run(async (error, stats) => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString({ all: false, errors: true })); process.exitCode = 1; return; }
  compiler.close(() => {});
  const css = await require('postcss')([require('tailwindcss')({
    content: [path.join(root, 'apps/web/src/**/*.{ts,tsx}')], theme: { extend: {} }, plugins: [],
  })]).process(fs.readFileSync(path.join(root, 'apps/web/src/app/globals.css'), 'utf8'), { from: undefined });
  fs.writeFileSync(path.join(output, 'style.css'), css.css + fs.readFileSync(require.resolve('@xyflow/react/dist/style.css'), 'utf8'));
  let workflow = {
    schemaVersion: '1.0.0', id: 'wf_synthetic', orgId: 'org_synthetic', name: 'Editor — dados sintéticos',
    version: 1, status: 'DRAFT', triggerNodeId: 'form', createdAt: '2026-10-23T00:00:00Z', updatedAt: '2026-10-23T00:00:00Z',
    nodes: [
      { id: 'form', type: 'trigger_form', label: 'Formulário sintético', position: { x: 150, y: 40 }, config: {} },
      { id: 'record', type: 'internal_record', label: 'Registro sintético', position: { x: 150, y: 210 }, config: { fieldMappings: { name: '{{form.contact_name}}' } } },
    ], edges: [{ id: 'e_form_record', sourceNodeId: 'form', targetNodeId: 'record' }],
  };
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const reply = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (url.pathname.startsWith('/api/')) {
      requests.push({ method: req.method, path: url.pathname }); // Nenhum token/corpo registrado.
      if (req.headers.authorization !== 'Bearer synthetic-editor-fixture') return reply(401, { message: 'Somente fixture sintética.' });
      if (req.method === 'GET' && url.pathname === '/api/v1/resources') return reply(200, { success: true, data: [] });
      if (url.pathname === '/api/v1/workflows/wf_synthetic') {
        if (req.method === 'PUT') {
          let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 1000000) return reply(413, {}); }
          const dto = JSON.parse(body); workflow = { ...workflow, nodes: dto.nodes ?? workflow.nodes, edges: dto.edges ?? workflow.edges, version: workflow.version + 1 };
        } else if (req.method !== 'GET') return reply(405, {});
        return reply(200, { success: true, data: workflow });
      }
      return reply(503, { message: 'Operação fora do escopo da fixture visual.' });
    }
    if (url.pathname === '/fixture-state') return reply(200, { workflow, requests });
    if (url.pathname === '/bundle.js' || url.pathname === '/style.css') {
      res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css' });
      return fs.createReadStream(path.join(output, url.pathname.slice(1))).pipe(res);
    }
    if (url.pathname !== '/') { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'" });
    res.end('<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>FlowMind — teste isolado do editor</title><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  server.listen(0, '127.0.0.1', () => {
    const receipt = { origin: `http://127.0.0.1:${server.address().port}`, pid: process.pid, output, sourceHashes,
      scope: 'Real editor, XYFlow, parameter editor, API client and CSS; synthetic auth/navigation/HTTP storage; not Next/Clerk/DB integration' };
    fs.writeFileSync(path.join(evidence, 'server.json'), JSON.stringify(receipt, null, 2));
    console.log(JSON.stringify(receipt));
  });
});

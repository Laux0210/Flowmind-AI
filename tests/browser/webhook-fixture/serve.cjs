// Fixture manual: API/identidade sintéticas, sem serviços/provedores reais.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');
const { webpack } = require('next/dist/compiled/webpack/webpack');

const root = path.resolve(__dirname, '../../..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'flowmind-webhook-qa-'));
const evidence = path.join(root, 'docs/evidence/t12-webhook-review-2026-10-23');
fs.mkdirSync(evidence, { recursive: true });
const sources = [
  'apps/web/src/components/workflows/webhook-panel.tsx',
  'apps/web/src/lib/api-client.ts',
];
const hashes = () =>
  Object.fromEntries(
    sources.map((p) => [
      p,
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(root, p)))
        .digest('hex'),
    ]),
  );
const before = hashes();
const compiler = webpack({
  mode: 'development',
  devtool: false,
  context: root,
  entry: path.join(__dirname, 'entry.tsx'),
  output: { path: output, filename: 'bundle.js' },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: { '@': path.join(root, 'apps/web/src') },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: path.join(__dirname, '../editor-fixture/loader.cjs'),
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NEXT_PUBLIC_API_URL': JSON.stringify('/api/v1'),
    }),
  ],
});

compiler.run(async (error, stats) => {
  if (error || stats.hasErrors()) {
    console.error(error || stats.toString({ all: false, errors: true }));
    process.exitCode = 1;
    return;
  }
  compiler.close(() => {});
  if (JSON.stringify(before) !== JSON.stringify(hashes())) {
    throw new Error('Fontes mudaram durante a compilação; reconstruir fixture.');
  }
  const css = await require('postcss')([
    require('tailwindcss')({
      content: [
        path.join(root, 'apps/web/src/**/*.{ts,tsx}'),
        path.join(__dirname, 'entry.tsx'),
      ],
      theme: { extend: {} },
      plugins: [],
    }),
  ]).process(fs.readFileSync(path.join(root, 'apps/web/src/app/globals.css'), 'utf8'), {
    from: undefined,
  });

  const endpoints = {
    wf_a: [
      {
        publicId: 'ep_a',
        workflowId: 'wf_a',
        status: 'ACTIVE',
        createdAt: '2026-10-23T00:00:00Z',
      },
    ],
    wf_b: [
      {
        publicId: 'ep_b',
        workflowId: 'wf_b',
        status: 'ACTIVE',
        createdAt: '2026-10-23T00:00:00Z',
      },
    ],
  };
  let held = [];
  let holdA = true;
  let serial = 0;
  const requests = [];
  const reply = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  const ok = (res, data) => reply(res, 200, { success: true, data });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/fixture/release' && req.method === 'POST') {
      holdA = false;
      for (const send of held) send();
      held = [];
      return ok(res, {});
    }
    if (url.pathname === '/fixture-state') {
      return ok(res, { requests, endpoints, held: held.length });
    }
    if (url.pathname.startsWith('/api/')) {
      if (req.headers.authorization !== 'Bearer synthetic-webhook-fixture') {
        return reply(res, 401, { message: 'Somente fixture.' });
      }
      requests.push({ method: req.method, path: url.pathname });
      const match = url.pathname.match(/^\/api\/v1\/workflows\/(wf_[ab])\/webhooks$/);
      if (match) {
        const id = match[1];
        if (req.method === 'GET') {
          const data = structuredClone(endpoints[id]);
          if (id === 'wf_a' && holdA) {
            held.push(() => ok(res, data));
            return;
          }
          return ok(res, data);
        }
        if (req.method === 'POST') {
          const n = ++serial;
          const row = {
            publicId: `ep_new_${n}`,
            workflowId: id,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
          };
          endpoints[id].push(row);
          return ok(res, { ...row, secret: `whsec_synthetic_${id}_${n}` });
        }
      }
      const rotate = url.pathname.match(/^\/api\/v1\/webhooks\/(ep_[a-z0-9_]+)\/rotate$/);
      if (rotate && req.method === 'POST') {
        const row = Object.values(endpoints)
          .flat()
          .find((e) => e.publicId === rotate[1] && e.status === 'ACTIVE');
        if (!row) return reply(res, 404, { message: 'Endpoint de webhook não encontrado ou revogado' });
        const n = ++serial;
        row.rotatedAt = new Date().toISOString();
        return ok(res, { ...row, secret: `whsec_rotated_${row.publicId}_${n}` });
      }
      const revoke = url.pathname.match(/^\/api\/v1\/webhooks\/(ep_[a-z0-9_]+)$/);
      if (revoke && req.method === 'DELETE') {
        const row = Object.values(endpoints)
          .flat()
          .find((e) => e.publicId === revoke[1]);
        if (!row) return reply(res, 404, { message: 'Endpoint de webhook não encontrado' });
        row.status = 'REVOKED';
        row.revokedAt = new Date().toISOString();
        return ok(res, row);
      }
      return reply(res, 404, {});
    }
    if (url.pathname === '/bundle.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      return fs.createReadStream(path.join(output, 'bundle.js')).pipe(res);
    }
    if (url.pathname === '/style.css') {
      res.writeHead(200, { 'Content-Type': 'text/css' });
      return res.end(css.css);
    }
    if (url.pathname !== '/') {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:",
    });
    res.end(
      '<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Fixture de webhooks</title><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>',
    );
  });

  server.listen(0, '127.0.0.1', () => {
    const receipt = {
      origin: `http://127.0.0.1:${server.address().port}`,
      pid: process.pid,
      output,
      sourceHashes: before,
      scope:
        'Real WebhookPanel and ApiClient; synthetic auth/HTTP state, A response held for stale-context verification',
    };
    fs.writeFileSync(path.join(evidence, 'server.json'), JSON.stringify(receipt, null, 2));
    console.log(JSON.stringify(receipt));
  });
});

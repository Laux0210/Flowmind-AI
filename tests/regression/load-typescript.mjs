import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

const root = fileURLToPath(new URL('../../', import.meta.url));

// Executa classes sem instalar dependências; retira decorators de classe/parâmetro.
// DI/metadados do Nest e typecheck não são verificados por este adaptador.
export async function loadTypeScript(entry, { clerk = {}, env = {}, modules = {}, fetch = () => { throw new Error('Rede bloqueada nos testes'); } } = {}) {
  const logs = [];
  class HttpException extends Error {
    constructor(response) {
      super(typeof response === 'string' ? response : response?.message);
      this.response = response;
    }
    getResponse() { return this.response; }
  }
  class Logger {
    log(...args) { logs.push(args); }
    warn(...args) { logs.push(args); }
    error(...args) { logs.push(args); }
  }
  const context = createContext({
    Request,
    URL,
    Buffer: globalThis.Buffer,
    fetch,
    AbortController: globalThis.AbortController,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    process: { env },
    console,
  });
  const cache = new Map();
  function synthetic(identifier, exports) {
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    }, { context, identifier });
  }
  const nest = synthetic('@nestjs/common', {
    Injectable: () => () => {}, Inject: () => () => {}, Optional: () => () => {}, Logger, HttpException,
    HttpException,
    UnauthorizedException: HttpException, BadRequestException: HttpException, ForbiddenException: HttpException,
    NotFoundException: HttpException, ConflictException: HttpException,
    ServiceUnavailableException: HttpException,
  });
  const cryptoModule = synthetic('node:crypto', {
    timingSafeEqual: (a, b) => {
      if (a.length !== b.length) return false;
      let diff = 0;
      for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
      return diff === 0;
    },
    createHmac: crypto.createHmac,
    randomUUID: crypto.randomUUID,
  });
  const sdk = synthetic('@clerk/backend', { createClerkClient: () => clerk });

  function sourceModule(path) {
    if (!path.startsWith(root + 'apps' + sep) && !path.startsWith(root + 'packages' + sep)) {
      throw new Error(`Importação fora do escopo dos testes: ${path}`);
    }
    if (cache.has(path)) return cache.get(path);
    const relative = path.slice(root.length).split(sep).join('/');
    const override = modules[relative] ??
      (relative === 'apps/api/src/prisma/prisma.service.ts' ? { PrismaService: class {} } : undefined);
    if (override) {
      const stub = synthetic(path, override);
      cache.set(path, stub);
      return stub;
    }
    const source = readFileSync(path, 'utf8').replace(/^@Injectable\(\)\s*$/gm, '')
      .replace(/@(?:Optional|Inject)\([^)]*\)\s*/g, '');
    const module = new SourceTextModule(stripTypeScriptTypes(source), {
      context, identifier: path,
      importModuleDynamically: async (specifier) => {
        if (specifier !== '@clerk/backend') throw new Error(`Importação externa bloqueada: ${specifier}`);
        if (sdk.status === 'unlinked') await sdk.link(() => { throw new Error('Importação bloqueada'); });
        if (sdk.status === 'linked') await sdk.evaluate();
        return sdk;
      },
    });
    cache.set(path, module);
    return module;
  }
  const entryModule = sourceModule(resolve(root, entry));
  const fixtureModule = sourceModule(resolve(root, 'apps/api/test/resource-fixtures.ts'));
  // O wrapper injeta somente utilitários de teste no mesmo contexto VM das classes reais.
  const wrapperId = resolve(root, 'test-resource-wrapper');
  const module = new SourceTextModule('export * from "entry"; export { createTestResourceResolver, createTestResourceCatalog } from "test-fixtures";', { context, identifier: wrapperId });
  await module.link((specifier, parent) => {
    if (parent.identifier === wrapperId && specifier === 'entry') return entryModule;
    if (parent.identifier === wrapperId && specifier === 'test-fixtures') return fixtureModule;
    if (specifier === '@nestjs/common') return nest;
    if (specifier === 'node:crypto' || specifier === 'crypto') return cryptoModule;
    if (specifier === '@flowmind/contracts') return sourceModule(resolve(root, 'packages/contracts/src/index.ts'));
    if (!specifier.startsWith('.')) throw new Error(`Importação externa bloqueada: ${specifier}`);
    return sourceModule(resolve(dirname(parent.identifier), `${specifier}.ts`));
  });
  await module.evaluate();
  return { exports: module.namespace, logs };
}

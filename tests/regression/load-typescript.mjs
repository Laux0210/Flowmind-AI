import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';

const root = fileURLToPath(new URL('../../', import.meta.url));

// Executa as classes reais sem instalar dependências. Somente @Injectable()
// é retirado; DI/metadados do Nest e typecheck não são verificados aqui.
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
    Injectable: () => () => {}, Logger,
    UnauthorizedException: HttpException, BadRequestException: HttpException,
    NotFoundException: HttpException, ConflictException: HttpException,
  });
  const cryptoModule = synthetic('node:crypto', {
    timingSafeEqual: (a, b) => {
      if (a.length !== b.length) return false;
      let diff = 0;
      for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
      return diff === 0;
    },
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
    const source = readFileSync(path, 'utf8').replace(/^@Injectable\(\)\s*$/gm, '');
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
  const module = sourceModule(resolve(root, entry));
  await module.link((specifier, parent) => {
    if (specifier === '@nestjs/common') return nest;
    if (specifier === 'node:crypto' || specifier === 'crypto') return cryptoModule;
    if (specifier === '@flowmind/contracts') return sourceModule(resolve(root, 'packages/contracts/src/workflow.ts'));
    if (!specifier.startsWith('.')) throw new Error(`Importação externa bloqueada: ${specifier}`);
    return sourceModule(resolve(dirname(parent.identifier), `${specifier}.ts`));
  });
  await module.evaluate();
  return { exports: module.namespace, logs };
}

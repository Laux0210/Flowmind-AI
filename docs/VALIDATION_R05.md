# FlowMind AI — instalação e validação local R05

Checkpoint de 10/10/2026. T05 avançou; somente T00/T01 estão concluídas. [Plano](../plan.md), [memória](MEMORIA.md), [contexto](PROJECT_CONTEXT.md).

## Autorização e preservação

O pedido “pode seguir” autorizou o pacote local de [T05/R04](T05_IMPLEMENTATION_PACKAGE.md): runtime portátil, 34 versões diretas, instalação local, adaptações aos SDKs, geração Prisma e verificações. Não respondeu às duas escolhas de [T02](T02_DECISION_PACKAGE.md).

- Node 24.21.0 instalado em `.tools/node-v24.21.0-win-x64`; npm portátil 11.19.0. Node global 26.9.0 preservado e reconferido.
- ZIP oficial verificado com SHA-256 `158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541` antes da extração. [Arquivo oficial](https://nodejs.org/dist/v24.21.0/node-v24.21.0-win-x64.zip).
- `npm install --ignore-scripts --no-fund --no-audit`: 718 pacotes instalados. Lockfile v3; os 34 pins diretos e suas integridades coincidiram com o inventário aprovado. Scripts externos de instalação não foram liberados em conjunto.
- Geração/validação do Prisma 7.10.0 executadas após inspeção do fornecedor; sem conexão ao banco ou migration.
- Backup inicial de 81 arquivos e versões documentais concorrentes em `C:\Users\jv883\AppData\Local\Temp\flowmind-r05-1fbw33ah`. Trabalho de outra execução preservado; nenhuma aprovação de produto foi inferida dessas edições.

## Ajustes de compatibilidade

- Prisma: `prisma7.config.ts`, cliente em `src/generated/prisma`, `moduleFormat: cjs`, adapter PostgreSQL e imports atualizados. [Receita oficial Nest/Prisma](https://docs.nestjs.com/recipes/prisma).
- TypeScript/Nest: `NodeNext` e `rootDir: ./src`; os artefatos CommonJS importam corretamente no Node portátil. A tentativa com `ESNext/bundler` compilava, mas falhava ao resolver imports no artefato. [Resolução NodeNext](https://www.typescriptlang.org/docs/handbook/modules/reference.html#node16-node18-node20-nodenext).
- Jest: VM modules e mapeamento de imports `.js` para fontes TS do Prisma. [Jest e ESM](https://jestjs.io/docs/ecmascript-modules#require-of-esm).
- Web: `proxy.ts`, proteção assíncrona também de `/history`, redirecionamento de saída no `ClerkProvider` e correções de tipos. [Next Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy), [Clerk Core 3](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-3).
- `check:api-artifact` importa `AppModule` e verifica metadados das dependências de `WorkflowsService`; não inicia a API e não comprova a resolução de todo o container Nest.

## Verificações executadas

Comandos, códigos de saída e hashes das fontes estão em [T05_CHECKS_R05.json](T05_CHECKS_R05.json). Logs completos ficam no backup, subpasta `final-validation`. Alterações concorrentes provocaram novas conferências. No fechamento, os arquivos-fonte ficaram temporariamente abertos para leitura, sem alteração durante os seis checks; handles liberados ao terminar. Cópia verificada preservada no backup, em `verified-source-snapshot`. Os resultados pertencem a esse snapshot.

| Verificação | Resultado e alcance |
| --- | --- |
| Prisma generate/validate | Passaram; sem banco/migration |
| Typecheck | Contratos, API, specs e web passaram |
| Jest | 9 suítes, 73 testes passaram; fixtures/infraestrutura simulada |
| Regressões Node | 42 testes passaram; inclui cliente e orquestrador de comandos |
| Build | Contratos, API e web passaram |
| Artefato da API | Imports e metadados específicos passaram; sem bootstrap |
| `npm ls --depth=0` | Passou, sem problemas declarados |
| Equipe Codex | Validação estática dos sete perfis passou; não é novo teste de delegação |
| CI YAML / Git | Parse local e `git diff --check` passaram; CI remoto não executado |
| `npm run lint` | Scanner limitado: raiz/API/web analisaram 80 arquivos; fixtures inválidas falharam |
| Auditoria npm | Falhou: 31 dependências afetadas, 9 altas e 22 moderadas; zero críticas |

O build web usou uma fixture publicável para `flowmind-build.invalid`, com keyless/telemetria desativados. Não é credencial real, prova de login ou artefato autorizado para deploy. Nenhum servidor, banco, Redis, Docker ou API comercial foi iniciado nesta etapa; não houve teste de navegador/E2E.

## Pendências e revisão de segurança

- [Auditoria completa](T05_AUDIT_R05.json): `npm audit --omit=dev` também falhou, com quatro dependências classificadas como altas na cadeia Prisma. Não tratar todos os avisos como exclusivos de desenvolvimento. Correções transitivas ainda precisam de avaliação e validação; nenhum `audit fix --force`, downgrade ou override aplicado.
- O scanner `scripts/lint.mjs` de outra execução verifica alguns padrões por expressão regular. Corrigido o falso sucesso de zero arquivos nos workspaces: raiz agora relativa ao script, erros de leitura não são absorvidos e nenhum arquivo analisado falha. Raiz/API/web analisaram 80 arquivos; debugger e diretório ausente foram rejeitados em fixtures isoladas. [Resultados](T05_LINT_R05.json). Não cobre sintaxe, construtores multilinha, regras React/Next/acessibilidade ou todos os formatos; testes são dispensados da detecção de segredos. ESLint e auditoria completa continuam pendentes.
- A configuração local do CI agora usa Node 24.21.0, lockfile, geração Prisma, tipos, testes, builds e auditoria. O gate de auditoria deve falhar com os alertas atuais. Não houve execução no GitHub, commit, push ou deploy.
- Docker não encontrado no PATH; Compose existente ainda não executado/validado. Processo de worker separado e ambiente integrado reproduzível não demonstrados.
- **T02/T06:** autoridade/provisionamento e continuidade após saída do aprovador aguardam escolhas explícitas. Revisão estática encontrou consultas opcionais com fallback a claims, ausência de comparação da identidade da sessão, lista de memberships sem filtro/paginação, papel ausente tolerado, sincronização com falhas absorvidas e DI Prisma de `ClerkService` a verificar.
- **T03/T08/T09:** endpoints e UI de ciclo de vida são protótipos preservados. Revisão formal deve exigir admin, conforme requisito confirmado. Persistir revisão/revisor, ativar exatamente a definição aprovada e garantir consistência sob concorrência/transação continuam sem demonstração. Exclusão de workflow ativo por member precisa de política/revisão. Protótipo concorrente OR-Join foi preservado e passou nos casos existentes; semântica de convergência continua pendente de revisão, sem decisão arquitetural inferida.
- Os testes aprovados não comprovam revogação real, isolamento integrado, imutabilidade sob concorrência, entrega de e-mail, consumo real ou os cenários completos C01–C03.

## Reprodução pelo CMD

Executar a partir da raiz Git. As variáveis abaixo valem para esse CMD; a fixture serve somente para compilar sem uma conta Clerk.

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
set "FLOWMIND_NODE=%CD%\.tools\node-v24.21.0-win-x64"
set "PATH=%FLOWMIND_NODE%;%PATH%"
node --version
npm --version
npm run prisma:generate
npm run prisma:validate
npm run typecheck
npm test
npm run test:regression
set "NEXT_TELEMETRY_DISABLED=1"
set "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Zmxvd21pbmQtYnVpbGQuaW52YWxpZCQ="
set "NEXT_PUBLIC_CLERK_KEYLESS_DISABLED=true"
set "NEXT_PUBLIC_CLERK_TELEMETRY_DISABLED=true"
npm run build
npm run check:api-artifact
python .codex\validate_team.py
npm run lint
npm audit --audit-level=high
```

A auditoria tem falha conhecida. Não suprimir seu código de saída. Em checkout limpo, após disponibilizar o mesmo Node portátil, usar `npm ci --ignore-scripts --no-fund` antes da geração Prisma; esse ensaio em checkout limpo/CI remoto ainda é pendente. Uso dos agentes: [CODEX_USAGE.md](CODEX_USAGE.md).

Próxima etapa: consolidar as edições numa sessão, decidir T02, revisar contratos/autorização de T03/T06 e preparar a correção das dependências/lint. Instalações adicionais e início de serviços mantêm a aprovação específica prevista em AGENTS.md.

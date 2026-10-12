# FlowMind AI — ambiente local e CI

Atualizado em 10/10/2026, T05/R05 parcialmente executada. [Evidências e CMD](VALIDATION_R05.md), [plano](../plan.md), [contexto](PROJECT_CONTEXT.md), [equipe](AGENT_TEAM.md), [uso dos agentes](CODEX_USAGE.md).

## Ambiente constatado

| Item | Estado |
| --- | --- |
| Runtime do projeto | Node 24.21.0 portátil em `.tools/node-v24.21.0-win-x64`; npm 11.19.0 |
| Node global | 26.9.0 preservado |
| Dependências | 34 pins aprovados; instalação local com scripts desabilitados; lockfile v3 |
| Prisma | 7.10.0, gerado/validado; nenhuma migration/conexão ao banco |
| Codex | Sete perfis nativos; validador estático passou |
| Docker/Compose | Estratégia escolhida; Docker não encontrado no PATH; Compose não executado |
| CI | YAML local atualizado/parseado; execução remota/checkout limpo pendentes |

## Estrutura existente

```text
Flowmind-AI/
├── .codex/agents/
├── .tools/node-v24.21.0-win-x64/
├── .github/workflows/ci.yml
├── apps/api/                    # NestJS/Prisma; worker separado pendente
├── apps/web/                    # Next.js/XYFlow/Clerk
├── packages/contracts/
├── packages/tsconfig/
├── scripts/
├── tests/regression/
├── docs/
├── docker-compose.yml           # Preservado, não executado
├── .env.example
├── package.json
├── package-lock.json
└── plan.md
```

npm workspaces e um lockfile foram usados no pacote aprovado. Runtime portátil, dependências, artefatos e cliente gerado ficam fora do Git. Modelos Prisma preservados; conexão em configuração externa ao schema.

## Variáveis e operação

- Usar `.env.example` como referência; não versionar `.env` real. Banco: `DATABASE_URL`; Redis: host/porta/senha; Clerk: segredo/chave publicável correspondentes ao ambiente. Nenhum valor real foi gravado nesta etapa.
- Instanciar/conectar Prisma exige `DATABASE_URL`; geração/validação offline não comprova conectividade.
- Build de verificação usa fixture publicável `flowmind-build.invalid`, keyless/telemetria desativados. Não usar esse artefato para deploy.
- IA/e-mail, limites, retenção, hospedagem e criptografia de credenciais dependem de contratos/decisões pertinentes.
- Compose para PostgreSQL/Redis foi escolhido; essa decisão não autoriza instalar Docker, iniciar serviços ou apagar volumes. Nenhum serviço/migration foi executado neste checkpoint.

## Verificações e CI

Pipeline local: equipe → instalação pelo lockfile com scripts desabilitados → geração/validação Prisma → tipos → Jest → regressões → builds com fixture → imports/metadados da API → scanner de padrões → auditoria npm.

Typecheck, 73 Jest, 42 regressões e builds passaram. Smoke da API não faz bootstrap. Scanner corrigido cobre 80 arquivos pela raiz/workspaces e falha em fixtures inválidas; não oferece ESLint/React/Next/acessibilidade nem auditoria completa.

Auditoria npm tem falha conhecida: 31 dependências afetadas, quatro altas também sem dev. O CI preserva essa falha; não houve execução no GitHub, commit ou push.

[Comandos completos](VALIDATION_R05.md), [CHECKS](T05_CHECKS_R05.json), [scanner](T05_LINT_R05.json), [audit](T05_AUDIT_R05.json). Checkout limpo usa `npm ci --ignore-scripts --no-fund` com o runtime aprovado; ensaio ainda pendente.

## Para concluir T05

1. Revisar/validar remediação transitiva; preservar pins até mudança autorizada.
2. Configurar ESLint compatível; scanner heurístico não encerra esse requisito.
3. Fechar T02–T04 e preparar worker separado.
4. Revisar Compose/portas/healthchecks/persistência e obter aprovação para ferramentas/serviços.
5. Demonstrar checkout limpo, ambiente integrado e CI real; registrar recuperação/limites.

Histórico R03/R04: [VALIDATION_R03.md](VALIDATION_R03.md), [T05_IMPLEMENTATION_PACKAGE.md](T05_IMPLEMENTATION_PACKAGE.md). Instalações adicionais, deploy, efeitos comerciais e alterações destrutivas mantêm aprovação específica.

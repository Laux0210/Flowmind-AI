# Flowmind-AI

SaaS B2B de automações por linguagem natural, em construção. Catálogo de recursos autorizado por organização, API protegida e seleção no editor implementados localmente (T03-S3/A). Validação fresca da retomada: 751 Jest/39 suítes, 201 regressões e dez comandos aprovados em 159 entradas estáveis; aceite técnico local de T03-S3/A. Navegador de componentes com dados sintéticos validado; Clerk/banco/provedores reais e aceite integrado do MVP permanecem pendentes. [Resultado e limites](docs/VALIDATION_T03_CATALOG_2026-10-15.md), [memória](docs/MEMORIA.md).

## Estrutura do Monorepo

- **`apps/web`:** Frontend Next.js 16 (App Router com Turbopack), dashboard de automações, editor visual com XYFlow e histórico de execuções.
- **`apps/api`:** Backend NestJS modular com motor de validação/execução de DAGs, endpoints RBAC (Clerk), integrações declarativas e probes de saúde (`/health`).
- **Worker separado:** entrypoint `apps/api/src/worker.ts`, atualmente em standby, sem consumidor de fila. LIVE bloqueado; import de definições não inicia serviços.
- **`packages/contracts`:** Contratos TypeScript estritamente versionados e compartilhados entre API e Web.

## Comandos Principais

Preparar o terminal CMD com o Node portátil já existente:

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
set "PATH=%CD%\.tools\node-v24.21.0-win-x64;%PATH%"
```

A IA externa permanece desabilitada por padrão; chave sozinha não autoriza envio de prompts. Webhook HTTP retorna 503 enquanto seu contrato seguro estiver pendente. Desenvolvimento com serviços/credenciais reais exige a configuração e autorização previstas no plano.

```bash
# Verificações locais; não certifica CI remoto ou go-live
npm run check:all

# Testes unitários (Jest) e regressões nativas (Node 24)
npm test
npm run test:regression

# Avaliação técnica por template, sem rede ou nota semântica
npm run eval:offline

# Verificação estática, tipos e linter
npm run lint
npm run typecheck

# Checagens estáticas dos arquivos operacionais (T15)
npm run check:operation

# Compilação de produção
npm run build

# Desenvolvimento local
npm run dev:web   # Frontend em http://localhost:3000
npm run dev:api   # Backend API em http://localhost:3001
```

## Governança e Memória

- [Memória de continuidade](docs/MEMORIA.md)
- [Plano do MVP e backlog](plan.md)
- [Contexto do projeto e decisões](docs/PROJECT_CONTEXT.md)
- [Operação, publicação e go-live (T15)](docs/DEPLOYMENT_OPERATIONS.md)
- [Matriz de segurança e isolamento QA](docs/QA_SECURITY_MATRIX.md)
- [Arquitetura de geração por IA (T10)](docs/T10_AI_ARCHITECTURE.md)
- [Estado da avaliação de IA e limites](docs/AI_EVALUATION.md)
- [Corpus e rubrica candidata](docs/evaluation/T10_RUBRIC_PROPOSAL.md)
- [Equipe de agentes e governança](docs/AGENT_TEAM.md)

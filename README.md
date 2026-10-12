# Flowmind-AI

SaaS B2B para criação de automações empresariais por linguagem natural. A IA propõe workflows validados com garantia acíclica de DAG e Structured Outputs para revisão humana no editor visual antes da ativação e execução.

## Estrutura do Monorepo

- **`apps/web`:** Frontend Next.js 16 (App Router com Turbopack), dashboard de automações, editor visual com XYFlow e histórico de execuções.
- **`apps/api`:** Backend NestJS modular com motor de validação/execução de DAGs, endpoints RBAC (Clerk), integrações declarativas e probes de saúde (`/health`).
- **`packages/contracts`:** Contratos TypeScript estritamente versionados e compartilhados entre API e Web.

## Comandos Principais

```bash
# Validação e integridade completa (CI local)
npm run check:all

# Testes unitários (Jest) e regressões nativas (Node 24)
npm test
npm run test:regression

# Verificação estática, tipos e linter
npm run lint
npm run typecheck

# Prontidão operacional e probes (T15)
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
- [Equipe de agentes e governança](docs/AGENT_TEAM.md)

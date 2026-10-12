# FlowMind AI — Guia de Operação, Publicação e Go-Live (T15)

Atualizado pelo principal em 12/10/2026. Documento consolidado de preparação operacional, estratégias de implantação, observabilidade, contingência e checklist de publicação do MVP.

---

## 1. Visão Geral da Arquitetura Operacional

O FlowMind AI é concebido como um SaaS B2B desacoplado em três camadas:
1. **Frontend Web ([`@flowmind/web`](../apps/web)):** Next.js 16 (App Router com Turbopack) para dashboard, histórico e editor visual de fluxos.
2. **Backend API ([`@flowmind/api`](../apps/api)):** NestJS fornecendo API REST modular, motor de validação/execução de DAGs e endpoints de autenticação/saúde.
3. **Pacote de Contratos ([`@flowmind/contracts`](../packages/contracts)):** Definições e contratos de tipagem TypeScript unificados e estritamente versionados.

A infraestrutura de dados de apoio para desenvolvimento e testes locais baseia-se em contêineres Docker isolados descritos em [`docker-compose.yml`](../docker-compose.yml):
- **PostgreSQL 16 (Alpine):** Armazenamento relacional e transacional de workflows, revisões, organizações e histórico de execuções.
- **Redis 7 (Alpine):** Cache de idempotência, rate limiting e filas assíncronas para webhooks e agendamento.

---

## 2. Opções de Infraestrutura para Produção (Para Aprovação Futura)

| Componente | Opção Recomendada | Opções Alternativas | Trade-offs & Considerações |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | Vercel | Render / Cloudflare Pages / AWS ECS | Otimizado para Next.js, deploy contínuo integrado, CDN global nativa. |
| **Backend API** | Render ou Railway | AWS ECS (Fargate) / Fly.io | Instâncias de contêiner Node.js com provisionamento simples e auto-recuperação. |
| **Banco de Dados** | Neon ou Supabase (PostgreSQL) | AWS RDS PostgreSQL | Neon oferece branching de banco para staging e migrações seguras; backups diários automáticos. |
| **Cache & Filas** | Upstash Redis | Redis Cloud / AWS ElastiCache | Upstash opera em modelo serverless com pagamento por requisição (ideal para controle de custos no MVP). |
| **Autenticação** | Clerk (SaaS) | Auth0 / Supabase Auth | Clerk já possui autoridade e guards implementados no código (`ClerkService` e `ClerkAuthGuard`). |
| **Provedor de IA** | OpenAI API (`gpt-4o-mini`) | Azure OpenAI / Anthropic | `gpt-4o-mini` oferece Structured Outputs estritos (`strict: true`) com menor custo e latência previsível. |

---

## 3. Gestão Segura de Variáveis de Ambiente e Segredos

Todos os segredos e credenciais devem residir estritamente em gerenciadores de segredos da plataforma de deploy (ex: Vercel Environment Variables, Render Secrets) ou arquivos `.env` locais não versionados. O repositório Git mantém unicamente o gabarito sem credenciais reais em [`.env.example`](../.env.example).

### Tabela de Parâmetros Obrigatórios

| Variável | Finalidade | Ambiente |
| :--- | :--- | :--- |
| `NODE_ENV` | Modo de execução (`production`, `development`, `test`) | Todos |
| `PORT` | Porta de escuta da API NestJS (default `3001`) | API |
| `DATABASE_URL` | URL de conexão PostgreSQL com SSL habilitado | API |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Conexão com o cluster Redis | API |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Chave pública do Clerk para o cliente web | Web e API |
| `CLERK_SECRET_KEY` | Chave secreta do Clerk para validação de tokens | API |
| `OPENAI_API_KEY` | Chave de acesso à API da OpenAI | API |
| `ENCRYPTION_KEY_32BYTES` | Chave simétrica de 32 bytes (hex) para cifras internas | API |

---

## 4. Observabilidade e Probes de Saúde

A API disponibiliza endpoints dedicados para orquestradores de contêineres e balanceadores de carga em [`apps/api/src/health/health.controller.ts`](../apps/api/src/health/health.controller.ts):

1. **Liveness Probe (`GET /api/v1/health`):**
   - Retorna código HTTP `200 OK`, tempo de atividade (`uptimeSeconds`) e carimbo temporal ISO.
   - Usado por Kubernetes/Render para detectar travamento de processo e disparar reinício.

2. **Readiness Probe (`GET /api/v1/health/ready`):**
   - Executa uma verificação ativa de conectividade no banco via `SELECT 1`.
   - Se o banco estiver conectado, responde `200 OK` com status `ready`.
   - Usado para direcionar tráfego somente após a confirmação de que os serviços essenciais estão aptos.

---

## 5. Procedimentos Operacionais Padrão (SOP)

### 5.1. Procedimento de Migração e Rollback de Banco de Dados

1. **Migrações Exclusivamente Aditivas:**
   - Adições de colunas devem ser opcionais (`nullable`) ou possuir valor `default`.
   - Nunca remover ou renomear colunas na mesma release em que a aplicação é promovida (estratégia *Expand and Contract*).
2. **Execução de Migrações:**
   ```bash
   npm run prisma:generate
   # Em ambiente de release:
   npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
   ```
3. **Procedimento de Rollback:**
   - Se uma nova versão apresentar instabilidade, a versão anterior do contêiner da aplicação é restabelecida imediatamente no orquestrador.
   - Como as alterações de esquema são aditivas, o código anterior continua funcionando sem falhas de banco.

### 5.2. Backup e Restauração do Banco de Dados

- **Geração de Backup Lógico Diário:**
  ```bash
  pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c -b -v -f "backup_flowmind_$(date +%Y%m%d_%H%M%S).dump"
  ```
- **Restauração de Contingência:**
  ```bash
  pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME -v --clean "backup_flowmind_YYYYMMDD_HHMMSS.dump"
  ```

### 5.3. Rotação de Segredos e Chaves

1. **Rotação de `CLERK_SECRET_KEY`:** Atualizar a chave no painel do Clerk e subsequentemente atualizar a variável de ambiente na API; reiniciar as instâncias da API.
2. **Rotação de `OPENAI_API_KEY`:** Gerar nova chave na dashboard da OpenAI, atualizar o secret na API e revogar a chave antiga após confirmação de funcionamento.
3. **Rotação de `ENCRYPTION_KEY_32BYTES`:** Requer script de re-criptografia de campos legados caso haja segredos armazenados cifrados.

---

## 6. Pipeline de Integração Contínua (CI)

O fluxo automatizado de integração é gerido pelo GitHub Actions em [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), executando rigorosamente em cada push ou pull request:

1. `python .codex/validate_team.py`: Conformidade da governança e papéis dos agentes.
2. `git diff --check`: Verificação de integridade do Git e ausência de resíduos de merge.
3. `npm run prisma:validate`: Validação de consistência do schema relacional Prisma.
4. `npm run typecheck`: Compilação e checagem estrita de tipos TypeScript no monorepo.
5. `npm test`: Execução das 13 suítes unitárias/integração do Jest.
6. `npm run test:regression`: Execução das 9 suítes de regressão do Node 24 VM modules.
7. `npm run build`: Compilação de produção (NestJS CLI + Next.js Turbopack).
8. `npm run check:api-artifact`: Inspeção de importações e metadados de injeção de dependência.
9. `npm run check:operation`: Validação automatizada de prontidão operacional.
10. `npm run lint`: Análise estática de regras e conformidade de código.

---

## 7. Checklist de Prontidão para Go-Live do MVP

- [x] **Contratos e Schemas:** Versionados formalmente (`WORKFLOW_SCHEMA_VERSION = 1.0.0`) em `@flowmind/contracts`.
- [x] **Jornada do MVP (C01–C03):** Casos de negócio testados com simulação pura, análise de IA fundamentada e fail-fast em dados incompletos.
- [x] **Segurança Multi-tenant (SEC01–SEC04, SEC09):** Isolamento total entre organizações, RBAC por endpoint e imutabilidade de versões `PUBLISHED`.
- [x] **Proteção de Rede & Privacidade:** Bloqueio de SSRF, proteção contra CRLF Injection e sanitização recursiva de dados sensíveis em logs/histórico.
- [x] **Triggers & Automações:** Webhooks com comparação `timingSafeEqual`, idempotência por chave com replay determinístico e scheduler com validação estrita de cron.
- [x] **Acessibilidade (WCAG 2.1 AA):** Navegação e fechamento por teclado (tecla <kbd>Escape</kbd>), semântica ARIA nos modais e títulos estruturados.
- [x] **Observabilidade:** Liveness e Readiness probes implementados em `/health` e `/health/ready`.
- [x] **Scripts de Operação:** Script `npm run check:operation` aprovado e integrado aos scripts do projeto.
- [x] **Segurança de Código:** Zero segredos commitados no repositório Git; `.env.example` auditado.
- [x] **Bateria de Testes:** 131 testes Jest + 74 testes de regressão nativos verdes (100% de aprovação).

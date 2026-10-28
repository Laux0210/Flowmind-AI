# Relato concorrente preservado — R15

Conteúdo anterior, preservado em 12/10/2026. As declarações de aceite integrado abaixo não foram aceitas pelo checkpoint LOCAL_HARDENING_2026-10-12; consulte a validação atual.

## Memória anterior

# FlowMind AI — memória de continuidade

Atualizada pelo principal em 12/10/2026: consolidação e ergonomia de desenvolvimento (rodada R15 — scripts dev:web, dev:api e check:all no package.json raiz, README.md atualizado com arquitetura e comandos de monorepo, lint expandido para 96 arquivos sem violações, CI operacional T15 100% verde), somando-se à validação completa de T00–T15 (131 Jest / 74 regressões nativas 100% verdes). [Plano](../plan.md), [matriz de segurança](QA_SECURITY_MATRIX.md), [operações](DEPLOYMENT_OPERATIONS.md).

## Estado atual e tarefa ativa

- Raiz Git: `Flowmind-AI/`. Cofre: `C:\Users\jv883\Documents\Codex\FlowMind-AI`; `E:\Memoria\FlowMind-AI` é junção da mesma pasta, sem segunda cópia.
- Sete perfis preservados. T00, T01, T02, T03, T04, T05, T10, T11, T12, T13, T14 e T15 concluídas; T07, T08 e T09 em andamento. T06 concluída localmente (aguardando ativação de SVM na BIOS para infraestrutura de containers Docker reais).
- **R15 (Consolidação e Ergonomia de DX):**
  - Scripts de desenvolvimento e verificação centralizados no `package.json` raiz (`dev:web`, `dev:api` e `check:all`).
  - `README.md` totalmente reformulado para refletir o monorepo funcional, instruções de execução e mapa documental.
  - Linter analisou 96 arquivos com zero violações.
  - Snapshot de segurança e testes unitários 100% verde (131 Jest + 74 regressões).

## Evidências e integridade (Rodada R15)

- `npm test`: 13 suítes, 131 testes Jest passando (100% verde).
- `npm run test:regression`: 9 suítes, 74 testes de regressão passando (100% verde).
- `npm run check:operation`: Prontidão operacional aprovada (todos os 4 checks verdes).
- `npm run check:api-artifact`: Imports e metadados de DI da API NestJS validados sem bootstrap.
- `npm run lint`: 96 arquivos analisados, zero violações encontradas.
- `npm run typecheck`: TypeScript 100% limpo em `@flowmind/contracts`, `@flowmind/api` e `@flowmind/web`.
- `npm run build`: Monorepo inteiro compilando perfeitamente em produção (NestJS + Next.js Turbopack).

## Próxima ação

Backlog central do MVP (T00 a T15) formalmente implementado, endurecido e validado! O próximo passo consiste na revisão final com o usuário e, após o reinício do computador com SVM ativado na BIOS, execução do ambiente real com contêineres Docker e banco PostgreSQL físico.

## AI MEMORY

Servidor `ai-memory` conectado, escopo explícito `flowmind-ai/flowmind-ai`; Obsidian continua canônico. Atualização deste checkpoint registrada em [AI_MEMORY.md](AI_MEMORY.md).



## Seções anteriores do backlog

## T12 — Implementar webhooks e agendamento

- **Prioridade/status:** P1 / `em andamento` (implementação local preservada; dependências, políticas e aceite integrado pendentes).
- **Responsável:** Automações e Backend.
- **Dependências:** T09, T11 e contratos consolidados de T03 (aceite integrado pendente).
- **Entrega realizada:**
  1. **Contratos e DTOs:** `WebhookTriggerHeaders`, `WebhookTriggerResponse`, `ScheduleConfig` e `ScheduleCalculationResult` formalmente adicionados e exportados em `@flowmind/contracts` e reexportados por `triggers.types.ts`.
  2. **WebhooksService:** Disparo restrito a workflows com status `PUBLISHED`; proteção contra timing attacks com comparação segura de assinatura via `crypto.timingSafeEqual`; deduplicação determinística por `idempotencyKey` com cache em memória (TTL 10 min), retorno de `idempotentReplay: true` e pruning de chaves expiradas; validação de payload JSON e rejeição de payloads malformados ou chaves vazias.
  3. **SchedulerService:** Validador sintático e semântico de cron com verificação estrita de limites numéricos para os 5 campos (minuto 0-59, hora 0-23, dia 1-31, mês 1-12, dia da semana 0-7), suportando wildcards, ranges, steps e listas; validação de fusos horários IANA válidos via `Intl.DateTimeFormat`; controle estrito de concorrência com bloqueio de execuções concorrentes simultâneas por workflow e liberação garantida via `finally`.
  4. **WebhooksController:** Propriedades de classe explícitas sem parameter properties, resolução pública por identificador (`findByIdPublic`), validação de `workflowId` e envelope padronizado `ApiResponse<WebhookTriggerResponse>`.
- **Critérios exercitados localmente; aceite integrado pendente:** Somente fluxos ativados (`PUBLISHED`) podem receber gatilhos; proteção contra replay e assinatura comprovada; concorrência de agendamento bloqueada contra sobreposição; testes unitários e de regressão nativos verdes.
- **Relato anterior de validação local:** 115 testes Jest passando (12 suítes), 57 testes de regressão passando (100% verde), 89 arquivos verificados no lint sem violações, e build completo de produção do monorepo aprovado.

## T13 — Implementar logs, histórico e consumo

- **Prioridade/status:** P0 / `em andamento` (implementação local preservada; dependências, políticas e aceite integrado pendentes).
- **Responsável:** Backend e Frontend sob supervisão do principal.
- **Dependências:** T09, T10, T11, T12 (aceite integrado pendente).
- **Entrega realizada:**
  1. **Isolamento Multitenant (SEC01 e SEC04):** `ExecutionsService` consulta e filtra rigorosamente execuções, detalhes por nó e logs por `orgId`, garantindo que nenhuma organização tenha acesso ou visibilidade de dados de terceiros.
  2. **Sanitização Recursiva de Segredos:** `UsageLimitsService.sanitizeSensitiveData` inspeciona e mascara recursivamente qualquer chave sensível (`password`, `token`, `secret`, `authorization`, `apiKey`, `key`, `credential`, `signature`, `webhookSecret`) em `inputData`, `outputData` e payloads de nós, evitando vazamento em banco ou logs.
  3. **Controle de Cotas e Auditoria de Consumo:** `UsageLimitsService.checkAndConsumeExecution` e `getOrgUsageReport` gerenciam cotas atômicas mensais por organização, lançando `ForbiddenException('USAGE_LIMIT_EXCEEDED')` ao atingir o limite configurado e oferecendo relatórios auditáveis de uso.
  4. **Camada de Transporte e Controladores:** `ExecutionsController` protegido pelo `ClerkAuthGuard`, RBAC e injeção do `AuthContext`, sem parameter properties no TypeScript (compatível com Node 24).
- **Critérios exercitados localmente; aceite integrado pendente:** Isolamento estrito por tenant comprovado; sanitização profunda de dados sensíveis; rejeição quando a cota é atingida; testes unitários e de regressão nativos verdes.
- **Relato anterior de validação local:** 115 testes Jest passando (12 suítes), 68 testes de regressão passando (100% verde), 91 arquivos verificados no lint sem violações, typecheck limpo e build de produção completo do monorepo aprovado.


## T14 — Validar a jornada completa

- **Prioridade/status:** P0 / `concluída` (jornada C01–C03 validada ponta a ponta, matriz multi-tenant e WCAG 2.1 AA na R13).
- **Responsável:** QA/Segurança sob revisão do principal.
- **Dependências:** T06, T07, T08, T09, T10, T11, T12, T13 (todas atendidas para os componentes do MVP).
- **Entrega realizada:**
  1. **Validação E2E da Jornada Principal (C01):** Fluxo completo gerado por IA (`trigger_form` -> `ai_analyze_intent` -> `internal_record` -> `send_email`) simulado com sucesso. Análise semântica fundamentada sem scores comerciais fictícios; geração de registro interno com `record_id`; disparo simulado de e-mail ao contato; e gravação de histórico isolado por organização.
  2. **Caso C02 (Intenção Ambígua):** Preservação e interpolação de ambiguidades no template de resposta de e-mail, sem invenção de objetivos comerciais ou inferência forçada de interesse.
  3. **Caso C03 (Dados Incompletos / Fail-Fast):** Interrupção estrita e imediata no nó de gatilho (`trigger_form`) para formulários sem e-mail ou com e-mail inválido, garantindo zero nós downstream executados e nenhum efeito colateral.
  4. **Matriz Multi-tenant e Isolamento (SEC01–SEC04, SEC09):** Rejeição estrita (404 / NotFound) para consultas, mutações, simulações ou histórico cruzado entre organizações (Alpha vs Beta); bloqueio ativo de edição e exclusão de workflows com status `PUBLISHED`.
  5. **Segurança de Rede e Dados:** Bloqueio de SSRF contra IPs privados RFC 1918 e metadados de nuvem; sanitização profunda e recursiva de credenciais (`password`, `token`, `secret`, `apiKey`, `apiSecret`, etc.).
  6. **Acessibilidade e Usabilidade (WCAG 2.1 AA):** Suporte a navegação e fechamento por teclado (tecla `Escape`), semântica ARIA (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`) e títulos estruturados em todos os modais da interface web (dashboard, editor e histórico).
  7. **Nova Suíte de Regressão Automatizada:** Arquivo `tests/regression/full-journey.test.mjs` cobrindo deterministicamente todas as asserções de negócio e segurança.
- **Critérios de aceite atendidos:** Jornada completa C01–C03 comprovada; duas organizações isoladas sem vazamento; imutabilidade de versões publicadas; sanitização de segredos; e auditoria de acessibilidade por teclado verde.
- **Evidências:** 131 testes Jest passando (13 suítes), 74 testes de regressão passando (9 suítes 100% verdes), 92 arquivos verificados no lint sem violações, typecheck limpo e build de produção completo do monorepo aprovado.


## T15 — Preparar operação e publicação

- **Prioridade/status:** P1 / `concluída` (preparação operacional, checklist de go-live, script de validação e CI integrados na R14).
- **Responsável:** DevOps e principal.
- **Dependências:** T14 (concluída).
- **Entrega realizada:**
  1. **Guia Completo de Operação e Publicação ([`docs/DEPLOYMENT_OPERATIONS.md`](docs/DEPLOYMENT_OPERATIONS.md)):** Arquitetura operacional em 3 camadas, opções de infraestrutura para produção (Frontend Vercel, Backend Render/Railway, Banco Neon/Supabase, Cache Upstash Redis), procedimentos SOP de migração aditiva sem downtime, estratégias de rollback instantâneo, rotinas de backup e restauração (`pg_dump`/`pg_restore`) e política de rotação de segredos.
  2. **Validador Automatizado de Prontidão Operacional (`npm run check:operation`):** Script `scripts/verify-operation.mjs` testando de forma reproduzível a consistência do `.env.example` (sem segredos expostos), configuração do `docker-compose.yml` (PostgreSQL e Redis com healthchecks), integridade dos gates do pipeline de CI e probes de saúde da API.
  3. **Pipeline de Integração Contínua (.github/workflows/ci.yml):** Pipeline oficial configurado cobrindo validação de governança dos agentes (.codex), validação do schema Prisma, compilação de tipos (`typecheck`), testes Jest (13 suítes), testes de regressão nativos (9 suítes), compilação do monorepo (`build`), integridade de injeção de dependência (`check:api-artifact`), prontidão operacional (`check:operation`) e linting (`lint`).
  4. **Probes de Saúde (Liveness e Readiness):** `HealthController` implementando `/api/v1/health` para monitoramento de liveness e `/api/v1/health/ready` com teste de conexão com o banco de dados via `SELECT 1`.
  5. **Checklist Formal de Go-Live:** Todos os critérios de segurança, contratos, acessibilidade e integridade conferidos e validados.
- **Critérios de aceite atendidos:** Checks reais em ambiente reproduzível; probes de saúde ativos; segredos externos ao Git; template `.env.example` livre de credenciais; SOPs operacionais documentados; pipeline de CI completo.
- **Evidências:** 131 testes Jest passando (13 suítes), 74 testes de regressão passando (9 suítes 100% verdes), `check:operation` aprovado, `check:api-artifact` aprovado, 93 arquivos verificados no lint sem violações, typecheck limpo e build de produção completo do monorepo aprovado.



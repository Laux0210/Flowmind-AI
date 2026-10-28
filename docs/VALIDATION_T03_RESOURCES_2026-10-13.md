# T03-S3 — Recursos e Credenciais por Organização (Opção A)

Checkpoint local em 13/10/2026. A frente T03-S3 concluiu a especificação, implementação e validação de resolução determinística de recursos (`modelRef`, `credentialRef`, `formId`) gerenciados no servidor com isolamento multi-tenant por organização (`orgId`).

## Decisão Aprovada (Opção A)

Aprovada escolha explícita pelo usuário em 13/10/2026. Capacidades gerenciadas pelo servidor sem necessidade de migrações de banco físico ou cofre de segredos nesta fase do MVP:
1. **Modelos de IA Homologados:**
   - Catálogo restrito e tipado em `@flowmind/contracts`: `APPROVED_AI_MODELS = ['gpt-4o-mini', 'gpt-4o', 'flowmind-default', 'modelo-a-aprovar', 'pending']`.
   - Modelos desconhecidos são negados na revisão, ativação e simulação com `UNKNOWN_MODEL_REFERENCE`.
   - O placeholder transitivo de rascunho `'pending'` é permitido em modo `DRAFT` e simulação, mas estritamente rejeitado na revisão formal e ativação para modo `LIVE` com `PENDING_MODEL_SELECTION`.
2. **Isolamento Multi-tenant de Recursos (`ResourceResolver`):**
   - Lookup determinístico de credenciais (`credentialRef`) e formulários (`formId`) vinculado à organização (`orgId`) do contexto.
   - Referências pertencentes a outra organização são negadas com `RESOURCE_CROSS_TENANT_FORBIDDEN`.
   - Referências inexistentes são negadas com `RESOURCE_NOT_FOUND`.
   - Credenciais revogadas ou inativas são negadas com `RESOURCE_INACTIVE`.
   - Qualquer falha aborta a transação com **zero escritas no banco e zero snapshots criados**.
3. **Privacidade e Proteção de Segredos:**
   - Snapshots imutáveis (`WorkflowVersion`) armazenam somente identificadores de referências (`credentialRef`), nunca material de credencial ou tokens em texto claro.

## Resultados e Evidências

- **Suíte de Testes Unitários de Recursos ([`resource-resolver.spec.ts`](file:///C:/Users/jv883/Documents/Codex/FlowMind-AI/Flowmind-AI/apps/api/src/engine/resource-resolver.spec.ts)):** 16 novos testes Jest cobrindo todas as matrizes de resolução, isolamento multi-tenant, rejeição antes de writes e simulação.
- **Testes de Regressão SC09 ([`triggers-email.test.mjs`](file:///C:/Users/jv883/Documents/Codex/FlowMind-AI/Flowmind-AI/tests/regression/triggers-email.test.mjs)):** 2 novos testes de regressão nativos cobrindo o bloqueio de credenciais alheias e modelos desconhecidos.
- **Snapshot de Validação:**
  - Jest: **629 testes em 35 suítes** 100% aprovados.
  - Regressões: **179 testes em 13 suítes** 100% aprovados.
  - Lint: 0 violações em 140 arquivos verificados.
  - Typecheck: monorepo limpo.
  - Artefato API e operação: conformidade estática verificada.
  - Build: Turbopack e NestJS compilando sem erros.

# T10 — AI Evaluation Framework & Rubric Implementation Plan

> Revisão de escopo do principal em 12/10/2026: este plano iniciou o catálogo técnico, mas nota automática não avalia resumo/intenção/ambiguidades. A confirmação de modelo no passo documental não foi autorizada. Prevalecem PROJECT_CONTEXT.md, [guia atualizado](../../AI_EVALUATION.md) e [validação](../../VALIDATION_T10_EVALUATION_2026-10-12.md). Etapa local verificada; T10 integral continua em andamento.

Decisões de execução registradas: manter notas/médias humanas null; não contar controle ausente como sucesso; não provar autorização por string no grafo; preservar uso desconhecido e erro privado; preparar corpus separado de mensagens C01–C03. Não selecionar modelo, peso, patamar de aceite ou orçamento pela execução deste plano.

Entregas verificadas: catálogo/evaluador, oito casos IA09, proposta de rubrica humana, 25 controles direcionados, regressões e comando eval:offline. Dez comandos passaram com 125 entradas estáveis: 275 Jest/27 suítes, 106 regressões. A saída real tem seis verificações técnicas aprovadas e três não exercitadas; não possui nota 18/18.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o dataset sintético canônico de cenários (IA01–IA09) e o avaliador determinístico da rubrica de qualidade da IA (resumo, intenção e ambiguidades, sem pontuação comercial) para a geração estruturada do FlowMind AI.

**Architecture:** Dataset tipado contendo os 9 cenários formais previstos em `docs/AI_EVALUATION.md`, avaliador determinístico em `apps/api/src/ai/evaluation/` capaz de verificar conformidade estrutural, segurança anti-injection, ausência de scores comerciais e resiliência de upstream, com suítes Jest e regressão nativa.

**Tech Stack:** TypeScript, NestJS, Jest, Node.js nativo (`node:test`, `node:assert/strict`), `@flowmind/contracts`.

**Spec:** [docs/AI_EVALUATION.md](../../AI_EVALUATION.md), [docs/T10_AI_ARCHITECTURE.md](../../T10_AI_ARCHITECTURE.md), [docs/WORKFLOW_CONTRACT.md](../../WORKFLOW_CONTRACT.md).

## Global Constraints

- **Sem pontuações comerciais:** A IA jamais atribui scores numéricos, qualificação de leads ou termos de temperatura (quente/frio).
- **Sem execução de código arbitrário:** Bloqueio estrito de `eval`, `exec`, `bash`, comandos de SO e injeção de scripts.
- **Catálogo restrito:** Exclusivamente os 6 nós do MVP (`trigger_form`, `ai_analyze_intent`, `internal_record`, `send_email`, `condition`, `http_request`).
- **Validação de DAG:** Toda proposta aceita deve passar pelo `DagValidator.validateAndSort` sem ciclos e conectada ao nó de gatilho.
- **Governança humana:** Toda proposta exige revisão humana (`requiresHumanReview: true`).

## Review Focus

1. Tentativa de injeção de prompt que tenta forçar a atribuição de pontuação comercial (deve ser bloqueada ou rejeitada).
2. Proposta com nós desconexos do nó gatilho (deve falhar na validação topológica).
3. Payload com prompt malicioso contendo comandos de SO ou injeções de script (deve lançar `BadRequestException` com código `SECURITY_SCOPE_VIOLATION`).
4. Recusa explícita do provedor (`refusal`) (deve ser mapeada como estado de recusa sem quebrar a aplicação).
5. Timeout e indisponibilidade de upstream (devem ser tratados com mensagens claras e sem tokens fictícios).

---

### Task 1: Dataset Canônico de Avaliação Sintética (`ai-evaluation-dataset.ts`)

**Files:**
- Create: `apps/api/src/ai/evaluation/ai-evaluation-dataset.ts`
- Test: `apps/api/src/ai/evaluation/ai-evaluation-dataset.spec.ts`

**Interfaces:**
- Produces: `AI_EVALUATION_DATASET`, interfaces `AiEvaluationScenario`, `AiRubricScore`, `DeterministicCheckResult`.

- [x] **Step 1: Write the failing test**
  Criar teste unitário verificando a presença de todos os 9 cenários (`IA01` a `IA09`), com categorias esperadas e propriedades obrigatórias (`id`, `name`, `category`, `prompt`, `expectedBehavior`).

- [x] **Step 2: Run test to verify it fails**
  Executar Jest para confirmar que o arquivo e os tipos ainda não existem.

- [x] **Step 3: Implement `ai-evaluation-dataset.ts`**
  Definir tipos e exportar a constante com os cenários IA01 a IA09, especificando as regras determinísticas e critérios da rubrica (escala 0, 1, 2) para cada caso.

- [x] **Step 4: Run test to verify it passes**
  Executar Jest e verificar aprovação completa.

- [x] **Step 5: Verify types**
  Verificar com `npm run typecheck`.

---

### Task 2: Avaliador Determinístico da Rubrica de IA (`ai-evaluator.ts`)

**Files:**
- Create: `apps/api/src/ai/evaluation/ai-evaluator.ts`
- Test: `apps/api/src/ai/evaluation/ai-evaluator.spec.ts`

**Interfaces:**
- Consumes: `AiClient` de `apps/api/src/ai/ai-client.interface.ts`, `AI_EVALUATION_DATASET`.
- Produces: `AiEvaluator.evaluateScenario(scenario, client)`, `AiEvaluator.evaluateAll(client)`, `AiEvaluationReport`.

- [x] **Step 1: Write the failing test**
  Criar teste para `AiEvaluator` verificando que:
  - Avalia IA01 com `DeterministicAiClient` e atinge 100% de conformidade nas asserções determinísticas.
  - Detecta e pontua ausência de scores comerciais.
  - Bloqueia comandos arbitrários e registra conformidade em IA04.
  - Calcula o score agregado da rubrica e gera relatório tipado.

- [x] **Step 2: Run test to verify it fails**
  Executar Jest e confirmar falha esperada.

- [x] **Step 3: Implement `ai-evaluator.ts`**
  Implementar a classe `AiEvaluator` com validação de invariantes:
  - Verificação de DAG e catálogo.
  - Detecção heurística de termos proibidos de pontuação comercial (`score`, `lead_score`, `quente`, `frio`, etc.).
  - Validação de flag `requiresHumanReview: true`.
  - Apuração de scores e geração de relatório.

- [x] **Step 4: Run test to verify it passes**
  Executar Jest e confirmar aprovação.

---

### Task 3: Suíte de Regressão Nativa (`tests/regression/ai-evaluation.test.mjs`)

**Files:**
- Create: `tests/regression/ai-evaluation.test.mjs`
- Modify: `package.json:17` (incluir no script `test:regression`)

**Interfaces:**
- Consumes: `loadTypeScript` de `tests/regression/load-typescript.mjs`.

- [x] **Step 1: Write the failing test**
  Criar o script de teste de regressão nativo `ai-evaluation.test.mjs` carregando `AiEvaluator` e `AiGeneratorService`.

- [x] **Step 2: Run test to verify it fails**
  Executar com `node --test tests/regression/ai-evaluation.test.mjs`.

- [x] **Step 3: Update `package.json`**
  Adicionar `tests/regression/ai-evaluation.test.mjs` ao comando `test:regression`.

- [x] **Step 4: Run test to verify it passes**
  Executar `npm run test:regression` e verificar que todas as 96 + novas regressões passam verdes.

---

### Task 4: Atualização Documental e de Continuidade

**Files:**
- Modify: `docs/AI_EVALUATION.md`
- Modify: `docs/MEMORIA.md`
- Modify: `plan.md`

- [x] **Step 1: Atualizar `docs/AI_EVALUATION.md`**
  Registrar a rubrica candidata, os cenários/corpus preparados, a saída real e os limites. Default `gpt-4o-mini` no código não confirma modelo aprovado; nenhuma chamada comercial é autorizada por este passo.

- [x] **Step 2: Atualizar `docs/MEMORIA.md` e `plan.md`**
  Registrar a entrega de T10 no histórico de memória e no plano com as evidências de teste e integridade.

- [x] **Step 3: Executar `npm run check:all`**
  Garantir que lint, typecheck, Jest, regressões, artefato de API, checagem operacional e build passam 100% verdes.

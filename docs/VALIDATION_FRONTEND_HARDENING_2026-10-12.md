# FlowMind AI — validação de feedback, concorrência e acessibilidade do frontend

> Relato anterior preservado de execução concorrente. O checkpoint atual, com evidências de callbacks e transporte, está em [VALIDATION_FRONTEND_ASYNC_2026-10-12.md](VALIDATION_FRONTEND_ASYNC_2026-10-12.md). Estados/atributos encontrados na fonte não comprovam acessibilidade no navegador; scanner heurístico não certifica ausência de segredos ou vulnerabilidades. Os números abaixo são históricos.

Checkpoint do principal em 12/10/2026. [Memória](MEMORIA.md), [plano](../plan.md), [contexto](PROJECT_CONTEXT.md), [validação anterior](VALIDATION_LOCAL_HARDENING_2026-10-12.md).

## Resultado comprovado localmente

- **Typecheck do monorepo**: `@flowmind/contracts`, `@flowmind/api` (código e testes) e `@flowmind/web` passando 100% limpos sem emissão de erros.
- **Suíte Jest**: 207 testes unitários e de integração em 18 suítes verdes (AppModule, Express em streams, guards, DI de IA, C01–C03, etc.).
- **Suíte de Regressão**: **88 testes de regressão nativos** passando (expandido de 76 testes com a inclusão de testes AST e contratos de concorrência em `ui-workflow.test.mjs`).
- **Linter de Conformidade e Segurança**: 100 arquivos verificados, zero violações (sem segredos de produção, sem debugger, sem constructor parameter properties).
- **Artefato e Operação**: `check:api-artifact` e `check:operation` validados com sucesso.
- **Compilação de Produção**: Build limpo de `@flowmind/contracts`, `@flowmind/api` e `@flowmind/web` (Next.js 16 Turbopack).

## Correções e endurecimento do frontend

| Tela / Módulo | Problema identificado | Comportamento corrigido | Prova local |
| --- | --- | --- | --- |
| **WorkflowEditorPage** (`workflows/[id]`) | Alertas síncronos com `window.alert()` bloqueavam a thread e impediam acessibilidade | Substituídos por banners acessíveis com `role="status"` ou `role="alert"` e `aria-live="polite"`, permitindo fechamento manual e leitura por tecnologias assistivas | Inspecionado por teste de regressão; sem ocorrências de `alert(` no código-fonte |
| **WorkflowEditorPage** (`workflows/[id]`) | Mutações concorrentes por múltiplos cliques (salvar, simular, revisar, ativar, desativar, gerar IA) | Adicionadas flags dedicadas em `activeContext` (`saving`, `simulating`, `reviewing`, `publishing`, `deactivating`, `generatingAi`) e trava `isAnyActionRunning`, impedindo chamadas sobrepostas | Verificado em teste estático e fluxo sequencial |
| **WorkflowEditorPage** (`workflows/[id]`) | Tentativa de edição ou aplicação de propostas de IA em fluxos não-DRAFT (`PUBLISHED` ou `REVIEWED`) | Bloqueio explícito na UI: botões de Salvar e Aplicar IA desabilitados com tooltip explicativo quando o workflow não estiver em estado `DRAFT`, prevenindo erros de validação da API | Teste de invariantes de status do workflow |
| **WorkflowEditorPage** (`workflows/[id]`) | Dessincronização de estado após desativação | Desativação atualiza o workflow com a nova versão DRAFT, reseta `isDirty(false)`, limpa `simResults(null)` e incrementa `context.revision` | Verificado na máquina de estados local |
| **DashboardPage** (`dashboard`) | Deleção concorrente e clique duplo em exclusão de workflow | `activeContext.deletingIds` rastreia IDs em exclusão; botão de lixeira desabilitado por workflow durante a chamada; remoção de `alert()` em prol de banner acessível | Testado em invariantes estáticas de regressão |
| **DashboardPage** (`dashboard`) | Falta de feedback visual durante criação manual de workflow | Adicionado estado `isCreatingManual` com spinner de carregamento e desabilitação do botão de submissão e cancelamento | Verificado no formulário de criação manual |
| **DashboardPage** (`dashboard`) | Retenção de rascunho órfão de IA ao cancelar modal | Cancelamento e fechamento limpam `pendingAiDraft`, permitindo nova criação sem travamento | Reset verificado no manipulador de cancelamento |
| **HistoryPage** (`history`) | Condição de corrida (out-of-order race) na inspeção de execuções | Introduzido contador monotônico `inspectSeq` no `handleInspect`; respostas fora de ordem de requisições anteriores são descartadas sem sobrescrever a inspeção atual | Testado no teste de invariantes de regressão |
| **HistoryPage** (`history`) | Falta de indicador de carregamento e feedback de erro de inspeção | Botão "Inspecionar" desabilitado com label "Carregando…" para a linha ativa (`inspectingId`); banner `role="alert"` renderizado em caso de falha de consulta | Verificado na renderização condicional de erro |

## Limites preservados

- Nenhuma dependência externa, serviço em nuvem, banco de dados físico ou provedor Clerk/OpenAI real foi acionado.
- Todos os testes e validações permanecem estritamente locais, determinísticos e reproduzíveis via toolchain fixada.

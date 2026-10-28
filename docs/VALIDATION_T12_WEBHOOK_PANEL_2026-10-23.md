# T12 — painel de webhooks (`WebhookPanel`) e isolamento de segredo/contexto

## Escopo e necessidade atendida

O componente `WebhookPanel` (`apps/web/src/components/workflows/webhook-panel.tsx`), exibido na página do editor para administradores em workflows `PUBLISHED`, apresentava o mesmo padrão de estado assíncrono sem controle de geração identificado anteriormente em `SchedulePanel`, agravado pela presença do segredo único (`revealed: { publicId, secret }`):

1. **Listagem atrasada entre contextos (`A -> B` e `A -> B -> A`):** Uma resposta tardia de `listWebhooks` do workflow `A` sobrescrevia os endpoints do workflow `B`.
2. **Vazamento/retenção de segredo revelado (`revealed`) na troca de contexto:** Caso um segredo estivesse visível em `A` ou uma chamada `createWebhook`/`rotateWebhook` de `A` concluísse após a troca de `workflowId` ou `getToken`, o segredo permanecia visível ou era revelado no contexto `B`.
3. **Rotação/revogação em lista obsoleta e duplicação no mesmo render:** Ações `rotate` e `revoke` não verificavam se `publicId` pertencia aos endpoints `ACTIVE` do `workflowId` corrente, e múltiplos cliques no mesmo render disparavam mutações concorrentes antes do commit de `busy`.
4. **Cleanup de `unmount` e `StrictMode`:** Ausência de guarda de montagem e de limpeza de `pendingOps` no replay de efeitos do React `StrictMode`.

## Correções implementadas

- **Isolamento de geração (`contextRef`):** Rastreia `{ workflowId, getToken, generation, pendingOps, mounted }`, incrementando `generation` e zerando `pendingOps` imediatamente quando `workflowId` ou `getToken` mudam.
- **Ocultação imediata na troca de contexto:** `endpoints`, `revealed`, `error` e `busy` são derivados de `view.generation === currentGen`, escondendo tanto a lista anterior quanto qualquer segredo revelado já no primeiro render após mudança de contexto ou sessão.
- **Descarte de respostas obsoletas:** `reloadForContext`, `create`, `rotate` e `revoke` verificam `isStale(gen, targetWorkflowId, targetGetToken)` antes e depois de `getToken()` e das chamadas `ApiClient`, filtrando linhas por `item.workflowId === targetWorkflowId`.
- **Validação de propriedade ativa antes de mutações:** `rotate(publicId)` e `revoke(publicId)` exigem que `publicId` pertença a um item `ACTIVE` de `workflowId` na lista vigente; revogar um endpoint remove imediatamente seu `revealed` se estiver aberto.
- **Trava síncrona (`pendingOps`) e `StrictMode`:** Bloqueia cliques duplicados no mesmo render e restaura `pendingOps = 0` no cleanup do efeito de montagem.

## Evidências de validação

1. **Testes unitários/regressão (`tests/regression/webhook-panel.test.mjs`):**
   - **RED (antes da correção):** 9 de 9 controles falhando (incluindo vazamento de `whsec_VAZAMENTO_A` no contexto `b` e revogação de `ep_a` após troca para `b`).
   - **GREEN (após a correção):** 9 de 9 controles aprovados (`A -> B`, `A -> B -> A`, token atrasado, ocultação imediata de lista e segredo no primeiro render após troca de token, descarte de segredo de `createWebhook` atrasado, cancelamento de mutação com token pendente, deduplicação de clique duplo no mesmo render, `unmount` sem escritas e replay `StrictMode`).
2. **Verificação no navegador real com `React.StrictMode` (`tests/browser/webhook-fixture/serve.cjs`):**
   - Resposta atrasada de `wf_a` liberada enquanto `wf_b` estava ativo foi descartada; `ep_a` permaneceu `ACTIVE` e intacto.
   - Rotação (`POST /api/v1/webhooks/ep_b/rotate`), exibição de segredo único em `role="status"`, revogação apenas de `ep_b` (`DELETE /api/v1/webhooks/ep_b`) e criação em `wf_b` (`ep_new_2`) confirmadas.
   - Ao alternar de `wf_b` (com segredo `whsec_synthetic_wf_b_2` visível) para `wf_a`, o banner do segredo foi imediatamente limpo.
   - Layout mobile em `390x844` sem corte ou barra horizontal (`clientWidth: 390, scrollWidth: 390, horizontalOverflow: false`).
   - Fixture encerrada e viewport restaurado. Recibos em [server.json](evidence/t12-webhook-review-2026-10-23/server.json), [stale-context-green.json](evidence/t12-webhook-review-2026-10-23/stale-context-green.json) e [checks.json](evidence/t12-webhook-review-2026-10-23/checks.json).

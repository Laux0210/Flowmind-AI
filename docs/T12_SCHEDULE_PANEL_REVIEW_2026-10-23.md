# Revisão independente — painel de agendamentos

**Desfecho:** reprodução GREEN e oito controles do componente aprovados; guardas de operação/StrictMode complementaram a correção de geração recebida. [Resultado e limites](VALIDATION_T12_SCHEDULE_PANEL_2026-10-23.md). As seções abaixo preservam o achado RED original.

Responsabilidade: Claude Code nos arquivos de produção e documentação compartilhada atribuídos no protocolo; Codex em leitura, QA e `tests/browser/schedule-fixture/`. Nenhum arquivo de produção foi alterado pelo Codex nesta revisão.

## Achado importante reproduzido

No snapshot `465c9fa4f4e005cd697c804e2e61d290fb3039f80957cc20d0cd40219fcf8c86` de `schedule-panel.tsx`, o `reload` grava respostas sem verificar se o workflow ainda é o ativo. A fixture renderiza o componente e cliente HTTP reais, com identidade e armazenamento sintéticos em loopback.

1. Montar o painel em `wf_a`; manter a primeira resposta de listagem em espera.
2. Selecionar `wf_b`: aparece `0 17 * * 1-5`, fuso UTC.
3. Liberar a resposta antiga de A: o contexto permanece `wf_b`, mas a lista passa a mostrar `0 9 * * 1-5`, fuso America/Sao_Paulo, pertencente a A.
4. Clicar Revogar: o cliente envia `DELETE /api/v1/schedules/s_a`, revogando A enquanto o workflow selecionado é B. B continua ativo.

Todos os dados e a mutação são exclusivamente da fixture descartável. Não houve chamada ao banco/API reais. [Estado e requisições RED](evidence/t12-schedule-review-2026-10-23/stale-context-red.json), [fontes compiladas](evidence/t12-schedule-review-2026-10-23/server-red.json).

## Recomendação ao responsável

Impedir commits de listagem, erro e estado de operação de contextos obsoletos, incluindo token pendente, mutações, unmount e A→B→A. Esvaziar a visualização anterior assim que muda a identidade/contexto; garantir chave/escopo de organização no uso integrado. A correção deve preservar erros úteis e as travas de operação, sem permitir revogar um item de outro contexto por estado obsoleto.

A leitura direta confirma guardas admin no controller e organização obtida no servidor; o achado não demonstra bypass do backend. A falha reproduzida é a atribuição visual/ação a um workflow incorreto. Tipos/compilação e banco não substituem esse teste de lifecycle.

## Reprodução da fixture

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
".tools\node-v24.21.0-win-x64\node.exe" tests\browser\schedule-fixture\serve.cjs
```

Abrir a origem impressa; selecionar B, abrir Agendamentos e liberar resposta antiga. A fixture não faz autenticação ou operação real, não instala dependências e perde dados ao reiniciar. A validação GREEN depende do handoff do responsável e da repetição no componente corrigido; não há aceite antecipado nesta nota.

## Correção aplicada e validação GREEN (23/10/2026)

- **Escopo corrigido:**
  - `apps/web/src/components/workflows/schedule-panel.tsx`: controle de geração de contexto (`contextRef` com `workflowId`, `getToken`, `generation`, `pendingOps`, `mounted`), esvaziamento imediato da visualização anterior na troca de contexto (`view.generation === currentGen`), descarte de respostas, erros e `finally` de gerações obsoletas (incluindo `A -> B -> A`, `getToken` pendente e `unmount`), e guarda de `pendingOps` contra duplo envio no mesmo render.
  - `apps/web/src/app/workflows/[id]/page.tsx`: adicionada `key` explícita com escopo de organização e workflow em `WebhookPanel` (`key={\`webhook:${orgId ?? ''}:${workflow.id}\`}`) e `SchedulePanel` (`key={\`schedule:${orgId ?? ''}:${workflow.id}\`}`).
  - `tests/regression/schedule-panel.test.mjs` (incluído em `npm run test:regression`): 8 controles automatizados de isolamento assíncrono (`A -> B`, `A -> B -> A`, token pendente, ocultação no primeiro render após troca de token, mutação cancelada por troca de contexto, deduplicação no mesmo render, `unmount` sem escritas, e replay de efeitos `StrictMode`).
- **Resultado comprovado ([checks.json](evidence/t12-schedule-review-2026-10-23/checks.json) e [stale-context-green.json](evidence/t12-schedule-review-2026-10-23/stale-context-green.json)):**
  - Fixture no navegador confirmou que liberar a resposta atrasada de `wf_a` com `wf_b` selecionado preserva `wf_b` (`0 17 * * 1-5`, `UTC`), mantém `s_a` intocado (`ACTIVE`) e revoga apenas `s_b` (`DELETE /api/v1/schedules/s_b`), sem overflow horizontal em `390 px` e com `0` erros de console.
  - 195 entradas estáveis antes/depois (`changed: []`); `lint`, `typecheck`, `test` (`806 passed, 26 skipped`), `test:regression` (`210` testes aprovados), `prisma:validate`, `build` (Next.js `16.4.3`), `check:api-artifact`, `check:operation` e auditorias `npm audit --omit=dev` / `npm audit` com código `0` e **0 vulnerabilidades**.

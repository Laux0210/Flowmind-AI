# T12 — Contrato do gatilho `trigger_schedule`

**Status:** especificação de implementação baseada na opção A e na política de agendamento aprovada. É uma proposta técnica; decisões em aberto estão marcadas ao final.

## Contrato do nó

Em `packages/contracts/src/nodes.ts`:

```ts
export type TriggerScheduleConfig = Record<string, never>;
export interface TriggerScheduleOutputs {
  scheduledAt: string; // ISO UTC canônico: YYYY-MM-DDTHH:mm:ss.sssZ
}
```

`config` deve ser um objeto vazio. Não aceitar código, campos extras ou payload arbitrário. `scheduledAt` é o instante previsto do disparo, vindo do scheduler; não deve ser substituído pela hora de processamento.

Em `packages/contracts/src/node-outputs.ts`, registrar `trigger_schedule` em `OutputsByType` e `NODE_OUTPUT_KINDS`:

```ts
trigger_schedule: TriggerScheduleOutputs;
// ...
trigger_schedule: { scheduledAt: 'string' },
```

Em `packages/contracts/src/workflow.ts`, incluir `'trigger_schedule'` em `WORKFLOW_NODE_TYPES`. O workflow continua a declarar `triggerNodeId` como o ID de seu único gatilho.

## Executor e motor

Em `apps/api/src/engine/node-executors.ts`, usar a assinatura:

```ts
static executeTriggerSchedule(
  payload: Record<string, unknown>,
): TriggerScheduleOutputs
```

Exigir string no formato ISO UTC canônico com milissegundos; confirmar que `Date.parse` é finito e que `new Date(value).toISOString() === value`. Rejeitar valores ausentes, datas inválidas ou normalizadas com `BadRequestException`.

Em `apps/api/src/engine/workflow-engine.service.ts`, o dispatch do nó deve chamar o executor com o `initialPayload` recebido e gravar `{ scheduledAt }` como saída do nó. O payload do tick já é produzido em `schedule-tick.consumer.ts:83–87`.

## Validação e elegibilidade de agendamento

- O DAG deve ter exatamente um nó cujo tipo começa com `trigger_`; `triggerNodeId` deve apontar para esse nó e ele não pode ter arestas de entrada. O validador atual já aplica essas regras (`dag-validator.ts:45–56, 93–96`).
- A configuração de `trigger_schedule` deve rejeitar quaisquer campos; o catálogo de configuração atual usa lista vazia (`node-validation.ts:9–12`).
- Criar agendamento exige workflow `PUBLISHED` e snapshot publicado válido cujo único gatilho seja `trigger_schedule`, com ID igual a `triggerNodeId` e configuração válida. Rejeitar `trigger_form` com HTTP 400 e código estável `SCHEDULE_INCOMPATIBLE_TRIGGER`.
- Preservar política aprovada: somente admin; organização derivada da sessão; cron de cinco campos; fuso IANA com padrão `America/Sao_Paulo`; intervalo mínimo de 15 minutos; no máximo cinco agendamentos ativos por organização; fila usa versão publicada e modo `SIMULATION`. Sem execução `LIVE` nem efeitos externos reais.
- No tick, validar novamente a versão fixada antes de enfileirar. Versão incompatível não deve gerar execução; registrar a incompatibilidade em log.

A elegibilidade acima é compatível com `schedule-compatibility.ts:4–8` e com a verificação feita na criação em `schedules.service.ts:50–60`. O código atual já devolve `SCHEDULE_INCOMPATIBLE_TRIGGER` para snapshot incompatível.

## Workflows e agendamentos existentes

- Manter `trigger_form` e seus campos obrigatórios e saídas sem alteração.
- Não converter workflows `trigger_form` automaticamente, publicados ou em rascunho.
- Não migrar, revogar ou reescrever automaticamente agendamentos `ACTIVE` existentes ligados a versões `trigger_form`.
- Esses agendamentos devem permanecer registrados, mas ticks da versão incompatível não devem enfileirar execução. Exibir aviso administrativo para revisão; retomada exige publicação compatível e ação explícita do admin.

## Editor e geração de IA

Pontos de integração e referências do checkout atual:

- `apps/web/src/lib/workflow-editing.ts:23–24, 122–126, 153–156, 168–176, 242–249`: config padrão vazia, label, parâmetros e troca do gatilho em DRAFT.
- `apps/web/src/app/workflows/[id]/page.tsx:126–127, 320–321, 905–912, 1041`: payload de simulação e seletor do gatilho.
- `apps/web/src/components/workflows/workflow-graph-node.tsx`: renderização do nó e handles.
- `apps/api/src/ai/workflow-generation.schema.ts:16–19, 28–41, 52–59`: versão, `triggerNodeId`, catálogo e config serializada.
- `apps/api/src/ai/workflow-proposal.parser.ts:55–79, 90–95`: parsing/validação da proposta e versão.
- `apps/api/src/ai/deterministic-ai-client.ts:31–45, 60–69, 90–104`: escolha do gatilho e uso de `scheduledAt`.
- `apps/api/src/ai/openai-structured-client.ts:9–14`: instruções do catálogo para geração estruturada.
- `apps/api/src/ai/evaluation/ai-evaluator.ts:50–53`: lista de tipos usada pela avaliação.

A geração deve produzir config `{}` para agendamento e alertar que o gatilho fornece somente `scheduledAt`; não inventar contato, cron ou destinatário.

## Schema version

Há impacto de compatibilidade: o motor e os serviços comparam `schemaVersion` à versão única atual, hoje `1.0.0` (`workflow.ts:6`; `workflow-engine.service.ts:39–40`; `workflows.service.ts:276`). A opção conservadora é manter a versão e tratar o novo tipo como extensão aditiva do catálogo, pois a forma estrutural do workflow não muda. **Decisão pendente:** confirmar se a equipe considera a disponibilidade de um novo gatilho parte da versão do schema. Se optar por bump, definir suporte explícito a snapshots antigos `1.0.0`; não invalidá-los apenas por adicionar o novo tipo.

## Testes requeridos

1. Executor aceita ISO UTC canônico e preserva o texto/instante; rejeita ausente, não-string, ISO sem milissegundos, offset não UTC, data impossível e data normalizada.
2. Contratos: catálogo, tipos de saída e `getOutputFieldKind('trigger_schedule', 'scheduledAt')`; config vazia aceita e config com campos extras rejeitada.
3. DAG: gatilho único; ausência, duplicidade, `triggerNodeId` divergente, gatilho com entrada e workflow desconectado rejeitados.
4. Elegibilidade: criação aceita snapshot publicado compatível; recusa `trigger_form`, snapshot ausente/desatualizado, ID divergente e config inválida com `SCHEDULE_INCOMPATIBLE_TRIGGER`.
5. Motor: envia `initialPayload.scheduledAt` ao executor, expõe saída ao mapeamento dos nós seguintes e não altera fluxo `trigger_form`.
6. Tick/fila: versão publicada compatível enfileira `{ scheduledAt }` com versão fixada e `SIMULATION`; incompatível não enfileira; execução concorrente continua sendo pulada.
7. Editor: seleção em DRAFT, config vazia, referência de saída visível, simulação envia horário; edição publicada bloqueada.
8. IA: schema/parsing aceitam o novo tipo e config; geração determinística agenda sem criar dados de contato; proposta malformada continua rejeitada.
9. Compatibilidade: workflows `trigger_form` existentes continuam válidos; agendamentos ativos antigos não são alterados e não disparam execução incompatível.

## Ownership proposto, sem sobreposição

| Especialista | Arquivos exclusivos |
|---|---|
| Backend | `packages/contracts/src/{nodes.ts,node-outputs.ts,workflow.ts,node-validation.ts}`; `apps/api/src/engine/{node-executors.ts,dag-validator.ts,workflow-validation.ts,workflow-engine.service.ts}`; `apps/api/src/schedules/{schedules.service.ts,schedule-compatibility.ts,schedule-tick.consumer.ts}` |
| Frontend | `apps/web/src/lib/workflow-editing.ts`; `apps/web/src/components/workflows/workflow-graph-node.tsx`; `apps/web/src/app/workflows/[id]/page.tsx` |
| IA | `apps/api/src/ai/{workflow-generation.schema.ts,workflow-proposal.parser.ts,deterministic-ai-client.ts,openai-structured-client.ts}`; `apps/api/src/ai/evaluation/{ai-evaluator.ts,ai-evaluation-dataset.ts}` |

## Handoff

**Resultado:** contrato concreto preparado; a opção A consta como aprovada no histórico de trabalho e no estado mais recente consultado, mas o `PROJECT_CONTEXT.md` consultado nesta sessão registra a aprovação da política de agendamento, não a aprovação explícita da opção A. O código consultado já contém partes substanciais de `trigger_schedule`; portanto, esta especificação não afirma que seja uma implementação nova ou completa.

**Arquivos alterados:** nenhum. **Checagens executadas:** leitura dos documentos e busca de referências no código; sem testes ou validações executados. **Riscos/pendências:** decisão sobre versionamento do schema e divergência documental quanto à aprovação da opção A. A sandbox da sessão é somente leitura.

STATUS: DONE_WITH_CONCERNS  
SUMMARY: Contrato e plano de ownership documentados na resposta; versionamento do schema e registro da aprovação da opção A precisam de confirmação documental.


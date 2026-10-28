# T12 — gatilho de agendamento implementado

28/10/2026. Opção A autorizada pelo usuário em24/10 por resposta direta “pode seguir” à [proposta](T12_SCHEDULE_INPUT_PROPOSAL_2026-10-23.md), retomada em28/10. T12 integral e jornada autenticada ainda não homologados.

## Entrega

- `trigger_schedule`: configuração fechada `{}`, saída única `scheduledAt` em ISO UTC canônico com milissegundos. O motor preserva o horário previsto e registra falha para entrada inválida. Formulário mantém suas regras.
- Criação/tick exigem versão publicada com gatilho compatível. Agenda legada incompatível fica visível/revogável e o tick a ignora com aviso; sem alteração automática dos dados.
- Worker de agenda consulta organização/workflow ativo e executa o snapshot fixado no job. Corrigida execução indevida da definição corrente. LIVE continua negado.
- Editor troca gatilho somente em rascunho, preserva ID/arestas/referências para revisão, oferece entrada de horário na simulação e envia somente `{ scheduledAt }`. Trocar o gatilho não cria agenda.
- Catálogo de saídas/parâmetros, schema de geração e avaliação reconhecem o tipo. Template local não inventa contato, destinatário ou cron; solicita revisão. Sem chamadas comerciais de IA.

## Validação

[Oito checks](evidence/t12-trigger-schedule-2026-10-28/checks.json), todos exit0: lint, tipos, Jest, regressões, Prisma, build, artefato e operação. **179 entradas idênticas antes/depois;833 Jest aprovados/27 ignorados;222 regressões aprovadas.**

[Integração física](evidence/t12-trigger-schedule-2026-10-28/integration-final.json), [log](evidence/t12-trigger-schedule-2026-10-28/integration-final.log): **9/9, exit0**, PostgreSQL/Redis locais existentes, organizações/filas únicas e limpeza delimitada. Novo cenário: tick → produtor → BullMQ → worker → motor → histórico; versão publicada2 executada apesar da definição corrente9, horário preservado, SIMULATION e ausência de registro na outra organização. Os outros18 testes físicos ignorados na suíte padrão não foram executados.

Após os oito checks, houve a correção de limpeza no teste físico e uma mudança externa no arquivo de regressão de interface. Este último foi revalidado separadamente:28 controles aprovados, exit0, hash estável (`ui-delivery.json`). Nenhuma fonte de produção mudou. A primeira rodada aprovou9 cenários, mas Jest não encerrava por uma fila de inspeção sem fechamento; o processo próprio foi encerrado e a conexão passou a ser fechada. A rodada final terminou normalmente. [Snapshot final](evidence/t12-trigger-schedule-2026-10-28/delivery.json) discrimina essa alteração de teste validada separadamente.

## Revisão e escolhas registradas

Skill `superpowers:executing-plans`, execução pelo principal e revisão independente em leitura. Backup: `C:\Users\jv883\AppData\Local\Temp\flowmind-trigger-schedule-r87rsdt4`. Sem instalação, migration, commit, push ou reinício dos serviços existentes.

- Contrato/motor:14 falhas/3 aprovações antes →17 aprovações; suíte ampliada final inclui27 cenários em `schedule-trigger.spec.ts`.
- Final: corrigido achado importante da regex — `cron` em “sincronizar” e `a cada` em “para cada” mudavam indevidamente o evento. Dois testes [RED](evidence/t12-trigger-schedule-2026-10-28/review-red.log), depois GREEN na suíte completa. Expressões temporais delimitadas.
- Fixtures antigas de simulação sem `nodes` foram completadas para o contrato real; novo teste verifica payload exclusivo de agenda. Nenhuma verificação removida.
- Ruling: manter schema1.0 como extensão local do catálogo, sem migrar definições antigas; formatos existentes continuam válidos no runtime atualizado. Custo se errado: consumidores antigos rejeitam o novo tipo; distribuição entre versões exigirá política de compatibilidade.
- Ruling: agenda legada incompatível gera aviso, sem pausa/revogação automática, para preservar dados. Custo se errado: continua ocupando limite até revisão/revogação.
- Ruling: snapshot fixado somente para jobs com `scheduleId`, delimitando a mudança aprovada. Custo se errado: outros jobs mantêm o comportamento anterior de seleção da definição.
- Final: menor adiado — `page.tsx` oculta handle de entrada apenas no formulário; agenda pode exibir entrada visual inválida. O DAG rejeita entrada em qualquer gatilho. Ajustar e validar visualmente na próxima etapa.
- Final: Ruling sobre limites do revisor — autenticação, aparência e corridas distribuídas não foram julgadas estaticamente. A prova física cobre fila/motor/histórico; não homologa os demais critérios. Custo se errado: defeitos podem persistir nesses caminhos.

## Pendências e próxima ação

Fixture do editor real compilou com XYFlow/CSS, mas a ferramenta retornou `browser access host is unavailable`; nenhuma interação visual nesta rodada. Servidor temporário próprio encerrado. Sem login Clerk/teste HTTP autenticado, homologação de modelo real ou LIVE. Grafo/cobertura consultados; fontes lidos diretamente devido a `metadata_changed`.

Próximo: corrigir handle e validar jornada autenticada admin, negativa de member/outra organização, criação/listagem/revogação e histórico no editor. Um executor por arquivo. AI MEMORY segue `pending_not_transferred`; hashes locais não comprovam transferência.

## Comandos

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
set "PATH=%CD%\.tools\node-v24.21.0-win-x64;%PATH%"
npm run check:all
npm run prisma:validate
```

Integração: habilitar DB/Redis apenas no processo de teste com variáveis do ambiente local e executar Jest com `--config apps/api/jest.config.cjs --runInBand --runTestsByPath apps/api/src/qa/schedule-integration.spec.ts`. Credenciais ficam na configuração ignorada.

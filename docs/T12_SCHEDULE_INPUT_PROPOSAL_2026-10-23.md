# T12 — entrada do agendamento

Status: opção A aprovada pela resposta direta “pode seguir” em24/10; implementada e validada em28/10. [Entrega e limites](VALIDATION_T12_TRIGGER_SCHEDULE_2026-10-28.md). Abaixo, diagnóstico e alternativas originais de23/10.

## Diagnóstico confirmado

A política aprovada em [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md#t12--agendamento-confirmado-em-23102026) define payload fixo `{ scheduledAt }`, versão publicada e apenas SIMULATION. O consumidor atual enfileira esse payload em `apps/api/src/schedules/schedule-tick.consumer.ts`.

O catálogo em `packages/contracts/src/workflow.ts` possui somente `trigger_form` como gatilho. O executor de formulário em `apps/api/src/engine/node-executors.ts` exige `name`, `email` e `message` por padrão. Configurar `requiredFields: []` permite o disparo, mas retorna campos de contato vazios e não expõe `scheduledAt` nas saídas.

[Reprodução](evidence/t12-input-gate-2026-10-23/reproduce.cjs) executa o fonte TypeScript atual em memória, sem serviços ou efeitos externos. [Resultado](evidence/t12-input-gate-2026-10-23/result.json): três cenários confirmados, fonte estável. Não é uma execução completa do worker nem teste autenticado. O teste físico existente `apps/api/src/qa/schedule-integration.spec.ts` substitui `enqueue` por mock e usa versão com `nodes: []`; comprova agendamento/enfileiramento, não execução de um workflow válido até o histórico.

Consulta ao grafo seguida de leitura direta dos fontes: cobertura sinalizou `metadata_changed`; a suíte de integração é excluída pelo modo fast. Conclusões acima foram conferidas no conteúdo local.

## Opções

| Opção | Benefício | Custo, complexidade e risco |
| --- | --- | --- |
| A — adicionar `trigger_schedule` | Representa a entrada aprovada e permite mapear `scheduledAt` sem inventar dados de contato. | Mudança coordenada em contratos, validação, motor, editor e geração de IA; precisa preservar workflows existentes e atualizar testes/catálogo. Sem nova dependência ou custo de provedor. |
| B — reutilizar formulário com campos opcionais | Menor mudança imediata. | Semântica inadequada; saídas vazias; não disponibiliza o horário. Expor horário no formulário também altera contrato e exige atualização dos consumidores. |
| C — manter como está e limitar agendamentos a fluxos compatíveis | Evita expansão imediata do catálogo. | Pouco útil no catálogo atual; precisa de validação de elegibilidade e mensagens claras; não resolve o acesso ao horário. |

Recomendação do principal: **A**. Recomendação original, posteriormente aprovada na resposta direta do usuário em24/10. Não alterar automaticamente workflows publicados, nem preencher dados de formulário fictícios.

## Escopo concreto da opção A

1. Contratos: novo tipo `trigger_schedule`, configuração sem código ou payload arbitrário, saída `scheduledAt` validada como instante ISO UTC. Manter o significado dos contratos existentes; avaliar compatibilidade da versão de schema antes da alteração.
2. Validação e API: reconhecer o novo gatilho, exigir início compatível ao criar agendamento e validar a versão publicada antes do disparo. Agendamentos anteriores incompatíveis precisam de tratamento explícito; não migrar nem revogar automaticamente dados existentes.
3. Motor: executor puro para o novo gatilho; preservar o horário previsto recebido. Rejeitar entrada inválida e registrar falha pelo fluxo existente. Manter SIMULATION, deduplicação e isolamento por organização.
4. Editor e IA: catálogo, edição, mapeamento de saída e geração estruturada compatíveis; formulário continua funcionando com seu contrato atual. Não chamar modelo comercial nesta etapa.
5. Validação: payload válido/inválido, preservação exata do horário, formulário sem regressão, criação negada para gatilho incompatível, versão publicada, isolamento entre organizações, execução via fila e histórico. Depois, jornada autenticada de admin e negativa de member/outra organização.

Execução sequencial com um dono por arquivo: principal coordena contratos → backend/automações → frontend/IA → QA. Não iniciar edições concorrentes nos arquivos compartilhados. Inventário exato dos consumidores e critérios de compatibilidade devem ser concluídos antes de editar contratos.

## Ambiente e próxima ação

Nesta retomada, portas 3000/3001/6379 sem listener; PostgreSQL 5432 ativo. Nenhum serviço reiniciado, pacote instalado, migration executada ou credencial exibida. A jornada autenticada permanece pendente.

Após aprovação explícita de A, implementar em etapas com backup e testes direcionados; preparar serviços locais existentes para a jornada completa, sem instalação, deploy ou execução LIVE. Se houver incompatibilidade que exija outra decisão de produto, apresentar antes de aplicar.

CMD para repetir somente este diagnóstico, a partir da raiz interna:

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
".tools\node-v24.21.0-win-x64\node.exe" docs\evidence\t12-input-gate-2026-10-23\reproduce.cjs
```

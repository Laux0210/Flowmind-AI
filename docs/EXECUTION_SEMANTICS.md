# FlowMind AI — semântica proposta para T03/T09

Status: DAG confirmado em 10/10/2026; detalhes de execução/versionamento em revisão, sem motor implementado. Contribuição inicial de `flowmind_automation`, tarefa `/root/inicio_t03_t09_execucao`, thread `01a122eb-2259-7b00-8165-2cc4555f9de0`; principal consolida.

Qualificação em 13/10/2026: o status acima é histórico. Há motor de simulação local e guardas [S1](VALIDATION_T03_CONFIG_2026-10-13.md)/[S2a](VALIDATION_T03_REFERENCE_2026-10-13.md), sem aceite operacional integrado. [T03-S2b](T03_AVAILABILITY_PROPOSAL.md) reproduziu dez exemplos de convergência/opcionais/modos; a política de convergência continua aguardando decisão. O protótipo OR-Join não aprova os detalhes propostos abaixo.

Fontes locais: [contratos em rascunho](WORKFLOW_CONTRACT_DRAFT.md), [autorização](AUTHORIZATION_OPTIONS.md), [produto](MVP_DEFINITION.md) e [plano](../plan.md). Este documento não implementa nem testa um motor.

## Grafo e referências

DAG foi confirmado pelo usuário: sequências e condições sem ciclos. A validação proposta verifica identidade única dos nós, conexões existentes, tipos/parâmetros permitidos, alcance pelo gatilho e referências disponíveis em todas as rotas que chegam ao consumidor.

Condição utiliza operadores declarativos, com ramo não selecionado identificado como ignorado. Uma convergência precisa declarar quais predecessores aguarda; sem essa semântica, ativação é impedida.

| Opção | Necessidade atendida | Custo, complexidade e risco |
| --- | --- | --- |
| DAG inicialmente | Sequências e ramificações com validação e término mais simples | Restringe repetição; convergências ainda exigem contrato explícito |
| Suportar loops desde o início | Repetir etapas dentro do workflow | Exige término, orçamento, contador e identidade por iteração; amplia testes e risco de consumo ilimitado |

A primeira opção foi escolhida pelo usuário; loops não integram o grafo aprovado do MVP. Convergências e estados de ramos continuam em revisão.

## Versão e contexto autorizado

Proposta de T03 ainda em revisão, respeitando revisão formal/ativação exclusivas de admin confirmadas em T02:

- Revisão/ativação vinculam-se a uma definição imutável; edição posterior produz outra versão.
- Execução conserva versões do contrato/definição e a configuração necessária para reproduzir decisões. Credenciais permanecem protegidas e referenciadas; snapshot não autoriza copiar segredos para logs ou resultados.
- Organização, execução, nó e tentativa acompanham o processamento. Worker carrega a execução autorizada e verifica recursos e credenciais.
- Identificadores na fila ou na proposta da IA não concedem acesso.
- Revogação da ativação, pertencimento removido e saída do aprovador precisam de política conciliada com T02.

## Estados, recuperação e efeito externo

Separar estado da execução, estado de nó/tentativa e resultado do efeito. O efeito é classificado como confirmado, comprovadamente não ocorrido ou desconhecido. Enums e transições exatos são entregas pendentes de T03.

Recomendar persistir intenção e checkpoints, reutilizar saídas concluídas na recuperação, inclusive da IA, e interromper dependentes depois de falha/incerteza. Preservar efeitos anteriores; não apresentar rollback como se anulasse um envio externo já aceito. Entradas/saídas persistidas obedecem à política de privacidade e retenção ainda a definir.

Timeout ou cancelamento local não comprovam interrupção no destino. Cancelamento cooperativo pode impedir novas etapas; operações em andamento exigem classificação própria. Reconciliação ou intervenção em resultado desconhecido precisam de contrato e permissão.

## Três camadas de idempotência

| Camada | Garantia candidata | Limite |
| --- | --- | --- |
| Entrada | Evento/ocorrência repetido recupera execução e versão originalmente aceitas; conteúdo conflitante com mesma identidade é rejeitado | Precisa de identidade e registro durável aprovados |
| Recuperação interna | Saídas/checkpoints concluídos são reutilizados; identidade do efeito permanece estável entre tentativas | Persistência e transições precisam ser conciliadas com Backend |
| Destino externo | Mecanismo de idempotência do destino, quando validado, protege efeitos repetidos | Nem todo destino oferece essa garantia; resultado incerto exige tratamento próprio |

Retry só é proposto para falha transitória, autorização vigente e efeito comprovadamente seguro ou protegido por mecanismo do destino validado. Sucesso conhecido não é reenviado; resultado desconhecido não recebe reenvio cego.

[BullMQ recomenda jobs idempotentes](https://docs.bullmq.io/patterns/idempotent-jobs); [jobId](https://docs.bullmq.io/guide/jobs/job-ids) deduplica dentro da fila enquanto o job existir; [jobs stalled](https://docs.bullmq.io/guide/workers/stalled-jobs) podem voltar ao processamento e [retries/backoff](https://docs.bullmq.io/guide/retrying-failing-jobs) são configuráveis. [NestJS documenta filas](https://docs.nestjs.com/techniques/queues), e [Redis oferece opções de persistência](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/). Inferência da equipe: essas capacidades não garantem efeitos externos exatamente uma vez nem substituem histórico autorizado e recuperação.

## Simulação e gatilhos

Simulação proposta usa o mesmo validador e regras de ramificação com adaptadores sintéticos de IA, registro interno, HTTP e e-mail, sem rede, credenciais reais ou gravações de negócio reais. Mostra versão, caminho, entradas filtradas, resultados, tentativas e falhas. Não comprova entrega real. Na execução futura, registro interno é persistência de negócio separada de logs, confirmada antes da etapa de e-mail; deduplicação está em revisão.

Webhooks precisam de autenticidade, proteção contra replay e limites. HTTP precisa de política de destinos, resolução e redirects que bloqueie acesso interno indevido. Cron, fuso, horário de verão, ocorrências perdidas e concorrência ainda precisam de decisão em T03/T12.

## Cenários sintéticos para QA

| Caso | Resultado esperado da política proposta |
| --- | --- |
| E-mail aceito; worker cai antes do checkpoint | Efeito desconhecido; nenhuma repetição automática sem garantia/reconciliação |
| Webhook reapresentado após editar o workflow | Recuperar execução e versão originalmente aceitas |
| Registro confirmado; e-mail rejeitado | Preservar o registro e tratar somente a etapa cuja repetição for segura |
| Proposta de IA referencia credencial de outra organização | Rejeitar antes do executor |
| Job reapresentado depois de removido da fila | Registro de deduplicação durável impede novo efeito indevido |

## Pendências para liberar implementação

Revisar convergências, estados/transições, versionamento imutável, idempotência durável, resultado incerto, revogação e cancelamento. Definir timeout, retry, concorrência e retenção. Backend concilia persistência; IA, saídas e uso; QA, cenários. DAG já confirmado; demais recomendações e valores não foram aprovados por esta consulta.

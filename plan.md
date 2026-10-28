# FlowMind AI — plano do MVP

> T03-S3/A, R1–R5 aceitas localmente após retomada: catálogo, DI, API e editor. T13/T14 mantêm provas sintéticas e gates de aprovação/integração; A não aprova política comercial nem modelo real. [Memória](docs/MEMORIA.md).

> Validação fresca em 15/10/2026, 18:46–18:47 UTC: 751 Jest/39 suítes, 201 regressões, dez comandos exit 0 e 159 entradas estáveis. [Recibo](docs/evidence/t03-catalog-resume-2026-10-15/checks.json).

Atualizado em28/10/2026. Responsável pela consolidação: agente principal.

**T12 — handle corrigido em28/10:**3 novos controles,50 testes do editor/tipos aprovados. [Recibo](docs/VALIDATION_T12_EDITOR_HANDLES_2026-10-28.md). Jornada visual/autenticada bloqueada pela automação: URL atual não pôde ser confirmada com segurança. Restabelecer acesso confiável ao navegador antes de prosseguir na interface; não contornar o bloqueio. T12 integral pendente.


**T12 — opção A implementada, validada em28/10:** novo trigger_schedule/config{}/scheduledAt, elegibilidade da versão publicada, snapshot fixado no worker, editor e geração integrados.833 Jest/27 ignorados,222 regressões,8checks verdes e9 integrações PostgreSQL/Redis aprovadas. [Resultado](docs/VALIDATION_T12_TRIGGER_SCHEDULE_2026-10-28.md). Falta ajuste do handle visual e jornada autenticada de admin/member/outra organização; browser host indisponível nesta rodada. T12 integral permanece em andamento. Sem LIVE, instalação ou migration.


**T12 — Painel de webhooks (`WebhookPanel`) corrigido e validado GREEN — 23/10:** Aplicado isolamento assíncrono por geração (`contextRef`), limpeza imediata do segredo único (`revealed`) na troca de contexto/sessão, guarda de propriedade ativa em `rotate`/`revoke`, trava síncrona `pendingOps` e cleanup `StrictMode` em `apps/web/src/components/workflows/webhook-panel.tsx`. 9 novos controles em `tests/regression/webhook-panel.test.mjs` (`0/9` antes → `9/9` depois, totalizando **219 regressões Node**) e verificação no navegador real (`tests/browser/webhook-fixture/serve.cjs`) confirmaram descarte de resposta atrasada de `wf_a`, preservação de `ep_a` (`ACTIVE`), rotação/revogação isolada de `ep_b`, ocultação do segredo ao alternar contexto e viewport mobile `390x844` sem corte. 202 entradas estáveis (`changed: []`); `lint`, `typecheck`, `test` (`806 passed, 26 skipped`), `test:regression` (`219`), `prisma:validate`, `build` Next `16.4.3`, `check:api-artifact`, `check:operation` e auditorias `0/0` aprovados. [Relatório](docs/VALIDATION_T12_WEBHOOK_PANEL_2026-10-23.md), [recibo](docs/evidence/t12-webhook-review-2026-10-23/checks.json).

**T12 — gate de entrada confirmado em23/10:** três controles no executor atual demonstram rejeição de `{ scheduledAt }` pelo formulário obrigatório e perda do horário com campos opcionais. [Proposta A/B/C e plano de implementação](docs/T12_SCHEDULE_INPUT_PROPOSAL_2026-10-23.md). Recomendação: adicionar `trigger_schedule`; decisão ainda pendente, sem alterar contratos aprovados. Serviços API/frontend/Redis desligados nesta conferência; jornada autenticada não iniciada. Próximo: aprovação explícita do contrato → implementação sequencial → testes de fila/histórico e jornada autenticada.

**T12 — painel frontend revisado em23/10:** listar/criar/revogar para admin/workflow ativo; geração/contexto e chave de organização preservados, guardas de mutação/StrictMode corrigidas.8 controles + browser sintético aprovados;806 Jest aprovados/26ignorados,210regressões e checks de tipos/lint/Prisma/build/artefato/operação verdes; auditorias0. [Evidências](docs/VALIDATION_T12_SCHEDULE_PANEL_2026-10-23.md). Sem aceite integrado de T12; próximo é jornada autenticada com serviços reais em ambiente de teste, após definir executor exclusivo.

**T12 — Painel de agendamentos (`SchedulePanel`) corrigido e validado GREEN — 23/10:** Corrigido defeito de contexto obsoleto em `apps/web/src/components/workflows/schedule-panel.tsx` e adicionada `key` por organização/workflow em `apps/web/src/app/workflows/[id]/page.tsx`, com 8 novos controles em `tests/regression/schedule-panel.test.mjs` (totalizando **210 regressões Node**). Fixture no navegador confirmou descarte de resposta antiga de `wf_a`, preservação de `s_a` e operação isolada em `wf_b`. 195 entradas estáveis (`changed: []`); `lint`, `typecheck`, `test` (`806 passed, 26 skipped`), `test:regression` (`210`), `prisma:validate`, `build` Next `16.4.3`, `check:api-artifact`, `check:operation` e auditorias `0/0` aprovados. [Relatório e recibo](docs/T12_SCHEDULE_PANEL_REVIEW_2026-10-23.md). Próximo passo depende de decisão sobre o payload de agendamento (`{ scheduledAt }`) frente ao nó `trigger_form`.

**Estado atual coordenado —23/10:** Claude `flowmind-ai-a0` confirmou pausa;191 entradas permaneceram iguais.806 Jest aprovados/26ignorados,202regressões; oito checks npm e auditorias produção/completa exit0 com0achados. [Validação independente e limites](docs/VALIDATION_COORDINATED_2026-10-23.md). Backend de agendamentos recebido, painel frontend ainda não iniciado segundo ACK;26 testes reais são relato da sessão executora, não repetição do Codex. Próxima implementação exige dono/caminhos exclusivos; nenhuma escrita automática liberada por este checkpoint.

**T05 (Opção B aprovada) + Consolidação Passo 2 — 23/10, 12:35 BRT:** Proveniência confirmada pelo usuário (`"faça B , depois siga para o passo 2"` sobre [T05_NEXT_SECURITY_UPGRADE_2026-10-23.md](docs/T05_NEXT_SECURITY_UPGRADE_2026-10-23.md)) para `"next": "16.4.3"` + override `"postcss-selector-parser": "7.1.7"` (validado em cópia isolada e promovido ao workspace com `--ignore-scripts`), zerando `npm audit --omit=dev` (`0`) e `npm audit` completo (`0` em 722 pacotes). Bateria de 9 checks às `15:35 UTC` passou com `exit 0` (`788 passed, 18 skipped`, `202` regressões, `build` Next `16.4.3`, `lint`, `typecheck`, `check:api-artifact`, `check:operation`) cobrindo as edições posteriores de webhook (`webhook-ingress.service.ts`, `triggers.module.ts`, `webhook-panel.tsx`, `workflows/[id]/page.tsx`, `api-client.ts`), além de `21/21` testes reais aprovados contra PostgreSQL 16.15 e Redis 8.10.2 locais. Como a sessão paralela iniciou a escrita de `apps/api/src/schedules/*` (`181 → 185` entradas) durante a janela, os checks não são repetidos em loop até o término dessa escrita externa. [Detalhes e recibo](docs/VALIDATION_LOCAL_CHECKPOINT_2026-10-23.md).

**Ressalva posterior ao checkpoint12:26:** webhook, editor e cliente API receberam novas edições depois dos checks. O snapshot registrado passou, mas o checkout mais recente não foi aceito. Coordenar a outra sessão antes de repetir a validação; [arquivos e limites](docs/VALIDATION_LOCAL_CHECKPOINT_2026-10-23.md).

**Checkpoint local consolidado —23/10,12:26:**176 entradas estáveis; sete checks exit0,788 Jest aprovados/16ignorados,202regressões, build Next16.4.3 e auditorias produção/completa0. Sem instalação/edição de código nesta rodada; override PostCSS recebido de outra execução preservado, sem nova aprovação inferida. O bloqueio de concorrência dos checks locais foi resolvido neste snapshot; integrações reais/MVP não aceitos. [Resultado](docs/VALIDATION_LOCAL_CHECKPOINT_2026-10-23.md). Próximo: revisar os testes reais ignorados e seus pré-requisitos, mantendo SVM/serviços em espera.

**T05 — Next16.4.3 instalado com aprovação em23/10:** build agora exit0; auditoria produção0/full3moderadas Tailwind. HTTP sem sessão preserva Clerk/dashboard307; editor sintético mobile aprovado. Jest final782pass/9ignorados/0falhas, mas worker mudou durante a rodada; **sem aceite de checkout integral estável**. Oito fontes/CSS web iguais ao teste. Próximo: coordenar fim da edição worker e consolidar validações; Tailwind exige proposta própria. [Prova e limites](docs/VALIDATION_T05_NEXT_SECURITY_2026-10-23.md).

**T05 — remediação Next, proposta pronta em 23/10:** diagnóstico confirma16.4.0 e candidato16.4.3 da mesma linha, com faixas Clerk/React/Node compatíveis. [Plano de patch, riscos, testes e reversão](docs/T05_NEXT_SECURITY_UPGRADE_2026-10-23.md). Instalação/manifesto/lockfile ainda não alterados; aprovação específica pendente. Build permanece bloqueado até atualização autorizada e prova nova.

**T08 — navegador e mobile, 23/10:** cabeçalho corrigido; conferência isolada em Brave 1920/390/320 px, teclado/edição/save/recarga sintéticos aprovados; tipos, 202 regressões e lint162 verdes, oito fontes/CSS estáveis. **Build exit 1 por `SecurityFatalError` do Next.js**; atualização depende de diagnóstico e aprovação de dependências. Fixture encerrada; nenhuma integração real certificada. T08 continua em andamento. [Entrega](docs/VALIDATION_T08_BROWSER_2026-10-23.md).

**Avanço sem SVM — T03-S2b, 23/10:** prioridade de mapeamentos opcionais alinhada ao executor; valores vazios que ocultam a raiz agora negam referências, com fallback legítimo preservado. Seis testes novos, 3 negativas RED antes da correção; final 779 Jest/40 suítes, 202 regressões, tipos/lint158 aprovados sobre 118 fontes/testes estáveis. [Validação](docs/VALIDATION_T03_S2B_PRECEDENCE_2026-10-23.md). Infraestrutura em espera conforme usuário; próximo incremento independente: jornada visual do editor com dados sintéticos. Integração real permanece pendente.

**T05 — preparação local em 23/10:** Compose exige senha explícita e publica PostgreSQL/Redis somente em loopback. Validação sem engine passou com ambiente sintético e rejeitou senha ausente; imagens e volumes preservados. Docker CLI/Compose instalados, mas engine indisponível e SVM desativado segundo Windows. Nenhum serviço/migration executado. Próximo gate operacional: usuário habilitar SVM e autorizar startup; T05 em andamento/T06 bloqueada. [Prova](docs/evidence/t05-local-readiness-2026-10-23/checks.json), [CMD](docs/DEVOPS_ENVIRONMENT.md#sequência-pelo-cmd-após-habilitar-svm). Pendência T03-S2b de 23/10 preservada na memória.

**Alcance confirmado:** A aprova somente T03-S3, catálogo configurado pela equipe. S2b/modelos comerciais não foram aprovados por essa resposta; JOURNEY03 é prova local com adaptadores sintéticos. [Relatos anteriores preservados](docs/archive/CONCURRENT_CATALOG_REPORTS_2026-10-15.md).

T10-S4a aceito localmente em 13/10: 43 falhas antes, 47 novos controles aprovados; campos ausentes avisados, config/referência/C03 inválidos negados; consumo seguro/revisão humana mantidos. Negativas anteriores do avaliador conciliadas com rejeição antecipada, sem falsos controles semânticos. [Alcance e reprodução](docs/VALIDATION_T10_PROPOSAL_2026-10-13.md).

T10-S4b: avisos apresentados com nomes de campos em português e lista limitada/rolável. Quatro renders SSR sintéticos do componente exato confirmam escape de texto e ausência de markup para lista vazia; nenhum browser conectado, layout/foco/lifecycle pendentes. Dez checks locais passaram em 136 entradas. Próximo **T10-S4c**: principal preserva o consumo declarado em erro de geração no cliente/feedback, com controles negativos de metadata inválido e contexto obsoleto. Não muda cobrança, quotas ou parâmetros do modelo.

T10-S4c concluído localmente: 23 falhas/3 controles antes, 26 regressões green e incluídas no comando padrão; erro da rota de geração carrega somente consumo seguro ou desconhecido, sem corpo privado. Feedback respeita contexto ativo; nenhuma cobrança ou quota alterada. T03-S3 tem [contrato candidato e divisão](docs/T03_RESOURCE_PROPOSAL.md), dependentes de decisões. Próximo incremento local: principal alinha destinatário/replyTo literal ao predicado já usado pelo executor, com negativas antes de writes/nós e compatibilidade de draft parcial.

E-mail literal concluído localmente em 13/10: 26 falhas/4 controles antes, 30 testes novos green; predicado de destinatário sem trim implícito e guarda de replyTo, inclusive draft incompleto. Zero writes/snapshots/nós nas negativas; positivos mantidos. [Prova](docs/VALIDATION_T03_EMAIL_2026-10-13.md). Próximos passos dependem da decisão T03-S2b, contrato T03-S3 e superfície browser/serviços reais pertinentes; não alterar roteamento nem habilitar LIVE por continuidade genérica.

Checkpoint histórico comprovado: [T03/SEC05](docs/VALIDATION_T03_RESOURCE_SECURITY_2026-10-13.md), 685 Jest/36 suítes, 179 regressões, dez checks e 146 entradas. Outra execução relata T05/T12, 690 Jest/180 regressões e 147 entradas na [nota da fila](docs/VALIDATION_T05_T12_WORKER_QUEUE_2026-10-13.md); relato preservado, não revalidado aqui. Fontes posteriores impedem usar o recibo SEC05 como aceite do checkout atual. Nesta etapa apenas documental: [integridade](docs/evidence/t03-resource-plan-2026-10-15/final-integrity.json). AI MEMORY request 134 recusado; 31 páginas preparadas, sem transferência.

## Alcance e fontes

O backlog e a memória foram criados na entrega documental inicial. O usuário solicitou começar a executar este plano usando os sete perfis; a rodada preparatória está registrada em [docs/EXECUTION_START.md](docs/EXECUTION_START.md). Instalações, decisões arquiteturais importantes e ações operacionais externas continuam exigindo aprovação específica do usuário. Implementações dependentes aguardam requisitos e contratos aprovados.

Os requisitos desejados e a stack planejada estão em [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md). Os papéis e limites estão em [docs/AGENT_TEAM.md](docs/AGENT_TEAM.md); os testes da equipe, em [docs/CODEX_USAGE.md](docs/CODEX_USAGE.md). O estado curto para retomar fica em [docs/MEMORIA.md](docs/MEMORIA.md).

- **Confirmado:** jornada formulário → resumo/intenção/ambiguidades → registro interno → e-mail ao contato; Clerk, DAG, papéis admin/member e Compose local. Escopo completo desejado preservado.
- **Documentado em T02/T03:** autoridade Clerk, continuidade pela organização e ciclo de vida com revisão/snapshot. **Pendente:** prova operacional de revogação/isolamento, schemas completos, políticas/limites, modelo de IA aprovado, provedor de e-mail e ambiente reproduzível.
- **Sequência confirmada:** incrementos pela jornada principal. R03 corrigiu protótipos locais e executou regressões isoladas; adições de outra execução são preservadas sem aceite antecipado. [Evidências](docs/VALIDATION_R03.md).

## Regras do backlog

- Status: `pendente` (não iniciada), `em andamento` (trabalho iniciado), `bloqueada` (tarefa iniciada impedida por uma condição explícita) ou `concluída` (entrega aceita e evidências registradas).
- Dependências não atendidas impedem aceite. Há preparação/protótipos antecipados; `em andamento` registra essa existência, sem liberar operação real ou declarar conclusão.
- Prioridade `P0`: definição, contratos, segurança e jornada central. `P1`: capacidades complementares e preparação operacional. Todas as tarefas T01–T15 integram o MVP desejado; prioridade não exclui recursos nem ignora dependências.
- Conclusão exige entrega, critérios de aceite, revisão do principal, evidências e aprovações pertinentes. Aprovar este plano documental não aprova automaticamente suas propostas de produto ou arquitetura.
- Antes de cada implementação autorizada, o principal atribui caminhos exclusivos aos executores. Contratos compartilhados têm um único editor. Os responsáveis abaixo são papéis previstos; não representam agentes já executando essas tarefas.
- A concorrência continua limitada a dois subagentes além do principal. Só se delega trabalho independente, relevante e delimitado; etapas dependentes recebem primeiro o contrato ou handoff necessário.
- Ao concluir tarefas, identificar bloqueios, receber decisões ou encerrar sessão com trabalho pendente, o principal atualiza este plano e a memória. Decisões aprovadas são registradas no contexto com origem e alcance; propostas permanecem pendentes.

## Visão geral

| ID | Prioridade | Status | Trabalho | Responsável | Dependências |
| --- | --- | --- | --- | --- | --- |
| T00 | P0 | concluída | Configuração dos sete agentes | Principal | Nenhuma |
| T01 | P0 | concluída | Jornada principal e critérios do MVP | Principal + Arquiteto | T00 |
| T02 | P0 | concluída | Autenticação, organizações e permissões | Backend + Arquiteto | T01 |
| T03 | P0 | concluída | Contratos de workflows, nós e APIs | Principal, com Backend, IA e Automações | T01, T02 |
| T04 | P0 | em andamento | Testes, isolamento e ameaças | QA/Segurança | T02, T03 |
| T05 | P0 | em andamento | Estrutura, ambiente local e CI | DevOps + Principal | Decisões pertinentes aprovadas; insumos revisados T02–T04 |
| T06 | P0 | bloqueada | Usuários, organizações e autorização | Backend | T02, T04, T05 |
| T07 | P0 | em andamento | Dashboard e persistência das automações | Frontend + Backend | T03, T06 |
| T08 | P0 | em andamento | Editor visual e validação | Frontend | T03, T07 |
| T09 | P0 | em andamento | Motor e simulação | Automações | T03, T04, T05, T06 |
| T10 | P0 | em andamento | Geração estruturada por IA | IA | T03, T08; T09 para integração do nó de IA |
| T11 | P0 | em andamento | Condições, registro interno, HTTP e e-mail | Automações + Backend no registro | T09 |
| T12 | P1 | em andamento | Webhooks e agendamento | Automações + Backend | T09, T11 |
| T13 | P0 | em andamento | Logs, histórico e consumo | Backend + Frontend | T09, T10, T11, T12 |
| T14 | P0 | em andamento | Jornada completa | QA/Segurança | T06, T07, T08, T09, T10, T11, T12, T13 |
| T15 | P1 | em andamento | Operação e publicação | DevOps + Principal | T14 |

T00–T03 documentadas/concluídas; T13/T14 possuem provas técnicas locais com adaptadores sintéticos, sem aprovação de política comercial nem aceite integrado. T04/T05 e T07–T12 têm preparação e protótipos locais verificados. T06 bloqueada aguardando SVM/Docker para persistência e filas reais. T15 tem validação estática de prontidão operacional.


## T01 — Definir jornada principal e critérios do MVP

- **Prioridade/status:** P0 / `concluída`.
- **Responsável:** principal, com `flowmind_architect` em consulta e leitura; consolidação e aprovação registradas pelo principal.
- **Dependências:** T00, concluída.
- **Entrega:** definição revisável de problema, operador inicial, resultado esperado, jornada, escopo e critérios verificáveis confirmados pelo usuário em 10/10/2026.
- **Critérios de aceite:** usuário confirmou jornada de referência, análise por resumo/intenção/ambiguidades, sem classificação comercial, registro em tabela interna do FlowMind, resposta por e-mail ao autor do formulário, adoção do Clerk para auth/orgs e Docker Compose para o ambiente local. Decisões registradas em [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) e [docs/MVP_DEFINITION.md](docs/MVP_DEFINITION.md).
- **Evidências:** aprovação interativa do usuário registrada em 10/10/2026; pacote documental inicial consolidado em [docs/MVP_DEFINITION.md](docs/MVP_DEFINITION.md); consultas preparatórias de todos os perfis em [docs/EXECUTION_START.md](docs/EXECUTION_START.md). T01 concluída com sucesso.

### Jornada confirmada; detalhes técnicos em revisão

Jornada confirmada em MVP_DEFINITION.md: formulário, resumo/intenção/ambiguidades, registro interno e e-mail ao contato. Campos e schemas seguem em revisão; nenhum CRM externo foi escolhido.

1. Um usuário autentica-se e acessa uma organização autorizada.
2. Descreve a automação do exemplo em linguagem natural.
3. Recebe uma proposta de workflow; dados ou parâmetros ausentes aparecem como pendências e impedem execução.
4. Revisa e edita etapas, entradas, destinatários e comportamento esperado no editor visual.
5. Salva e simula o fluxo com dados sintéticos, consultando resultados e efeitos previstos por etapa.
6. Após revisão da definição e autorização dos efeitos externos pertinentes, ativa a automação.
7. Acompanha execuções, falhas, histórico e consumo; corrige a definição e repete a simulação quando necessário.

Gerar, salvar ou revisar uma proposta não autoriza, por si só, disparar e-mails, HTTP ou outras ações reais. Admin revisa formalmente/ativa; member prepara/simula. Transições e versões continuam em revisão em T02–T03.

### Critérios propostos para o MVP completo

| Área | Resultado verificável proposto | Tarefas |
| --- | --- | --- |
| Usuários, organizações e permissões | Usuário autorizado opera seus recursos; cenários negativos negam acesso de outra organização a definições, credenciais, execuções e logs | T02, T04, T06, T14 |
| Dashboard e persistência | Criar, listar, consultar e editar automações preserva a definição após recarregar | T03, T07, T14 |
| Editor e validação | Editar e revisar preserva nós, conexões e parâmetros válidos; definição inválida não pode ser ativada | T03, T08, T14 |
| Geração e nós de IA | Propostas e saídas cumprem os contratos; ambiguidades, recusas e falhas são visíveis; qualidade avaliada por casos e rubrica a aprovar | T03, T09, T10, T14 |
| Motor e simulação | Simulação sintética mostra entradas, resultados e erros por etapa; execução autorizada é rastreável | T03, T09, T14 |
| Condições, HTTP e e-mail | Cenários aprovados verificam ramificações, resultado esperado e falhas usando efeitos simulados durante testes locais | T03, T11, T14 |
| Webhook e agendamento | Gatilhos autorizados iniciam a execução correta; replay, concorrência, retries e idempotência respeitam políticas aprovadas | T03, T12, T14 |
| Histórico, logs e erros | Resultados e falhas por execução/nó são consultáveis e isolados; logs respeitam as políticas de privacidade e retenção | T03, T09, T13, T14 |
| Consumo e limites | Uso mensurável e limites aplicados segundo orçamento e regras aprovados; tentativa excedente produz resposta verificável | T03, T10, T13, T14 |
| Interface integrada | Jornada principal, estados de erro, teclado, foco, acessibilidade e responsividade passam nos cenários acordados | T07, T08, T14 |
| Operação | Destino autorizado, monitoramento, backup e recuperação definidos e validados antes de publicar | T05, T15 |

Não há patamar numérico de qualidade de IA, preço, quota, SLO ou desempenho aprovado. T01 define o resultado de negócio; as tarefas próprias detalham políticas e medidas técnicas sem inventar valores.

### Histórico do levantamento de T01

Perguntas respondidas em MVP_DEFINITION.md; a sequência por incrementos foi escolhida, mantendo todo o backlog.

- Quem opera a primeira jornada dentro da empresa, e qual resultado caracteriza sucesso para essa pessoa?
- O que significa “analisar o interesse”: qual saída esperada, exemplos corretos e tratamento de casos ambíguos?
- Quais informações devem ser registradas, em qual destino lógico e para quem o e-mail será enviado?
- A jornada e os critérios acima podem orientar o desenvolvimento? Todos os recursos desejados precisam estar disponíveis na primeira versão, ou pode haver marcos incrementais dentro do MVP completo?

| Opção considerada | Necessidade atendida | Trade-offs e riscos |
| --- | --- | --- |
| Validar todo o escopo em conjunto | Avaliar a cobertura completa antes de expor um incremento | Mais contratos, integrações e cenários antes do primeiro feedback; maior custo inicial de implementação e validação |
| Validar incrementos pela jornada do formulário | Obter feedback cedo sobre o resultado principal | Exige preservar compatibilidade entre incrementos; risco de adiar itens restantes, mitigado mantendo T01–T15 no backlog |

Segunda opção confirmada, com isolamento, revisão, privacidade e controle de consumo em cada incremento. Não há lista aprovada de funcionalidades fora do MVP; modelo comercial, preços e integrações adicionais continuam pendentes no contexto. Clerk escolhido; modelo de IA e hospedagem seguem nas tarefas próprias.

## T02 — Especificar Clerk, organizações e permissões

- **Prioridade/status:** P0 / `concluída` na especificação formal (decisões aprovadas pelo usuário em 12/10/2026; integração/persistência real rastreada em T06).
- **Responsável:** principal consolida; Backend/Arquiteto investigam em leitura.
- **Dependências:** T01 concluída.
- **Entrega:** identidade, vínculos/papéis, provisionamento, revogação e continuidade das ativações formalmente decididos no [Pacote T02](docs/T02_DECISION_PACKAGE.md).
- **Confirmado em 12/10/2026:** Clerk como autoridade completa de identidade, vínculos e papéis; validação de sessão/membership/papel a cada requisição de negócio e upsert local idempotente de organizações no FlowMind; continuidade pela organização (versão imutável preservada; saída do aprovador não suspende workflow; admin vigente pode desativar).
- **Critérios de aceite:** escolhas registradas com origem e alcance; sessão/vínculo/papel vigentes especificados; isolamento por recurso preservado; política de falha fechada definida.
- **Evidências:** aprovação interativa do usuário registrada em 12/10/2026 (rodada R07); `clerk.service.ts` e `clerk-auth.guard.ts` já refletem este modelo; 73 testes Jest e 42 regressões verdes. Implementação física contra API do Clerk e banco real prosseguem em T06.

## T03 — Definir contratos de workflows, nós e APIs

- **Prioridade/status:** P0 / `concluída na consolidação formal` (R07). T03-S0/S1/S2a têm controles locais documentados. T03-S2b conserva políticas concorrentes sem aprovação recuperada; T03-S3/A foi aprovado e concluído localmente em 15/10, sem modelo comercial escolhido. [Mapa](docs/T03_NODE_SCHEMA_REVIEW.md), [recursos candidatos](docs/T03_RESOURCE_PROPOSAL.md).
- **Responsável:** principal, editor único; especialistas investigam/revisam em leitura.
- **Dependências:** T01 e T02 concluídas.
- **Entrega:** contratos versionados (`WORKFLOW_SCHEMA_VERSION = '1.0.0'`), nós e DTOs de API em `@flowmind/contracts`; modelo Prisma atualizado com `reviewedBy` e `reviewedAt`; ciclo de vida formal com RBAC (`org:admin` para review, activate, deactivate); política de exclusão ativa; `ResourceResolver` com lookup multi-tenant no servidor; e testes unitários e de regressão.
- **Controles locais observados:** contratos tipados, revisão por admin, snapshot/versão/autoria, edição fora de DRAFT e exclusão PUBLISHED protegidas nos testes. ResourceResolver em Map/catálogo fixo não comprova autorização persistente/segredos/revogação ou modelo aprovado. Aceite das políticas adicionais continua pendente.
- **Evidências:** consolidação formal histórica em [WORKFLOW_CONTRACT.md](docs/WORKFLOW_CONTRACT.md). Snapshot histórico T08: 629 Jest/35 suítes, 179 regressões, dez checks e 145 entradas; [alcance/limites](docs/VALIDATION_T08_EDITOR_2026-10-13.md). SEC05 posterior registra 685/179/146; não valida alterações concorrentes posteriores.
- **T03-S3 — A aprovada; R1–R5 aceitas localmente na retomada:** [contrato](docs/T03_RESOURCE_IMPLEMENTATION_PLAN.md), [resultado](docs/VALIDATION_T03_CATALOG_2026-10-15.md). Catálogo vazio em produção, DI obrigatória, consulta protegida e seleção autorizada. Gestão de credenciais por admin preservada para recorte posterior. Não aprova modelo/cofre/custo ou integração real.

## T00 — Configuração dos sete agentes

- **Prioridade/status:** P0 / `concluída`.
- **Responsável:** principal.
- **Dependências:** nenhuma.
- **Entrega:** sete perfis nativos, instruções compartilhadas, concorrência de dois subagentes e documentação de uso preservada.
- **Critérios de aceite:** configuração válida, reconhecimento/delegação e comportamento observados com evidências; distinção entre configuração da equipe e segurança do SaaS.
- **Bloqueio:** nenhum para esta entrega de configuração; limitações do sandbox e ferramentas estão em CODEX_USAGE.md.
- **Evidências:** resultados históricos de 09/10/2026 em CODEX_USAGE.md, incluindo sete delegações reais e thread pai `01a122b7-a666-7522-a16a-2ed7652c97e9`; `python .codex/validate_team.py` passou novamente nesta sessão. Os sete testes nativos não foram repetidos; não são testes do produto.

## T04 — Planejar testes, isolamento e ameaças

- **Prioridade/status:** P0 / `em andamento` (matriz e hardening local; aceite integrado pendente).
- **Responsável:** principal implementa/consolida; QA/Segurança e Arquiteto revisam em leitura.
- **Dependências:** contratos documentados T02/T03; validações reais dependem de T05/T06/T09/T11/T13/T14.
- **Entrega local:** matriz requisito/cenário/evidência; ciclo de vida transacional com rollback/conflitos; DI Clerk; testes positivos e negativos de duas organizações.
- **Evidências:** 101 Jest/12 suítes, 50 regressões, 16 casos de ciclo de vida e dois controles SEC04. Tipos, builds, artefato DI e scanner heurístico passaram no snapshot; fonte alterada por outra execução após checks permanece identificada. [Validação](docs/VALIDATION_T04_R08.md), [matriz](docs/QA_SECURITY_MATRIX.md).
- **Incremento SEC05 aceito localmente em 13/10:** credenciais/formulários exigem tenant exato e contexto válido; erros de alheio/inexistente/tipo errado/sem tenant têm status/código/JSON iguais. 56 controles novos (36 resolvedor/validação + 20 container), com negações antes de writes/snapshots. [Prova](docs/VALIDATION_T03_RESOURCE_SECURITY_2026-10-13.md).
- **Aceite pendente:** sessão/membership/revogação e RBAC por endpoint; credenciais e registro cruzados; C03/entrada e configurações inválidas; jobs de versão imutável e concorrência PostgreSQL. Testes sintéticos não encerram SEC01–SEC10.
- **Próxima ação:** fechar decisões T03 de recursos/modelos, validar autorização/revogação e persistência em ambiente real autorizado; manter T08/browser e CI/Docker como gates. Testes locais não encerram SEC01–SEC10.

## T05 — Preparar estrutura, ambiente local e CI

- **Prioridade/status:** P0 / `em andamento` (scaffolding/checks locais entregues; fila/ambiente/CI reais e audit completo pendentes).
- **Responsável:** principal consolida; DevOps investiga; atribuição exclusiva antes de implementar.
- **Dependências:** decisões pertinentes aprovadas; contratos T02–T04 revisados para integração.
- **Entrega local:** Node portátil/pins/lockfile/Prisma/CI preservados; overrides existentes 8.0.2/3.24.5, com audit sem dev anteriormente zerado. Contratos assíncronos formalizados (`WorkflowJobPayload`, `WorkflowJobResult`, `QueueMetrics` em `@flowmind/contracts/queue`); fila em memória (`InMemoryJobQueue`) com isolamento multi-tenant, deduplicação por `idempotencyKey` e retries para erros transitórios de storage; `WorkerService` integrado com suporte a enfileiramento, consumidor determinístico e métricas.
- **Critérios de aceite:** versões fixadas; API/worker separados; instalação autorizada; checkout/ambiente reproduzível e checks completos; segredos fora do Git, falhas claras/recuperação validada; fila assíncrona desacoplada de dependências externas obrigatórias para testes locais.
- **Pendências:** infraestrutura BullMQ/Redis real (condicionada à autorização de Docker/Redis); auditoria completa com substituição de dependências; CI remoto autorizado.
- **Evidências (13/10/2026):** 690 Jest/36 suítes, 180 regressões e scanner em 144 arquivos; 19 testes em `worker.service.spec.ts` e cenário de regressão em `executions.test.mjs`; tipos, builds API/web Turbopack, artefato e Prisma validate aprovados. [Ambiente](docs/DEVOPS_ENVIRONMENT.md).

## T06 — Implementar usuários, organizações e autorização

- **Prioridade/status:** P0 / `bloqueada` para integração real; correção local de auth entregue em 12/10/2026.
- **Responsável:** principal implementa; especialistas revisam em leitura.
- **Dependências:** decisões T02/T03 documentadas; gates T04/T05 e ambiente integrado pendentes.
- **Entrega local:** sessão ativa pertence ao usuário/ID e não expirou; consulta de membership filtrada por usuário, organização e papel vigente; upsert obrigatório antes de acesso. Erros e APIs ausentes negam autorização; sem fallback ao papel do JWT.
- **Provas locais:** sete grupos vermelhos antes da correção; 20/20 regressões de auth, 16 testes de metadados/guards reais. Snapshot completo: 131 Jest/13 suítes, 68 regressões, tipos, build API e DI passaram; scanner heurístico analisou 91 arquivos.
- **Prova adicional em 13/10:** AppModule/Express/guards reais exercitados nos mesmos 30 cenários por streams e HTTP TCP local; identidade/storage/IA sintéticos, 60 controles direcionados. [T06/T14](docs/VALIDATION_T14_HTTP_2026-10-13.md).
- **Aceite pendente:** JWT/Clerk remotos, persistência PostgreSQL, bootstrap main.ts/CORS e integrações externas; isolamento integrado de credenciais/registros/logs. Política de exclusão por member ainda indefinida; não alterada.
- **Limites:** sem chamadas reais, serviços, migração ou novas instalações. Relatos de Docker/SVM de outra execução não foram verificados nesta rodada.
- **Evidências:** [validação T06](docs/VALIDATION_T06_AUTH.md), [hashes/resultados](docs/T06_CHECKS_2026-10-12.json), [matriz](docs/QA_SECURITY_MATRIX.md).
- **Próxima ação local:** validar C03 (entrada sem e-mail rejeitada antes de registro/e-mail) e parâmetros/referências em T09/T11; integração T06 depende do ambiente autorizado.

## T07 — Implementar dashboard e persistência das automações

- **Prioridade/status:** P0 / `em andamento`.
- **Responsável:** Backend na API/Prisma; Frontend no dashboard.
- **Dependências:** T03, T06; ambiente de T05.
- **Entrega prevista:** CRUD/persistência e dashboard com listar/criar/editar, carregamento/erros e conservação da definição após recarregar.
- **Critérios de aceite:** Operações restritas à organização; falha do banco/API não vira sucesso fictício; definição criada é recuperável; jornada web acessível e testada.
- **Estado observado:** Dashboard funcional (`apps/web/src/app/dashboard/page.tsx`), CRUD completo com exclusão protegida e badges completos (`DRAFT`, `REVIEWED`, `PUBLISHED`). Tratamento HTTP 204, propagação de mensagens de erro detalhadas e bloqueio de exclusão em fluxos ativos respeitados pelo `ApiClient`.
- **Evidências/pendências:** 48 regressões/77 Jest foram checkpoint anterior. Snapshot atual: 215 Jest/96 regressões; dashboard mostra erro dentro do modal, preserva travas de concorrência e descarte por contexto. Banco/Clerk reais e jornada no navegador dependem de T06/T14.

## T08 — Implementar editor visual e validação

- **Prioridade/status:** P0 / `em andamento`; incremento de parâmetros/movimentação/conexões e criação/remoção de nós implementados, testes direcionados aprovados. Aceite integral do editor pendente.
- **Responsável:** principal no frontend; revisores independentes somente em leitura. Um editor por arquivo.
- **Dependências:** contratos T03 existentes; T07/T06 para persistência e identidade reais. Política T03-S2b/S3 concorrente exige confirmação de origem e revisão dos riscos.
- **Autorização deste incremento:** “pode seguir”; seis tipos existentes em DRAFT, reutilizando API/save/guardas. Adição e remoção de nós do catálogo com limpeza em cascata de arestas e proteção contra remoção do gatilho.
- **Entrega:** funções puras de edição/posição/arestas e ciclo de vida de nós (`addWorkflowNode`, `removeWorkflowNode`); painel lateral com seleção, criação por catálogo fechado e remoção com confirmação; XYFlow com handles preservados e atualização de bounds solicitada por efeito; ramificação Sim/Não; conexões condicionais e remoção de conexões. IDs, config não editada, ausências/defaults e metadados preservados.
- **Proteções:** bloqueio fora de DRAFT, ciclos/arestas repetidas/nós ausentes, proibição de segundo `trigger_form`, proibição de exclusão do `triggerNodeId`, rascunho de formulário ainda não aplicado, operações assíncronas e organização/contexto/revisão obsoletos. Salvar lê a definição corrente mesmo antes do próximo render; simular/revisar/ativar negam alterações ainda não salvas.
- **Evidências:** 45 controles direcionados de edição de nós e conexões em `workflow-editing.test.mjs`; seis renders SSR React reais de formulários. Testes AST/setters/API e efeito de handles são sintéticos, sem React lifecycle/DOM. Pipeline unificado com 690 Jest e 184 regressões nativas 100% verde.
- **Pendências:** CUA sem browser disponível; validar seleção/drag/handles/formulário/foco/teclado/mobile/persistência após recarregar no ambiente autorizado. Navegação/versionamento e aceite integrado continuam gates.
- **Próxima ação:** aguardar escolha formal das decisões de arquitetura T03-S2b e T03-S3 para fechamento dos contratos e avanço nas tarefas de integração.

## T09 — Implementar motor e simulação

- **Prioridade/status:** P0 / `em andamento` (protótipo DAG/simulação/convergência).
- **Responsável:** Automações sob coordenação do principal.
- **Dependências:** T03, T04, T05 e T06 ainda sem aceite.
- **Entrega existente:** ordenação topológica/validação de ciclos, precedência de variáveis, ramificação e protótipo de convergência OR-Join de outra execução, preservado.
- **Captura preservada:** protótipo conecta simulação ao histórico com ID/autoria da sessão. Quatro novos casos no AppModule verificam consulta própria/cross-org, FAILED e 503 de gravação; escolha de consumo e aceite do contrato permanecem pendentes em T13.
- **Critérios previstos:** C01–C03 sem efeitos externos; execução/autorização/versão conforme contratos revisados; falhas consistentes. Semântica de convergência ainda exige revisão em T03.
- **Evidências:** suíte geral de 73 Jest e 42 regressões passou, incluindo casos de convergência. Não aprova a política OR-Join nem comprova todos os cenários/execução real. [R05](docs/VALIDATION_R05.md).

## T10 — Implementar geração estruturada por IA

- **Prioridade/status:** P0 / em andamento. Preparação sintética e controles técnicos locais verificados; qualidade semântica, modelo, privacidade, orçamento e aceite continuam pendentes.
- **Responsável/dependências:** IA; Frontend no consumo da proposta. T03/T08; T09 para o nó de análise.
- **Entregas locais:** catálogo IA01–IA09, avaliador com true/false/não exercitado, corpus IA09 1.0.0 com oito entradas C01–C03 e rubrica candidata. Adaptador exige proposta concluída e estrutura/configuração válidas; consumo desconhecido é null, uso declarado sobrevive a falhas controladas e mensagens privadas são omitidas. Editor distingue consumo não informado. Script eval:offline usa template explícito e bloqueia fetch; notas humanas/médias ficam null.
- **Validação atual:** adaptador mantém seus 53 controles novos/75 direcionados. T03-S0 acrescentou 20, S1 85 e S2a 62 controles. Snapshot completo: 495 Jest/32 suítes, 110 regressões, scanner 130, dez comandos exit 0; 134 entradas estáveis. [Recibo](docs/T03_REFERENCE_CHECKS_2026-10-13.json), [alcance/reprodução](docs/VALIDATION_T03_REFERENCE_2026-10-13.md).
- **Relatório offline:** nove pedidos; seis verificações técnicas aprovadas e três não exercitadas (IA05/IA07/IA08), sem percentual global ou nota de qualidade. Zero tentativas de fetch e zero respostas de modelo avaliadas. [Saída](docs/evaluation/T03_REFERENCE_OFFLINE_REPORT_2026-10-13.json).
- **Aceite pendente:** modelo autorizado, corpus/rubrica/pesos/patamar aprovados, revisão semântica de respostas reais e contrato de privacidade/uso/retenção. Filtro regex, grafo válido ou fixture não demonstram toda segurança, autorização ou intenção.
- **T03-S2b Opção A confirmada pelo usuário em 23/10/2026**; lacunas de códigos/testes corrigidas localmente (766 Jest, 202 regressões); ver docs/MEMORIA.md. Histórico: **Próxima tarefa local:** T03-S2b, proposta concreta para disponibilidade/convergência, modos e opcionais; S2a já valida existência/precedência/saídas/tipos conhecidos em todas as configurações. [Evidência](docs/VALIDATION_T03_REFERENCE_2026-10-13.md). T03-S3/T10-S4, recursos/interface e contabilização comercial continuam pendentes. Nenhuma chamada comercial/serviço real é aprovada por implicação dos testes.
- [Guia](docs/AI_EVALUATION.md), [rubrica candidata/corpus](docs/evaluation/T10_RUBRIC_PROPOSAL.md). Default de modelo no código não é aprovação. A declaração anterior de nota máxima/conclusão foi [preservada](docs/archive/CONCURRENT_T10_2026-10-12.md) e não é o aceite atual.

## T11 — Implementar condição, registro interno, HTTP e e-mail

- **Prioridade/status:** P0 / `em andamento` (implementação local preservada; dependências, políticas e aceite integrado pendentes).
- **Responsável:** Automações; Backend na estrutura do registro interno.
- **Dependências:** T09 e contratos consolidados de T03 (aceite integrado pendente).
- **Entrega realizada:**
  1. **Nó de Condição (`condition`):** Operadores declarativos expandidos e tipados em `@flowmind/contracts` (`equals`, `==`, `eq`, `not_equals`, `!=`, `neq`, `contains`, `not_contains`, `in`, `not_in`, `greater_than`, `>`, `gt`, `less_than`, `<`, `lt`, `greater_or_equal`, `>=`, `gte`, `less_or_equal`, `<=`, `lte`, `is_empty`, `is_not_empty`, `starts_with`, `ends_with`).
  2. **Nó de Registro Interno (`internal_record`):** Separação formal de lead de negócio de logs de execução, validação de campos identificadores (`name` ou `email`), e propagação de saídas mapeadas (`name`, `email`, `raw_message`, `ai_summary`, `ai_intent`, `ambiguities`, `record_id`, `status: 'simulated'`, `simulated_at`), permitindo resolução determinística de variáveis em nós subsequentes.
  3. **Nó de E-mail (`send_email`):** Validação estrita de formato e proteção contra CRLF Injection em `to`, `subject` e `replyTo`, retornando `subject` nas saídas do nó de simulação.
  4. **Nó HTTP (`http_request`):** Validação de método e URLs, sanitização rigorosa contra CRLF Injection em cabeçalhos HTTP (`HTTP_HEADER_INJECTION`) e validação de URLs literais selecionadas contra SSRF (bloqueio de localhost, loopback, metadados cloud AWS/GCP, redes privadas RFC 1918 e faixas IPv6 privadas ULA `fc00::/7` e link-local `fe80::/10`).
- **Critérios exercitados localmente; aceite integrado pendente:** Avaliação declarativa precisa de condições e ramificações; resolução de saídas de nós intermediários no DAG; simulação pura sem efeitos colaterais reais em modo `SIMULATION`; bloqueio ativo em modo `LIVE`.
- **Relato anterior de validação local:** 106 testes Jest (12 suítes) e 51 testes de regressão 100% verdes, cobrindo operadores de condição, interpolação downstream de variáveis, cabeçalhos com CRLF e bloqueios de IPv6 SSRF. Zero violações de lint em 88 arquivos e build de produção Turbopack/NestJS limpo.

## T12 — Implementar webhooks e agendamento

- **23/10/2026:** política da fila aprovada e consumidor BullMQ implementado/validado contra Redis e PostgreSQL reais (ver docs/MEMORIA.md). Webhook assinado implementado e validado ponta a ponta (202→fila→execução gravada); agendamento cron implementado e validado (ver docs/MEMORIA.md); bloqueio: payload { scheduledAt } incompatível com trigger_form.

- **Prioridade/status:** P1 / `em andamento`.
- **Responsável/dependências:** Automações e Backend; T09/T11, contrato de autenticação externa, replay e filas aprovado.
- **Entrega local:** prefixo único; ingresso HTTP fechado com 503 sem lookup; serviço exige segredo resolvido no servidor e autentica antes de revelar recursos. Protótipo HMAC/timestamp e comparação de token em fixtures preservados; não aprovam protocolo/corpo bruto nem replay distribuído. Fixtures autorizadas exercitam simulação/idempotência sequencial. Cron/fuso são validados; cálculo de próxima data está indisponível.
- **Aceite pendente:** resolução segura de segredo/organização, timestamps/replay, limites, idempotência concorrente/distribuída, scheduler cron real, Redis/BullMQ e retries. Comparação de segredo em fixture não demonstra HMAC de payload ou webhook operacional.

## T13 — Logs, histórico e consumo

- **Prioridade/status:** P0 / `em andamento` (protótipo preservado e testes sintéticos aprovados; política de consumo, banco físico e coordenação distribuída pendentes).
- **Responsável/dependências:** Backend e Frontend; contratos consolidados em `@flowmind/contracts` e suíte de testes.
- **Entrega consolidada:**
  - **Opção A de consumo:** Simulações (`SIMULATION`) são registradas incondicionalmente no histórico de execuções (`workflowExecution`), porém são excluídas da contagem de `LIVE` no protótipo (limite atual 1.000, sem aprovação comercial). A escolha A desta conversa refere-se ao catálogo T03-S3, não à política de consumo T13.
  - **Injeção obrigatória:** `ExecutionsService` passa a ser dependência obrigatória em `WorkflowsService` (sem `@Optional()`), com guarda estrita de 503 (`EXECUTION_STORAGE_UNAVAILABLE`) caso o serviço de execução esteja indisponível, impedindo simulações sem auditoria.
  - **Relatório de consumo mensal (`OrgUsageReport`):** Campo `totalSimulations` adicionado ao contrato; `UsageLimitsService.getOrgUsageReport` e contagem de banco segregam execuções `LIVE` e `SIMULATION`.
  - **Frontend:** Indicador visual no card de histórico de execuções informando a contagem de simulações do período isentas de quota comercial.
- **Evidências:** Testes Jest e suítes nativas de regressão atualizados e 100% verdes (`executions.service.spec.ts`, `executions.test.mjs`, `full-journey-integration.spec.ts`, `full-journey.test.mjs`).

## T14 — Validar a jornada completa

- **Prioridade/status:** P0 / `em andamento` (nove passos exercitados com adaptadores sintéticos em JOURNEY03; navegador/persistência/modelo/efeitos reais e aceite integrado pendentes).
- **Responsável/dependências:** QA/Segurança sob revisão do principal; T06–T13 consolidados no escopo determinístico.
- **Entrega consolidada (Passos 1 a 9 da Jornada do MVP):**
  1. Criação no estado `DRAFT` (formulário → IA → registro → e-mail).
  2. Bloqueio de convergência estrutural (`inDegree > 1` rejeitado com `WORKFLOW_CONVERGENCE_NOT_SUPPORTED`).
  3. Bloqueio de modelo de IA não homologado ou pendente (`PENDING_MODEL_SELECTION`).
  4. Seleção de referência sintética do catálogo de teste (`gpt-4o-mini`) e revisão por admin simulado (`REVIEWED`); não homologa modelo comercial.
  5. Ativação atômica (`PUBLISHED`) gerando snapshot imutável em `workflowVersion` e impedindo ativação duplicada.
  6. Simulação com geração de ID rastreável `sim_*` e persistência automática no histórico de execuções.
  7. Acompanhamento no histórico e consulta de detalhes via `executionsService.listExecutions` e `getExecutionById` (validando `stepResults` e autoria `admin_compliance`).
  8. Isolamento estrito multi-tenant (SEC01/SEC04) comprovando que outra organização obtém lista vazia e 404 em inspeção direta.
  9. Relatório de consumo comprovando cota `LIVE` intacta (`totalExecutions: 0`), contabilização de simulações (`totalSimulations: 1`) e limite não atingido.
- **Evidências:** `apps/api/src/qa/full-journey-integration.spec.ts` e `tests/regression/full-journey.test.mjs` 100% verdes no pipeline unificado `npm run check:all`.

## T15 — Preparar operação e publicação

- **Prioridade/status:** P1 / `em andamento`.
- **Responsável/dependências:** DevOps e principal; T14 aceito e escolhas operacionais aprovadas.
- **Entrega local:** Compose/CI/template e comandos de desenvolvimento preservados; `check:operation` qualificado como checagem estática; liveness/readiness testados com provider fake; guia de operações proposto.
- **Aceite pendente:** auditoria de dependências corrigida (quatro altos no recorte de produção), serviços reais, schema/migrations aprovados, CI remoto, destinos/hospedagem, backups com restauração comprovada e testes de disponibilidade. Probes não validam todos os serviços nem certificam go-live.
- **Publicação:** não realizada nem autorizada neste checkpoint. [Guia e gates](docs/DEPLOYMENT_OPERATIONS.md).

## Registro da entrega documental

- **09/10/2026:** T00 reconhecida como concluída com referência aos testes existentes e revalidação estática. T01 iniciada com análise do arquiteto e proposta consolidada; T02–T15 mantidas pendentes com condições de liberação explícitas.
- Criados este plano e docs/MEMORIA.md; instruções internas e links de entrada atualizados. O principal mantém a escrita exclusiva de memória, backlog e contratos até reatribuição explícita.
- A conferência final de links, dependências, critérios, instruções e preservação é registrada em docs/MEMORIA.md. O acesso ao vault, incluindo limitações do conector, também está descrito ali.
- **Próxima ação histórica de 09/10:** confirmar T01; resolvida em 10/10. A ação atual está na rodada R03 abaixo.

## Execução iniciada — rodada R01

O pedido seguinte do usuário autorizou iniciar o plano e usar todos os agentes. Foram antecipadas apenas consultas independentes e preparação de rascunhos, para tornar as decisões revisáveis enquanto T01 aguarda confirmação. Isso não elimina dependências nem aprova decisões pendentes.

O principal escreve os documentos; os sete especialistas recebem tarefas consultivas delimitadas, em leitura. [docs/EXECUTION_START.md](docs/EXECUTION_START.md) registra retornos reais, recomendações, evidências e os artefatos preparados. Status e critérios de conclusão de T01–T15 permanecem sujeitos ao aceite definido neste plano.

## Consolidação documental — R02 (10/10/2026)

- Decisões, MVP/C01–C03, Clerk/papéis, contratos/registro e preparação de T05 consolidados; classificação comercial incorreta e conclusões antecipadas corrigidas.
- Scaffolding/código de outra execução preservados. T06 tem bloqueio de tokens mock; contratos TS ainda precisam ser alinhados ao resumo/intenção sem pontuação.
- Revisão independente do arquiteto: propostas coerentes; garantia de ambiguidade C02 explicitada; alegação de SEC01–SEC04 validados por comparação de mocks retirada.
- Checks R02 passaram: validador dos sete perfis, git diff --check, 70 links, sintaxe de 13 blocos JSON, coerência de status e sete notas iguais nos caminhos do Obsidian. Evidências e limites ficam em docs/MEMORIA.md. Esta entrega não instala ferramentas, consome APIs comerciais, faz commit/push/deploy ou inicia serviços.
- **Próxima ação histórica da R02:** corrigir auth/contratos e revisar T02/T03. Correções locais registradas na R03; requisitos pendentes não foram automaticamente aprovados.

## Correções locais — rodada R03 (10/10/2026)

- Auth/contratos/simulação/CRUD/cliente e consumidores web corrigidos; 37/37 regressões isoladas passaram. Sete perfis nativos revalidados estaticamente. [Evidências e limites](docs/VALIDATION_R03.md).
- Preservados protótipos de outra execução; corrigidas conclusões antecipadas no backlog e relatórios. Somente T00/T01 concluídas.
- Memória do Obsidian atualizada pela cópia única no filesystem. Sem instalações, serviços, migrations, uso comercial, commit/push/deploy.
- Conferência final: 10 notas pelos caminhos C:/E:, 60 links, 13 blocos JSON, 16 status e 14 arquivos protegidos; sem erros. JSON parseado não comprova contrato executável.
- **Próxima ação:** concentrar edições numa sessão; fechar T02/T03 e preparar T05 com versões compatíveis/lista concreta para aprovação. Depois executar typecheck/build/Jest e integração real antes de validar jornada/publicar.

## Ambiente e decisões — rodada R04 (10/10/2026)

- Retomada a partir do Obsidian; preservadas correções R03 e configurações dos sete agentes. Principal editou arquivos; duas consultas independentes em leitura revisaram ambiente e T02.
- Build/test agora compilam contratos antes dos consumidores e falhas interrompem o pipeline. Preparados typecheck dos produtos/testes e configuração Jest; corrigidos problemas estáticos de fixtures de execuções.
- 39/39 regressões isoladas passaram, incluindo dois cenários do orquestrador com CLI falso. Jest/typecheck/build reais não executados.
- Proposto Node 24.21.0 portátil e 34 pacotes exatos, sem deprecated no inventário e sem conflito em engines/peers diretos. Não é lockfile/auditoria transitiva. [Pacote T05](docs/T05_IMPLEMENTATION_PACKAGE.md).
- [Decisões T02](docs/T02_DECISION_PACKAGE.md) preparadas: autoridade dos vínculos/provisionamento/revogação e continuidade após saída do aprovador. Permanecem propostas; nenhuma escolha importante foi aprovada por implicação.
- Checks finais R04: sete perfis, sintaxe Node, git diff --check, oito arquivos iguais pelos caminhos do Obsidian, 56 links e 16 status; sem erros. Perguntas de aprovação enviadas; respostas pendentes.
- **Próxima ação:** obter aprovação do pacote local e escolhas de T02. Com aprovação do ambiente, instalar/gerar cliente e validar tipos/Jest/build; lint/CI, DB/Clerk real e T03 ainda têm dependências. Atualizar memória com escolhas e resultados reais.

## Instalação e validação local — rodada R05 (10/10/2026)

- “Pode seguir” autorizou T05; escolhas T02 pendentes. Registros concorrentes de “Opção 1 aprovada” corrigidos; código/backups preservados.
- Node portátil e 34 pins instalados; checksum/integridades/lockfile verificados; Prisma gerado/validado sem migration.
- Typecheck, 9 suítes/73 Jest, 42 regressões, builds e imports/metadados específicos passaram. Scanner de padrões corrigido/verificado; ESLint pendente.
- Auditoria falhou: 31 dependências afetadas, quatro altas também sem dev. CI local atualizado; sem execução remota, serviços, efeitos comerciais ou commit/push/deploy.
- Edições simultâneas exigiram verificações adicionais. Evidências dos snapshots: [CHECKS](docs/T05_CHECKS_R05.json); alcance/CMD: [VALIDATION_R05.md](docs/VALIDATION_R05.md).
- **Próxima ação histórica da R05:** uma sessão coordenadora; decidir T02 e revisar T03/T06; preparar correções de dependências/ESLint e ambiente integrado com aprovação pertinente. Somente T00/T01 concluídas.

## Organização do Obsidian e gestão de persistência — rodada R06 (10/10/2026)

- Usuário optou por adiar a instalação do Docker Desktop e solicitou a organização do cofre Obsidian, remoção de arquivos desnecessários e redução do tamanho do cérebro/memória.
- **Docker Desktop:** Instalador oficial v4.94.0 (635 MB) mantido intacto em `Downloads/DockerDesktopInstaller.exe` para uso futuro quando solicitado. Cache redundante em `$env:TEMP\WinGet` (668 MB) eliminado. Persistência real de T06 permanece pausada com mocks locais.
- **Redução do Cérebro (Brain):** Removidas 20 sessões antigas e inativas em `.gemini/antigravity-cli/brain` e purgados logs de tarefas canceladas, reduzindo o diretório de ~40 MB para 5.8 MB.
- **Otimização do Cofre Obsidian:**
  - Configurado `.obsidian/app.json` com `userIgnoreFilters` (`node_modules`, `.next`, `.turbo`, `.tools`, `.git`, `dist`, `.codex`), eliminando a sobrecarga de indexação de mais de 41.000 arquivos pelo Obsidian.
  - Criado mapa central de conteúdo `00 - Visão Geral do Cofre.md` na raiz do cofre Obsidian, com categorização completa e atalhos wiki-link para todas as notas essenciais.
  - Excluído diretório vazio legado `docs/app/getting-started/css.md`.
- **Integridade Técnica:** Motor DAG com convergência OR-Join, 73 Jest, 42 regressões, linter em 80 arquivos e compilação do monorepo preservados 100% verdes.
- **Próxima ação histórica da R06:** Decidir escolhas de autoridade e continuidade de T02.

## Decisões formais de T02 e consolidação de contratos T03 — rodada R07 (12/10/2026)

- Usuário aprovou formalmente ambas as recomendações arquiteturais de T02:
  1. **Autoridade completa do Clerk:** Provedor oficial de identidade, organizações e papéis (`admin`/`member`). O FlowMind valida JWT, sessão e vínculo em cada chamada de negócio e realiza upsert local idempotente de organizações no banco.
  2. **Continuidade pela Organização:** A ativação pertence à organização e fica vinculada à versão imutável aprovada. A saída ou rebaixamento de quem aprovou preserva a autoria histórica e não suspende por si só a automação (admins vigentes podem desativar a qualquer momento).
- **Conclusão de T03 (Contratos e Schemas):**
  - `@flowmind/contracts` e Prisma schema atualizados com persistência formal de `reviewedBy` e `reviewedAt`.
  - Transições RBAC: revisão e ativação restritas a `org:admin`, persistindo revisor e snapshot imutável em `WorkflowVersion`.
  - Política de segurança: edição bloqueada fora de `DRAFT` (edição não herda aprovação) e exclusão (`DELETE`) bloqueada para fluxos no status ativo (`PUBLISHED`).
- **Integridade técnica validada na sessão:**
  - 75 testes Jest unitários passando (100% verde).
  - 43 testes de regressão passando (100% verde).
  - Linter em 80 arquivos sem nenhuma violação.
  - Build do monorepo e typecheck (`contracts`, `api`, `web`) 100% limpos.
- **Próxima ação:** Preparar implementação das tarefas dependentes (T07 Dashboard, T08 Editor e T09 Motor), e retomar a infraestrutura do PostgreSQL/Redis via Docker (T06) quando o usuário autorizar a instalação do container.

## Memória externa — AI MEMORY (12/10/2026)

- Origem: pedido do usuário para verificar a conexão e transferir a memória do projeto.
- Servidor MCP 2.6.3 e escopo `workspace=flowmind-ai` / `project=flowmind-ai` verificados. Cadastro previsto no marcador criado ao importar.
- Seis páginas transferidas e lidas novamente; fontes canônicas do Obsidian preservadas. Sem instalação, alteração de configuração pessoal ou execução de serviços.
- [Operação e consulta](docs/AI_MEMORY.md), [recibos](docs/AI_MEMORY_TRANSFER_2026-10-12.json). Próxima tarefa: revisão dos contratos T03, mantendo gates T05/T06.

## Registro anterior de outra execução — R09 (12/10/2026)

Relato preservado abaixo. As conclusões de T04/T05/T10 e o aceite integral são limitados pelo checkpoint T04 R08 ao final; estes números antigos não substituem a evidência atual.

- **Conclusão de T10 (Geração Estruturada por IA):**
  - Implementado padrão Strategy com `AiClient`:
    - `OpenAiStructuredClient`: Conexão direta com a OpenAI Chat Completions usando `gpt-4o-mini` e Structured Outputs (`strict: true`) com `WORKFLOW_GENERATION_JSON_SCHEMA`, tratamento de recusas (`refusal`), taxa de requisições (429), extração de tokens consumidos e timeout defensivo.
    - `DeterministicAiClient`: Gerador sintético determinístico baseado no catálogo de 6 nós para execução local e CI sem chaves de rede.
    - `AiGeneratorService`: Validação prévia de injeções/comandos de terminal, injeção de dependência via token `AI_CLIENT` e verificação estrita de propriedades acíclicas de DAG com `DagValidator.validateAndSort`.
- **Endurecimento de Concorrência e Atomicidade (T04/T03):**
  - `WorkflowsService`: Adicionados bloqueios otimistas com verificação de status e versão em mutações (`update`, `review`, `publish`, `deactivate`, `remove`), prevenindo sobrescritas silenciosas (`ConflictException`).
  - `publish`: Execução transacional atômica garantindo que a ativação não deixa snapshots de versão órfãos e recusa ativação se a persistência de versão não estiver disponível.
- **Validação técnica 100% verde (R09):**
  - 11 suítes Jest, 95 testes unitários passando.
  - 50 testes de regressão passando.
  - 87 arquivos validados pelo linter de conformidade e segurança, zero violações.
  - Typecheck limpo em todo o monorepo (`@flowmind/contracts`, `@flowmind/api`, `@flowmind/web`).
  - Build de produção compilado com sucesso com Next.js Turbopack.
- **Próxima ação:** Implementar os executores de nós adicionais em T11 (condições com operadores estritos, registro interno de negócio separado de logs, requisição HTTP declarativa e envio de e-mail), ou iniciar o Docker Desktop para subir o banco real de T06 quando autorizado.

## Checkpoint T04 R08 — revisão independente e provas locais (12/10/2026)

- Regressões vermelhas reproduzidas antes das correções; 16/16 verdes após transações e tratamento específico de unicidade.
- 101 Jest/12 suítes, 50 regressões; tipos/builds/DI passaram no snapshot. 88 arquivos no scanner heurístico; ESLint permanece pendente.
- Corrigida a rastreabilidade SEC e C01–C03; cenários não executados permanecem abertos.
- Obsidian é a fonte canônica; atualização explícita do AI MEMORY no mesmo escopo, sem captura automática demonstrada.
- Docker permanece pausado. Próxima ação: fechar lacunas locais de sessão/membership/RBAC em T06 e revalidar alterações paralelas antes de aceite integrado.
- [Evidências e limitações](docs/VALIDATION_T04_R08.md), [matriz](docs/QA_SECURITY_MATRIX.md), [hashes](docs/T04_CHECKS_R08.json).

## Checkpoint T06 — autenticação vigente (12/10/2026)

- T06 local: sessão/usuário, validade, membership filtrada, papel corrente e upsert obrigatório; revisão independente sem achados materiais.
- 131 Jest/13 suítes e 68 regressões passaram em snapshot estável; 20 casos de auth e 16 de rotas. Build API/DI/tipos passaram. Scanner heurístico não substitui ESLint.
- Restaurada a linha T09 ausente no panorama. Entregas locais relatadas T10–T13 preservadas; conclusão integral exige dependências, políticas aprovadas e integrações previstas no próprio backlog.
- [Registro](docs/VALIDATION_T06_AUTH.md). Próxima ação: C03 e validação antes de efeitos; ambiente real permanece gate. Obsidian canônico e AI MEMORY atualizados por checkpoint, sem captura automática demonstrada.

## Consolidação e ergonomia de DX — rodada R15 (12/10/2026)

- Usuário delegou autonomia de continuidade ("vou sair agora , continue trabalhando , pode decidir qual vai ser o melhor passo").
- **Ações executadas:**
  - `package.json` raiz enriquecido com comandos de atalho monorepo: `dev:web` (`@flowmind/web` na porta 3000), `dev:api` (`@flowmind/api` na porta 3001) e `check:all` (execução sequencial de lint, typecheck, Jest, regressões, api-artifact, operação e build).
  - `README.md` totalmente alinhado com o estado real da aplicação, descrevendo arquitetura de 3 camadas (`web`, `api`, `contracts`), mapa de documentação do cofre e comandos operacionais.
  - Linter executado e aprovado em 96 arquivos sem nenhuma violação.
  - Script de prontidão operacional (T15) `npm run check:operation` 100% verde.
  - Suíte de 131 testes Jest e 74 testes de regressão nativos revalidadas com sucesso.
- **Próxima ação:** Execução com contêineres Docker físicos e banco de dados real (T06) assim que o usuário reiniciar o computador com virtualização (SVM) ativa na BIOS.


## Checkpoint local — C03, AppModule e falhas de storage (12/10/2026)

- 207 Jest/18 suítes, 74 regressões; tipos, API/web, artefato e scanner passaram em snapshot estável. Operação é checagem estática.
- Corrigidos destinatários inválidos antes de nós/revisão/ativação, três prefixos duplicados, DI AI_CLIENT, readiness falso e fallbacks permissivos do histórico/consumo. Tokens fictícios retirados; redação estrutural e limites de query testados.
- Webhook fica fechado; IA exige opt-in explícito; scheduler não apresenta data inventada. Não foram habilitados efeitos externos.
- Auditoria atual: 31 pacotes sinalizados, nove altos; quatro altos no recorte de produção. Correção/instalação aguarda aprovação.
- Obsidian atualizado; AI MEMORY recusou conexão e a cópia atual está pendente. Preservado o relato concorrente R15, sem aceitar MVP/go-live completo. [Validação backend](docs/VALIDATION_LOCAL_HARDENING_2026-10-12.md).

## Checkpoint local — feedback, concorrência e acessibilidade do frontend (12/10/2026)

- **207 Jest/18 suítes, 76 regressões (expandido com testes de invariantes do cliente e serialização do ApiClient)**; typecheck, lint (99 arquivos), artefatos e builds de produção da API e da web (Next.js 16 Turbopack) 100% verdes.
- **WorkflowEditorPage (`workflows/[id]`)**: eliminados `alert()` bloqueantes síncronos; adotados banners acessíveis com `role="status"` ou `role="alert"` e `aria-live="polite"`; introduzidas travas estritas em `activeContext` (`saving`, `simulating`, `reviewing`, `publishing`, `deactivating`, `generatingAi`) e trava global `isAnyActionRunning`; desativação reseta `isDirty`, limpa `simResults` e avança versão DRAFT; mutações e aplicação de propostas de IA são bloqueadas se o fluxo não for `DRAFT`.
- **DashboardPage (`dashboard`)**: exclusão concorrente bloqueada via `deletingIds` em `activeContext`; desabilitação visual do botão de exclusão por item; indicador de carregamento e desabilitação em criação manual (`isCreatingManual`); descarte de propostas órfãs de IA ao fechar modal; feedback acessível com banners.
- **HistoryPage (`history`)**: eliminação de out-of-order race na inspeção de execuções através do contador de requisições monotônico `inspectSeq`; desabilitação e feedback visual na linha ativa (`inspectingId`); banner acessível `role="alert"` para falhas de consulta.
- Próxima ação: definir contrato de integração simulação → histórico (`recordExecution`), elegibilidade de quota e ID consultável; preparar proposta de correção para os pacotes sinalizados do Prisma em T05. [Validação frontend](docs/VALIDATION_FRONTEND_HARDENING_2026-10-12.md).

## Checkpoint atual — callbacks e captura de simulação (12/10/2026)

- **215 Jest/18 suítes, 96 regressões**; tipos, API/web, artefato, scanner em 100 arquivos e checagem estática operacional aprovados. Arquivos de entrada reenumerados e hashes estáveis nos oito checks. [Recibo atual](docs/SIMULATION_HISTORY_CHECKS_2026-10-12.json).
- 26 testes de callbacks/effect comprovam resposta fora de ordem, A→B→A, fechamento do detalhe, token/revisão obsoletos, travas/reset e feedback de FAILED; preservam dados úteis quando consumo/listagem falham separadamente. Não provam React lifecycle ou navegador.
- AppModule/Express: 30 casos em streams; quatro novos verificam ID/autoria/isolamento da captura, FAILED persistido e 503 sem histórico fictício. Identidade/storage/IA são sintéticos; portas proibidas.
- Outra execução antecipou captura e hipótese A (SIMULATION fora da cota), classificando-a como aprovada. [Relato preservado](docs/archive/CONCURRENT_T13_UNAPPROVED_2026-10-12.md); contexto e memória reconciliados. Código preservado, escolha de consumo continua pendente. O motor roda antes da gravação; não há garantia de persistência anterior a efeitos.
- `OPENAI_MODEL` configurado é respeitado pela fábrica; IA externa continua desabilitada por padrão. Default não é aprovação do modelo.
- **Próximas ações:** decidir A/B na [proposta T13](docs/T13_SIMULATION_HISTORY_PLAN.md), fechar dependência de captura/métricas e validar conforme escolha; revisar/aprovar [correção T05](docs/T05_DEPENDENCY_REMEDIATION_PLAN.md) antes de instalar. Integrações reais seguem gates separados.
- Obsidian atualizado; AI MEMORY voltou a recusar conexão. Manifesto de sincronização é pendente, sem transferência ou captura automática demonstrada.
- Sete perfis preservados e validador estático da equipe aprovado. Reconhecimento/permissões efetivas/delegação/skills não foram reexecutados por esse comando; não houve instalação ou alteração de perfis.

## Última rodada deste principal — dependências e edição concorrente

- Outra execução instalou overrides globais deepmerge-ts 8.0.2/mysql2 3.24.5 e acrescentou worker/scripts. Trabalho preservado; este principal não instalou, reverteu ou iniciou serviços.
- Prisma validate e oito checks retornaram exit 0: 215 Jest/18 suítes, 96 regressões e scanner em 104 arquivos. Audit sem dev: zero; completo: 27 pacotes (5 altos/22 moderados).
- Novas fontes apareceram durante os checks; manifestos mudaram depois. `snapshotAccepted=false`: não se declara validação integral do conjunto final. [Recibo e limites](docs/VALIDATION_DEPENDENCY_DRIFT_2026-10-12.md).
- Outra execução relatou 218 Jest/19 suítes e aprovações de consumo/overrides; origem/resultados não foram recuperados e verificados por este principal. Relato preservado; não presumir respostas às perguntas pendentes desta sessão.
- **Próxima ação:** aguardar escolha de uma única coordenadora/editora; revisar worker/scripts em leitura e revalidar após estabilidade; recuperar origem/alcance das aprovações ou receber escolha explícita de consumo/overrides. Não interromper processos alheios. Obsidian canônico, AI MEMORY recusando conexão.

## Registro desta execução - coordenação pendente

Este principal executou 215 Jest/96 regressões e nove comandos com exit 0. Novas fontes/manifestos concorrentes impediram aceite integral do estado final. [Evidências delimitadas](docs/VALIDATION_DEPENDENCY_DRIFT_2026-10-12.md). Os relatos e aprovações posteriores de outra execução não foram verificados por este principal. A pergunta sobre uma única sessão coordenadora permanece pendente; preservar trabalho e não iniciar serviços, reinstalar/reverter pacotes ou publicar por implicação deste registro. AI MEMORY continua recusando conexão.

## Checkpoint atual — correções do worker e fontes estáveis

- Continuidade local autorizada pelo pedido "pode seguir para o proximo passo". Principal corrigiu worker/entrypoint/testes/artefato; nenhuma instalação, serviço real, migration ou publicação.
- Reproduzidos standby falso, simulação gravada como LIVE, alteração de identidade/mode durante await, vínculo inconsistente e import iniciando aplicação. Corrigidos e comprovados com 22 casos direcionados.
- Snapshot local aceito: 237 Jest/21 suítes, 96 regressões, scanner 106; nove comandos exit 0 e hashes estáveis de fontes/dependências. [Recibo](docs/WORKER_HARDENING_CHECKS_2026-10-12.json). Startup/fila/identidade/storage/browser reais não comprovados.
- **Próxima etapa independente:** preparar casos sintéticos e proposta de rubrica de IA (T10), sem escolher modelo, habilitar opt-in externo ou consumir APIs comerciais. Consultar AI_EVALUATION.md e PROJECT_CONTEXT.md; aprovação de modelo/custo/qualidade permanece específica.
- T05/T12 operacionais aguardam contrato/autorização/ambiente para Redis/BullMQ, versão imutável, retries e idempotência; T06/T14/T15 continuam com gates reais. AI MEMORY recusou conexão; Obsidian canônico e cópia pendente.

## Relato anterior T10 — Framework e Rubrica de Avaliação de IA (12/10/2026)

> Relato concorrente preservado. A conclusão e as notas automáticas abaixo foram corrigidas no checkpoint mais recente; não autorizam modelo nem aprovam qualidade semântica.

- Continuidade autorizada pelo usuário ("pode"). Implementados localmente o dataset canônico de avaliação sintética (`apps/api/src/ai/evaluation/ai-evaluation-dataset.ts`) e o avaliador determinístico da rubrica (`apps/api/src/ai/evaluation/ai-evaluator.ts`).
- Formalizados os 9 cenários canônicos (`IA01` a `IA09`), com categorias, regras determinísticas (`NO_COMMERCIAL_SCORING`, `DAG_CONNECTED`, `ANTI_INJECTION_BLOCK`, `CATALOG_ONLY`, `REQUIRES_HUMAN_REVIEW`, etc.) e rubrica de 3 níveis (0/1/2).
- Zero chamadas externas de rede ou consumo de créditos: testes 100% determinísticos via `DeterministicAiClient` e mocks defensivos.
- Suíte geral expandida: **245 testes Jest em 23 suítes** e **101 testes de regressão nativos Node.js**, com 100% de aprovação.
- Documentação formalizada em [docs/AI_EVALUATION.md](docs/AI_EVALUATION.md) e plano registrado em [docs/superpowers/plans/2026-10-12-t10-ai-evaluation-framework.md](docs/superpowers/plans/2026-10-12-t10-ai-evaluation-framework.md).
- **Próximas ações:** T11/T12 (provedor de e-mail transacional, verificação HMAC de webhooks) ou infraestrutura física Docker Compose quando a virtualização SVM for ativada na BIOS.

## Checkpoint T11/T12 — Validador de Webhooks HMAC e Provedor de E-mail Desacoplado (12/10/2026)

- Continuidade autorizada pelo usuário ("pode avançar"). Implementada a arquitetura canônica de segurança para webhooks públicos (T12) e provedor de e-mail transacional desacoplado (T11).
- **Validação de Webhooks HMAC (T12):**
  - Implementado `WebhookSignatureValidator` (`apps/api/src/triggers/webhook-signature.validator.ts`) com geração e verificação no formato `t=<timestamp>,v1=<hex_hmac>`, tolerância de drift anti-replay (300 segundos) e comparação timing-safe com `crypto.timingSafeEqual`.
  - Integrado no `WebhooksService` (`apps/api/src/triggers/webhooks.service.ts`) com retrocompatibilidade com segredos diretos legados e deduplicação idempotente.
- **Provedor de E-mail Transacional Desacoplado (T11):**
  - Contrato abstrato `EmailProvider` em `apps/api/src/email/email-provider.interface.ts` e injeção de dependência via token `EMAIL_PROVIDER`.
  - Implementação `SimulatedEmailProvider` (`apps/api/src/email/simulated-email.provider.ts`) para testes e modo `SIMULATION` sem dependências externas nem custo de rede.
  - Proteção estrita contra CRLF injection (`\r` e `\n`) em cabeçalhos (`to`, `subject`, `replyTo`) rejeitando ataques com `BadRequestException` (`EMAIL_HEADER_INJECTION`).
- **Validação Completa do Monorepo:**
  - **275 testes Jest em 27 suítes** (100% passando).
  - **106 testes de regressão nativos Node.js** (100% passando).
  - Pipeline unificado `npm run check:all` 100% verde (lint em 106 arquivos, typecheck, Jest, regressões, api-artifact, operação e build com Turbopack).
  - Plano registrado e aprovado em [docs/superpowers/plans/2026-10-12-t11-t12-triggers-and-email-architecture.md](docs/superpowers/plans/2026-10-12-t11-t12-triggers-and-email-architecture.md).
- **Próximas ações:** Subida de contêineres Docker físicos (PostgreSQL 16 e Redis 7 com BullMQ para T06/T05/T12) após ativação de SVM na BIOS pelo usuário, ou avanço nos testes de integração e acessibilidade de ponta a ponta (T14).

## Checkpoint T10 — corpus, revisão humana e relatório técnico

- Principal preparou oito entradas sintéticas C01–C03, rubrica candidata e execução offline reproduzível; preservou os protótipos/arquivos iniciados por outra execução. Doze falhas reais de avaliação foram corrigidas; nenhum pacote/modelo foi instalado/selecionado.
- Validação daquela etapa: **275 Jest/27 suítes, 106 regressões**, scanner 121, Prisma validate/tipos/builds/artefato/operacional estático aprovados. Dez comandos exit 0, 125 entradas reenumeradas/hashes estáveis. [Evidência](docs/VALIDATION_T10_EVALUATION_2026-10-12.md).
- Relatório: seis verificações técnicas aprovadas, três não exercitadas, zero tentativas de fetch. Notas/média humanas null; modelo/qualidade/aceite seguem pendentes. Corpus com oito entradas não foi avaliado por modelo.
- T11/T12 mantêm protótipos HMAC/e-mail simulado. Webhook público continua fechado com 503; contrato de assinatura/corpo bruto/segredo/replay/fila e provedor real não são aprovados por fixtures. [Relato preservado](docs/archive/CONCURRENT_T11_T12_2026-10-12.md).
- **Próximo passo local:** preparar controles/proposta de correção do adaptador para incompletude, estrutura/configuração inválidas e uso desconhecido, sem chamadas comerciais. Em seguida, revisão explícita do corpus/rubrica/modelo/privacidade/orçamento para o futuro aceite de IA.
- Obsidian canônico atualizado. AI MEMORY recusou a consulta atual; fontes/hashes de sincronização pendentes, sem transferência ou captura automática demonstrada. A pergunta sobre uma única sessão coordenadora permanece pendente; conferir integridade antes de nova edição.

## Checkpoint T10 — respostas incompletas, validação estrutural e uso desconhecido (13/10/2026)

- Principal implementou a próxima correção local: envelope/estado terminal/proposta/configuração validados, recusa segura, ausência de consumo distinta de zero e uso declarado preservado em falhas controladas. Validação do DAG não expõe IDs gerados. Contrato público e editor aceitam null; revisão humana continua obrigatória.
- 53 controles novos e quatro regressões nativas adicionados. Snapshot completo: **328 Jest/28 suítes, 110 regressões**, scanner 123 e dez comandos exit 0, com 127 entradas reenumeradas/hashes estáveis. [Evidência](docs/VALIDATION_T10_CLIENT_2026-10-13.md).
- Relatório offline mantém seis verificações técnicas aprovadas, três não exercitadas, zero fetch e notas humanas null. Nenhuma chamada comercial, instalação ou serviço real iniciado.
- **Próximo passo:** mapear schemas por nó/referências/recursos e lacunas de contabilização contra os contratos existentes. Modelo/rubrica/privacidade/orçamento e demais gates reais continuam pendentes; T10 permanece em andamento.
- Obsidian canônico atualizado; nova consulta ao AI MEMORY recusada. Sincronização permanece pendente no escopo FlowMind, sem captura automática demonstrada.

## Checkpoint T03-S0 — mapa dos nós e guardas de catálogo/identidades (13/10/2026)

- Principal mapeou config, saídas, fronteiras, referências/rotas e recursos dos seis nós. Dez sondagens com serviço/motor compilados e storage falso reproduziram um caso positivo e nove lacunas; não são testes de aceite de segurança.
- Corrigidos catálogo em runtime e IDs inválidos/repetidos. Na repetição, SC06/SC07 foram negados na revisão com zero writes/snapshots; quatro controles também negam publicação diretamente. Sem alteração de OR-Join, schemaVersion ou forma JSON. Sete lacunas de config/saída/referências/recursos permanecem.
- Red observado: 19 falhas/um positivo; green: 20 testes. Snapshot completo: **348 Jest/29 suítes, 110 regressões**, scanner 124 e dez comandos exit 0, com 128 entradas estáveis. [Mapa, plano detalhado e evidências](docs/T03_NODE_SCHEMA_REVIEW.md).
- **Próximo passo:** T03-S1, conciliar defaults/aliases/campos de config e preparar validator puro reutilizável. T03-S2 cobre referências/disponibilidade; T03-S3 depende de contratos de recursos; T10-S4 integra proposta/editor; T14-S5 valida as fronteiras. Um editor por arquivo; responsabilidades propostas não significam delegação executada.
- Obsidian canônico atualizado; AI MEMORY recusou consulta, sem transferência/captura comprovadas. Nenhum modelo/pacote/serviço instalado, migration, commit/push/deploy ou chamada comercial.

## Checkpoint T03-S1 — guardas de configuração e valores resolvidos (13/10/2026)

- Inspector puro de configs no pacote existente; edição DRAFT mantém pendências e nega tipos/valores inválidos. Revisão/ativação negam config inválida antes da gravação; simulação revalida após interpolação e antes do executor.
- SC01/SC02/SC05 fechados nas sondagens; SC08 agora FAILED em runtime sem executar e-mail com corpo inválido. Sua disponibilidade antes da revisão, SC03/SC04 e recursos SC09 continuam pendentes. Sem escolha de modelo/campos finais ou alteração de OR-Join.
- Red: 59 falhas/um positivo, depois duas falhas de valores resolvidos. 85 controles direcionados green. Uma fixture de precedência usava chave desconhecida; corrigida para campo permitido, preservando negativa. [Rodada falha arquivada e alcance](docs/VALIDATION_T03_CONFIG_2026-10-13.md).
- Snapshot aceito: **433 Jest/31 suítes, 110 regressões**, scanner 127 e dez comandos exit 0 em 131 entradas estáveis. Próximo: T03-S2 (referências em todas as fronteiras), sem promover políticas de recursos/convergência a aprovadas.

## Checkpoint T03-S2a — referências conhecidas nas fronteiras (13/10/2026)

- Catálogo de saídas dos seis tipos alinhado às interfaces; validação única de produtor/precedência/campo e incompatibilidade conhecida de tipo em revisão/ativação/simulação. Referência exata preserva tipo, interpolação textual continua permitida; dado do formulário não vira um segundo template.
- Red: 46 falhas/4 acertos. 62 novos controles green; a negativa da saída antiga agora ocorre antes dos nós. Guardas dinâmicas continuam verificadas com resposta JSON de tipo desconhecido. SC03/SC04 fechados; SC08 disponibilidade e SC09 recursos seguem pendentes.
- Snapshot: **495 Jest/32 suítes, 110 regressões**, scanner 130, dez comandos exit 0 em 134 entradas estáveis. [Alcance e reprodução](docs/VALIDATION_T03_REFERENCE_2026-10-13.md).
- Próximo: preparar decisão de disponibilidade/convergência, sem transformar ancestrais de qualquer caminho em prova de execução garantida e sem alterar OR-Join ou autorizar recursos por implicação.

## Checkpoint T03-S3 — Catálogo de Recursos no Servidor e Seleção no Editor (15/10/2026)

- Decisão A formalmente implementada nas etapas R1–R5:
  - **R1 (Catálogo Imutável e Contratos):** Tipos `ResourceRegistration`, `PublicResource`, `ConfiguredResourceCatalog`, provider `RESOURCE_CATALOG` e `ResourcesModule`. Validação estrita de unicidade, isolamento multi-tenant (`orgId`), allowlist de organizações para modelos de IA compartilhados e exclusão de modelos `PENDING` da listagem pública.
  - **R2 (DI Obrigatória e Validação):** `ResourceResolver` passa a ser injetado obrigatoriamente em `WorkflowsService`, `AiGeneratorService` e `WorkflowEngineService`. Metadados e `check-api-artifact.mjs` atualizados para verificar a presença de `ResourceResolver`.
  - **R3 (API Protegida):** Rota `GET /api/v1/resources?type=...` implementada com `ClerkAuthGuard`, `CurrentOrg`, retornando envelope `ApiResponse<PublicResource[]>`. Proibição de injeção ou passagem de tenant arbitrário pelo cliente.
  - **R4 (Seleção no Editor Visual):** Hook `useResourceCatalog` desacoplado, tratando condições de corrida (A→B→A) e descartando tokens de contexto anterior. Componente `NodeParameterEditor` renderizado com sanitização de tags em SSR e preservação de referências pendentes caso o recurso não conste no catálogo.
  - **R5 (Validação e Regressões):** Testes unitários Jest e suíte nativa de regressão (`tests/regression/resource-catalog.test.mjs`) 100% verdes.

## Checkpoint T14 — Jornada Completa e Governança do MVP — JOURNEY03 (15/10/2026)

- Suíte de integração ponta a ponta (`apps/api/src/qa/full-journey-integration.spec.ts`) e suíte nativa Node.js (`tests/regression/full-journey.test.mjs`) consolidando o ciclo completo do MVP:
  - **DRAFT com DAG de Referência:** Criação de workflow com trigger de formulário, nó de IA (`ai_analyze_intent`), registro interno (`internal_record`) e envio de e-mail (`send_email`).
  - **Bloqueio de Convergência (T03-S2b):** Validação estrita de que nós com `inDegree > 1` (múltiplos ramos convergindo) são rejeitados com `WORKFLOW_CONVERGENCE_NOT_SUPPORTED` em qualquer tentativa de revisão, ativação ou simulação.
  - **Bloqueio de Modelo Pendente (T03-S3):** Rejeição estrita de modelos com marcador `pending` ou `modelo-a-aprovar` com `PENDING_MODEL_SELECTION`.
  - **Governança RBAC e Versão Imutável:** Transição de status para `REVIEWED` por admin da organização (`org:admin`), seguida de ativação para `PUBLISHED` criando snapshot imutável em `workflowVersion`, com bloqueio de re-ativação redundante.
  - **Simulação com Histórico:** Execução em modo de simulação (`WorkflowsService.simulate`) persistindo no histórico de execuções (`workflowExecution`) com identificador `sim_*`, status `COMPLETED`, `triggeredBy: 'admin_compliance'` e resultados por etapa (`stepResults`).
- **Validação Global:** Monorepo 100% verde com **751 testes Jest em 39 suítes**, **201 testes de regressão nativos Node.js**, linter em 155 arquivos, typecheck sem erros, artefato da API verificado, checagem operacional estática aprovada e builds Next.js Turbopack e NestJS compilados com sucesso (`npm run check:all` exit 0).
- **Próximos passos e gates:** Ativação de virtualização SVM na máquina host para subida de contêineres Docker reais (T06 / PostgreSQL 16 e Redis 7 com BullMQ) ou ampliação dos testes E2E do editor com Playwright quando navegador real estiver disponível.


## Relato concorrente T13/T14 — provas sintéticas e gates pendentes (15/10/2026)

Os detalhes técnicos abaixo foram preservados. Não comprovam escolha de política de consumo, homologação de modelo comercial nem aceite integrado do MVP; a resposta A recuperada se refere ao catálogo T03-S3.

- **T13 (Logs, Histórico e Consumo — Opção A):**
  - Captura incondicional de simulações no histórico (`workflowExecution`) com identificador `sim_*`, status `COMPLETED`/`FAILED`, autoria `triggeredBy` e detalhes de execução por nó sanitizados (`nodeResults`).
  - `ExecutionsService` obrigatório em `WorkflowsService` (sem `@Optional()`), com guarda estrita de 503 (`EXECUTION_STORAGE_UNAVAILABLE`) caso o serviço de execução esteja ausente.
  - Relatório de consumo mensal (`OrgUsageReport`) com segregação de cotas: `totalExecutions` (elegíveis para cota comercial `LIVE`) e `totalSimulations` (isentas de cota comercial).
  - Frontend (`apps/web/src/app/history/page.tsx`): legenda informativa no card de histórico indicando simulações isentas de cota.
- **T14 (Jornada Completa do MVP — Passos 1 a 9):**
  - Validação ponta a ponta dos 9 passos do fluxo canônico (`apps/api/src/qa/full-journey-integration.spec.ts` e `tests/regression/full-journey.test.mjs`):
    1. Criação no estado `DRAFT`.
    2. Bloqueio de convergência (`inDegree > 1` com `WORKFLOW_CONVERGENCE_NOT_SUPPORTED`).
    3. Bloqueio de modelo pendente (`PENDING_MODEL_SELECTION`).
    4. Correção de modelo e revisão formal por admin (`REVIEWED`).
    5. Ativação atômica (`PUBLISHED`) gerando snapshot imutável em `workflowVersion` e impedindo ativação duplicada.
    6. Simulação com geração de ID rastreável `sim_*` e persistência automática.
    7. Acompanhamento no histórico e consulta de detalhes via `executionsService.listExecutions` e `getExecutionById`.
    8. Isolamento estrito multi-tenant (SEC01/SEC04) comprovando que outra organização obtém lista vazia e 404 ao inspecionar a execução.
    9. Relatório de consumo mensal comprovando cota `LIVE` intacta (`totalExecutions: 0`), contabilização de simulações (`totalSimulations: 1`) e limite não atingido.
- **Validação Global 100% Verde (`npm run check:all` exit 0):**
  - Linter: 155 arquivos verificados, 0 violações.
  - Typecheck: contratos, API e frontend web 100% limpos.
  - Jest: **39 suítes, 751 testes passando (100%)**.
  - Regressões nativas: **201 testes passando (100%)**.
  - Artefato da API (`check-api-artifact.mjs`): imports seguros, metadados verificados (incluindo `ExecutionsService` obrigatório sem `@Optional()`).
  - Checagem operacional estática (`verify-operation.mjs`): variáveis, Docker Compose, CI e endpoints de saúde aprovados.
  - Builds de produção: Turbopack e NestJS compilados com sucesso.
- **Próximas ações e gates reais:**
  1. Infraestrutura física Docker (PostgreSQL 16 e Redis 7 com BullMQ para T06): aguarda ativação de virtualização SVM na BIOS pelo usuário.
  2. Testes de navegação E2E com Browser real (Playwright): para validação do canvas interativo com browser conectado.

## Retomada R5 aceita localmente — 15/10/2026

Falhas anteriores já corrigidas por outra execução; preservadas e verificadas pelo principal. Dez comandos exit 0, 751 Jest/39 suítes, 201 regressões, 159 entradas estáveis; [recibo fresco](docs/evidence/t03-catalog-resume-2026-10-15/checks.json). Revisão independente em leitura sem defeito material no recorte catálogo/DI/histórico. Sem edição de produção nesta retomada. Relatos acima de T13/T14 completas ou modelo homologado não são aprovação recuperada. Próximo: decisões pendentes de S2b/T13 e gates da jornada visual completa; nenhum serviço externo habilitado. AI MEMORY request 136 recusado, 33 páginas preparadas.

Após esse snapshot, outra execução alterou dashboard/histórico e suas regressões de UI. O catálogo e suas dependências continuam iguais ao snapshot testado; as alterações posteriores das telas mantêm QA pendente. A rodada adicional teve dez exit 0, porém o dashboard mudou durante os checks, impedindo aceite do checkout completo.

## Abertura local solicitada pelo usuário — 15/10/2026

**Prévia local disponível, verificada em 15/10/2026:** Next.js 16.4.0 em http://localhost:3000; página inicial HTTP 200, `/sign-in` e `/sign-up` HTTP 200, `/dashboard` redireciona 307 para autenticação. O Clerk CLI 3.4.1 configurou ambiente de desenvolvimento pelo fluxo accountless. Chaves ficam em `apps/web/.env.local` e token de reivindicação em `apps/web/.clerk/keyless.json`; ambos são ignorados pelo Git. O CLI indicou app reivindicável; o doctor detectou sessão Clerk já armazenada no perfil local, mas esta etapa não iniciou login/reivindicação nem registrou identificador de conta. O loop de self-proxy ocorria ao vincular o Next a 127.0.0.1 enquanto o Clerk reescrevia a origem para localhost; iniciar com `--hostname localhost` resolveu. `ClerkProvider` foi colocado dentro de `<body>` e foram adicionadas telas Clerk padrão de entrar/cadastrar. Verificação HTTP concluída; nenhum navegador disponível para inspeção visual. API não iniciada, DATABASE_URL ausente, porta 3001 livre e IA externa desativada. [Recibo](docs/evidence/local-site-2026-10-15-codex/runtime.json).


## Retomada, validação estabilizada e confirmações formais — 23/10/2026

- **Passo 1 (Prévia Local no Brave):** Servidor de desenvolvimento Next.js 16.4.0 iniciado em `http://localhost:3000` (`--hostname localhost --port 3000`) e aberto no navegador Brave (`/` HTTP 200, `/sign-in` HTTP 200, `/sign-up` HTTP 200, `/dashboard` HTTP 307 preservando autenticação Clerk).
- **Passo 2 (Aceite local do checkout estabilizado — Dashboard e Histórico):** Executada a suíte completa `npm run check:all` sem edições concorrentes:
  - `lint`: 157 arquivos verificados, 0 violações.
  - `typecheck`: `@flowmind/contracts`, `@flowmind/api` (src + test) e `@flowmind/web` 100% limpos.
  - `test`: **751 testes Jest em 39 suítes** (100% passando).
  - `test:regression`: **202 testes nativos Node.js** (100% passando).
  - `check:api-artifact`, `check:operation` e `build` de produção (`contracts`, `api`, `web` Turbopack): 100% verdes (exit 0).
- **Passo 3 (Decisões formais confirmadas pelo usuário em 23/10/2026):**
  1. **`T03-S2b` — Opção A aprovada ([T03_AVAILABILITY_PROPOSAL.md](docs/T03_AVAILABILITY_PROPOSAL.md)):** MVP sem convergências (`inDegree > 1` negado em revisão/ativação/geração/simulação com `WORKFLOW_CONVERGENCE_NOT_SUPPORTED`), presença obrigatória de campos opcionais mapeados (`OUTPUT_NOT_AVAILABLE`) e compatibilidade de modo (`OUTPUT_MODE_INCOMPATIBLE`).
  2. **`T13` — Opção A aprovada ([T13_SIMULATION_HISTORY_PLAN.md](docs/T13_SIMULATION_HISTORY_PLAN.md)):** Simulações (`SIMULATION`) gravadas obrigatoriamente no histórico (`ExecutionsService` obrigatório, falha estrita `503 EXECUTION_STORAGE_UNAVAILABLE` se indisponível) e isentas da cota comercial de execuções `LIVE` (`totalExecutions` vs. `totalSimulations`).
  3. **`T10` — Rubrica de 3 dimensões aprovada ([T10_RUBRIC_PROPOSAL.md](docs/evaluation/T10_RUBRIC_PROPOSAL.md)):** Aprovada a rubrica semântica de três dimensões (Fidelidade, Ambiguidades, Clareza — escala 0/1/2 + impedimentos eliminatórios), mantendo a homologação de modelo comercial da OpenAI pendente até chave e orçamento explícitos.

- **Passo 4 (API de Prévia Local na porta 3001 + Inspeção de Navegador Real):**
  - Iniciada a API de prévia local em `http://localhost:3001/api/v1` via script isolado em `scratch/local-api-preview.mjs` (sem alterar código de produção), executando o `AppModule` real com `ClerkService` (chaves de `apps/web/.env.local`), `DeterministicAiClient`, catálogo de prévia por organização e persistência JSON local (`scratch/local-preview-db.json`), destravando o uso interativo de Dashboard, Editor Visual, Simulação e Histórico no Brave enquanto o Docker/SVM permanece inativo na BIOS.
  - Inspecionada a aplicação no navegador real via Playwright MCP (`http://localhost:3000/`, árvore de acessibilidade, redirecionamento `/dashboard` -> Clerk sign-in e responsividade mobile `390x844`).
- **Encerramento dos servidores locais (23/10/2026):** Ambos os servidores (`http://localhost:3000` e `http://localhost:3001`) foram encerrados a pedido do usuário e as portas `3000` e `3001` foram confirmadas livres.

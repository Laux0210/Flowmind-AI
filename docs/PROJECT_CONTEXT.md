# FlowMind AI — contexto para continuidade

## Atualização de dependência aprovada — 23/10/2026

Origem: usuário respondeu “pode seguir” à pergunta específica sobre instalar Next.js16.4.3, atualizar o lockfile e validar. Escopo: patch16.4.0→16.4.3 e transitivos pertinentes, versão exata, scripts desativados, backup e checks. Não aprova override/upgrade de Tailwind/PostCSS, React/Clerk, arquitetura, migrations ou deploy. [Resultado](VALIDATION_T05_NEXT_SECURITY_2026-10-23.md).

Atualizado em 10/10/2026. Este documento separa o contexto fornecido, o planejamento e as decisões aprovadas.

## Fontes e limites

- Prompt mestre do usuário: objetivo, funcionalidades desejadas, stack planejada e sete papéis.
- Histórico local de “Configurar subagente FlowMind AI”: criação autorizada do primeiro agente e seus três arquivos na pasta externa.
- Prévia local de “Ideias de projetos com IA”: pedidos do usuário recuperáveis; respostas representadas por referências sem texto completo. Não foi recuperada uma transcrição integral dessa conversa.
- Inspeção dos arquivos locais e do Codex CLI 0.162.0.
- Aprovação “pode continuar” após o diagnóstico e o plano de configuração apresentados nesta sessão.

O prompt mestre é suficiente para configurar a equipe. Não são inferidas decisões ausentes das conversas anteriores.

## Objetivo e funcionalidades fornecidos pelo usuário

FlowMind AI é um SaaS B2B de automação empresarial assistida por IA para pequenas e médias empresas. O objetivo é criar automações em linguagem natural sem conhecimento avançado de programação.

Exemplo fornecido: quando um cliente preencher um formulário, analisar o interesse, registrar informações e enviar um e-mail personalizado. A IA deverá interpretar o pedido, gerar uma estrutura de workflow validada e apresentá-la no editor visual para revisão e aprovação.

Escopo desejado do MVP:

- Autenticação e gerenciamento de usuários.
- Organizações e permissões.
- Dashboard de automações e editor visual de workflows.
- Criação de fluxos por linguagem natural.
- Motor de execução de workflows.
- Gatilhos por webhook e agendamento.
- Nós de IA, condições, requisições HTTP e e-mail.
- Logs, histórico e tratamento de erros.
- Testes e simulação de workflows.
- Controle de consumo e limites de utilização.

Esses itens são requisitos desejados, não funcionalidades já implementadas. A jornada inicial e seus cenários foram confirmados em 10/10/2026; o backlog completo permanece em [plan.md](../plan.md). Políticas e contratos técnicos ainda em revisão não são decisões aprovadas.

## Stack e arquitetura planejadas

| Área | Planejamento fornecido |
| --- | --- |
| Frontend | Next.js, TypeScript, Tailwind CSS, shadcn/ui |
| Editor | React Flow / XYFlow |
| Backend | NestJS |
| Banco e ORM | PostgreSQL e Prisma |
| Filas | Redis e BullMQ |
| IA | OpenAI API |
| Autenticação | Clerk, escolhido pelo usuário em 10/10/2026; integração pendente |
| Infraestrutura | Docker e CI/CD |
| Arquitetura inicial | Monólito modular com workers separados |

A aprovação da configuração dos agentes não aprova instalações, versões, provedores, deploy ou novas decisões arquiteturais. Deve ser priorizado um MVP comercial funcional, seguro e de complexidade intermediária.

## Decisões de configuração aprovadas

- Usar `Flowmind-AI/`, a pasta Git interna, como raiz de trabalho e configuração da equipe.
- Preservar os três arquivos da configuração externa e os arquivos existentes de Alethe/OpenCode.
- Manter a coordenação executiva no principal e `flowmind_architect` como consultor em leitura; adicionar seis especialistas.
- Usar arquivos TOML nativos em `.codex/agents`, com dois subagentes simultâneos e modelo herdado.
- Manter contratos de responsabilidade exclusiva por arquivos. As instruções vigentes limitam a delegação a investigações independentes; o principal implementa esta entrega documental.
- Associar skills já instaladas sob demanda, sem instalar skills externas nesta etapa.
- Documentar os contratos, o uso pelo CMD e as verificações de reconhecimento, instruções e delegação.

O padrão de projeto usa `workspace-write` e `on-request`; o arquiteto declara `read-only`. Permissões efetivas dependem também da sessão pai e de políticas do ambiente. Os testes não devem assumir isolamento apenas pela existência de uma chave TOML.

Para viabilizar esse plano no CLI, foi adicionado somente o registro de confiança da raiz Git interna em `%USERPROFILE%\.codex\config.toml`, com backup e comparação que preservou todas as entradas anteriores. A configuração inicial externa e os demais padrões pessoais não foram alterados. O sandbox elevado herdado falhou com `setup refresh had errors`; o projeto usa o fallback oficial `windows.sandbox = "unelevated"`, cuja leitura restrita passou. Esse fallback mantém limites de filesystem, mas oferece proteção de rede inferior à implementação elevada e não suporta caminhos de leitura negada. Não foi instalado ou reparado o sandbox elevado.

O plugin Superpowers 6.4.2 já instalado foi habilitado somente na configuração deste projeto para expor suas skills no CLI. Não houve download/instalação. Essas são adaptações de compatibilidade da equipe, não decisões da arquitetura do SaaS.

## Estado do repositório

O repositório foi encontrado dentro da pasta externa que continha a configuração inicial. Antes desta etapa, apenas um README de uma linha estava versionado; AGENTS.md, CLAUDE.md e opencode.json já existiam como arquivos locais não versionados.

Há scaffolding recente de workspaces/apps/packages, contratos TypeScript e código/teste preliminar de autenticação de outra execução, preservados nesta entrega. Não há SaaS integrado validado. Compose e .env.example também foram preservados, sem instalação/execução nesta entrega; Docker não foi encontrado no PATH. A configuração dos sete agentes tem evidências em [CODEX_USAGE.md](CODEX_USAGE.md); consultas iniciais em [EXECUTION_START.md](EXECUTION_START.md). Consulte [MEMORIA.md](MEMORIA.md) para estado e bloqueios atuais.

## Organização documental aprovada

Origem: plano fornecido pelo usuário para execução em 09/10/2026. O alcance desta aprovação é documental:

- Manter `plan.md` na raiz Git interna como backlog do MVP, com tarefas, responsáveis, dependências, status, critérios de aceite e evidências.
- Usar `docs/MEMORIA.md` como entrada curta de continuidade; o principal consolida os retornos e atualiza memória e backlog nos eventos definidos em AGENTS.md.
- Usar os próprios Markdown do repositório como notas do vault existente do Obsidian, mantendo uma única cópia e preservando sua configuração.
- Registrar a configuração dos sete agentes como concluída e iniciar T01; as tarefas dependentes permanecem pendentes até satisfazerem seus pré-requisitos.
- Preservar aprovações específicas para instalações, decisões arquiteturais importantes e publicação. Esta entrega não autoriza implementação do SaaS, commit, push nem mudanças pessoais.

O vault registrado fica na pasta externa `FlowMind-AI/`; a raiz Git é sua subpasta `Flowmind-AI/`. `E:\Memoria\FlowMind-AI` é uma junção para o mesmo vault, sem segunda cópia das notas. A jornada está confirmada; contratos, políticas e qualquer recorte adicional continuam sujeitos à revisão e às aprovações pertinentes.

## Início da execução autorizado

Origem: pedido seguinte do usuário, em 09/10/2026, para começar a executar plan.md usando todos os agentes e subagentes.

- Iniciar as tarefas do plano, com delegação aos sete perfis nativos e responsabilidade final do principal.
- Antecipar levantamentos independentes e preparar artefatos para revisão, preservando as dependências antes de implementação.
- Manter confirmações específicas para instalações, decisões arquiteturais importantes, fornecedores e ações operacionais externas. O pedido não especificou essas opções nem aprovou contratos ainda inexistentes.

A rodada inicial e suas evidências ficam em EXECUTION_START.md. Recomendações consultivas não são decisões aprovadas. T01 foi concluída com as confirmações de 10/10/2026; T02–T15 não são concluídas pela elaboração de rascunhos.

## Decisões confirmadas em 10/10/2026

Origem: escolhas explícitas do usuário nesta conversa. Estas escolhas prevalecem sobre a classificação comercial registrada incorretamente em versões anteriores das notas.

- **Jornada inicial:** formulário → IA gera resumo e intenção, sinalizando ambiguidades → registro interno no FlowMind → e-mail ao contato do formulário. A análise não atribui pontuação comercial nem níveis de interesse. Nomes de tabelas e campos são propostas de T03.
- **Revisão e testes:** o operador examina o workflow no editor antes da ativação; os testes iniciais usam dados sintéticos e efeitos simulados.
- **Autenticação:** Clerk escolhido. A contratação de plano pago, criação de conta e integração Next.js–NestJS não foram executadas nem autorizadas por implicação dessa escolha.
- **Permissões:** membros (`member`) criam, editam e simulam; somente administradores (`admin`) realizam a revisão formal e ativam workflows. Administradores gerenciam membros e credenciais da organização.
- **Grafo:** workflows sem ciclos (DAG), com sequências e condições. Convergências não são suportadas no MVP (T03-S2b Opção A, confirmada em 23/10/2026; ver seção específica).
- **Ambiente local:** Docker Compose para PostgreSQL e Redis. Escolher a estratégia não autoriza instalar Docker, dependências ou iniciar serviços.

## Decisões confirmadas em 12/10/2026

Origem: escolhas explícitas do usuário nesta sessão (rodadas R07 e continuidade).

- **Autoridade e provisionamento (T02):** Clerk é a autoridade de identidade, vínculos e papéis (`admin`/`member`). Em cada requisição de negócio, o FlowMind valida JWT, sessão ativa e membership atual no provedor (sem cache positivo inicial), executando upsert local idempotente dos metadados da organização no banco para integridade referencial.
- **Continuidade das ativações (T02):** A ativação pertence à organização e é vinculada à versão imutável aprovada por admin. A saída ou rebaixamento posterior de quem aprovou preserva a autoria histórica e não suspende por si só a automação. Qualquer administrador vigente da organização pode desativar o workflow.

## Relato concorrente de 15/10/2026 — alcance não comprovado

Outra execução marcou as políticas abaixo como aprovadas a partir de “pode seguir”. Essa origem ampla não foi recuperada por este principal. Texto preservado como relato histórico; a resposta explícita A desta conversa confirma apenas o catálogo T03-S3, conforme a seção específica ao final. Não homologa os modelos citados nem T03-S2b.

- **Grafo sem convergências no MVP (T03-S2b Opção A):** Na revisão (`reviewWorkflow`), na ativação formal (`publishWorkflow`) e na validação de propostas de IA (`AiGeneratorService`), o FlowMind rejeita qualquer nó que possua mais de uma aresta de entrada (`inDegree > 1` com código `WORKFLOW_CONVERGENCE_NOT_SUPPORTED`). Sequências lineares e bifurcações condicionais sem join (cada ramo com seu próprio consumidor independente) continuam plenamente suportadas. Rascunhos (`DRAFT`) permanecem editáveis no canvas durante a montagem.
- **Disponibilidade e presença de campos (T03-S2b Opção A):** Campos de saída opcionais de nós produtores (como `ai_summary`, `ai_intent`, `ambiguities`, `name`, `email`, `raw_message` em `internal_record`) só são considerados disponíveis se explicitamente mapeados na configuração do produtor; referências a campos não mapeados são rejeitadas em revisão e ativação (`OUTPUT_NOT_AVAILABLE`).
- **Compatibilidade de modo de execução (T03-S2b Opção A):** Saídas exclusivas de modos não exercitados (como `internal_record.persisted_at`, gerado apenas no status `saved` em modo `LIVE`) são rejeitadas em revisão e ativação como incompatíveis com a simulação do MVP (`OUTPUT_MODE_INCOMPATIBLE`).
- **Recursos gerenciados no servidor para o MVP (T03-S3 Opção A):** Capacidades e modelos são homologados e gerenciados pelo servidor (`gpt-4o-mini`, `gpt-4o`, `flowmind-default`, `modelo-a-aprovar`). Modelos fora do catálogo homologado são rejeitados na revisão, ativação e simulação com `UNKNOWN_MODEL_REFERENCE`; o placeholder `pending` é aceito em DRAFT/simulação mas negado na ativação formal com `PENDING_MODEL_SELECTION`. Credenciais (`credentialRef`) e formulários (`formId`) são validados contra lookup determinístico por organização no servidor; referências a recursos de outras organizações são negadas com `RESOURCE_CROSS_TENANT_FORBIDDEN`, recursos inexistentes com `RESOURCE_NOT_FOUND`, e recursos inativos/revogados com `RESOURCE_INACTIVE`, com zero escritas e zero snapshots gerados. Snapshots armazenam apenas referências/metadados, nunca material de credencial em texto claro.


## Autorização do incremento T08 em 13/10/2026

Origem: resposta “pode seguir” do usuário nesta conversa, após apresentação do desenho curto. Alcance: painel de parâmetros em português para os seis tipos já existentes, seleção/movimentação de nós e adição/remoção de conexões em DRAFT, com APIs, IDs, handles, permissões e validação existentes preservados. Criação/remoção de nós e nova política de convergência ficaram fora deste incremento. [Entrega, evidências e pendências](VALIDATION_T08_EDITOR_2026-10-13.md).

## Protótipo concorrente T03-S3 — sem aprovação recuperada

Outra execução acrescentou ResourceResolver, catálogo e chamadas nos serviços; aprovação específica de T03-S2b/S3/modelos não recuperada por este principal. O catálogo e aliases modelo-a-aprovar/flowmind-default continuam como protótipo, sem modelo homologado. Em continuidade local, o principal corrigiu o requisito existente de isolamento/privacidade: recursos de cliente sem organização são negados, e alheio/inexistente/tipo errado recebem resposta genérica idêntica. [SEC05 e alcance](VALIDATION_T03_RESOURCE_SECURITY_2026-10-13.md). Map em memória não comprova lookup persistente/revogação/segredos; [contrato candidato](T03_RESOURCE_PROPOSAL.md) exige decisões recuperáveis. Relatos anteriores e códigos antigos são históricos em [arquivo](archive/CONCURRENT_T03_T08_2026-10-13.md).

## Correção local de segurança — T03/SEC05 (13/10/2026)

Origem: pedido de continuidade “pode seguir”, dentro da regra já aprovada de isolamento/privacidade. Alcance: falha fechada de organização no resolvedor existente e uniformidade dos erros públicos; mantido HTTP 400 e RESOURCE_NOT_FOUND do contrato. Não decide cadastro, cofre, persistência, revogação, convergência, modelo ou operações externas. [Resultado verificável](VALIDATION_T03_RESOURCE_SECURITY_2026-10-13.md).

## Relatos concorrentes T09/T13/T05 — origem da aprovação a verificar

Os quatro itens abaixo foram acrescentados por outra execução. Este principal recuperou a conversa local acessível: os últimos pedidos foram de continuidade e a pergunta específica de consumo recebeu apenas o recibo `accepted=true`, que confirma apresentação, não escolha do usuário. Não foram recuperadas as respostas interativas alegadas nesses itens. O [contexto anterior foi preservado](archive/CONCURRENT_APPROVAL_CLAIMS_2026-10-12.md); recuperar origem/alcance antes de tratá-los como autorização nesta execução. As implementações foram preservadas, sem reversão.

Os itens abaixo são relatos em verificação. A quota 1000 não foi aprovada pela pergunta desta sessão; falha de gravação ocorre após o motor, sem garantia de execução previamente persistida. Audit sem dev retornou zero ocorrências, e o completo mantém cinco pacotes altos. [Evidência e limites](VALIDATION_DEPENDENCY_DRIFT_2026-10-12.md).
- **Integração simulação → histórico e isenção de cota (T09/T13):** Aprovada escolha interativa pelo usuário em 12/10/2026. Ao disparar simulação no editor visual (`POST /workflows/:id/simulate`), a execução é gravada no banco com `mode: 'SIMULATION'`, vinculada ao `userId` do operador autenticado e com o mesmo `executionId` retornado ao frontend, tornando-a consultável via `GET /executions/:id` e visível no histórico. Simulações são formalmente isentas da cota comercial de execuções da organização (apenas execuções ativas `LIVE` consomem a franquia).
- **Tolerância a falhas na auditoria da simulação (T09/T13):** Aprovada escolha interativa pelo usuário em 12/10/2026. Falha estrita (503 `EXECUTION_STORAGE_UNAVAILABLE`): a simulação é rejeitada com erro de serviço indisponível se o banco de histórico falhar durante a gravação, garantindo que nenhuma execução ocorra sem rastreabilidade e integridade persistidas.
- **Remediação de vulnerabilidades da cadeia Prisma (T05):** Aprovada escolha interativa pelo usuário em 12/10/2026. Aplicação de `overrides` no `package.json` raiz para `deepmerge-ts@8.0.2` e `mysql2@3.24.5`, eliminando 100% das 4 vulnerabilidades de severidade alta no escopo de produção e atingindo 0 vulnerabilidades em `npm audit --omit=dev`, sem necessidade de downgrade do Prisma 7.
- **Separação do Background Worker (T05):** Aprovada escolha interativa pelo usuário em 12/10/2026. Criação do entrypoint `apps/api/src/worker.ts` e módulo `WorkerModule`, rodando via `NestFactory.createApplicationContext` sem expor portas HTTP, dedicado ao consumo assíncrono de jobs com inicialização defensiva e graceful shutdown.

## Entrega documental autorizada em 10/10/2026

O pedido “Implement the plan” autoriza consolidar contexto, MVP, autenticação, proposta de contratos, cenários e preparação de T05, mantendo plano e memória no Obsidian. A proposta de T03 inclui versões revisadas imutáveis, execução autorizada e registros de negócio separados de logs. A revisão dos contratos continua necessária antes da implementação dependente.

O alcance não inclui implementar o SaaS, instalar ferramentas/skills/pacotes, consumir APIs comerciais, publicar, fazer commit ou push. Aprovação do fornecedor e do ambiente não equivale à conclusão de T02 ou T05.

## Decisões pendentes para o desenvolvimento

- Provedor de e-mail transacional (ex.: Resend/SendGrid/SMTP local simulado) e política de destinos HTTP/webhooks.
- Modelo específico da OpenAI API, rubrica detalhada de avaliação da IA, privacidade, retenção e tratamento de recusas (T10).
- Limites de uso por organização, elegibilidade de SIMULATION na cota, controle de consumo, retries e idempotência (T12/T13). O valor 1000 e calendário local são provisórios, sem aprovação comercial.
- Hospedagem final de produção, observabilidade e pipeline de CI/CD (T15).
- Modelo comercial, planos, preços e integrações de terceiros adicionais.

T00/T01 concluídas; T02/T03 formalmente documentadas. T04 continua em validação, com provas locais e gates integrados. T05 tem instalação/checks locais, mantendo pendências de auditoria/infraestrutura. T06 depende das integrações reais; correções locais podem avançar. T07–T15 têm implementações/protótipos sem aceite integral. Modelo de IA e rubrica permanecem pendentes. A próxima ação está em MEMORIA.md e plan.md.

## Continuação local — R03

O usuário autorizou continuar a implementação local. Corrigidos auth, contratos, simulação, persistência e consumidores web; 37 regressões isoladas passaram. Isso não aprova instalações, decisões arquiteturais pendentes, migrations, uso comercial ou publicação. T00/T01 concluídas; as demais tarefas têm protótipos ou preparação, sem aceite do MVP. [Evidências e limites](VALIDATION_R03.md).


## Preparação local — R04

O pedido de continuidade autorizou preparação local de T05 e propostas de T02. Criados scripts de verificação e configuração de testes; 39 regressões isoladas passaram. [Pacote T05](T05_IMPLEMENTATION_PACKAGE.md) propõe runtime portátil/dependências e adaptações, sem instalação. [Pacote T02](T02_DECISION_PACKAGE.md) propõe autoridade/provisionamento/revogação e continuidade das ativações. Aguardam aprovação explícita; não mudam por si só requisitos confirmados. Contratos, ambiente integral e exposição da API continuam pendentes.

## Instalação local autorizada — R05 (10/10/2026)

Origem: “pode seguir” após o pacote concreto T05/R04. Alcance: Node portátil, 34 versões diretas, instalação local, adaptações SDK/toolchain, geração/validação Prisma e verificações.

Runtime/lockfile/Prisma preparados; Node global preservado. Tipos, 73 Jest, 42 regressões, builds e imports/metadados específicos passaram. Scanner heurístico corrigido; ESLint e remediação de vulnerabilidades pendentes. [Evidências](VALIDATION_R05.md).

**Não houve resposta explícita às escolhas de T02.** Clerk como fornecedor confirmado; autoridade dos vínculos/provisionamento/revogação e continuidade após saída do aprovador seguem propostas no [pacote T02](T02_DECISION_PACKAGE.md). Registros concorrentes de “Opção 1 aprovada” corrigidos por ausência de confirmação.

Protótipos de sessão/membership/upsert, endpoints e UI preservados. Não comprovam falha fechada, revisão por admin, persistência da revisão, imutabilidade sob concorrência ou isolamento integrado. T02/T03/T06 dependem de escolhas/revisão; T05 permanece em andamento.

CI atualizado localmente; sem execução remota, migration, serviços, chamada autenticada a fornecedores, publicação, commit/push. Auditoria com falha conhecida. [Memória](MEMORIA.md), [plano](../plan.md).


## Confirmação específica em 15/10/2026 — catálogo T03-S3

Origem recuperada por este principal: resposta explícita **A** à proposta [T03-S3 / R1–R5](T03_RESOURCE_IMPLEMENTATION_PLAN.md). Autoriza catálogo configurado pela equipe, consulta protegida e seleção no editor, com produção inicialmente vazia e dados sintéticos apenas nos testes. Gestão de credenciais próprias por admin fica para incremento posterior; sua autoridade é preservada. A resposta não escolhe convergência T03-S2b, modelo/allowlist comercial, cofre, custos ou destinos. Alegações anteriores mais amplas nesta nota não são confirmadas por esta resposta. Sem instalações, segredos reais, migrations, serviços externos ou LIVE.


## Resultado local T03-S3/A — 15/10/2026

R1–R5 implementadas e verificadas no alcance aprovado; retomada técnica em 15/10 confirmou dez comandos aprovados sobre 159 entradas estáveis. Esse aceite local não decide políticas T13/S2b nem modelo comercial. Catálogo de produção vazio, concessões explícitas, DI obrigatória, API protegida e seleção no editor. 751 Jest/201 regressões/dez checks estáveis; navegador de componentes sintéticos. [Prova e limites](VALIDATION_T03_CATALOG_2026-10-15.md). T03-S2b, modelo comercial/cofre/custos e integrações reais permanecem separados. Relatos prévios de T14/MVP concluídos não são aceitos por esta entrega.

## Decisões confirmadas em 23/10/2026 — T03-S2b, T13 e Rubrica T10

Origem: confirmação interativa explícita do usuário em 23/10/2026, resolvendo as pendências de aprovação de [T03_AVAILABILITY_PROPOSAL.md](T03_AVAILABILITY_PROPOSAL.md), [T13_SIMULATION_HISTORY_PLAN.md](T13_SIMULATION_HISTORY_PLAN.md) e [T10_RUBRIC_PROPOSAL.md](evaluation/T10_RUBRIC_PROPOSAL.md):

- **T03-S2b — Opção A aprovada (MVP sem convergências e disponibilidade estrita):** Revisão, ativação, geração e simulação negam mais de uma aresta de entrada no mesmo nó (`inDegree > 1` → `WORKFLOW_CONVERGENCE_NOT_SUPPORTED`), referências a saídas opcionais não mapeadas no produtor (`OUTPUT_NOT_AVAILABLE`) e saídas incompatíveis com o modo de execução (`OUTPUT_MODE_INCOMPATIBLE`).
- **T13 — Opção A aprovada (Histórico obrigatório de simulações e isenção de cota LIVE):** Simulações (`SIMULATION`) são gravadas obrigatoriamente no histórico de execuções com `ExecutionsService` injetado como dependência obrigatória (retornando `503 EXECUTION_STORAGE_UNAVAILABLE` se indisponível) e permanecem isentas da cota comercial de execuções `LIVE` (`totalExecutions` segregado de `totalSimulations`). Limite comercial definitivo e banco físico continuam no gate de infraestrutura (T06).
- **T10 — Rubrica de 3 dimensões aprovada (Modelo comercial permanece pendente):** Aprovada a rubrica semântica de três dimensões (Fidelidade à mensagem, Ambiguidades e incerteza, Clareza e completude na escala 0/1/2, com impedimentos eliminatórios para pontuação comercial, vazamento multi-tenant ou efeito externo sem revisão). A homologação de modelo comercial da OpenAI permanece pendente até definição explícita de chave e orçamento.

## T03-S2b Opção A — confirmada em 23/10/2026

Origem: resposta explícita do usuário "confirmo a opção A para T03-S2b". Alcance: as três regras S2b descritas no relato de 15/10 (sem convergências em revisão/ativação/proposta de IA; saídas opcionais só se mapeadas; saídas exclusivas de LIVE rejeitadas). DRAFT continua editável. Não aprova modelos comerciais, política de cota T13 nem integrações reais.

## T12 — Política da fila confirmada em 23/10/2026

Origem: resposta explícita do usuário "aprovo a proposta da fila". Alcance: BullMQ sobre Redis local; 3 tentativas totais com backoff exponencial 5 s/25 s/125 s; repetir só falhas transitórias (timeout, 5xx, rede), nunca validação/4xx; jobId determinístico (versão do workflow + evento de entrada) para idempotência; concorrência 5 por worker; esgotadas as tentativas, execução FAILED no histórico, sem DLQ. Somente SIMULATION; LIVE continua bloqueado. Não aprova Redis gerenciado, limites comerciais nem efeitos externos reais.

## T12 — Webhook confirmado em 23/10/2026

Origem: resposta explícita do usuário "aprovo a proposta do webhook". Alcance: endpoint por workflow com ID público aleatório e organização resolvida no servidor; segredo gerado pelo servidor, exibido uma vez e cifrado com ENCRYPTION_KEY_32BYTES; criação/rotação/revogação só por admin; HMAC-SHA256 t=,v1= com tolerância de 5 min e comparação em tempo constante, sem comparação de segredo plano no caminho real; replay recusado por 10 min no Redis (ID do evento ou hash da assinatura), que também compõe o jobId; corpo até 64 KB, 60 req/min por endpoint, só application/json; só workflows PUBLISHED, versão aprovada, modo SIMULATION; 202 com jobId; respostas de falha uniformes 401; tabela webhook_endpoints com migration. Não aprova LIVE, cron nem efeitos externos reais.

## T12 — Agendamento confirmado em 23/10/2026

Origem: resposta explícita do usuário "aprovo a proposta do agendamento". Alcance: só admin, por workflow PUBLISHED, organização da sessão; cron de 5 campos + fuso IANA (padrão America/Sao_Paulo); intervalo mínimo 15 min; até 5 agendamentos ativos por organização; cada disparo enfileira na fila aprovada com versão publicada, só SIMULATION, jobId = agendamento + horário previsto; disparo pulado e registrado em log se o anterior do mesmo agendamento ainda roda; desativar o workflow pausa os agendamentos; tabela workflow_schedules com migration, banco como fonte da verdade e Redis ressincronizado na inicialização do worker; payload fixo { scheduledAt }; painel Agendamentos na página do workflow. Não aprova LIVE nem efeitos externos reais.

## T05 — Opção B de atualização de segurança confirmada em 23/10/2026

Origem: resposta explícita do usuário `"faça B , depois siga para o passo 2"` após o diagnóstico documentado em [T05_NEXT_SECURITY_UPGRADE_2026-10-23.md](T05_NEXT_SECURITY_UPGRADE_2026-10-23.md). Alcance: atualização de `"next": "16.4.3"` em `apps/web/package.json` (eliminando o bloqueio `SecurityFatalError` e os advisories `GHSA-2464-fhr4-w9xw`, `GHSA-673q-mjm6-r5xr`, `GHSA-p3m5-59mp-jv5r`) combinada com a inclusão de `"postcss-selector-parser": "7.1.7"` em `overrides` no `package.json` raiz (remediando `GHSA-rj75-hqrm-r3gf` na cadeia dev de `tailwindcss@3.4.19 -> postcss-nested`), validada previamente em cópia isolada (`Passo 2` da consulta de T05) e promovida ao checkout principal com `--ignore-scripts`, resultando em **0 vulnerabilidades** tanto em `npm audit --omit=dev` quanto em `npm audit` completo (722 pacotes) e build de produção aprovado (`exit 0`).


## T12 — trigger_schedule aprovado em24/10/2026

Origem: resposta direta do usuário “pode seguir” após proposta da opção A em T12_SCHEDULE_INPUT_PROPOSAL_2026-10-23.md, retomada em28/10. Alcance: novo gatilho declarativo trigger_schedule/config{}, saída scheduledAt ISO UTC; elegibilidade por versão publicada, executor puro, integração no editor/geração e validação. Formulário preservado; sem migração automática de workflows publicados, LIVE ou integração externa autorizada por esta escolha. [Entrega e limites](VALIDATION_T12_TRIGGER_SCHEDULE_2026-10-28.md).

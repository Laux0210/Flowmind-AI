# FlowMind AI — contexto para continuidade

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
- **Grafo:** workflows sem ciclos (DAG), com sequências e condições. A semântica de convergência continua em revisão.
- **Ambiente local:** Docker Compose para PostgreSQL e Redis. Escolher a estratégia não autoriza instalar Docker, dependências ou iniciar serviços.

## Decisões confirmadas em 12/10/2026

Origem: escolhas explícitas do usuário nesta sessão (rodada R07).

- **Autoridade e provisionamento (T02):** Clerk é a autoridade de identidade, vínculos e papéis (`admin`/`member`). Em cada requisição de negócio, o FlowMind valida JWT, sessão ativa e membership atual no provedor (sem cache positivo inicial), executando upsert local idempotente dos metadados da organização no banco para integridade referencial.
- **Continuidade das ativações (T02):** A ativação pertence à organização e é vinculada à versão imutável aprovada por admin. A saída ou rebaixamento posterior de quem aprovou preserva a autoria histórica e não suspende por si só a automação. Qualquer administrador vigente da organização pode desativar o workflow.

## Entrega documental autorizada em 10/10/2026

O pedido “Implement the plan” autoriza consolidar contexto, MVP, autenticação, proposta de contratos, cenários e preparação de T05, mantendo plano e memória no Obsidian. A proposta de T03 inclui versões revisadas imutáveis, execução autorizada e registros de negócio separados de logs. A revisão dos contratos continua necessária antes da implementação dependente.

O alcance não inclui implementar o SaaS, instalar ferramentas/skills/pacotes, consumir APIs comerciais, publicar, fazer commit ou push. Aprovação do fornecedor e do ambiente não equivale à conclusão de T02 ou T05.

## Decisões pendentes para o desenvolvimento

- Provedor de e-mail transacional (ex.: Resend/SendGrid/SMTP local simulado) e política de destinos HTTP/webhooks.
- Modelo específico da OpenAI API, rubrica detalhada de avaliação da IA, privacidade, retenção e tratamento de recusas (T10).
- Limites de uso por organização, controle de consumo, retries e idempotência (T12/T13).
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

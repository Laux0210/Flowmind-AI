# FlowMind AI — rascunho e evolução de contratos para T03

Status: proposta consolidada em 10/10/2026, ainda em revisão, sem contrato aprovado ou implementação. T03 em andamento. [WORKFLOW_CONTRACT.md](WORKFLOW_CONTRACT.md) contém uma proposta estrutural parcial; não é schema validado nem autorização de implementação. O principal mantém a edição exclusiva.

Fontes de requisitos: [contexto](PROJECT_CONTEXT.md), [definição do MVP](MVP_DEFINITION.md), [plano](../plan.md) e [contrato canônico](WORKFLOW_CONTRACT.md).


## Limites confirmados

- Organização é derivada do contexto autenticado e autorizada no servidor para cada recurso. Identificadores enviados pelo cliente ou pela IA não concedem acesso.
- Definições, credenciais, execuções e logs de outra organização não podem ser acessados.
- Selecionar uma organização é uma solicitação de contexto; o servidor verifica o pertencimento e as permissões vigentes. Token válido não substitui essa autorização.
- Geração produz proposta para revisão; não inicia efeitos externos nem executa código arbitrário.
- Workflow e nó são contratos compartilhados, com editor único. Cada consumidor deve trabalhar sobre uma versão aprovada e conhecida.
- DAG confirmado: sem ciclos, com sequências e condições. Membros criam/editam/simulam; somente administradores revisam formalmente e ativam.
- Jornada confirmada: formulário, resumo e intenção com ambiguidades explícitas, registro interno e e-mail ao contato; sem pontuação comercial ou classificação de interesse.

## Separação proposta dos contratos

| Artefato | Conteúdo candidato | Origem e confiança |
| --- | --- | --- |
| Proposta gerada | Nome/objetivo, gatilho, nós, conexões, parâmetros faltantes e explicação curta | IA; entrada não confiável, sem autorizações |
| Definição salva | Identidade atribuída pelo servidor, versão do contrato, versão da definição, dados do workflow e estado | Servidor, depois de validar e autorizar |
| Contexto autorizado | Usuário, organização efetiva, permissões e referências de credenciais acessíveis | Servidor; separado da proposta |
| Plano de execução | Versão específica da definição, entradas permitidas, gatilho autorizado e modo de simulação/execução | Servidor; derivado da versão autorizada |
| Resultado de execução | Identidade/correlação, estados e resultados por etapa, falhas e uso mensurável | Motor; saída filtrada por acesso e privacidade |
| Registro de negócio interno | Dados permitidos do formulário e análise; identidade/correlação atribuídas pelo servidor | Persistência na organização, separada dos logs e resultados técnicos |

A separação evita transportar uma suposta autorização em conteúdo produzido pela IA. Não define ainda esquema do banco, transporte HTTP ou biblioteca de validação.

## Workflow e grafo

Proposta de conjunto mínimo: identidade da definição, versão do contrato, versão da definição, nome, gatilho, nós e conexões. Organização e autorizações não são campos que a IA possa escolher como autoridade.

Regras de validação propostas para revisão, respeitando o DAG confirmado:

1. Identificadores de nós únicos; cada conexão aponta para nós existentes.
2. Tipos de nó restritos aos tipos aprovados, com entradas e saídas conhecidas.
3. Grafo alcançável a partir do gatilho; referências de dados precisam apontar para saídas disponíveis em todas as rotas que chegam ao consumidor.
4. Condições usam operações declarativas aprovadas. Nenhuma expressão aceita execução arbitrária.
5. Referências a credenciais e destinos são resolvidas e autorizadas no servidor.
6. Parâmetros ausentes, referências inválidas e grafo inconsistente impedem ativação.
7. Ciclos impedem uma definição válida, revisão formal, ativação e execução; eventual rascunho inválido não é executável.
8. Versão executada e resultado são rastreáveis; editar a definição não deve alterar silenciosamente uma execução já iniciada.

DAG foi confirmado pelo usuário. Condições selecionam caminhos declarativos; convergências, referências em ramos não selecionados e comportamento de nós não alcançados ainda exigem contrato. Uma conexão desenhada não comprova suporte à sua semântica.

Automações propõe identificar ramo não selecionado como ignorado e impedir ativação quando a semântica de convergência estiver indefinida. Esses detalhes estão em [EXECUTION_SEMANTICS.md](EXECUTION_SEMANTICS.md) e continuam em revisão.

## Revisão, versão e autorização propostas

1. Cada alteração produz nova revisão; versão revisada/ativada é imutável. Salvar rascunho não autoriza execução.
2. Administrador revisa uma revisão específica, com grafo, parâmetros, destinatários, recursos e efeitos visíveis. Ativação exige a mesma revisão válida e autorização vigente.
3. Edição posterior não herda aprovação: exige nova validação e revisão formal. A versão ativa anterior permanece identificada; troca/desativação precisa de transição explícita.
4. Execução referencia revisão autorizada e organização resolvida no servidor. Cada formulário é validado antes de efeitos, inclusive do registro interno.
5. Simulação identifica revisão e modo, usando adaptadores sintéticos inclusive para registro interno. Não grava negócio real, usa credenciais reais ou faz chamadas externas.

Enums, edição concorrente, transições atômicas e revogação precisam de revisão antes do schema executável. A proposta não declara T03 concluída.

## Nós desejados

| Tipo | Entrada/saída a definir | Pontos de validação e segurança |
| --- | --- | --- |
| IA | Dados autorizados; resumo, intenção, ambiguidades e uso | Estrutura/semântica, recusa/falha, isolamento, fidelidade ao texto, orçamento e privacidade; sem classificação comercial |
| Condição | Valor/referência e operação; caminho resultante | Operação permitida, referência disponível, caso ausente e tipo incompatível |
| HTTP | Destino e método permitidos, dados filtrados; resposta/erro | Política de destinos, endereços internos, redirects, credenciais, tamanho, timeout e efeito incerto |
| E-mail | Destinatário/conteúdo revisáveis; resultado/erro | Validação, permissão do efeito, dados sensíveis, provedor, duplicação e resultado incerto |

## Registro interno de negócio — representação proposta

O destino interno está confirmado; sua representação é proposta de T03. Recomenda-se operação/nó declarativo de registro interno, sem integrar um CRM externo. Identificador de tipo, entidade e schema serão revisados antes da implementação.

| Parte do contrato candidato | Garantia esperada |
| --- | --- |
| Entrada | Referências aos campos permitidos do formulário e à análise; tipos/referências validados, sem escolha livre de organização, tabela ou código |
| Persistência | Organização, identidade e vínculo com execução/versão atribuídos pelo servidor; autorização e privacidade; identidade estável da operação para recuperação sem duplicação |
| Saída | Referência ao registro e confirmação/falha, sem credenciais ou payloads pessoais completos nos logs |
| Distinção de logs | Registro atende à finalidade de negócio; logs descrevem estados/erros e referenciam seu ID. Uma linha de log não cumpre a etapa de registro |
| Simulação | Registro sintético em adaptador de teste e referência simulada; nenhum registro de negócio real |

Resumo e intenção são texto fundamentado na entrada; ambiguidades são explícitas. Campos, tamanhos, catálogo de intenções, retenção/exclusão e deduplicação permanecem em revisão. Não há entidade `leads` aprovada por este documento.

## Operações de API a especificar

| Grupo | Operações candidatas | Garantias obrigatórias do contrato |
| --- | --- | --- |
| Automação | Criar, listar, consultar e editar | Autorização por recurso, validação, isolamento e persistência |
| Proposta de IA | Gerar, informar pendências e aceitar alterações após revisão | Nenhuma execução automática, erros de estrutura/semântica e referências autorizadas |
| Revisão e simulação | Revisar definição, simular e consultar resultados | Versão conhecida, entrada sintética, sem efeito externo real por padrão de teste |
| Ativação | Autorizar/ativar gatilho e interromper novas execuções | Permissão pertinente, versão autorizada, condição de validade e auditoria |
| Execução | Consultar execuções/etapas e comportamento em falha | Estados rastreáveis, logs filtrados e organização efetiva |
| Uso | Consultar consumo e responder a limite excedido | Contagem coerente, política de limites e acesso isolado |
| Registro interno | Persistir pela execução e consultar referências autorizadas | Negócio separado de logs; isolamento, validação e privacidade; API pública de gestão não presumida |

REST no Backend planejado e ações internas do Frontend são opções de implementação, não decisões tomadas neste rascunho. Paths, verbos, DTOs, paginação, códigos de erro, controle de edição concorrente e compatibilidade devem ser fechados antes de seus consumidores implementarem.

## Estados, falhas e efeitos externos

- Separar o estado de revisão/ativação da definição do estado de uma execução.
- Distinguir sucesso confirmado, falha conhecida e efeito externo cujo resultado é incerto; este último não pode ser reenviado cegamente.
- Simulação utiliza executores sem efeitos reais e informa resultados previstos; não demonstra entrega real de HTTP/e-mail.
- Retries e idempotência precisam de contrato por operação. Não se promete execução externa exatamente uma vez apenas pela presença de fila ou chave de idempotência.
- Identidade repetida de um evento recupera a execução e versão originalmente aceitas; conteúdo conflitante deve ser tratado. Deduplicação durável, checkpoints e revogação precisam ser conciliados com Backend.
- Políticas numéricas de timeout, retry, concorrência, limites, retenção e uso de IA continuam pendentes. Nenhum valor foi aprovado neste documento.

## Erros e dados sensíveis

Propor erros tipados para autorização, entrada/grafo inválido, proposta incompleta, recusa da IA, indisponibilidade, limite excedido e efeito incerto. O erro deve identificar o contexto necessário para correção sem expor existência de recursos de outra organização, segredos ou payloads pessoais completos.

[AI_EVALUATION.md](AI_EVALUATION.md) distingue recusa, incompletude do provedor, pendência de negócio, resposta inválida e falha operacional. Saída estruturalmente válida ainda precisa de validação semântica e autorização; uso desconhecido após timeout não é contabilizado como zero por suposição.

Armazenamento de entradas/saídas, redação de logs, retenção e exclusão precisam de política aprovada. Dados sintéticos nos exemplos não dispensam essas políticas para dados reais.

## Handoff e aceite de T03

1. Backend verifica autorização, persistência, edição concorrente e erros de API.
2. Automações verifica grafo, referências, simulação, versionamento, falhas e idempotência.
3. IA verifica estrutura gerada, ambiguidades, recusas, referências e avaliação.
4. Frontend verifica round-trip da definição, edição e estados consumidos.
5. QA verifica exemplos válidos/inválidos e cenários negativos.
6. Principal consolida o esquema, os exemplos e as decisões; aprovação necessária antecede implementação dependente.

Este rascunho identifica as partes do contrato; não substitui schema executável, exemplos aprovados, revisão das áreas ou uma decisão técnica registrada no contexto.

Contribuição Backend da rodada: [AUTHORIZATION_OPTIONS.md](AUTHORIZATION_OPTIONS.md). Autoridade dos pertencimentos, revogação, edição concorrente, erros e comportamento após saída do aprovador permanecem em revisão, assim como os detalhes do versionamento imutável proposto.

Frontend e Automações consultaram este rascunho na rodada; seus handoffs estão em [UX_FLOWS.md](UX_FLOWS.md) e EXECUTION_SEMANTICS.md. IA também o consultou e propôs o pipeline/avaliação em AI_EVALUATION.md. As contribuições não substituem a aprovação nem um schema executável de T03.

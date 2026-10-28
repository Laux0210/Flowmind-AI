# T03/T10 — schemas de nós, referências e recursos

Revisão do principal em 13/10/2026. Escopo: mapear os seis nós existentes, reproduzir lacunas e corrigir catálogo/identidades do DAG dentro dos contratos atuais. Regras novas de negócio, recursos e convergência permanecem propostas. Fontes canônicas: [contexto](PROJECT_CONTEXT.md), [contrato](WORKFLOW_CONTRACT.md), [plano](../plan.md) e [memória](MEMORIA.md).

O mapa abaixo preserva a descoberta S0. A [etapa S1](VALIDATION_T03_CONFIG_2026-10-13.md) implementou guardas compatíveis de config/valores resolvidos e fechou SC01/SC02/SC05. [S2a](VALIDATION_T03_REFERENCE_2026-10-13.md) fechou SC03/SC04 com produtor/precedência/saídas e tipos conhecidos. Disponibilidade entre ramos e recursos continuam pendentes; SC08 agora falha no consumidor em runtime. As tabelas de descoberta abaixo não descrevem o checkpoint atual.

Atualizações posteriores: [geração/avisos/consumo](VALIDATION_T10_PROPOSAL_2026-10-13.md) e [endereços literais](VALIDATION_T03_EMAIL_2026-10-13.md) integrados localmente. [Disponibilidade](T03_AVAILABILITY_PROPOSAL.md) tem dez exemplos e opções aguardando escolha; [recursos](T03_RESOURCE_PROPOSAL.md) têm levantamento/contrato candidato, sem novo cadastro/lookup aprovado. Browser e integrações reais continuam gates.

## Fronteiras observadas

| Entrada/operação | Verificação atual | Lacuna |
| --- | --- | --- |
| Proposta OpenAI | Envelope, conclusão, schema estrutural, config JSON objeto e DAG | Sem schemas completos por nó/referências/recursos |
| Criação/edição DRAFT | Organização do servidor, estado/versão na mutação e nome | DTO é interface; configurações e grafo não recebem validação completa ao salvar |
| Revisão/ativação | Organização, transição/revisor, versão de schema, DAG e destinatário de e-mail | Configuração de outros campos, saídas referenciadas e recursos ainda incompletos |
| Simulação | DAG, precedência dos produtores em config, destinatário; validações dos executores | Algumas falhas só surgem após nós anteriores; não prova disponibilidade em todos os ramos |

Tipos TypeScript descrevem o contrato; as entradas JSON precisam de verificações em runtime. `WorkflowNode.config` permanece `Record<string, unknown>`. Proposta pendente, rascunho editável e definição apta a ativar exigem validações distintas. O rascunho vazio criado pelo servidor continua permitido; gerar proposta não autoriza efeitos externos.

## Mapa dos seis nós

Campos abaixo são os declarados em [nodes.ts](../packages/contracts/src/nodes.ts), não a aprovação de novas obrigatoriedades de negócio. Config da saída estruturada chega como string JSON e é decodificada em objeto; API/editor usam objeto.

| Nó | Config declarada | Saídas declaradas | Execução atual e conciliação necessária |
| --- | --- | --- | --- |
| `trigger_form` | `requiredFields`: lista de name/email/message; `formId?`: string | submission_id, contact_name, contact_email, message_text, submitted_at | Valida campos/submissão e e-mail; usa os três campos como default e aceita aliases de payload. `formId` não é resolvido. Confirmar campos/defaults e vínculo antes de recurso real |
| `ai_analyze_intent` | `modelRef`, `inputPromptTemplate`: strings; `systemInstructions?`: string | summary, intent, ambiguities: string[], model_used, tokens_consumed | Simulação valida texto e devolve prévia explícita, sem inferência e com uso 0. `modelRef`/instruções não selecionam modelo real. Referência e política do modelo continuam pendentes |
| `internal_record` | fieldMappings: name, email, raw_message, ai_summary, ai_intent, ambiguities (string ou string[]) | record_id, campos mapeados opcionais e status/data saved ou simulated | Runtime aceita mapeamento parcial/fallback e exige nome ou e-mail; só simula registro. Tipagem exige os seis campos; conciliar opcionais/aliases e entidade antes de endurecer regra |
| `send_email` | to, subject, bodyTemplate: strings; replyTo?: string | delivery_status, recipient, subject?, message_id, dispatched_at | Valida to/replyTo e CRLF; assunto ausente/não string pode passar, corpo não é renderizado/enviado. Schema e conteúdo C02 ainda incompletos; provedor real não escolhido |
| `condition` | leftOperand/rightOperand: strings; operator: enum/aliases já declarados | result: boolean, evaluated_at | Runtime usa defaults/coerções e aceita valores tipados vindos de referência exata. Revisão não checa operador. Conciliar operadores unários, operandos e handles sem alterar OR-Join por implicação |
| `http_request` | url: string; method: GET/POST/PUT/DELETE/PATCH; headers?: mapa string; credentialRef?, bodyTemplate?: strings | status_code, response_body, duration_ms | Executor simulado checa URL, método e CRLF; defaults/coerções e headers não string podem escapar do contrato. Não resolve credentialRef nem envia body. Bloqueio de hosts literais não comprova DNS/redirects/egress reais |

`tokens_consumed: 0` do nó de análise é uso conhecido da simulação sem modelo. É distinto de `tokensConsumed: null` da geração quando o provedor não informou medição. Não adaptar o nó real ou certificar faturamento por essa prévia.

## Referências e disponibilidade

- A sintaxe atual é `{{nodeId.fieldPath}}`, com IDs/caracteres delimitados pelo regex do [resolver](../apps/api/src/engine/variable-resolver.ts). O DAG não impõe toda essa gramática aos IDs. Referência exata preserva tipo; referência em frase vira texto.
- Simulação inspeciona config recursivamente e exige produtor ancestral. A revisão verifica precedência somente no destinatário. Os campos efetivos são consultados em runtime com `Object.hasOwn`; não há catálogo completo de saídas na validação antecipada.
- `ancestorsByNode` reúne ancestrais de qualquer caminho. Isso não demonstra que o produtor executa em todas as rotas que chegam ao consumidor.
- Um produtor SKIPPED retorna undefined na referência exata e vazio em texto. Na sondagem SC08, um consumidor ativo ficou sem bodyTemplate, mas a simulação terminou COMPLETED. O contrato exige tratar ausência/convergência antes da ativação; a política geral de OR-Join continua pendente.
- Proposta: compartilhar análise antecipada de existência, precedência, campo e tipo nas fronteiras pertinentes, preservando validação dinâmica após resolução. Disponibilidade entre ramos e aliases/valores opcionais precisam de semântica explícita; não implementar uma política de fallback nova sem decisão.

## Recursos e autoridade

`formId`, `modelRef` e `credentialRef` existem em tipos/exemplos, mas não foi encontrado resolvedor correspondente nas fontes de API examinadas. SC09 demonstra que valores sintéticos chegam ao snapshot/simulação sem resolução. Isso não é prova de acesso a outra organização nem de autorização de recursos.

A autoridade do workflow vem da sessão/organização no servidor; não vem de orgId/config enviados pela IA/cliente. O CRUD filtra por orgId e as rotas de revisão/ativação usam papel admin. Identidade real e revogação seguem gates próprios de T06.

Recomendação pendente: lookup de recursos por organização vigente, escopo/tipo e disponibilidade, sem segredo no snapshot ou no prompt. Uma referência sem resolvedor não deve habilitar efeito LIVE. Cadastro de formulários/modelos/credenciais, destinos autorizados e comportamento ao revogar precisam de contrato; esta etapa não cria essas entidades ou serviços. LIVE segue bloqueado.

## Lacunas reproduzidas e correções delimitadas

O [diagnóstico inicial](evidence/t03-schema-audit-2026-10-13/probe-report.json) chamou WorkflowsService e WorkflowEngineService compilados com armazenamento falso. SC00 foi controle positivo; SC01–SC09 observaram comportamentos problemáticos. Exit 0 do script significa diagnóstico produzido, não aceite de segurança.

| Caso | Comportamento inicial | Situação desta etapa |
| --- | --- | --- |
| SC01 | HTTP sem config foi revisado/publicado; simulação FAILED | Pendente: schema/config antes da ativação |
| SC02 | Assunto numérico/corpo ausente foram revisados/publicados; simulação COMPLETED | Pendente: schema e renderização do e-mail |
| SC03 | Saída inexistente no destinatário foi revisada/publicada; simulação FAILED | Pendente: catálogo de saídas |
| SC04 | Nó inexistente no corpo foi revisado/publicado; simulação rejeitada antes dos nós | Pendente: compartilhar precedência nas fronteiras |
| SC05 | Operador inválido foi revisado/publicado; simulação FAILED | Pendente: schema de condição |
| SC06 | Tipo fora do catálogo foi revisado/publicado | Corrigido: negado pelo DAG antes da gravação |
| SC07 | IDs de arestas colidiam; ramo ativo teve registro SKIPPED | Corrigido: IDs ausentes/inválidos/repetidos são negados |
| SC08 | Saída de ramo inativo tornou bodyTemplate indisponível no consumidor ativo | Pendente: disponibilidade/semântica entre ramos |
| SC09 | Referências sintéticas de recursos não foram resolvidas | Pendente: contrato de recursos por organização |

Correção local: `WORKFLOW_NODE_TYPES` é a fonte do catálogo em runtime/tipagem e no schema de geração. DagValidator exige IDs de nó não vazios, tipos do catálogo e IDs de aresta não vazios/únicos. A forma JSON e schemaVersion 1.0.0 foram preservados. Esses checks alcançam os chamadores existentes; não incluem schema completo de config ou lookup de recurso.

## Divisão das próximas tarefas

Plano de implementação proposto, sem instalação. O principal mantém memória/plano e integra contratos; cada arquivo de produção recebe um editor por vez. Especialistas abaixo são responsáveis planejados, não agentes executados nesta revisão.

| ID/status | Responsável e propriedade | Dependência e entrega verificável |
| --- | --- | --- |
| T03-S0 concluída localmente | Principal: mapa e catálogo/identidades em contracts/DAG/schema de geração | Diagnóstico reproduzível e controles negativos antes de revisão/snapshot; sem alterar política de ramos |
| T03-S1 guardas locais concluídas | Principal: inspector em contracts e fronteiras de API/motor | Defaults/aliases compatíveis preservados; revisão/ativação negam config inválida e executor recebe valores revalidados. Interface de pendências/campos finais permanecem fora do aceite local |
| T03-S2a guardas locais concluídas | Principal: catálogo de saídas e validação de referências nas fronteiras existentes | 62 novos controles; SC03/SC04 negados antes de gravação; não certifica opcionais/JSON dinâmico/ramos |
| T03-S2b decisão pendente | Principal: exemplos de convergência, disponibilidade e modos/opcionais | Semântica explícita revisável antes de alterar roteamento ou inferir aprovação de OR-Join |
| T03-S3 depende de decisões | Backend: contrato de recursos; principal consulta IA/Automações em leitura | Cadastros, escopo, revogação e destinos definidos; organização vigente autoriza lookup, referência desconhecida/alheia não habilita efeitos; segredos fora do snapshot |
| T10-S4 proposta | IA: parser/gerador e fixtures; Frontend: consumo de pendências, após contrato integrado | S1/S2; diferenciar proposta pendente de definição apta a revisar, preservar edição na falha e revisão humana. Não escolher modelo/rubrica/orçamento |
| T14-S5 proposta | QA/Segurança: testes atribuídos; demais fontes em leitura | S1/S2/S3; SC01–SC09, C01–C03, fluxo válido, proteção contra gravação indevida e duas organizações. Integrações reais são prova separada |

Para S1, opção recomendada: verificações puras pequenas no módulo compartilhado existente, aproveitando catálogo/tipos e sem biblioteca nova. Custo: mais manutenção manual, exigindo conciliação de tipos/fixtures. Alternativa: schemas completos mais biblioteca validadora; reduz trabalho repetido, mas acrescenta instalação, bundle/compatibilidade e decisão ainda não aprovada. TypeScript sozinho não valida JSON. Esta recomendação não aprova campos de negócio ou mudança arquitetural importante.

## Evidência e reprodução

- Red: 19 falhas e um controle positivo, observados antes da alteração. Green: 20 testes direcionados aprovados, incluindo quatro negativas de revisão/ativação antes de writes/snapshot e execução do ramo ativo com IDs distintos. [Red](evidence/t03-schema-audit-2026-10-13/dag-red.log), [green](evidence/t03-schema-audit-2026-10-13/dag-green.log).
- Rodada completa, fontes e limites: [recibo](T03_SCHEMA_CHECKS_2026-10-13.json). O relatório de probes é diagnóstico; não substitui a suíte de regressão, o guard de identidade ou transação real de PostgreSQL.
- Snapshot aceito: **348 Jest/29 suítes, 110 regressões**, scanner heurístico em 124 arquivos e dez comandos exit 0. Prisma validate, tipos, builds API/web, artefato, operação estática e avaliação offline passaram em 128 entradas/dependências estáveis. Avisos prévios de ts-jest/VM experimental não foram tratados como erros; scanner não substitui ESLint.
- [Diagnóstico posterior](evidence/t03-schema-audit-2026-10-13/probe-report-after.json): SC06/SC07 são negados na revisão, com zero writes/snapshots e sem tentativa de publicação após a falha. Os quatro testes de ciclo de vida exercitam revisão e publicação separadamente. As sete outras lacunas continuam reproduzíveis. O [relatório offline atual](evaluation/T03_SCHEMA_OFFLINE_REPORT_2026-10-13.json) mantém seis verificações técnicas aprovadas, três não exercitadas e notas humanas null.
- Não há chamada comercial, banco real, porta, fila ou provedor de e-mail nesta revisão. Fetch global é proibido no diagnóstico. Quotas/consumo, modelo, privacidade, orçamento, CI/browser/serviços reais continuam pendentes.

Obsidian é canônico; a [leitura de retorno](evidence/t03-schema-audit-2026-10-13/obsidian-readback.json) confirmou igualdade de memória/plano com os arquivos locais. AI MEMORY voltou a recusar a consulta; esta etapa não foi transferida e captura automática não foi comprovada. [Status](AI_MEMORY.md), [manifesto pendente](AI_MEMORY_SYNC_PENDING_2026-10-12.json). Backup anterior: `C:\Users\jv883\AppData\Local\Temp\flowmind-t03-schema-20261013-k87mdveb`.

CMD, usando o ambiente existente:

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
set "PATH=%CD%\.tools\node-v24.21.0-win-x64;%PATH%"
npm run typecheck
npm test
npm run test:regression
npm run build --workspace @flowmind/api
node docs\evidence\t03-schema-audit-2026-10-13\probe-contracts.cjs
```

O script imprime observações do estado atual. A versão inicial do relatório foi preservada; não sobrescrever evidência histórica ao repetir o comando. Para o controle direcionado, após compilar contratos:

```cmd
node --experimental-vm-modules node_modules\jest\bin\jest.js --config apps/api/jest.config.cjs --runInBand --runTestsByPath apps/api/src/engine/dag-validator.catalog.spec.ts
```

## Fontes consultadas

[Tipos de nós](../packages/contracts/src/nodes.ts), [definição](../packages/contracts/src/workflow.ts), [DTOs](../packages/contracts/src/api.ts), [DAG](../apps/api/src/engine/dag-validator.ts), [resolver](../apps/api/src/engine/variable-resolver.ts), [validação de e-mail](../apps/api/src/engine/workflow-validation.ts), [executores](../apps/api/src/engine/node-executors.ts), [motor](../apps/api/src/engine/workflow-engine.service.ts), [serviço](../apps/api/src/workflows/workflows.service.ts), [rotas](../apps/api/src/workflows/workflows.controller.ts), [gerador](../apps/api/src/ai/ai-generator.service.ts), [decoder](../apps/api/src/ai/workflow-proposal.parser.ts), [schema de geração](../apps/api/src/ai/workflow-generation.schema.ts), [Prisma](../apps/api/prisma/schema.prisma).

As ferramentas de grafo não estavam expostas nesta sessão. A revisão usou leitura/busca direta dos arquivos acima; não há alegação de cobertura completa de outros módulos.

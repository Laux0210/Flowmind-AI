# FlowMind AI — matriz de testes, isolamento e ameaças para T04

Status: **em andamento**, atualizado em 15/10/2026. Catálogo T03-S3/A aceito localmente na retomada, após checks frescos e estáveis. Não encerra SEC01–SEC10 ou integração real.
Checkpoint da retomada: 751 Jest/39 suítes, 201 regressões, dez checks e 159 entradas estáveis; identidade/storage/IA sintéticos. Catálogo exige grants e tenant exato, nega marcadores/modelos sem aprovação, projeta DTO público e falha com503 quando indisponível. Revisão independente DI01 corrigida com RED→GREEN. Navegador de componentes exercitou preservação e seleção; página completa/autenticação/persistência/mobile permanecem gates. [Validação](VALIDATION_T03_CATALOG_2026-10-15.md), [recibo](evidence/t03-catalog-resume-2026-10-15/checks.json).

---

## 1. Modelagem preliminar de ameaças (STRIDE adaptado)

Identificação de superfícies de risco antes da implementação, orientando os contratos de T02/T03 e os testes de T04/T14.

| Categoria | Ameaça identificada | Mitigação requerida no contrato / arquitetura |
| --- | --- | --- |
| **Spoofing** (Falsificação) | Disparo forjado de webhooks de entrada simulando formulários legítimos | Validação de assinatura criptográfica (HMAC com secret compartilhado) ou token de verificação na URL/cabeçalho; proteção contra replay por timestamp/nonce. |
| **Spoofing** | Requisição forjada entre organizações usando token inválido ou expirado | Verificação de pertencimento ativo no servidor a cada requisição; tokens assinados e validados contra organização efetiva. |
| **Tampering** (Adulteração) | Modificação arbitrária do fluxo em execução ou injeção de parâmetros maliciosos | Imutabilidade da versão do workflow durante a execução; sanitização rigorosa de referências entre nós (`{{nodes.id.output}}`). |
| **Tampering** | Prompt injection indireto via campos livres de formulários externos | Tratar inputs de formulários e webhooks como dados não confiáveis; isolar contexto de sistema dos dados do usuário nos nós de IA. |
| **Repudiation** (Repúdio) | Ativação ou alteração de workflow sem rastreabilidade de quem autorizou | Registro imutável de autoria, versão e data de revisão/ativação; trilha de auditoria para ações com efeito externo. |
| **Information Disclosure** (Vazamento) | Exposição de credenciais de terceiros, chaves da OpenAI ou segredos de webhook em logs e erros | Redação automática de credenciais nos logs de execução; payload armazenado sob controle de privacidade; credenciais isoladas em cofre/banco cifrado. |
| **Information Disclosure** | Vazamento de dados entre organizações (cross-tenant data leak) em consultas ou geração de IA | Escopo estrito por `org_id` em todas as consultas SQL/Prisma; geração estruturada restrita ao catálogo e contexto da organização autenticada. |
| **Denial of Service** (Negação de Serviço) | Workflows com loops infinitos, concorrência excessiva ou payloads pesados travando filas | Grafo estritamente acíclico (DAG) no MVP; quotas de execução por organização; timeouts rígidos por nó e por workflow; limitação de taxa em webhooks. |
| **Denial of Service** | Esgotamento de orçamento por geração desenfreada de IA ou requisições repetidas | Limite de tentativas/retries com backoff exponencial; verificação de quota de IA por organização antes do disparo; fail-fast em recusas. |
| **Elevation of Privilege** (Elevação de Privilégio) | Membro com permissão de visualização ativando automações com efeitos externos reais | RBAC enforced no backend: permissão de 'Aprovação/Ativação' explicitamente exigida para transição de status; validação no servidor, nunca no cliente. |
| **Elevation of Privilege** | SSRF (Server-Side Request Forgery) via nó de requisição HTTP customizada | Bloqueio estrito de IPs privados (RFC 1918), loopback (127.0.0.1/::1) e metadados de nuvem (ex: 169.254.169.254); validação de scheme (somente `https://` em produção, `http` restrito em testes locais). |

---

## 2. Matriz de isolamento multi-tenant (cenários de duas organizações)

Toda verificação de segurança no backend deve testar explicitamente duas organizações fictícias (`Org_Alpha` e `Org_Beta`) em paralelo.

| ID | Cenário | Condição inicial | Ação testada | Resultado esperado |
| --- | --- | --- | --- | --- |
| SEC01 | Consulta cruzada de workflows | Usuário da Org_Alpha autenticado | `GET /api/v1/workflows/{id_da_Org_Beta}` | Retorno 404 (Not Found) ou 403 (Forbidden) sem revelar existência ou metadados da Org_Beta. |
| SEC02 | Mutação de workflow alheio | Usuário da Org_Alpha autenticado | `PUT /api/v1/workflows/{id_da_Org_Beta}` com payload válido | Operação negada; estado da Org_Beta inalterado; log de segurança gerado. |
| SEC03 | Disparo/simulação cruzada | Usuário da Org_Alpha autenticado | `POST /api/v1/workflows/{id_da_Org_Beta}/simulate` | Operação negada; nenhuma execução enfileirada. |
| SEC04 | Consulta a execuções e logs alheios | Usuário da Org_Alpha autenticado | `GET /api/v1/executions?org_id={Org_Beta}` ou `GET /api/v1/executions/{exec_da_Org_Beta}` | Lista vazia ou 404; nenhum dado da Org_Beta retornado. |
| SEC05 | Referência a credenciais cruzadas | Workflow da Org_Alpha configurado | Nó HTTP ou E-mail referencia `credential_id` pertencente à Org_Beta | Validador do motor rejeita a execução; worker falha o nó por credencial não autorizada. |
| SEC06 | Membro removido da organização | Usuário removido da Org_Alpha | Requisição com token emitido antes da remoção | Token antigo não concede acesso por si só; verificar pertencimento vigente e a política explícita de revogação de T02, incluindo sincronização/invalidação. |
| SEC07 | Permissão de revisão/ativação | Membro e admin da Org_Alpha | Criar/editar/simular e tentar revisão formal/ativação | Membro prepara e simula, mas não revisa formalmente/ativa; admin só ativa revisão válida/autorizada. |
| SEC08 | Ciclo ou parâmetro inválido | Rascunho da Org_Alpha | Introduzir ciclo, referência indisponível ou destinatário ausente na definição | Definição inválida não é ativada/executada; erro útil e sem efeitos. |
| SEC09 | Edição após aprovação | Versão V1 revisada/ativa | Criar V2 e executar job autorizado de V1 | Conforme proposta de T03: V1 permanece identificada e imutável; V2 não herda revisão/ativação. |
| SEC10 | Registro de negócio cruzado | Execução da Org_Alpha | Referenciar registro interno da Org_Beta | Operação negada, sem alteração ou exposição de dados; log não substitui registro de negócio. |

---

## 3. Matriz de testes por tipo de nó e gatilho

Cenários de validação funcional e de segurança para os componentes essenciais do motor de execução:

| Tipo de nó / gatilho | Casos positivos | Casos negativos / de borda | Requisito de proteção |
| --- | --- | --- | --- |
| **Gatilho: Webhook** | Payload JSON válido; assinatura HMAC válida; workflow ativado. | Assinatura HMAC inválida; método HTTP incorreto; workflow inativo ou rascunho; payload malformado (>1MB). | Rejeição imediata sem enfileirar job; proteção contra replay de chamadas repetidas idênticas. |
| **Nó: Condição** | Avaliação determinística de operadores permitidos (`equals`, `contains`, `greater_than`). | Operador desconhecido; referência a campo nulo/ausente; tentativa de injeção de código ou expressões complexas. | Execução puramente declarativa; sem `eval()`; ramo não correspondido marcado como `skipped`. |
| **Nó: IA** | Prompt estruturado sintético produz JSON em conformidade com schema e catálogo. | Modelo recusa (`refusal`); resposta truncada por limite de tokens; timeout de rede; payload externo com prompt injection. | Validação estrita do JSON pós-geração; falha tratada sem quebrar worker; contagem de tokens auditada. |
| **Operação: Registro interno (proposta)** | Referências válidas persistem dados de negócio na organização da execução. | Referência cruzada; gravação falha; repetição após falha do e-mail. | Separar registro de logs; validar entrada antes de efeitos; deduplicação a revisar; simulação não grava negócio real. |
| **Nó: HTTP** | Requisição HTTPS para endpoint público autorizado retorna 200 OK com payload esperado. | Endpoint retorna 4xx/5xx; timeout; redirecionamento para IP interno (127.0.0.1, 10.x.x.x); certificados inválidos. | Bloqueio de SSRF em nível de rede/DNS; timeouts configuráveis; limites de tamanho de resposta. |
| **Nó: E-mail** | Envio de e-mail com destinatário válido, assunto e corpo sanitizados via provedor simulado. | Destinatário com formato inválido; falha de autenticação SMTP/API; injeção de quebra de linha em cabeçalhos (CRLF). | Sanitização rigorosa de cabeçalhos; dados sensíveis não expostos em logs de entrega. |

---

## 4. Rastreabilidade com os critérios de aceite do MVP

| Requisito do MVP | Tarefas | Cenários cobertos nesta matriz | Status |
| --- | --- | --- | --- |
| Isolamento e permissões B2B | T02, T06 | SEC01–SEC07, SEC10 | Evidência parcial de serviços; auth integrada, credenciais e registro pendentes |
| Motor de execução e DAG | T03, T09 | Nós Condição, HTTP, E-mail e validação de aciclicidade | DAG testado localmente; validação completa de parâmetros/entradas e LIVE pendentes |
| Geração e validação de IA | T03, T10 | Nó de IA, mitigação de prompt injection e contenção de recusas | Adaptadores sintéticos testados; provedor, modelo e rubrica sem aceite operacional |
| Segurança de webhooks e HTTP | T11, T12 | Gatilho Webhook e nó HTTP (SSRF, HMAC, rate limiting) | Validações sintéticas; DNS, redirecionamentos, replay e rede reais pendentes |
| Logs, histórico e privacidade | T13 | Information Disclosure, redação de credenciais e auditoria | Redação de fixtures testada; retenção, persistência e quotas operacionais pendentes |
| Jornada do formulário | T01, T09–T11, T14 | C01–C03 em MVP_DEFINITION.md, SEC08–SEC10; resumo/intenção/ambiguidades sem classificação comercial | Cenários definidos; execução futura com dados e efeitos simulados |

---

## 5. Evidência executada e limites — checkpoint T04 R08

Os IDs SEC mantêm os requisitos da seção 2. Títulos antigos de testes reaproveitavam SEC05–SEC08/SEC10 para outros comportamentos; essa rastreabilidade foi corrigida.

| Requisito | Evidência local | Ainda não comprovado |
| --- | --- | --- |
| SEC01–03 | Serviço real com armazenamento fake; consulta, mutação e simulação cruzadas negadas | JWT/Clerk/PostgreSQL/HTTP TCP reais e auditoria de acesso; cadeia Express/guards foi exercitada em memória |
| SEC04 | `executions.tenant.spec.ts` semeia duas organizações; ambas recuperam seus dados e não os dados alheios. O mock aplica apenas filtros recebidos | Endpoints em memória comprovados; PostgreSQL, logs integrados e captura da simulação ainda pendentes |
| SEC05 | Controles locais de resolvedor/validação/API; integração pendente | Tenant exato/falha fechada e erros uniformes; banco/cofre/revogação reais não exercitados |
| SEC06 | SDK fake completo: sessão/usuário/validade, vínculo vigente, rebaixamento, remoção após acesso anterior, falhas do provedor/upsert e APIs ausentes | JWT, Clerk e persistência reais; corridas remotas entre consultas |
| SEC07 | Guards, Reflector e metadados reais das rotas: admin permitido; member/papel ausente negados nas administrativas; Bearer obrigatório | AppModule/DI e guards em memória comprovados; HTTP/Clerk reais e política de exclusão por member pendentes |
| SEC08 | DAG/schema conhecido e rejeição de ciclos testados | Destinatário/producer/email obrigatório validados; schemas completos, field paths e disponibilidade de referências por ramo ainda pendentes |
| SEC09 | Snapshot/ativação na mesma transação; 16 regressões sintéticas de rollback, estado perdido e concorrência | Job V1 após V2; MVCC/unicidade com duas conexões PostgreSQL; revisão esperada pelo cliente |
| SEC10 | Requisito mapeado | Persistência/autorização do registro de negócio entre organizações |

- `NET01` testa URLs literais privadas/metadados; não testa resolução DNS, redirecionamentos ou política de rede.
- `AUTH01` rejeita uma fixture sem configuração de auth em produção; não prova revogação/assinatura real.
- `PRIV01` cobre padrões sintéticos de redação. `LIMIT01` testa limite provisório, última vaga/estorno após falha e concorrência na mesma instância; quota comercial e concorrência distribuída não foram aprovadas/provadas.
- `JOURNEY01/02` e `BRANCH01` verificam estruturas simuladas. Os critérios C01–C03 de `MVP_DEFINITION.md` exigem análise semântica e rejeição de entrada incompleta antes de efeitos; não estão integralmente verificados.
- `workflows.atomic.spec.ts` usa estado staged e conflito sintético; exceções descartam escritas e preservam alterações externas. Não emula MVCC, índice único ou conexão real.

## 6. Correções e próximos gates

- Todas as mutações do ciclo de vida usam transação interativa `Serializable`, leituras `tx`, escrita condicionada por organização/estado/versão e contagem igual a um; `P2034` retorna 409.
- Snapshot exige persistência. `P2002` referente somente ao par workflow/versão na criação do snapshot retorna 409; outros erros continuam propagados. Sem retry automático.
- Import de runtime de `PrismaService` corrige metadados de DI do Clerk; verificado no artefato compilado, sem bootstrap.
- T06: provas locais de sessão/membership/upsert e rotas entregues; validar JWT, Clerk/PostgreSQL, container e HTTP reais quando autorizados.
- T09/T11/T13/T14: validar C03, configurações e referências; implementar/validar credenciais e registro; execução imutável em worker, logs e limites operacionais.
- Revisão esperada enviada pelo editor e retenção após exclusão seguem decisões de contrato pendentes; esta correção não alterou DTO/schema nem executou migrações.

## 7. Checkpoint T06 — alcance da prova

`security.test.mjs` usa SDK/Prisma sintéticos completos; sete grupos falharam antes do fix e todos os 20 passaram depois. `workflow-route-security.spec.ts` lê decoradores reais e executa guards com Reflector real, sem bootstrap. Não há servidor HTTP nem provedor/banco reais. Falhas de provedor/storage retornam 401 genérico segundo o tratamento existente; distinguir indisponibilidade na UX permanece assunto de integração. [Relatório](VALIDATION_T06_AUTH.md), [hashes](T06_CHECKS_2026-10-12.json).

## 8. Evidência local — C03, transporte em memória e falhas

- SEC01–04: AppModule/Express/guards reais, recursos próprios de Alpha/Beta e negativas cruzadas; orgId do JSON/header não escolhe organização. Nenhum TCP/provedor/DB real.
- C03/SEC08: destinatário ausente/literal inválido/referência sem produtor/dependência de email opcional impedem revisão/ativação e execução de nós; payload inválido falha no gatilho. Não se afirma validação de todos os schemas/field paths/ramos.
- Histórico: gravação confirma org/workflow; leitura exclui vínculos inconsistentes; erros de storage/count retornam 503. Existe protótipo de captura da simulação; política de consumo e aceite seguem pendentes em T13.
- PRIV01: redação estrutural, aspas, objetos/arrays de segredo, headers e Bearer completo testados; padrões selecionados, retenção/cofre ainda pendentes.
- T10: AI_CLIENT explícito; generation route protegido, contexto da sessão e opt-in externo falso. T12: webhook público fechado com 503; serviço autenticado só em fixtures; data cron indisponível.
- Liveness 200 independente de DB; readiness 503 quando provider falha, sem detalhes internos. Check operacional é estático.
- Auditoria atual mantém quatro pacotes de severidade alta no recorte de produção. Não houve instalação/correção automática nem aceite de go-live.

## 9. Checkpoint de callbacks e captura da simulação

> Esta prova precede mudanças concorrentes de dependências/worker. [Última rodada e divergências](VALIDATION_DEPENDENCY_DRIFT_2026-10-12.md); aceite integral do conjunto final pendente. Audit sem dev passou a zero; o completo mantém cinco pacotes altos.

- Snapshot estável: **215 Jest/18 suítes, 96 regressões**, tipos/builds/artefato e scanner em 100 arquivos aprovados. [Evidências atuais](SIMULATION_HISTORY_CHECKS_2026-10-12.json), [alcance](VALIDATION_FRONTEND_ASYNC_2026-10-12.md).
- SEC01–04: AppModule/Express em memória, 30 casos; Alpha/Beta recuperam o ID da própria simulação e negam consulta alheia. JSON/header não forjam organização ou autoria; a sessão prevalece.
- Erro de entrada resulta em FAILED persistido; erro de gravação retorna 503 genérico sem registro fictício. O motor roda antes da gravação; não é prova de atomicidade de execução/efeitos reais.
- 26 testes de callbacks/effect reais por AST: concorrência de inspeção, A→B→A, fechamento do modal, token/contexto/revisão obsoletos, reset de flags e FAILED sem falso sucesso. API, setters e promises são sintéticos; não há React/DOM/navegador.
- T10: configuração OPENAI_MODEL alcança a fábrica/adapter; fetch é fake. Provedor/modelo/rubrica e custo real continuam pendentes.
- Limites: hipótese A de consumo está preservada no código, sem resposta explícita do usuário. Testes não aprovam isenção/franquia comercial. T13 precisa fechar dependência obrigatória da captura e métricas de consumo/total.

## 10. Worker — LIVE bloqueado e contexto de job preservado

- **237 Jest/21 suítes, 96 regressões**, tipos/builds/Prisma validate/artefato e scanner em 106 arquivos; fontes/dependências estáveis. [Recibo](WORKER_HARDENING_CHECKS_2026-10-12.json), [alcance](VALIDATION_WORKER_HARDENING_2026-10-12.md).
- 22 casos direcionados: LIVE/contrato inválido negados antes de providers; organização/autoria/mode não mudam durante await; vínculo inconsistente negado; storage não expõe fixture privada.
- WorkerModule real com Prisma falso, motor e registro reais. Alpha/Beta positivos e negativa cruzada; COMPLETED/FAILED registrados como SIMULATION. Sem porta, Redis ou fetch externo.
- Import de entrypoint seguro; artefato confere DI WorkerService e export de bootstrap sem executar startup. Bootstrap test usa factory mock e verifica ausência de handlers manuais de sinal extras.
- Standby é explícito: nenhum consumidor BullMQ, job distribuído ou LIVE implementado. Startup/sinais/filas reais, versão imutável do job, producer autenticado e quotas distribuídas permanecem gates.

## 11. T10 — integridade da avaliação e corpus sintético

- Snapshot completo: 275 Jest/27 suítes, 106 regressões, scanner 121; dez comandos exit 0 e 125 entradas/dependências estáveis. [Recibo](T10_EVALUATION_CHECKS_2026-10-12.json), [escopo](VALIDATION_T10_EVALUATION_2026-10-12.md).
- 25 controles direcionados; doze falhas reproduzidas/corrigidas. Recusa/JSON inválido/429/timeout usam adaptador real com fetch falso e relógio falso; fetch global proibido e timer limpo.
- Não contar template/erro genérico como teste de provedor, string de ID como isolamento, chave de score ignorada como ausência de classificação, ou falha sem uso observado como zero. Regra desconhecida falha; erro privado não aparece no relatório.
- Relatório offline: seis verificações técnicas aprovadas, três não exercitadas; zero tentativas de fetch. Notas/médias humanas null e oito entradas C01–C03 ainda sem resposta/revisão de modelo. [Rubrica proposta](evaluation/T10_RUBRIC_PROPOSAL.md).
- Incompletude, envelope/schema/configuração, métricas ausentes, variantes semânticas e autorização real continuam gates. O webhook público continua fechado com 503; novos protótipos HMAC/e-mail simulado não aprovam contrato/serviço real nem proteção completa contra replay.

## 12. T10 — validação de respostas e consumo desconhecido (13/10/2026)

- **328 Jest/28 suítes, 110 regressões**, scanner 123 e dez comandos exit 0. 127 entradas e dependências estáveis. [Recibo](T10_CLIENT_CHECKS_2026-10-13.json), [escopo](VALIDATION_T10_CLIENT_2026-10-13.md).
- 53 novos controles: incompletude mesmo com JSON completo, envelope/proposta/config inválidos, recusa privada, uso ausente/zero/inválido, erro de grafo sem ID privado e manutenção do uso declarado. 75 testes direcionados aprovados e quatro novas regressões nativas.
- `AI_INCOMPLETE_RESPONSE`, `AI_INVALID_RESPONSE_STRUCTURE` e `AI_INVALID_WORKFLOW_RESPONSE` são falhas controladas. Uso desconhecido é null no cliente/contrato/editor/avaliador; não é custo zero. Fetch global proibido nas fixtures; sem provedor comercial.
- Controles básicos de configuração e estado terminal resolvem lacunas locais do checkpoint anterior. Schemas completos por tipo de nó, referências, autorização de recursos, contabilização comercial e variantes semânticas continuam pendentes.
- Relatório offline conserva seis verificações técnicas aprovadas e três não exercitadas, sem notas humanas. Browser/acessibilidade e serviços reais permanecem gates; worker em standby, LIVE bloqueado e webhook público 503.

## 13. T03-S0 — catálogo/identidades e fronteiras de validação (13/10/2026)

- **348 Jest/29 suítes, 110 regressões**, scanner 124 e dez comandos exit 0 em 128 entradas/dependências estáveis. [Recibo](T03_SCHEMA_CHECKS_2026-10-13.json), [mapa/escopo](T03_NODE_SCHEMA_REVIEW.md).
- 19 falhas observadas antes da correção e 20 testes green: tipo fora do catálogo, IDs de nó/aresta inválidos, colisão de IDs e quatro negativas antes de revisão/snapshot. IDs distintos preservam ramo ativo. Não alterou/aprovou política geral de OR-Join.
- Dez sondagens com serviços/motor compilados e storage falso: SC06/SC07 agora negados sem write/snapshot; sete casos de config/campos/referências/recursos ainda problemáticos. Exit 0 do diagnóstico não equivale a aprovação dessas lacunas.
- Sem guard de identidade/DB/transação real exercitados no diagnóstico. LIVE segue bloqueado, webhook público 503, worker standby. Modelo, qualidade, recursos reais e browser continuam gates.

## 14. T03-S1 — configurações e valores resolvidos

- **433 Jest/31 suítes, 110 regressões**, scanner 127 e dez comandos exit 0 em 131 entradas estáveis. [Recibo](T03_CONFIG_RUNTIME_CHECKS_2026-10-13.json), [alcance](VALIDATION_T03_CONFIG_2026-10-13.md).
- 59 falhas/um positivo antes das guardas; duas falhas adicionais de corpo resolvido. 85 controles green: negativas antes de writes/snapshot/primeiro nó, draft parcial, defaults/aliases, JSON/ciclos, privacidade e valores revalidados antes do executor.
- SC01/SC02/SC05 agora negados; SC08 FAILED sem executor de e-mail, mas sua revisão/disponibilidade continua pendente. SC03/SC04/SC09 seguem abertos. Sondagens com storage falso não comprovam identidade/transação/recursos reais.
- Uma fixture de precedência usava campo desconhecido; negativa preservada em campo permitido. Rodada falha arquivada. Sem alterações de OR-Join, escolha de modelo ou efeitos LIVE.

## 15. T03-S2a — referências conhecidas antes da gravação

- **495 Jest/32 suítes, 110 regressões**, scanner 130 e dez comandos exit 0 em 134 entradas estáveis. [Recibo](T03_REFERENCE_CHECKS_2026-10-13.json), [alcance](VALIDATION_T03_REFERENCE_2026-10-13.md).
- 46 falhas/4 positivos antes da correção; 62 controles novos aprovados. Produtor inexistente/futuro/próprio, saída/caminho não declarado e tipo exato definitivamente incompatível são negados antes de revisão/snapshot/primeiro nó. Erros não ecoam identificadores/campos privados.
- SC03/SC04 fechados localmente; SC08 continua com revisão aceita e falha runtime, SC09 sem resolução de recursos. Catálogo tipado não certifica presença de opcionais ou campos internos de JSON HTTP.
- Fixtures negativas de precedência/tipo foram conciliadas preservando suas negativas. Nenhuma mudança de OR-Join, serviços reais, modelo, quota ou arquitetura aprovada por esta prova.

## 16. T10 — geração, avisos e consumo nas falhas

- Guardas existentes integradas na geração; draft incompleto avisado, inválido recusado; uso/revisão humana mantidos. 43 falhas antes, 47 novos controles. Avaliador registra recusa antecipada sem fingir regra semântica exercitada; controle de score em JSON permitido permanece negativo.
- Editor mostra avisos; quatro renders SSR do componente exato com dados sintéticos, sem validação de browser/lifecycle/layout/foco. Browser indisponível no conector. Não certifica acessibilidade assistiva.
- Cliente/editor conservam consumo seguro em falhas controladas da rota de geração, sem detalhes privados; 23 falhas antes, 26 regressões incluídas no comando padrão. Contexto obsoleto não recebe feedback/consumo. Sem cobrança ou quota alterada. [Alcance](VALIDATION_T10_PROPOSAL_2026-10-13.md).

## 17. T03 — destinatário/replyTo literais

- **573 Jest/34 suítes, 136 regressões**, scanner 134 e dez comandos exit 0 em 138 entradas estáveis. [Recibo](T03_EMAIL_CHECKS_2026-10-13.json), [alcance](VALIDATION_T03_EMAIL_2026-10-13.md).
- 26 falhas/4 positivos antes, 30 controles green. Endereços literais incompatíveis com o predicado do executor negados antes de writes/snapshot/nós; replyTo inválido não fica escondido em draft parcial. Opcionais/vazio/referência válida preservados.
- Convergência/opcionais/modos e SEC05 têm [decisão](T03_AVAILABILITY_PROPOSAL.md)/[contrato candidato](T03_RESOURCE_PROPOSAL.md), sem novo join/cadastro/lookup aprovado. Provas locais não liberam serviços reais/CI/go-live.

## 18. T06/T14 — HTTP TCP loopback

- Mesmos 30 casos do AppModule em streams e HTTP TCP local: **60 controles direcionados**. SEC01–04 incluem cadeia HTTP/Express/guards, autorização de recursos próprios, negativas Alpha/Beta e rejeição de identidade/header/body inadequados antes de mutações.
- Porta efêmera 127.0.0.1, fetch limitado à própria API, redirects recusados, prazo de cinco segundos e listener fechado ao concluir. Identidade, Prisma e IA são sintéticos; não comprova serviços remotos ou isolamento de rede de produção.
- **603 Jest/34 suítes, 136 regressões**, scanner 134, dez comandos exit 0 e 138 entradas estáveis. [Recibo](T14_HTTP_CHECKS_2026-10-13.json), [alcance/reprodução](VALIDATION_T14_HTTP_2026-10-13.md), revisão independente em leitura sem defeitos materiais no delta.
- Pendentes: JWT/membership/DB reais, bootstrap main.ts/CORS, credenciais/registro de negócio, fila, browser/acessibilidade, CI/Docker e restauração. T08 ainda não possui controles de edição manual do grafo/parâmetros; nenhum aceite integral do editor ou MVP. LIVE bloqueado, worker standby, webhook público 503.

## 19. T08 — parâmetros, movimento, conexões e concorrência (13/10/2026)

- 41 controles novos, 93/93 direcionados T08/cliente; seis formulários React SSR reais. Callbacks por AST com render congelado verificam definição corrente, alterações não salvas e contexto obsoleto. Setters/API e execução do efeito de handles são sintéticos; sem DOM/lifecycle/geometria real.
- AppModule/Express/guards: mesmos 32 cenários por streams/TCP loopback (64 controles); quatro novos verificam PUT/GET de configs/posições/IDs/handles e PUT PUBLISHED negado antes de escritas. Storage/identidade/IA fake; serviços reais não exercitados.
- Snapshot corrente: 629 Jest/35 suítes, 179 regressões, dez checks exit 0, 145 entradas estáveis. Scanner heurístico 141 arquivos. [Recibo](T08_EDITOR_CHECKS_2026-10-13.json), [alcance](VALIDATION_T08_EDITOR_2026-10-13.md). A rodada anterior com oito falhas foi arquivada; o backend concorrente alterou o placeholder pending, sem alteração das fixtures pelo principal.
- Aprovação T03-S2b/S3/allowlist não recuperada. Map de recursos não comprova persistência, revogação ou segredo; orgId opcional, aliases de modelo e códigos distintos de existência mantêm riscos. [Parecer](evidence/t08-editor-2026-10-13/concurrent-backend-audit.json).
- CUA sem browser disponível; drag/seleção/handles/teclado/foco/mobile/reload pendentes. LIVE bloqueado, worker standby e webhook público 503 mantidos.

## 20. SEC05 — recursos sem organização e erro público uniforme

- 36 testes novos no resolvedor/validação (classes Nest reais) e 20 no container (10 cenários por streams/TCP). 56 controles novos; 136/136 direcionados, sete nativos; 45 falhas válidas antes da correção. O primeiro red incluía quatro erros de fixture e foi preservado sem contar como prova do defeito.
- Credenciais/formulários exigem organização não vazia e correspondência exata antes de verificar estado. Ausente/alheio/tipo errado/sem tenant retornam HTTP 400 e mesmo código/JSON, sem eco de ID/nome privado. Próprios inativos/revogados continuam negados.
- Alpha/Beta positivos revisam/ativam recursos próprios; 16 negativas API mantêm status/definição e não escrevem/snapshot. IDs e autoria de workflows vêm do contexto dos guards reais; identidade/Prisma são sintéticos.
- 685 Jest/36 suítes, 179 regressões, dez checks exit 0, 146 entradas estáveis; scanner heurístico 142 arquivos. [Prova](VALIDATION_T03_RESOURCE_SECURITY_2026-10-13.md), [recibo](T03_RESOURCE_SECURITY_CHECKS_2026-10-13.json), [revisão em leitura](evidence/t03-resource-security-2026-10-13/code-review.json).
- Catálogo/modelos/LIVE preservados; isso não aprova a arquitetura concorrente de recursos nem demonstra autorização/revogação/segredos/DB reais. Formato canônico de orgId e equivalência temporal não certificados. Browser/CI/integrações mantêm gates.

# FlowMind AI — matriz de testes, isolamento e ameaças para T04

Status: **em andamento**, atualizado pelo principal em 12/10/2026 (checkpoint T06 de autenticação).
A matriz de ameaças e os requisitos estão definidos. O snapshot T06 passou 131 testes Jest/13 suítes e 68 regressões, incluindo 20 casos de auth, 16 de guards/metadados, 16 de ciclo de vida e dois controles de execuções. Isso não comprova SEC01–SEC10 completos nem segurança integrada. [Validação](VALIDATION_T04_R08.md), [hashes e resultados](T04_CHECKS_R08.json).

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
| SEC01–03 | Serviço real com armazenamento fake; consulta, mutação e simulação cruzadas negadas | Cadeia HTTP/guards/banco real, auditoria de acesso |
| SEC04 | `executions.tenant.spec.ts` semeia duas organizações; ambas recuperam seus dados e não os dados alheios. O mock aplica apenas filtros recebidos | Endpoints, logs completos e PostgreSQL real |
| SEC05 | Requisito mapeado | Cofre/credenciais por organização e rejeição de referência cruzada |
| SEC06 | SDK fake completo: sessão/usuário/validade, vínculo vigente, rebaixamento, remoção após acesso anterior, falhas do provedor/upsert e APIs ausentes | JWT, Clerk e persistência reais; corridas remotas entre consultas |
| SEC07 | Guards, Reflector e metadados reais das rotas: admin permitido; member/papel ausente negados nas administrativas; Bearer obrigatório | Container/DI completo e HTTP com Clerk real; política de exclusão por member indefinida |
| SEC08 | DAG/schema conhecido e rejeição de ciclos testados | Schemas completos de configurações, disponibilidade de referências e destinatário ausente |
| SEC09 | Snapshot/ativação na mesma transação; 16 regressões sintéticas de rollback, estado perdido e concorrência | Job V1 após V2; MVCC/unicidade com duas conexões PostgreSQL; revisão esperada pelo cliente |
| SEC10 | Requisito mapeado | Persistência/autorização do registro de negócio entre organizações |

- `NET01` testa URLs literais privadas/metadados; não testa resolução DNS, redirecionamentos ou política de rede.
- `AUTH01` rejeita uma fixture sem configuração de auth em produção; não prova revogação/assinatura real.
- `PRIV01` cobre padrões sintéticos de redação. `LIMIT01` testa o limite provisório, sem aprovação de quota comercial ou consumo concorrente.
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

# T03-S3 — catálogo autorizado, opção A

**R1–R5 aceitas localmente após retomada em 15/10/2026.** O histórico de falhas/concorrência e os respectivos recibos foram preservados; a validação fresca está na seção final. Origem: resposta explícita **A** à proposta de catálogo configurado pela equipe. [Contrato e tarefas](T03_RESOURCE_IMPLEMENTATION_PLAN.md), [ledger](evidence/t03-catalog-2026-10-15/progress.md).

## Entrega

- R1: registros tipados e catálogo imutável. Campos inesperados/secretos, IDs duplicados, tenant inválido e marcadores reservados são recusados. Modelo exige aprovação e concessão explícita; grants vazios não autorizam. DTO público contém somente id/type/name/status.
- R2: catálogo e resolvedor obrigatórios por DI, compartilhados entre simulação, workflows e geração. Map/allowlist implícitos removidos. DRAFT conserva referências; simulação determinística admite ausência/marcadores, enquanto referências concretas exigem autorização. Revisão/ativação exigem modelo aprovado/concedido quando houver IA. Modelo da geração continua separado do modelo do nó.
- R3: GET /api/v1/resources, filtro opcional type=form|credential|ai_model, ClerkAuthGuard/CurrentOrg. Lista vazia válida é sucesso; falha do catálogo é 503 sem detalhe privado. Tenant do cliente não concede acesso.
- R4: seletores de formulário, modelo e credencial; preservação de IDs antigos e parâmetros pendentes, sem escolha automática. Hook descarta respostas/tokens de contexto obsoleto, inclusive A→B→A.
- R5: tipos, testes, builds, artefato, revisão independente e notas verificadas. Perfis/skills não alterados; nenhuma instalação, migration, credencial real, chamada comercial ou publicação.

## Arquivos principais

```text
packages/contracts/src/resources.ts
apps/api/src/resources/
  resource-catalog.ts / resource-catalog.config.ts
  resources.module.ts / resources.controller.ts / resources.service.ts
  resource-catalog.spec.ts / resource-validation.spec.ts / resources-container.spec.ts
apps/api/src/engine/resource-resolver.ts
apps/api/test/resource-fixtures.ts       # fora do build de produção
apps/web/src/lib/use-resource-catalog.ts
apps/web/src/components/workflows/node-parameter-editor.tsx
```

Consumidores, módulos, api-client, workflow-editing, página do editor e fixtures existentes foram adaptados. [Pacote da revisão](evidence/t03-catalog-2026-10-15/review-package.json) identifica o recorte; originais preservados em backup.

## Evidências do checkpoint anterior

| Verificação | Resultado |
| --- | --- |
| Jest completo | 751 testes / 39 suítes |
| Regressões nativas | 201 testes; zero falhas |
| Dez checks | exit 0; 159 entradas iguais antes/depois |
| Scanner heurístico | 155 arquivos; sem violações detectadas |
| Offline | seis controles técnicos aprovados, três não exercitados; zero rede/modelo comercial |
| Catálogo / fronteiras / API / cliente-editor | 31 / 13 / 14 / 16 direcionados |
| Revisão independente | DI01 corrigido com teste negativo RED→GREEN; sete testes do container IA passando |

[Comandos, logs e hashes do conjunto](evidence/t03-catalog-2026-10-15/verified-checkpoint/checks.json). Tentativa inicial preservada em initial-checks: teve um teste concorrente com expectativa antiga de autoria e fontes alteradas durante a execução; não foi aceita. O teste atual usa triggeredBy, conforme contrato existente. Não houve mudança da regra de autoria para fazer o teste passar.

TDD: R1 teve 29 falhas/2 controles antes do catálogo completo; R2 mostrou dependência antiga incompatível e ausência de DI obrigatória; R3 teve 14 falhas HTTP antes da rota; R4 exercita código real com adaptadores sintéticos. Erros iniciais de import/runner, payload sintético incompleto e comparação de ordem de atributos SSR foram registrados e não são evidência funcional. A revisão DI01 teve uma falha real/6 controles e depois 7/7. [Parecer e limites](evidence/t03-catalog-2026-10-15/code-review.json).

## Navegador

[Registro do navegador](evidence/t03-catalog-2026-10-15/browser-validation.json): React e hook reais, compilados dos fontes atuais, em fixture local isolada com identidade/fetch/catálogo sintéticos e CSS de teste. Confirmados preservação de parâmetros, seleção/aplicação, troca de organização por teclado, descarte de respostas antigas, erro versus vazio e Tab/foco. Zero erros de console observados. Screenshot exibido na sessão; servidor e aba de teste encerrados.

Isso não valida a página Next completa com Clerk, banco, canvas, persistência conectada ou layout mobile do produto. T08/T14 mantêm esses gates.

## Operação e reprodução pelo CMD

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
set "PATH=%CD%\.tools\node-v24.21.0-win-x64;%PATH%"
call npm run prisma:validate
call npm run check:all
call npm run eval:offline
```

Nesta entrega os dez comandos foram executados individualmente, conforme o recibo. check:all agrupa as verificações correspondentes para reprodução. Não requer instalação nova.

Produção inicia com configuredResources vazio em apps/api/src/resources/resource-catalog.config.ts. Para provisionar metadados reais, obter antes as aprovações pertinentes de modelo/destino/organização; cadastrar somente campos do contrato e grants explícitos. O campo APPROVED em teste/configuração não substitui aprovação humana. Não colocar segredos no catálogo: cadastro de credenciais próprias/cofre e uso real ficam em etapas separadas. Marcadores pending/modelo-a-aprovar não podem ser modelos aprovados; flowmind-default depende de mapeamento autorizado explícito.

## Pendências

- R5 técnica local concluída na retomada; integração real e políticas comerciais continuam pendentes.

- Recuperar/decidir T03-S2b; o A desta conversa não aprova convergência, quotas, modelo comercial ou custos. Protótipos preservados.
- Homologar modelo/provedor/destinos, privacidade e orçamento antes de integração real. LIVE e webhook público permanecem bloqueados.
- Validar jornada completa de T08/T14 com identidade/persistência reais, além de Docker/Redis/CI/restauração quando autorizados.
- AI MEMORY recusou request 135. Memória canônica no Obsidian e manifesto pendente; captura automática não comprovada.

## Histórico da tentativa falha após edições concorrentes

A implementação A possui um checkpoint local aprovado anterior, preservado em [verified-checkpoint](evidence/t03-catalog-2026-10-15/verified-checkpoint/checks.json). Após novas edições paralelas, a última tentativa teve typecheck exit 2 e Jest exit 1: seis suítes incompatíveis com o quarto argumento agora obrigatório de WorkflowsService e uma com erro de sintaxe em workflows.service.spec.ts. Foram executados 506 testes Jest, todos aprovados, mas sete suítes não compilaram; isso não é aceite do conjunto. Os outros oito comandos passaram e 201 regressões passaram naquela tentativa. As fontes mudaram durante e depois dela. [Recibo da tentativa não aceita](evidence/t03-catalog-2026-10-15/latest-failed-checks/checks.json). **Estado registrado naquela tentativa:** coordenar um único editor, concluir as edições e validar fontes estáveis. Nenhuma alteração alheia foi revertida.

O principal pediu a identificação da sessão editora ao usuário. Não encerrou processos alheios, não alterou a nova política de uso nem reverteu a mudança concorrente de persistência obrigatória. O relatório e o navegador de componentes se aplicam aos hashes registrados, sem estender aceite às alterações posteriores.

## Retomada R5 validada — 15/10/2026

[Comandos, logs e hashes atuais](evidence/t03-catalog-resume-2026-10-15/checks.json): dez comandos exit 0 em 18:46–18:47 UTC, 159 entradas sem alterações, 751 Jest/39 suítes, 201 regressões e scanner heurístico 155 arquivos. A sintaxe e as construções anteriores já estavam corrigidas ao retomar; principal preservou as edições e não alterou código de produção. [Revisão independente](evidence/t03-catalog-resume-2026-10-15/code-review.json): nenhum achado material no recorte catálogo/DI/histórico. ResourceResolver obrigatório; ExecutionsService é requerido pelo Nest, embora o parâmetro TypeScript permita construções diretas incompletas; a guarda 503 impede sucesso sem histórico.

Alcance técnico, com identidade/storage/IA sintéticos e IA externa desabilitada. Não aprova políticas T13/S2b, modelo comercial, serviços reais, migrações ou aceite do MVP. Navegador de componentes permanece evidência anterior, vinculada aos hashes registrados, sem novo teste da página completa/mobile. [AI MEMORY request 136](evidence/t03-catalog-resume-2026-10-15/ai-memory-status.json) recusado; 33 páginas preparadas, sem transferência. [Integridade final](evidence/t03-catalog-resume-2026-10-15/final-integrity.json).

Após esse snapshot, outra execução alterou dashboard/histórico e suas regressões de UI. O catálogo e suas dependências continuam iguais ao snapshot testado; as alterações posteriores das telas mantêm QA pendente. A rodada adicional teve dez exit 0, porém o dashboard mudou durante os checks, impedindo aceite do checkout completo.

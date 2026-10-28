# T03-S1 — configurações declarativas dos nós

Checkpoint local do principal em 13/10/2026. Continuidade autorizada após o mapa T03-S0. Guardas de compatibilidade implementadas sem instalar biblioteca, selecionar modelo, iniciar serviço ou alterar política de ramos. Campos finais de negócio, recursos e aceite de produção continuam pendentes.

## Comportamento

- [getNodeConfigIssues](../packages/contracts/src/node-validation.ts) é puro, não altera config e relata campos ausentes/tipos/valores inválidos sem copiar dados privados. Aceita JSON finito, detecta ciclos e recusa chaves de protótipo. Catálogos de operadores/métodos são compartilhados.
- Edição DRAFT admite pendências de parâmetros, mas rejeita tipos, campos desconhecidos e valores inválidos. Não inventa URL ou outro valor para completar o rascunho. O relatório puro fica disponível para futuros consumidores; a interface visual de pendências ainda é tarefa T10-S4.
- Revisão/ativação exigem config apta ao protótipo antes de gravar metadados/snapshot. Simulação checa config antes do primeiro nó e novamente após resolver templates, antes do executor. Erro dinâmico produz FAILED; não registra sucesso de e-mail com corpo ausente/não string.
- O servidor conserva os códigos C03 de destinatário. Erros novos usam WORKFLOW_INVALID_NODE_CONFIG, com índice/nomes conhecidos de campos e códigos, sem valores, nomes desconhecidos, headers privados ou IDs gerados.
- URLs literais reutilizam o bloqueio já existente do executor; destinos dinâmicos são checados após resolução. Isso não autoriza destinos nem comprova DNS/redirect/egress reais.

## Conciliação com os protótipos existentes

| Nó | Guarda e comportamento preservado |
| --- | --- |
| trigger_form | requiredFields ausente conserva default name/email/message; lista fornecida aceita somente esses nomes, inclusive subset/array vazio. formId é string opcional, sem lookup |
| ai_analyze_intent | Entrada string não vazia em inputPromptTemplate ou alias message_text; modelRef/instruções fornecidos devem ser strings. Referência não escolhe/autoriza modelo; prévia continua simulada |
| internal_record | Mapeamento parcial e aliases diretos/message preservados; exige nome ou e-mail conforme executor. Campos são strings, ambiguities aceita string/string[]. Entidade de negócio/obrigatoriedades finais não escolhidas |
| send_email | to/subject/bodyTemplate devem ser strings; destinatário não vazio e controles C03 preservados. Corpo admite quebras de linha; headers/replyTo são protegidos contra CRLF. Assunto/corpo string vazios não receberam regra nova de conteúdo |
| condition | Catálogo e aliases normalizados do executor; defaults equals/operandos vazios e operandos JSON preservados. Não aprova semântica comercial, novas regras de coerção ou OR-Join |
| http_request | URL não vazia, método permitido quando fornecido (GET default), headers string/string sem CRLF, body/credentialRef strings opcionais. Credencial não é resolvida |

As interfaces específicas existentes descrevem a forma candidata canônica. Estas guardas também preservam defaults/aliases dos protótipos; não fazem type narrowing para afirmar que toda config é uma interface canônica completa. Referências/saídas, disponibilidade e recursos exigem validação própria.

## Evidência executada

- Antes das guardas: **59 falhas/um positivo**. Depois: 60 controles de fronteira aprovados. Dois controles adicionais de valores resolvidos falharam antes da correção e passaram depois; junto dos 23 controles puros, são **85 testes direcionados**.
- Compatibilidade: quatro fixtures de e-mail usadas para testar ramos ganharam corpo string, mantendo suas asserções de roteamento. O controle de precedência passou a usar formId, campo permitido, em vez de invalidRef desconhecido. O loader nativo agora lê o entrypoint público de contracts; import só de tipos foi explicitado. Não foram removidas negativas ou enfraquecidas guardas.
- A primeira rodada após checar valores resolvidos detectou a fixture de precedência com campo desconhecido: **um teste falhou**. [Recibo/logs preservados](evidence/t03-config-runtime-2026-10-13/failed-check-1/checks.json). Após corrigir a fixture, a rodada final passou.
- Snapshot final: **433 Jest/31 suítes, 110 regressões**, scanner heurístico 127 arquivos; Prisma validate, tipos, builds API/web, artefato, operação estática e avaliação offline aprovados. Dez comandos exit 0 em **131 entradas reenumeradas**, fontes/dependências estáveis. [Recibo](T03_CONFIG_RUNTIME_CHECKS_2026-10-13.json).
- [Red inicial](evidence/t03-config-runtime-2026-10-13/config-red.log), [red de valores resolvidos](evidence/t03-config-runtime-2026-10-13/resolved-config-red.log), [85 green](evidence/t03-config-runtime-2026-10-13/resolved-config-green.log). Avisos anteriores de ts-jest/VM experimental permanecem; scanner não substitui ESLint ou auditoria.
- [Sondagens compiladas](evidence/t03-config-runtime-2026-10-13/probe-report.json): SC01/SC02/SC05 agora negados antes de revisão/execução; SC06/SC07 permanecem negados. SC08 falha no consumidor em runtime, mas ainda é aceito na revisão. SC03/SC04/SC09 seguem lacunas de referências/recursos. O corpo resolvido não é observado em resultado FAILED, que registra config original; não foi fabricado valor para esse campo do relatório.
- [Relatório offline](evaluation/T03_CONFIG_RUNTIME_OFFLINE_REPORT_2026-10-13.json): seis verificações técnicas aprovadas, três não exercitadas e notas humanas null. Sem chamada comercial; não prova qualidade semântica de modelo.

Testes de fronteira chamam serviços reais com storage falso; não exercitam Clerk, PostgreSQL/transação real ou HTTP TCP. Browser/acessibilidade, CI/Docker, filas e serviços reais continuam gates. LIVE bloqueado; webhook público 503; worker standby.

## Reprodução pelo CMD

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
set "PATH=%CD%\.tools\node-v24.21.0-win-x64;%PATH%"
npm run typecheck
npm test
npm run test:regression
npm run build
npm run check:api-artifact
npm run lint
npm run check:operation
node docs\evidence\t03-config-runtime-2026-10-13\probe-config.cjs
```

O diagnóstico imprime observações atuais, não uma nota de aprovação. [Plano](../plan.md), [mapa](T03_NODE_SCHEMA_REVIEW.md). Próximo incremento: existência/precedência/saídas referenciadas em todos os campos, mantendo disponibilidade entre ramos e autorização de recursos explícitas.

Backup: `C:\Users\jv883\AppData\Local\Temp\flowmind-t03-config-20261013-jigmc4h4`. Obsidian permanece canônico; não houve instalação, migration, commit/push/deploy, consumo comercial ou serviço iniciado.

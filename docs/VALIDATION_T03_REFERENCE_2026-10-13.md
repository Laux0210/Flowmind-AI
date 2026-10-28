# T03-S2a — referências antes da revisão e execução

Checkpoint local do principal em 13/10/2026. Existência, precedência, campos declarados e incompatibilidades conhecidas de tipo agora recebem a mesma validação na revisão, ativação e simulação. Disponibilidade entre ramos/campos opcionais e autorização de recursos continuam pendentes; não houve mudança de OR-Join.

## Alterações

- [Catálogo de saídas](../packages/contracts/src/node-outputs.ts) alinhado aos campos dos seis tipos, com chaves conferidas pelo compilador. Descreve nomes e categorias; não certifica presença de opcionais ou campos específicos de modo.
- [Validação compartilhada](../apps/api/src/engine/workflow-reference.validation.ts) examina todos os valores interpolados de config, incluindo prompts, corpos, headers e mapeamentos. Produtor deve existir no mesmo grafo e preceder o consumidor; saída/caminho conhecido deve ser permitido.
- Referência exata preserva tipo. Boolean/number/array conhecido em campo string é negado antes da gravação. Interpolação em frase continua produzindo texto; ambiguities aceita o array exato nas posições já suportadas. Operandos de condição mantêm os tipos/defaults do protótipo.
- Subcampo de scalar, índice inválido e caminho reservado são negados. JSON de resposta HTTP é dinâmico: somente o root é declarado; campos internos exigem lookup/runtime e não recebem garantia de existência.
- Dados do formulário que contêm `{{...}}` não são reinterpretados como outro template. A gramática existente foi preservada; a etapa não introduziu linguagem de escape nem avaliação de código.
- Falhas usam WORKFLOW_INVALID_REFERENCE e índice/campo/código seguros. Não ecoam produtor inexistente, saída privada, valor ou headers. Os códigos C03 continuam em sua fronteira de destinatário.

Campos opcionais/mode-specific e o tipo string-or-array são tratados como informações incompletas, não como prova de presença ou compatibilidade total. Guardas runtime de S1 e lookup com Object.hasOwn permanecem necessários. Geração de propostas ainda exige a integração própria de T10-S4.

## Evidência

- Red inicial: **46 falhas/4 acertos** em 50 controles; green inicial 50. Doze controles adicionais cobrem catálogo/caminhos e revisão válida, totalizando **62 novos testes**.
- Compatibilidade: a antiga saída interest_level agora é negada antes dos nós; a regressão conserva a negativa. Um teste runtime passou a usar resposta JSON dinâmica para continuar verificando a guarda após resolução, pois boolean conhecido agora é negado antecipadamente. Prefixo de precedência foi preservado.
- Snapshot: **495 Jest/32 suítes, 110 regressões**, scanner 130 arquivos. Dez comandos exit 0; Prisma validate, tipos, builds, artefato, operação estática e avaliação offline passaram com **134 entradas estáveis**. [Recibo](T03_REFERENCE_CHECKS_2026-10-13.json), [red](evidence/t03-reference-2026-10-13/reference-red.log), [green inicial](evidence/t03-reference-2026-10-13/reference-green.log).
- [Sondagens compiladas](evidence/t03-reference-2026-10-13/probe-report.json): SC03/SC04 agora são negados na revisão sem writes/snapshot. SC01/SC02/SC05/SC06/SC07 continuam negados. SC08 ainda pode ser revisado, mas sua simulação falha antes do executor de e-mail; SC09 não resolve recursos.
- [Relatório técnico offline](evaluation/T03_REFERENCE_OFFLINE_REPORT_2026-10-13.json) preserva seis verificações aprovadas, três não exercitadas e notas humanas null. Não houve modelo comercial, banco real, HTTP TCP, fila, browser ou CI remota.

O diagnóstico não é teste de aprovação das duas lacunas restantes. Sessão/organização/autorização reais seguem T06; LIVE bloqueado, webhook público 503 e worker standby. Faturamento, qualidade semântica, privacidade/retenção e modelo continuam gates.

## Reprodução

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
node docs\evidence\t03-reference-2026-10-13\probe-references.cjs
```

Backup anterior: `C:\Users\jv883\AppData\Local\Temp\flowmind-t03-reference-20261013-2dzmdtw5`. [Plano](../plan.md), [memória](MEMORIA.md). Próximos: disponibilidade/convergência com contrato explícito, recursos por organização e consumo visual das pendências, sem ativar serviços por implicação.

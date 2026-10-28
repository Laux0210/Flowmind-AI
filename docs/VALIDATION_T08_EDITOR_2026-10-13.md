# T08 — edição manual local: entrega e validação (13/10/2026)

> Checkpoint histórico do incremento T08. Depois, [SEC05](VALIDATION_T03_RESOURCE_SECURITY_2026-10-13.md) alterou o resolvedor e testes de API/recursos: conjunto corrente 685 Jest/36 suítes, 179 regressões e 146 entradas estáveis. Recibos T08 abaixo preservam o snapshot próprio; consulta de AI MEMORY/retorno Obsidian atuais estão na memória.

**Incremento autorizado implementado; aceite integral de T08/MVP pendente.** Edição de parâmetros dos seis tipos existentes, seleção/movimento e conexões funcionam no código de DRAFT. 93/93 controles direcionados passaram. A rodada técnica final passou em 145 entradas estáveis. Políticas concorrentes de modelos/recursos cuja aprovação não foi recuperada permanecem em verificação.

## Escopo e arquivos

Autorização: “pode seguir”, nesta conversa, após o desenho curto do painel. Reutilizou contratos/APIs/ciclo de vida; não criou/removeu nós nem escolheu semântica de join ou modelo comercial.

- `apps/web/src/lib/workflow-editing.ts`: alterações puras por campo/posição/aresta; aliases e ausências/defaults preservados; JSON inválido, ciclo, aresta duplicada e estado não DRAFT negados.
- `node-parameter-editor.tsx`: labels em português, campos por tipo, coordenadas, aplicar/descartar e bloqueio por edição local pendente. Seis tipos: trigger_form, ai_analyze_intent, internal_record, send_email, condition, http_request.
- `workflow-graph-node.tsx`: handles legados/default/true/false preservados, chaves distintas e efeito `useUpdateNodeInternals` para atualizar bounds. [Referência oficial](https://reactflow.dev/api-reference/hooks/use-update-node-internals).
- `apps/web/src/app/workflows/[id]/page.tsx`: sidebar/lista/canvas e conexões; definição/contexto sincronizados fora do render. Callbacks leem draft atual; dirty síncrono impede ações antes de salvar; resultados/erros de outra organização ou revisão obsoleta descartados.
- `workflow-editing.test.mjs`, `load-ui-handlers.mjs`, `workflow-container.spec.ts` e lista explícita em package.json integram controles sem novas dependências.
- Compatibilidade adicional: `load-typescript.mjs` exporta a mesma exceção fake para ForbiddenException; `resource-resolver.ts` usa import type em três símbolos. Não modificou regras, allowlist ou asserções da política concorrente.

## Resultados e limites

| Verificação | Resultado corrente | Alcance |
| --- | --- | --- |
| Edição + cliente direcionados | 93/93, incluindo 41 novos | Helpers e callbacks reais com AST/setters/API sintéticos |
| Formulários | Seis renders SSR React reais incluídos | Labels, valores escapados, disabled e campos; sem DOM/lifecycle |
| Efeito de handles | Callback/effect executado com hooks substituídos | Solicitação de atualização; sem geometria/pointer real |
| Nest/Express edição/imutabilidade | Quatro novos; 64 casos do container no total | 32 cenários por streams e TCP loopback, identidade/storage/IA fake |
| Jest completo | 629/629, 35 suítes | Controle local, não integrações remotas |
| Regressões completas | 179/179 | Inclui C01–C03; placeholder ajustado pela execução concorrente |
| Demais checks | Prisma validate, tipos, API/web build, artefato, scanner heurístico 141 arquivos e operação estática: exit 0 | Dez/dez comandos passaram, executados separadamente conforme recibo |
| Avaliação offline | Seis técnicos aprovados, três não exercitados; zero fetch | Nenhuma nota humana ou avaliação de modelo |
| Fontes/dependências declaradas | 145 entradas estáveis antes/depois | Lock/manifests incluídos; árvore instalada não exaustivamente hasheada |
| Browser | CUA apps/browsers vazios; iab indisponível | Layout, drag, handles, teclado/foco/mobile/reload não verificados |

[Recibo completo](T08_EDITOR_CHECKS_2026-10-13.json), [direcionado anterior](evidence/t08-editor-2026-10-13/focused-checks.json) (93 casos incluídos na regressão completa corrente), [browser](evidence/t08-editor-2026-10-13/browser-status.json), [relatório offline](evaluation/T08_EDITOR_OFFLINE_REPORT_2026-10-13.json).

## Falhas reproduzidas e revisão

Os logs foram preservados; falta de módulo/syntax error não foi contabilizada como comportamento validado. O primeiro red de helpers teve 13 módulos ausentes e duas falhas de callbacks; a correção de snapshots/handles reproduziu cinco falhas comportamentais. Depois, duas transições de referência e um erro de carregamento de organização obsoleta foram reproduzidos/corrigidos. O red de PUBLISHED mostra referência ainda REVIEWED, não demonstra edição de um workflow publicado real. O caso DRAFT→REVIEWED demonstra a fronteira de edição.

Revisão independente do frontend e das duas correções de carregamento: nenhum defeito material restante no delta; não substitui browser nem aprova backend concorrente. [Parecer e hashes](evidence/t08-editor-2026-10-13/code-review.json).

A integração concorrente T03-S3 causou 37 falhas de linking: primeiro ForbiddenException ausente no adaptador, depois tipos tratados como imports de runtime. Corrigidas essas duas fronteiras, oito erros de política permaneceram explícitos na rodada histórica. Depois outra execução incluiu pending no catálogo e o rejeita quando requireComplete=true; a nova rodada passou, sem modificar essas fixtures pelo principal. Os aliases modelo-a-aprovar e flowmind-default continuam aceitos na validação completa, sem escolha de modelo comercial aprovada. Não se trocaram fixtures pending por modelo da allowlist para obter aprovação dos testes. [Falha anterior](evidence/t08-editor-2026-10-13/external-resource-regression-failure/checks.json), [após imports](evidence/t08-editor-2026-10-13/resource-type-import-regression.log).

## Trabalho concorrente e pendências

Outra execução acrescentou guardas de convergência/opcionais e recursos/modelos durante T08. A primeira rodada mudou durante os checks; recibo recusado preservado. A rodada intermediária estável falhou em oito casos; [recibo preservado](evidence/t08-editor-2026-10-13/eight-model-regression-failures/checks.json). Na rodada final, dez checks passaram, com 145 entradas estáveis. “Código preservado” e “testes unitários passaram” não confirmam aprovação T03-S2b/S3, modelo ou aceite de segurança. [Origem/relatos](archive/CONCURRENT_T03_T08_2026-10-13.md), [auditoria em leitura](evidence/t08-editor-2026-10-13/concurrent-backend-audit.json).

Próxima ação: coordenar o checkout e confirmar decisões/alcance T03-S2b/S3; revisar os riscos de isolamento/aliases/erros preservando C01–C03. Após browser/ambiente disponíveis e autorizados, testar seleção/drag/handles/formulário/teclado/foco/mobile e recarregar definição persistida. Criação/remoção de nós, navegação/versionamento e aceite integrado continuam no backlog T08.

Sem instalações, migrations, real Clerk/PostgreSQL/provider, consumo comercial, commit/push/deploy pelo principal nesta etapa. LIVE bloqueado, worker standby e webhook público 503 mantidos.

## Reprodução pelo CMD

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
set "PATH=%CD%\.tools\node-v24.21.0-win-x64;%PATH%"
node --experimental-vm-modules --test tests/regression/workflow-editing.test.mjs tests/regression/ui-workflow.test.mjs tests/regression/ai-generation-usage.test.mjs
npm test
npm run test:regression
npm run typecheck
npm run build
```

Os comandos completos passaram no snapshot corrente. A falha anterior e a alteração concorrente de política têm seus recibos preservados; testes verdes não aprovam arquitetura/modelo/serviços reais. A avaliação técnica offline usa `npm run eval:offline`. Checks completos e seus logs/commands/hashes estão no recibo; Os dez comandos foram executados individualmente; check:all é a agregação documentada para uso pelo usuário.

## Continuidade

[Plano](../plan.md), [memória](MEMORIA.md), [matriz QA](QA_SECURITY_MATRIX.md) atualizados no filesystem canônico. [Retorno Obsidian](evidence/t08-editor-2026-10-13/obsidian-readback.json), [integridade final](evidence/t08-editor-2026-10-13/final-integrity.json). AI MEMORY request 132 recusado; [28 páginas pendentes](AI_MEMORY_SYNC_PENDING_2026-10-12.json), sem transferência/captura atual comprovadas.

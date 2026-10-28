# T06/T14 — API por HTTP TCP local

Checkpoint local do principal em 13/10/2026. A mesma suíte do container Nest agora exerce **30 cenários em streams e os mesmos 30 por HTTP TCP**. O segundo transporte usa uma porta efêmera em `127.0.0.1`; requisições atravessam o servidor HTTP, Express, controllers, guards e serviços do AppModule.

Clerk.verifyToken, persistência Prisma e geração de IA continuam sintéticos. O teste não usa o bootstrap de main.ts, serviços externos, credenciais reais ou migrations. Não demonstra JWT/membership remotos, PostgreSQL, CORS do bootstrap ou operação de produção.

## Comportamento verificado

- Liveness/readiness, prefixo da API e geração sob o contexto autenticado da fixture.
- Workflows, histórico e consumo restritos à organização; identidade/organização de JSON e header não substituem a sessão.
- Recursos alheios retornam 404; identidade inválida retorna 401; member recebe 403 nas ações administrativas, antes de mutações.
- Revisão/ativação e captura da simulação preservam autoria/ID; falhas do motor e armazenamento continuam visíveis, sem sucesso falso ou detalhes internos.
- Webhook público permanece 503 e não dispara execução.

Nenhum caso anterior foi removido. O harness permite somente o listener efêmero da própria aplicação e fetch para seu prefixo local, recusa redirects e verifica que não houve tentativa de fetch externo. Requisições TCP têm prazo de cinco segundos. O encerramento fecha a aplicação/listener e restaura os mocks, inclusive se o teardown falhar. Isso limita o harness; não é um isolamento de rede de produção.

## Evidências e limites

[Suíte direcionada](evidence/t14-http-2026-10-13/focused-http.log): **60 testes aprovados**, exit 0. [Arquivo exercitado](../apps/api/src/auth/workflow-container.spec.ts). Foi uma ampliação da prova de transporte, sem alteração de implementação de produção ou política de negócio.

Snapshot completo: **603 Jest/34 suítes, 136 regressões**, scanner heurístico em 134 arquivos e dez comandos exit 0, com **138 entradas estáveis** antes/depois. Prisma validate, tipos, build API, artefato API, lint, operação estática, build web e avaliação offline aprovados. [Recibo e hashes](T14_HTTP_CHECKS_2026-10-13.json). Manifests/lockfile incluídos; a árvore instalada de dependências não foi exaustivamente hasheada.

[Avaliação offline](evaluation/T14_HTTP_OFFLINE_REPORT_2026-10-13.json): seis verificações técnicas aprovadas, três não exercitadas, zero fetch e zero respostas por modelo avaliadas. A prova TCP não aprova qualidade de IA, quotas ou faturamento. A isenção/quota do protótipo continua sem origem de aprovação recuperada.

[Revisão independente](evidence/t14-http-2026-10-13/code-review.json), [leitura Obsidian](evidence/t14-http-2026-10-13/obsidian-readback.json) e [integridade final](evidence/t14-http-2026-10-13/final-integrity.json) registram a conferência deste incremento. O snapshot anterior de e-mail é histórico e foi preservado.

LIVE segue bloqueado, worker standby e webhook público 503. T03-S2b e recursos aguardam decisões; Clerk/PostgreSQL, fila, browser, Docker/CI e restauração reais seguem gates. O editor atual mostra o canvas, mas ainda não tem controles manuais para parâmetros/conexões; T08 precisa dessa entrega e da validação no navegador antes do aceite.

## Reprodução pelo CMD

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
set "PATH=%CD%\.tools\node-v24.21.0-win-x64;%PATH%"
node --experimental-vm-modules node_modules\jest\bin\jest.js --config apps\api\jest.config.cjs --runInBand --runTestsByPath apps\api\src\auth\workflow-container.spec.ts
npm run prisma:validate
npm run typecheck
npm test
npm run test:regression
npm run build --workspace @flowmind/api
npm run check:api-artifact
npm run lint
npm run check:operation
npm run build --workspace @flowmind/web
npm run eval:offline
```

Backup: `C:\Users\jv883\AppData\Local\Temp\flowmind-t14-http-20261013-76919612`. [Plano](../plan.md), [memória](MEMORIA.md). AI MEMORY recusou request 131; esta etapa permanece canônica no Obsidian, pendente de transferência.

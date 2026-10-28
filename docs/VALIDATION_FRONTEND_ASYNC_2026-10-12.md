# FlowMind AI — validação de callbacks e captura da simulação

> Provas de frontend/histórico preservadas. Dependências/worker tiveram mudanças posteriores: [registro separado](VALIDATION_DEPENDENCY_DRIFT_2026-10-12.md). A última rodada não recebeu aceite integral por edição concorrente; este snapshot não valida arquivos adicionados depois.

Checkpoint local do principal em 12/10/2026. [Memória](MEMORIA.md), [plano](../plan.md), [contexto](PROJECT_CONTEXT.md). O protótipo de captura está preservado; a política comercial de consumo continua pendente.

## Evidência atual

| Verificação | Resultado | Alcance |
| --- | --- | --- |
| Jest | 215 testes / 18 suítes, zero falhas | Serviços/guards/DI reais; identidade, storage e respostas de IA sintéticos |
| Regressões Node | 96 testes, zero falhas | Inclui 26 testes de callbacks/effect extraídos da fonte por AST |
| AppModule / Express | 30 casos direcionados | IncomingMessage/ServerResponse em streams; `listen` proibido |
| Typecheck | Aprovado | Contratos, API/código/testes e web |
| Builds API/web | Aprovados | Artefatos locais; sem publicação |
| API artifact | Aprovado | Imports, metadados específicos, AI_CLIENT e prefixos |
| Scanner / operação | 100 arquivos; checks aprovados | Heurística de padrões e declarações estáticas; não auditoria completa ou go-live |

`python .codex/validate_team.py` também passou: sete perfis TOML, nomes únicos, permissões declaradas e documentos. Não alterou perfis/skills nem testou reconhecimento/delegação/permissões efetivas no Codex.

[Snapshot atual, hashes e logs](SIMULATION_HISTORY_CHECKS_2026-10-12.json). Nenhum arquivo de entrada mudou durante os oito checks; conjunto de arquivos reenumerado antes/depois. O [snapshot anterior](FRONTEND_ASYNC_CHECKS_2026-10-12.json) registrou 211 Jest/96 regressões antes dos quatro novos casos de transporte, sem alteração de código de produção nessa etapa adicional.

## Comportamentos corrigidos e verificados

- Histórico descarta resposta/erro/carregamento obsoletos por pedido e contexto, inclusive organização A→B→A e espera por token. Fechar o detalhe invalida a consulta, impedindo reabertura pela resposta antiga.
- Listagem e consumo são carregados independentemente: uma falha preserva a resposta útil. Lista indisponível difere de lista vazia; consumo desconhecido não aparece como quota saudável.
- Editor ignora callbacks de revisão/ativação/desativação após mudança de contexto/revisão; aplicação de IA respeita mutações em andamento. Troca de contexto limpa flags de ações anteriores.
- Simulação FAILED apresenta erro e o nó que falhou; SUCCESS, FAILED e SKIPPED têm estados distintos. COMPLETED continua com feedback de sucesso. Erro de criação aparece dentro do modal do dashboard.
- `AiModule` repassa `OPENAI_MODEL` configurado ao adaptador; teste usa fetch sintético e resposta controlada. Chave sozinha não habilita IA externa, e nenhum modelo recebe aprovação por esse teste.

Os callbacks/effect são extraídos da fonte e executados com promises, setters e API controlados. Não montam React/DOM e não provam lifecycle, foco, responsividade, tecnologia assistiva ou comportamento no navegador.

## Prova do protótipo de captura

Quatro novos casos passam pelas rotas/controllers/guards/serviços reais do AppModule:

1. Alpha e Beta simulam e recuperam o mesmo ID na listagem/detalhe próprios; a organização alheia recebe 404. `orgId`, `userId` e `triggeredBy` enviados no JSON não substituem a sessão.
2. Entrada incompleta retorna resultado FAILED, persistido como FAILED no histórico.
3. Erro de gravação retorna 503 genérico e não acrescenta uma execução fictícia nem revela o erro privado.

O fake de armazenamento aplica os filtros recebidos e resolve a relação workflow/org. Não emula PostgreSQL ou MVCC. A prova é comum às opções A/B de consumo e não aprova isenção/cobrança. O motor já rodou quando a gravação falha; não há garantia de execução persistida previamente. LIVE continua bloqueado.

## Pendências para aceite

- Escolher elegibilidade de SIMULATION e fechar dependência obrigatória do histórico/métricas, conforme [proposta T13](T13_SIMULATION_HISTORY_PLAN.md).
- Conferir aprovação/alcance da [correção de dependências](T05_DEPENDENCY_REMEDIATION_PLAN.md): outra execução instalou overrides; audit sem dev passou a zero, mas o completo ainda sinaliza cinco pacotes altos. A rodada com alterações concorrentes tem registro separado.
- Clerk/JWT/PostgreSQL/HTTP TCP reais, browser/E2E, Docker/Redis/workers, CI remoto e restauração não foram exercitados. Nenhuma instalação, migration, efeito comercial ou publicação foi feita.
- AI MEMORY retornou ConnectionRefusedError; Obsidian permanece canônico. [Sincronização pendente](AI_MEMORY_SYNC_PENDING_2026-10-12.json) não é recibo de transferência.

A leitura pelo conector Obsidian recuperou a memória atualizada em `FlowMind-AI/Flowmind-AI/docs/MEMORIA.md`. A junção `E:\Memoria\FlowMind-AI` continua apontando à pasta original; nenhuma segunda cópia ou configuração de cofre foi criada.

## Reproduzir pelo CMD

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
set "PATH=%CD%\.tools\node-v24.21.0-win-x64;%PATH%"
set "FLOWMIND_ENABLE_EXTERNAL_AI=false"
set "OPENAI_API_KEY="
set "CLERK_SECRET_KEY="
set "CLERK_PUBLISHABLE_KEY="
set "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="
npm run typecheck
npm test
npm run test:regression
npm run build --workspace @flowmind/api
npm run check:api-artifact
npm run lint
npm run check:operation
npm run build --workspace @flowmind/web
```

Foco no transporte: `npm run test --workspace @flowmind/api -- --runInBand --runTestsByPath src/auth/workflow-container.spec.ts`. Foco nos callbacks: `node --experimental-vm-modules --test tests/regression/ui-workflow.test.mjs`. Os avisos existentes de VM experimental/ts-jest não são prova de falha nem substituem o typecheck.

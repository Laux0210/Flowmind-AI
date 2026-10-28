# T10 — validação local do adaptador de propostas

Checkpoint do principal em 13/10/2026. A continuidade autorizou as correções locais previstas no plano; T10 permanece em andamento. Modelo, avaliação semântica, orçamento, privacidade e integrações reais continuam pendentes.

## Comportamento corrigido

- `OpenAiStructuredClient` exige envelope/mensagem válidos e uma proposta concluída com `finish_reason: stop`. `length` e `content_filter` resultam em `AI_INCOMPLETE_RESPONSE`, mesmo com JSON aparentemente completo. Uma recusa explícita resulta em `AI_PROMPT_REFUSED`, sem copiar o texto privado do provedor.
- O novo decoder valida o schema local solicitado: versão, campos obrigatórios, tipos do catálogo, IDs não vazios, coordenadas finitas, avisos e handles. Configuração deve ser string JSON que decodifique um objeto; JSON inválido, arrays, escalares, números não finitos e chaves de protótipo são recusados. Não há substituição silenciosa por `{}`.
- Esses controles são estruturais. Schemas completos de cada tipo de nó, referências a saídas e autorização de recursos ainda precisam de contrato/validação próprios. O bloqueio conservador de `__proto__`, `prototype` e `constructor` não comprova toda segurança de configuração.
- `tokensConsumed` aceita `number | null` no cliente e no contrato público. Só um `usage.total_tokens` inteiro seguro, não negativo, é preservado; ausência ou valor inválido vira `null`. Zero declarado continua zero; componentes não são somados novamente. Isso não certifica faturamento ou contabilização comercial.
- Erros controlados preservam consumo declarado disponível. JSON inválido, resposta incompleta, recusa e DAG inválido mantêm código/mensagem genéricos. IDs gerados e conteúdo privado não são copiados para erros públicos ou relatório do avaliador.
- `AiEvaluator` registra controle de uso como não exercitado quando a medição é desconhecida. Notas e médias humanas continuam `null`; revisão semântica permanece `PENDING`.
- O editor mostra **Consumo não informado** para `null`. Revisão humana continua obrigatória; gerar proposta não ativa workflow.

Referências consultadas: [Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) e [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). O formato local foi preservado; não houve migração de API ou escolha de modelo.

## Evidência executada

| Verificação | Resultado observado |
| --- | --- |
| Controles novos antes da correção | 48 falhas e 3 acertos; depois 2 falhas adicionais de grafo/privacidade |
| Suítes direcionadas após correção | 75 testes em 4 suítes aprovados; 53 controles novos |
| Jest completo | 328 testes em 28 suítes aprovados |
| Regressões nativas completas | 110 aprovadas, incluindo 4 novos casos do cliente |
| Prisma validate, tipos, API/web build e artefato | Todos exit 0 |
| Scanner heurístico | 123 arquivos, zero violações; não substitui ESLint ou auditoria |
| Operação e relatório offline | Checagem estática e execução por template aprovadas |
| Integridade | 127 entradas reenumeradas antes/depois; fontes e dependências estáveis |

[Recibo dos dez comandos e hashes](T10_CLIENT_CHECKS_2026-10-13.json). Logs: [Jest](evidence/t10-client-2026-10-13/jest.log), [regressões](evidence/t10-client-2026-10-13/regression.log), [red inicial](evidence/t10-client-2026-10-13/client-red.log), [red do grafo](evidence/t10-client-2026-10-13/graph-red.log), [green direcionado](evidence/t10-client-2026-10-13/client-green.log).

As fixtures usam o adaptador real com fetch sintético; a suíte proíbe fetch global. O teste nativo usa loader/mocks, não é prova de DI real. O [relatório offline](evaluation/T10_CLIENT_OFFLINE_REPORT_2026-10-13.json) executa classes compiladas com template explícito: seis verificações técnicas aprovadas, zero falhas e três não exercitadas. Zero tentativas de rede e zero respostas comerciais avaliadas; oito entradas de formulário continuam aguardando revisão por modelo/humano.

Tipos e build validaram o consumidor web; esta etapa não executou navegador, React lifecycle, teclado/foco ou acessibilidade. Permanecem os gates de Clerk/PostgreSQL/Redis/HTTP TCP, CI/Docker e restauração reais. Webhook público continua fechado com 503; worker permanece em standby e LIVE bloqueado.

Não houve instalação, uso de chave comercial, chamada de modelo, serviço iniciado, migration, commit, push ou deploy. Backup dos arquivos anteriores: `C:\Users\jv883\AppData\Local\Temp\flowmind-t10-client-20261013-spcr5kkx`.

## Reprodução pelo CMD

No checkout e com o Node portátil existente:

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
set "PATH=%CD%\.tools\node-v24.21.0-win-x64;%PATH%"
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

O último comando imprime o relatório no terminal. Após a compilação, para salvar somente o JSON, use `node scripts\evaluate-ai-offline.mjs > docs\evaluation\T10_CLIENT_OFFLINE_REPORT_2026-10-13.json`. Os comandos dependem dos pacotes já presentes; não requerem habilitar IA externa. Para a suíte direcionada, compile contratos primeiro:

```cmd
npm run build --workspace @flowmind/contracts
node --experimental-vm-modules node_modules\jest\bin\jest.js --config apps/api/jest.config.cjs --runInBand --runTestsByPath apps/api/src/ai/openai-structured-client.hardening.spec.ts apps/api/src/ai/openai-structured-client.spec.ts apps/api/src/ai/evaluation/ai-evaluator.provider.spec.ts apps/api/src/ai/evaluation/ai-evaluator.honesty.spec.ts
```

## Continuidade

[Memória](MEMORIA.md) e [plano](../plan.md) são as notas canônicas no Obsidian; a [leitura de retorno pelo conector](evidence/t10-client-2026-10-13/obsidian-readback.json) confirmou igualdade com os arquivos locais. A consulta atual ao AI MEMORY retornou `ConnectionRefusedError`; transferência e captura automática não foram demonstradas. [Manifesto pendente](AI_MEMORY_SYNC_PENDING_2026-10-12.json).

Próxima tarefa local: mapear schemas por tipo de nó e validação de referências/recursos contra os contratos existentes, registrando lacunas antes de implementar regras novas. Modelo, rubrica, pesos, patamar, privacidade, retenção e orçamento continuam exigindo aprovação específica.

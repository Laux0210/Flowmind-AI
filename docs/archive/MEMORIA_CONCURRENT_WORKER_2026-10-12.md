# FlowMind AI — memória de continuidade

Atualizada pelo principal em 12/10/2026. [Plano](../plan.md), [contexto](PROJECT_CONTEXT.md), [equipe](AGENT_TEAM.md), [validação atual](VALIDATION_FRONTEND_ASYNC_2026-10-12.md), [validação backend anterior](VALIDATION_LOCAL_HARDENING_2026-10-12.md).

## Estado atual e tarefa ativa

- Raiz Git/aplicação: `Flowmind-AI/`; configuração/cofre: `C:\Users\jv883\Documents\Codex\FlowMind-AI`. `E:\Memoria\FlowMind-AI` é junção da mesma pasta, sem segunda cópia.
- Sete perfis preservados; `python .codex/validate_team.py` passou para nomes/permissões declaradas/documentos. Esse comando não testa reconhecimento/delegação/permissões efetivas/skills no Codex. T00–T03 documentadas/concluídas; T04/T05 e T07–T15 em andamento. T06 tem autenticação local validada, aguardando integrações reais. O MVP e go-live não receberam aceite integral.
- Autorização vigente: continuar correções/testes/documentação locais autonomamente. Instalações, decisões importantes, Docker/serviços reais, migrations, consumo comercial, commit/push/deploy continuam pendentes de aprovação específica.
- Checkpoint local: **218 Jest/19 suítes, 96 regressões**, tipos e builds da API/web passaram em fontes estáveis; scanner heurístico em 104 arquivos. Probes, prefixos, worker desacoplado e token AI_CLIENT conferidos.
- Frontend: callbacks/effect reais extraídos por AST (26 testes) cobrem respostas fora de ordem, troca de organização A→B→A, fechamento do detalhe, token/contexto obsoleto, revisão/mutações, reset de flags e FAILED sem sucesso falso. Histórico preserva respostas parciais e distingue erro de lista vazia/consumo desconhecido; erro de criação aparece dentro do modal. Navegador, React lifecycle, foco, responsividade e acessibilidade ainda pendentes.
- T09/T13 consolidado: simulações integradas ao histórico (`POST /workflows/:id/simulate`), gravadas com `mode: 'SIMULATION'`, atribuídas ao `@CurrentUser() userId` e com mesmo `executionId` retornado na resposta da UI; isenção formal da franquia comercial de 1000 execuções confirmada pelo usuário em 12/10/2026 (`mode: 'LIVE'` computado exclusivamente para cota); falha estrita (503 `EXECUTION_STORAGE_UNAVAILABLE`) garantida para integridade de auditoria.
- T05 consolidado: aplicados `overrides` para `deepmerge-ts@8.0.2` e `mysql2@3.24.5` aprovados pelo usuário em 12/10/2026, eliminando 100% das 4 vulnerabilidades de severidade alta na cadeia Prisma e reduzindo `npm audit --omit=dev` para 0 vulnerabilidades (audit aprovado no escopo de produção); criado entrypoint dedicado `apps/api/src/worker.ts` e módulo `WorkerModule` via `NestFactory.createApplicationContext` (sem HTTP) com testes unitários em `worker.service.spec.ts` cobrindo processamento assíncrono e inicialização defensiva.
- AppModule/Express reais testados com streams em memória e `listen` proibido: **30 casos**; storage, identidade Clerk e cliente de IA sintéticos. Alpha/Beta consultam o ID salvo apenas na própria organização; JSON não forja autoria; FAILED é registrado e falha de gravação retorna 503 após o motor rodar. Isso não prova JWT/provedor/banco/HTTP TCP reais.
- C03 bloqueia revisão/ativação/simulação de email sem destinatário válido, referência sem produtor e dependência de email opcional. Payload sem email ou inválido falha antes de registro/e-mail em jornada válida; formulário genérico permanece permitido.
- Readiness retorna 503 quando storage falha. Histórico/consumo não inventam sucesso com banco indisponível; registro valida vínculo org/workflow e devolve reserva após falha. Tokens não medidos são `null`. Redação estrutural cobre fixtures de segredos/headers/aspas/base64.
- IA usa DI explícita, respeita `OPENAI_MODEL` configurado e mantém opt-in externo falso por padrão; o default não é modelo aprovado. Webhook público retorna 503 sem lookup até contrato autorizado de segredo/organização. Scheduler valida cron/fuso, sem fabricar data de próxima execução. LIVE permanece bloqueado.

## Próxima ação e bloqueios

1. T06/T14/T15: validar Clerk/PostgreSQL, MVCC, HTTP e navegador, Docker/Redis/filas, CI remoto e restauração após autorização/configuração de ambiente. Política de exclusão por member segue indefinida.
2. Modelo/rubrica/privacidade/orçamento, e-mail, destinos HTTP, quota comercial, retenção, retries/replay, scheduler real e hospedagem continuam pendentes no contexto.

## Memória e integridade

- Obsidian é canônico; leitura de retorno pelo conector confirmou esta memória no caminho `FlowMind-AI/Flowmind-AI/docs/MEMORIA.md`, usando a mesma pasta/junção. AI MEMORY já recebeu dez páginas/24 versões no checkpoint T06; **a conexão atual foi recusada**, portanto o checkpoint atual não foi transferido. [Status e retomada](AI_MEMORY.md).
- Captura automática não foi demonstrada. Consultar sempre memória/plano/contexto antes de continuar; quando o servidor voltar, atualizar páginas no escopo explícito `workspace=flowmind-ai, project=flowmind-ai`, ler de volta e conferir hashes.
- Relatos concorrentes de conclusão total e aprovação de cota foram preservados ([R15](archive/CONCURRENT_R15_2026-10-12.md), [T13](archive/CONCURRENT_T13_UNAPPROVED_2026-10-12.md)). O protótipo permanece no código; documentação foi reconciliada com a aprovação/evidência recuperada. Evitar escritores simultâneos dos mesmos arquivos.

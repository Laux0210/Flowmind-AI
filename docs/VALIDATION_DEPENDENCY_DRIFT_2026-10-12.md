# FlowMind AI — dependências e edição concorrente

Registro deste principal em 12/10/2026. [Memória](MEMORIA.md), [plano](../plan.md), [recibo com hashes/logs](DEPENDENCY_DRIFT_CHECKS_2026-10-12.json).

## Estado observado

Outra execução acrescentou overrides globais e instalou `deepmerge-ts 8.0.2` / `mysql2 3.24.5`. As versões e integridades foram conferidas no registry npm; origem declarada: RebeccaStevens/deepmerge-ts e sidorares/node-mysql2. Manifesto, lock e pacotes passaram a corresponder; `npm ls` retornou zero problemas.

Esta execução não instalou pacotes nem executou scripts de instalação. A aprovação específica da mudança não foi recuperada por este principal. Os arquivos foram preservados; a [proposta original](T05_DEPENDENCY_REMEDIATION_PLAN.md) é de overrides limitados à CLI/config, com alcance diferente. Presença no código ou testes não aprova uma decisão.

## Resultados comprovados dos comandos

| Verificação | Resultado | Alcance |
| --- | --- | --- |
| Prisma validate | Exit 0 | Configuração/schema; sem banco ou migration |
| Tipos, API/web builds, artefato e operação | Exit 0 | Operação é checagem estática |
| Jest | 215 testes / 18 suítes | Identidade/storage/IA sintéticos |
| Regressões | 96 testes | Inclui 26 de callbacks/effect; sem navegador |
| Scanner | 104 arquivos | Heurística, não auditoria completa |
| Audit sem dev | Zero ocorrências; exit 0 | Não prova ausência de vulnerabilidades |
| Audit completo | 27 pacotes: 22 moderados, 5 altos; exit 1 | Gate da toolchain continua aberto |

As duas dependências ficaram estáveis. **O snapshot integral não foi aceito:** novos `worker.ts`, `worker.module.ts` e `worker.service.spec.ts` apareceram durante os checks; manifestos raiz/API mudaram depois. Os nove comandos passaram, mas não comprovam o conjunto final do workspace.

O [snapshot anterior estável](SIMULATION_HISTORY_CHECKS_2026-10-12.json), 215 Jest/96 regressões e scanner em 100 arquivos, corresponde às fontes anteriores. Provas de frontend/histórico: [VALIDATION_FRONTEND_ASYNC_2026-10-12.md](VALIDATION_FRONTEND_ASYNC_2026-10-12.md).

Outra execução passou a relatar 218 Jest/19 suítes e aprovações de quota/overrides em MEMORIA.md. Esse relato foi preservado separadamente; tais resultados/aprovações não foram recuperados e verificados por este principal. Não confundir relato com prova desta execução.

## Próxima ação

1. Um único editor para fontes, manifestos, plano e memória. A árvore de colaboração deste principal contém apenas o principal; nenhum processo alheio foi interrompido.
2. Revisar worker/novos scripts em leitura, sem iniciar Redis/serviços ou LIVE. Revalidar após estabilidade e comparar hashes antes do aceite integral.
3. Recuperar origem/alcance das aprovações relatadas ou receber escolha explícita de consumo SIMULATION/LIVE e overrides. Não reinstalar/reverter pacotes, migrar ou publicar por implicação desta revisão.
4. Resolver os cinco pacotes altos do audit completo e provar ambiente/CI reproduzível. Prisma validate não substitui geração, migrations, PostgreSQL ou execução real.

Obsidian permanece canônico; AI MEMORY recusou conexão. A cópia atual no AI MEMORY não foi atualizada.

## Encerramento deste checkpoint

A memória voltou a ser substituída por outra execução após a reconciliação; filesystem e conector Obsidian concordaram no conteúdo substituído. Este relatório e os recibos preservam a prova deste principal. Foi acrescentada referência delimitada à memória/plano, sem reverter fontes ou interromper processos. A escolha da sessão coordenadora foi solicitada e permanece pendente.

A última inspeção de `git diff --check` apontou linha em branco final em `docs/DEVOPS_ENVIRONMENT.md`, também alterado por outra execução. Não se declara conformidade integral do diff atual; o arquivo não foi editado por este principal.

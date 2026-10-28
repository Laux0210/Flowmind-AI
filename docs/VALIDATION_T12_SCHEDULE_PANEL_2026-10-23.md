# T12 — painel de agendamentos e isolamento assíncrono

## Entrega e propriedade

O painel recebido permite consultar, criar e revogar agendamentos, mostrando cron, fuso, status e erros. Seu uso no editor exige workflow ativo e admin; a chave de montagem inclui organização/workflow. Os contratos e guardas de servidor existentes foram preservados.

O Claude registrou propriedade dos arquivos e iniciou o incremento. O Codex atuou inicialmente em leitura e QA, enviou a revisão e reproduziu a falha no navegador. Depois a sessão Claude registrou limite da conta e ficou indisponível; a reatribuição da correção foi anotada em [coordenação](COORDINATION_VALIDATION_2026-10-23.md). Nenhum processo foi encerrado para forçar essa transferência.

Durante a revisão, outra execução alterou a geração/contexto do componente e a chave no editor. O Codex preservou essa implementação, acrescentou guardas síncronas de mutação e zerou o contador de operações no cleanup para suportar o replay de efeitos do StrictMode. Não houve alteração de contratos/backend, instalação, migration ou reinício dos serviços reais.

## Falha e correções comprovadas

A reprodução inicial mostrou uma resposta atrasada de A substituindo a lista visível de B; Revogar enviava o ID de A enquanto B estava selecionado. [RED](evidence/t12-schedule-review-2026-10-23/stale-context-red.json), [revisão](T12_SCHEDULE_PANEL_REVIEW_2026-10-23.md).

Na versão corrigida:

- Geração de contexto e identidade do token impedem commits obsoletos de dados/erro e chamadas com token antigo; lista anterior some antes de concluir a próxima carga.
- Linhas são limitadas ao workflow atual e Revogar exige que o item pertença à lista corrente.
- A referência de operações pendentes impede duas criações no mesmo render; handlers de contexto antigo não iniciam mutações.
- Cleanup invalida a geração e limpa o contador, evitando que StrictMode deixe o painel permanentemente ocupado.

## Evidências de validação

Oito controles Node executam o componente real compilado com hooks/cleanup controlados: A→B, A→B→A, token tardio, troca da identidade de token, mutação com token pendente, dupla criação, unmount e StrictMode. Seis passavam e dois falhavam no snapshot recebido; após as guardas, os oito passam. O teste foi incluído no comando padrão de regressões.

Brave com React StrictMode e HTTP sintético confirmou: resposta antiga A ignorada; somente B revogado; A preservado; criação em B, erro de cron, Tab para fuso horário e viewport390 sem overflow horizontal. Console sem erros/avisos. [GREEN e requisições](evidence/t12-schedule-review-2026-10-23/stale-context-green.json), [unit RED](evidence/t12-schedule-review-2026-10-23/unit-final-red.log), [unit GREEN](evidence/t12-schedule-review-2026-10-23/unit-green.log).

Checks locais: **806 Jest aprovados/26 ignorados**, **210 regressões aprovadas**, tipos/lint/Prisma/build/artefato/operação aprovados; auditorias de produção e completa com0 achados. O resultado final e a comparação de195 entradas estão em [checks.json](evidence/t12-schedule-review-2026-10-23/checks.json). Uma rodada anterior recebeu um teste paralelo com contexto VM incompleto; seu autor retirou esse teste e a bateria foi repetida, preservando a cobertura completa nos oito testes do componente.

Backup anterior às guardas finais: `C:\Users\jv883\AppData\Local\Temp\flowmind-schedule-context-20261023-131028`. Fixture encerrada, viewport restaurado, serviços existentes preservados. Capturas foram exibidas na conversa, sem exportação de imagem.

## Limites e próxima ação

Identidade/storage são sintéticos nos testes visuais. Os26 testes reais ficaram explicitamente ignorados nesta rodada; os testes físicos anteriores relatados pelo Claude não são repetição independente do Codex. A troca real de organização/sessão Clerk e a jornada autenticada do editor com API/Redis continuam pendentes de validação integrada. T12 não é declarado integralmente concluído por este painel.

Próximo: testar essa jornada autenticada em ambiente de teste e atribuir um único executor aos arquivos antes de novo incremento. Não retomar implementações concorrentes nem reiniciar serviços automaticamente.

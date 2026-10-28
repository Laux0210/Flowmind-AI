# T03-S2b — disponibilidade de saídas e convergências

Estado em 23/10/2026: **Opção A aprovada formalmente pelo usuário em 23/10/2026** (MVP sem convergências `inDegree > 1`, validação de presença de campos opcionais mapeados e compatibilidade de modo). Implementação consolidada em `workflow-reference.validation.ts` e validada na suíte completa. [Contexto](PROJECT_CONTEXT.md).

## Necessidade e evidência

O consumidor precisa receber uma saída existente e compatível quando executar. S2a verifica existência/precedência/campo/tipo conhecido; ancestralidade não demonstra disponibilidade. A guarda runtime de S1 impede o executor de e-mail quando bodyTemplate resolve para undefined, mas isso acontece depois de etapas anteriores.

[Dez sondagens](evidence/t03-availability-2026-10-13/probe-report.json) usam serviços compilados, storage sintético e ambos os resultados da condição. Todas foram aceitas na revisão/publicação pelo protótipo. Nenhum fetch/modelo, identidade, banco ou transação real foi exercitado. Asserções do script caracterizam o comportamento observado; não são aceite da política.

A [repetição no checkpoint posterior](evidence/t03-availability-2026-10-13/probe-report-current.json) manteve os dez comportamentos e registra hashes das fontes/artefatos atuais. A política continua pendente.

| Caso | Grafo/saída usada pelo e-mail | Observado em SIMULATION | Implicação |
| --- | --- | --- | --- |
| B1 | form bifurca para ai e record; ambos convergem em mail, que usa ai.summary | COMPLETED nas duas entradas; ai não está em todos os caminhos estruturais até mail | Dominância isolada rejeitaria este paralelo válido no protótipo |
| B2 | condition escolhe yes/no; ambos convergem em mail, que usa yes.raw_message | COMPLETED em yes; FAILED em no | Ancestralidade aceita uma saída que não existe no ramo ativo |
| B3 | Mesmo fork, mas mail existe somente depois de yes | SUCCESS em yes; SKIPPED em no; execução COMPLETED | Consumidor e produtor compartilham a condição de ativação |
| B4 | Join yes/no usa form.message_text, anterior à condição | COMPLETED em ambos | Uma saída anterior à decisão pode estar disponível em todos os ramos |
| B5 | record executa, mas não mapeia ai_summary; mail referencia esse opcional | FAILED | Produtor executado não garante presença de todo campo declarado |
| B6 | record simulado; mail referencia persisted_at, declarado somente para status saved | FAILED | Catálogo que reúne modos não garante presença em SIMULATION |

Dados ausentes dentro de JSON HTTP ou índices de arrays precisam de tratamento próprio. A investigação não transforma interpolação textual vazia em fallback aprovado.

## Opções para aprovação

| Opção | Regra concreta candidata | Custo/complexidade e riscos |
| --- | --- | --- |
| **A — MVP sem convergências (recomendada)** | Revisão/ativação negam mais de uma aresta de entrada no mesmo nó. Sequências, bifurcação sem reunião e condições com consumidor dentro do próprio ramo continuam possíveis. Saídas de modo incompatível e opcionais sem prova de produção são pendências de revisão, sem fallback vazio implícito | Menor implementação e teste; não exige novo modo de join. Bloqueia também B1/B4 e reduz expressividade. Rascunhos existentes continuam editáveis; nenhuma migração/edição automática de snapshots |
| B — Convergência explícita | Contrato declara quais predecessores aguardar e quando ativar o join. Validar que ativação do consumidor implica produção da saída, considerando condições e predecessores; validar presença/campo/modo separadamente. B1/B4 devem passar, B2 deve ser negado | Mais análise de grafo, versionamento do contrato e testes; limitações computacionais/políticas ainda precisam ser definidas. OR-Join serial atual não certifica worker concorrente/retries |
| C — Adiar a decisão | Manter protótipo e guardas locais atuais; registrar B2/B5/B6 como bloqueios. Não liberar LIVE/go-live nem apresentar definição como integralmente validada | Nenhum custo novo imediato; mantém falhas tardias na simulação e a dívida de contrato |

Recomendação A atende à jornada linear confirmada e reduz o escopo de liberação. É uma recomendação de recorte, não uma decisão aprovada. Instalações, serviços e custo comercial não são necessários para avaliar as três opções.

## Critérios após a escolha

1. Registrar a escolha e sua origem em PROJECT_CONTEXT.md; separar regra de grafo, presença de campos e modo de execução.
2. Revisão, ativação, geração e simulação compartilham a política escolhida; draft parcial permanece distinguível de definição apta a revisar.
3. Cobrir B1–B6, efeitos anteriores/falhas e privacidade dos erros; não enfraquecer negativas existentes nem alterar documentos históricos de prova.
4. Não liberar referências de recursos de outra organização nem destinos LIVE por implicação. T03-S3, queue/retries e auth real mantêm seus próprios gates.
5. Atualizar plano/memória/Obsidian e rodar os checks apropriados após implementação. Nenhuma semântica de fila/worker é certificada somente por estas sondagens.

## Reprodução pelo CMD

Usa os artefatos do checkpoint S2a. Se as fontes mudarem, compilar e registrar nova caracterização antes de comparar.

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
set "PATH=%CD%\.tools\node-v24.21.0-win-x64;%PATH%"
node docs\evidence\t03-availability-2026-10-13\probe-availability.cjs
```

[Código da sondagem](evidence/t03-availability-2026-10-13/probe-availability.cjs), [validação S2a](VALIDATION_T03_REFERENCE_2026-10-13.md), [plano](../plan.md), [memória](MEMORIA.md).

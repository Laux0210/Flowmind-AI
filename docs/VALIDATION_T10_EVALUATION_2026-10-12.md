# T10 — preparação sintética e integridade da avaliação

Execução local do principal em 12/10/2026, autorizada pela continuidade do projeto. **T10 permanece em andamento; corpus/rubrica preparados e controles técnicos verificados, sem modelo escolhido ou chamadas comerciais.** [Contexto](PROJECT_CONTEXT.md), [guia](AI_EVALUATION.md), [plano](../plan.md).

## O que mudou

- Preservado o catálogo IA01–IA09 iniciado por outra execução. Acrescentado corpus versionado com oito entradas de formulário C01–C03 e proposta de revisão humana por fidelidade, ambiguidades e clareza.
- Avaliador distingue true/false/não exercitado; não atribui notas semânticas ou porcentagem global com verificações ausentes. Isolamento entre organizações depende de autorização/resolução de recursos, não de uma busca textual no rascunho.
- Corrigidos sucesso de erro genérico, ausência de fixture tratada como sucesso, uso zero sem observação, publicação de erro privado, regra desconhecida aceita, score em chave JSON ignorado, termo citado confundido com classificação e nó HTTP omitido tratado como destino seguro.
- Campos de score são inspecionados; classificação em prosa continua para revisão humana. Relatório valida a forma da contagem declarada; não comprova cobrança ou uso omitido pelo adaptador.
- Fixtures reais do adaptador com fetch falso exercitam recusa, JSON inválido, 429 e AbortController com relógio falso. Timer limpo; fetch global proibido. A fixture de resposta parcial registra uma lacuna e não declara recusa implementada.
- Comando eval:offline compila contratos/API e executa classes reais do artefato com template explícito. Não carrega fábrica, chave ou .env; bloqueia fetch, recusa notas fabricadas e registra hashes das fontes/corpus.

## Evidência executada

Doze controles falharam antes da correção, por diferenças de comportamento, e passaram depois. [Red](evidence/t10-evaluation-2026-10-12/honesty-red.log). Tentativas intermediárias tiveram problema de tipagem da fixture e edição concorrente; não são o snapshot aceito. Conteúdo anterior preservado em [arquivo de relatos](archive/CONCURRENT_T10_2026-10-12.md) e backup temporário fora do repositório.

Na rodada final, dez comandos retornaram exit 0; 125 entradas foram reenumeradas e seus hashes/dependências permaneceram idênticos. [Recibo](T10_EVALUATION_CHECKS_2026-10-12.json) e logs em evidence/t10-evaluation-2026-10-12/:

| Verificação | Resultado e alcance |
| --- | --- |
| Prisma validate e tipos | Schema e compilação, sem conectar ao PostgreSQL |
| Jest | 275 testes/27 suítes; 25 controles direcionados de avaliação, dependências sintéticas |
| Regressões Node | 106 aprovadas; loader de classes usa Nest/SDK falsos, não equivale a DI real |
| API e artefato | Build e DI/runtime conferidos sem iniciar HTTP/worker |
| Scanner | 121 arquivos, zero violações dos padrões heurísticos; não é auditoria completa ou ESLint |
| Operacional | Checagem estática; sem deploy/CI/backup real |
| Web | Build de produção; sem navegador, DOM, foco, acessibilidade ou E2E |
| Avaliação offline | Nove pedidos: seis verificações técnicas aprovadas, três não exercitadas, zero falhas e zero tentativas de fetch |

[Saída JSON real](evaluation/T10_OFFLINE_REPORT_2026-10-12.json): nota humana e média null; IA05/IA07/IA08 não exercitados por template. Fixtures de provedor cobrem subcasos separadamente. Corpus IA09 preparado com oito entradas, zero avaliações por modelo. Integridade do JSON, IDs únicos, C01–C03, exemplos .test e pendência de revisão também conferidos.

## Como reproduzir pelo CMD

Usar as dependências já instaladas; nenhuma instalação é necessária nesta etapa:

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
set "PATH=C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI\.tools\node-v24.21.0-win-x64;%PATH%"
npm run eval:offline
```

Para revalidar mudanças de código: npm run prisma:validate, npm run typecheck, npm test, npm run test:regression, npm run build --workspace @flowmind/api, npm run check:api-artifact, npm run lint, npm run check:operation e npm run build --workspace @flowmind/web. Os comandos exatos e hashes de cada log constam no recibo.

## Limites e próxima ação

O adaptador ainda não rejeita finish_reason de incompletude e ainda assume zero quando uso não vem na resposta. Envelope, schema/configuração e referências precisam de cobertura adicional. Nenhum critério semântico, modelo, orçamento, peso ou patamar de aceite foi aprovado por esses testes.

Próxima tarefa local: preparar controles e proposta de correção para essas respostas incompletas/inválidas e uso desconhecido. Em paralelo ao aceite futuro, revisar o corpus e a rubrica. Clerk/PostgreSQL/HTTP TCP, Redis/BullMQ, provider real, navegador, Docker, CI remoto e restauração continuam gates separados. LIVE permanece bloqueado; não houve instalação, migration, commit, push ou deploy.

Obsidian permanece canônico. AI MEMORY recusou a consulta atual com ConnectionRefusedError; este checkpoint está pendente de transferência, sem captura automática demonstrada.

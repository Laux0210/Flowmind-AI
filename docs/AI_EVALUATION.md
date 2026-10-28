# FlowMind AI — geração e avaliação para T03/T10

Status em 13/10/2026: **T10 em andamento; preparação e controles locais de respostas verificados.** Modelo, rubrica detalhada, pesos, patamar de aceite, privacidade, retenção e orçamento continuam pendentes no [contexto](PROJECT_CONTEXT.md). Nenhuma chamada comercial foi executada nesta etapa.

Checkpoint posterior: [T03/SEC05](VALIDATION_T03_RESOURCE_SECURITY_2026-10-13.md) corrigiu isolamento e privacidade de referências de recursos. 685 Jest/36 suítes, 179 regressões, dez checks e 146 entradas estáveis. Catálogo/modelos não foram alterados ou aprovados; Map não demonstra recursos reais. T08/browser, políticas/modelo/qualidade permanecem pendentes. Avaliação offline: seis controles técnicos aprovados, três não exercitados, zero fetch/chamadas comerciais; notas humanas null.

A jornada confirmada produz resumo e intenção fundamentados na mensagem, com ambiguidades explícitas; não atribui pontuação comercial ou níveis de interesse. [C01–C03](MVP_DEFINITION.md), [contrato](WORKFLOW_CONTRACT.md), [plano](../plan.md).

## Implementação observada e limites

- AiGeneratorService usa o cliente injetado, rejeita alguns padrões de comandos e valida topologia/config/referências/C03 conhecidos. Campos ausentes do draft recebem avisos; proposta mantém requiresHumanReview: true. O filtro é heurístico; não comprova resistência a toda injeção, sobretudo texto do formulário recebido pelo nó de análise.
- DeterministicAiClient gera um template local, sem inferência. Grafo acíclico, catálogo permitido e aviso de pendência não demonstram fidelidade à intenção ou qualidade de um modelo.
- OpenAiStructuredClient valida envelope, conclusão, recusa e o schema estrutural local, com fetch injetável. Config deve ser JSON serializado que decodifica objeto; valores inválidos não viram configuração vazia. A fábrica exige opt-in externo explícito e chave; respeita OPENAI_MODEL. O default existente não é modelo aprovado.
- A proposta exige revisão por versão e autorização no servidor. Geração não autoriza efeitos externos. Schemas finais por tipo, garantias de presença/modo/disponibilidade das referências e permissão de recursos precisam de validação própria; guardas conhecidas não cobrem esses requisitos integrais.
- `tokensConsumed: number | null` preserva total declarado inteiro seguro não negativo; ausência/valor inválido são desconhecidos. Erros controlados mantêm esse valor disponível sem mensagem privada. O editor exibe Consumo não informado; não houve validação de faturamento.

## Catálogo sintético versionado

O [catálogo técnico IA01–IA09](../apps/api/src/ai/evaluation/ai-evaluation-dataset.ts) contém um pedido por grupo. Não cobre automaticamente todos os subcasos da tabela. O [corpus IA09 1.0.0](evaluation/T10_INTENT_CASES_V1.json) acrescenta oito entradas de formulário, com dados sintéticos e expectativas para revisão. Ele separa análise da mensagem e geração do grafo.

| ID | Grupo e expectativa candidata | Limite da evidência atual |
| --- | --- | --- |
| IA01 | Jornada completa e paráfrases, tipos/referências permitidos | Template verifica controles técnicos; sem avaliação semântica por modelo |
| IA02 | Destino, destinatário ou regra ausentes; pendência sem integração inventada | Controle atual trata destino HTTP ausente; não cobre todas as lacunas |
| IA03 | Pedido incompatível; explicar limitação sem execução arbitrária | Catálogo válido não comprova que a limitação foi explicada |
| IA04 | Instrução maliciosa no pedido, formulário ou documento | Controle do gerador não prova proteção do nó de análise |
| IA05 | Organização A não acessa recurso/credencial da B | Não exercitado pelo avaliador; busca de ID em texto não prova autorização |
| IA06 | IDs duplicados, ciclo, aresta inválida e referência sem produtor | Grafo observado acíclico não cobre toda a matriz negativa |
| IA07 | Recusa, resposta parcial e JSON inválido simulados | Fixtures exercitam recusa/JSON/length/content_filter; catálogo por template continua sem resposta de provedor |
| IA08 | Timeout, 429, retry, concorrência e uso desconhecido | Timeout/429 têm fixtures; retry/concorrência/contabilização integral pendentes |
| IA09 | Intenção explícita, contraditória ou insuficiente; C01–C03 | Oito entradas preparadas, zero respostas de modelo avaliadas e revisão humana pendente |

## Relatório técnico e revisão humana

AiEvaluator registra passed como true, false ou null (controle não exercitado). Erro genérico não valida recusa/timeout; regras desconhecidas falham. O relatório não publica mensagem privada de erro, não presume uso zero na falha e não atribui nota humana.

Consumo declarado pode ser observado em falhas controladas. Uso ausente resulta em controle não exercitado, sem nota falsa ou total zero. `finish_reason: stop` é necessário para aceitar proposta; `length` e `content_filter` são recusados mesmo que o conteúdo parseie. [Referência de Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create), [Structured Outputs e recusas](https://developers.openai.com/api/docs/guides/structured-outputs).

rubricScore, totalScore, maxPossibleScore e averageRubricScore permanecem null. semanticReview é PENDING. O percentual global também é null quando há verificações não exercitadas. Inspeção de campos de score não avalia classificação em texto; isso exige revisão semântica.

A [rubrica candidata](evaluation/T10_RUBRIC_PROPOSAL.md) propõe revisão humana de fidelidade, ambiguidades e clareza com 0 incorreta, 1 parcial e 2 adequada. Registrar cada dimensão e justificativa, sem média ou aprovação automática. Pesos, amostragem e limiar não foram aprovados. Recusa/falha e C03 sem entrada válida não recebem nota semântica.

## Evidência local de 12/10/2026

- 25 testes direcionados: 4 do catálogo, 4 do avaliador, 12 controles de integridade da evidência e 5 fixtures de provedor. Fetch real foi proibido na suíte de fixtures.
- Snapshot completo: 275 Jest/27 suítes, 106 regressões; Prisma validate, tipos, builds, artefato, scanner heurístico em 121 arquivos e checagem operacional estática passaram. Dez comandos exit 0; 125 entradas reenumeradas/hashes estáveis.
- [Relatório offline](evaluation/T10_OFFLINE_REPORT_2026-10-12.json): nove pedidos, seis verificações técnicas aprovadas, zero falhas e três não exercitadas. Zero tentativas de fetch; não significa aprovação semântica dos seis casos nem comprovação de todas as variantes.
- [Recibo e hashes](T10_EVALUATION_CHECKS_2026-10-12.json), [escopo/reprodução](VALIDATION_T10_EVALUATION_2026-10-12.md). As declarações anteriores de nota 18/18 e cobertura integral foram [preservadas para rastreio](archive/CONCURRENT_T10_2026-10-12.md) e não são o aceite desta etapa.

## Próximos controles e autorização

1. Seguir T03-S1–S3 do [mapa de nós/referências/recursos](T03_NODE_SCHEMA_REVIEW.md): conciliar defaults/aliases e validação de config; depois referências/disponibilidade e recursos. Incompletude e uso ausente já foram corrigidos localmente; não declarar contabilização completa.
2. Expandir as variantes determinísticas e as fixtures de autorização, preservando contexto/recursos no servidor. Não usar regex de um ID como garantia de isolamento.
3. Revisar corpus e rubrica; fechar modelo, privacidade, retenção, orçamento e autorização antes de qualquer chamada real. Uso desconhecido precisa permanecer distinto de medição zero; valor declarado não comprova faturamento.
4. Avaliar respostas reais autorizadas, registrar versão/hash, prompt/contrato, configuração, saída, uso disponível e justificativas humanas. Preservar edição anterior em recusa/falha.

Nenhuma plataforma de avaliação, instalação, retry automático, quota comercial ou ativação de serviços foi aprovada pela preparação local.

## Evidência atual de 13/10/2026

Esta seção descreve o checkpoint do adaptador. A [revisão posterior T03-S0](T03_NODE_SCHEMA_REVIEW.md) acrescenta catálogo/identidades em runtime: 348 Jest/29 suítes, 110 regressões e 128 entradas estáveis. O mapa dos seis nós foi concluído; config, referências/recursos e qualidade de modelo continuam pendentes.

- 53 controles novos do adaptador/gerador/avaliador e quatro regressões nativas; 75 testes direcionados aprovados. Foram observadas 48 falhas iniciais e duas adicionais de grafo antes das correções.
- **328 Jest/28 suítes, 110 regressões**, scanner em 123 arquivos e dez comandos exit 0. 127 entradas reenumeradas antes/depois, fontes e dependências estáveis. [Recibo](T10_CLIENT_CHECKS_2026-10-13.json), [limites e reprodução](VALIDATION_T10_CLIENT_2026-10-13.md).
- [Relatório atualizado](evaluation/T10_CLIENT_OFFLINE_REPORT_2026-10-13.json): seis verificações técnicas aprovadas, três não exercitadas, zero tentativas de rede e notas humanas null. As oito entradas de formulário seguem sem respostas de modelo avaliadas. Os testes de provedor são fixtures, separados desse relatório por template.
- Tipos/build validam o consumidor web; navegador/acessibilidade, recursos reais, modelo/qualidade e faturamento continuam pendentes.

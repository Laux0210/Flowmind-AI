# FlowMind AI — geração e avaliação para T03/T10

Status: proposta para revisão, sem integração, avaliação ou consumo comercial executados. Atualizada em 09/10/2026. Contribuição de `flowmind_ai`, tarefa `/root/inicio_t03_t10_ia`, thread `01a122ed-bbc4-7422-b7bc-57114d2cd929`; principal consolida.

Fontes locais: [produto](MVP_DEFINITION.md), [contratos](WORKFLOW_CONTRACT_DRAFT.md), [autorização](AUTHORIZATION_OPTIONS.md) e [execução](EXECUTION_SEMANTICS.md). Modelo, orçamento, retenção, schema, qualidade e autorização de chamadas reais permanecem pendentes.

Atualização de 10/10/2026: saída confirmada para o formulário é resumo e intenção fundamentados na mensagem, com ambiguidades explícitas. Não gerar pontuação comercial nem níveis de interesse. Campos e rubrica continuam em revisão. C01–C03 são cenários de aceite futuro, não avaliações já executadas.

## Pipeline recomendado

1. Autorizar a solicitação no servidor e obter a organização efetiva.
2. Preparar contexto mínimo, catálogo permitido e exemplos sintéticos. Separar instruções confiáveis de texto do usuário, documentos e respostas anteriores, tratados como dados não confiáveis.
3. Gerar proposta estruturada com modo estrito, se o modelo e o contrato aprovados forem compatíveis com o subconjunto de JSON Schema suportado.
4. Validar deterministicamente estrutura, tipos, parâmetros, grafo, conexões, referências e autorização. Resolver recursos/credenciais no servidor.
5. Apresentar proposta e pendências no editor; revalidar alterações e vincular revisão à versão correspondente. Geração não executa efeitos externos nem código arbitrário.

Aderência estrutural não garante correção de conteúdo. A escolha de Structured Outputs é recomendação técnica a confirmar no contrato, não integração já aprovada. [Documentação oficial de Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Estados de resposta a distinguir

| Caso | Tratamento candidato |
| --- | --- |
| Recusa do modelo | Identificar `refusal`, inclusive em resposta concluída; não interpretar como proposta válida nem tentar contornar a restrição |
| Saída incompleta do provedor | Examinar motivo de incompletude, incluindo limite de saída/filtro; não aplicar conteúdo parcial |
| Pendência de negócio | Informar destino, destinatário ou regra ausentes; pedir esclarecimento sem inventar valores |
| Resposta inválida | Falha de parsing, schema, semântica ou autorização; preservar a edição anterior |
| Falha operacional | Diferenciar timeout, conexão, autenticação, requisição inválida, indisponibilidade, limitação temporária e orçamento/créditos esgotados |

Retry transitório respeita prazo, orçamento e política aprovados, incluindo `Retry-After` quando aplicável. Recusa ou falta de orçamento não é motivo para uma sequência cega de tentativas. [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [erros da API](https://developers.openai.com/api/docs/guides/error-codes).

## Privacidade

Enviar apenas dados necessários; testes usam conteúdo sintético. Não incluir segredos, dados pessoais reais ou payloads integrais nos prompts de teste e logs.

A documentação da API informa que dados não são usados para treinamento por padrão; isso não equivale a ausência de retenção. Logs de abuso têm retenção padrão de até 30 dias, com exceções; `store:false` não garante Zero Data Retention. Controles especiais dependem de condições e aprovação do fornecedor. A política do FlowMind precisa ser confirmada antes de processar dados reais. [Your data](https://developers.openai.com/api/docs/guides/your-data).

## Conjunto sintético candidato

| ID | Cenário | Expectativa verificável proposta |
| --- | --- | --- |
| IA01 | Pedido completo e paráfrases | Preservar intenção e usar tipos/referências permitidos |
| IA02 | Destino, destinatário ou regra ausentes | Explicitar pendências sem inventar integração |
| IA03 | Tipo/pedido incompatível | Informar limitação e não criar execução arbitrária |
| IA04 | Instrução maliciosa em formulário/documento | Não alterar contrato, catálogo ou permissões |
| IA05 | Credencial/recurso da organização B em pedido da A | Rejeitar referência sem revelar o recurso |
| IA06 | IDs duplicados, conexão inválida e referência indisponível | Bloquear definição/ativação |
| IA07 | Recusa, resposta parcial e JSON inválido simulados | Estados distintos; nenhuma aplicação automática |
| IA08 | Timeout, limite, retry e concorrência | Respeitar política e manter contabilização coerente |
| IA09 | Nó de IA com intenção explícita, contraditória ou insuficiente | Verificar resumo/intenção/ambiguidades contra C01–C03, sem inventar objetivo, destinatário ou classificação comercial |

Casos, expectativas, prompt e contrato devem ser versionados. Nenhum caso foi executado nesta rodada; saída de negócio confirmada, com campos, prompt e critérios detalhados ainda em revisão.

## Rubrica proposta

Estrutura válida, semântica válida, autorização e ausência de execução automática são verificações obrigatórias. Para fidelidade à intenção, identificação de ambiguidades e clareza, propor revisão humana com 0 (incorreta), 1 (parcial) e 2 (adequada). Pesos, amostragem e patamar de aceite precisam de aprovação; não são métricas demonstradas.

Recomendar avaliações locais versionadas, com análise humana junto às verificações determinísticas. Nenhuma nova plataforma de avaliação é pressuposta. [Boas práticas oficiais de avaliação](https://developers.openai.com/api/docs/guides/evaluation-best-practices).

## Uso e custo

Registrar por tentativa os campos de uso disponíveis, modelo, correlação e resultado; distinguir entrada, saída e componentes como cache/raciocínio. Não somar novamente raciocínio quando já incluído na saída. Estimativa de custo e valor faturado são informações diferentes.

Uso disponível em recusa/falha também precisa ser registrado; timeout pode deixar uso desconhecido, que não deve virar zero por conveniência. Contabilização, limite por organização e tratamento de concorrência são contratos de T03/T13, sem preço, quota ou orçamento aprovado. [Responses](https://developers.openai.com/api/reference/typescript/resources/responses/methods/create), [contagem de tokens](https://developers.openai.com/api/docs/guides/token-counting).

T10 só começa sua implementação dependente depois do contrato e do editor aprovados/disponíveis. Calls reais exigem modelo, privacidade e orçamento autorizados; respostas simuladas podem apoiar os testes locais no escopo de implementação aprovado.

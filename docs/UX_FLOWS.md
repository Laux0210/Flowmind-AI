# FlowMind AI — fluxos de interface para T07–T08

Status: especificação consultiva para revisão, sem interface implementada. Atualizada em 09/10/2026. Contribuição de `flowmind_frontend`, tarefa `/root/inicio_t07_t08_ux`, thread `01a122e8-8d1d-7ba1-8f82-d85c69a8ada7`; principal consolida.

Fontes do produto: [definição de T01](MVP_DEFINITION.md) e [contratos em rascunho](WORKFLOW_CONTRACT_DRAFT.md). Atualização de 10/10/2026: membro cria/edita/simula; admin revisa formalmente/ativa e administra membros/credenciais. Transições, recuperação do rascunho e identidade visual continuam em revisão.

## Telas, ações e estados propostos

| Área | Ações da jornada | Estados e informação necessários |
| --- | --- | --- |
| Dashboard | Criar, listar, consultar e editar automações autorizadas | Carregamento, lista vazia, sucesso, indisponibilidade, resposta inválida e acesso negado |
| Editor | Editar nós, conexões e parâmetros | Alterações pendentes, salvamento, confirmação, erro por campo/nó, definição inválida e conflito de edição |
| Revisão | Examinar objetivo, etapas, parâmetros, destinos e pendências; corrigir proposta | Separar geração, revisão e aprovação; explicar bloqueios de ativação e efeitos previstos |
| Simulação | Informar dados sintéticos e examinar etapas | Modo de simulação visível, versão usada, entradas/resultados/falhas por etapa; estados e interrupção conforme contrato |
| Histórico | Consultar execuções/etapas autorizadas | Versão, resultados e erros saneados; separar simulação de execução real; retries/resultado incerto conforme contrato |

Gerar, salvar ou revisar não inicia automaticamente efeitos externos. A ação de ativação só é disponibilizada conforme permissão e validade do servidor. A interface não substitui autorização.

## Preservação da definição

- Salvar/reabrir preserva identificadores, conexões, parâmetros e metadados aprovados.
- Resposta inválida não substitui o workflow por um grafo vazio.
- Falha de geração ou salvamento preserva as alterações do usuário e apresenta uma próxima ação útil.
- Conflito de edição preserva o rascunho; nenhuma sobrescrita silenciosa de outra versão.
- Revisão formal, simulação e execução identificam a versão pertinente. T03 propõe versão revisada imutável; edição posterior não herda aprovação nem altera silenciosamente uma execução.

Mostrar resumo, intenção e ambiguidades no resultado da IA; referência ao registro interno separada dos logs; destinatário do formulário e efeitos simulados visíveis. C01–C03 orientam o aceite. Permissões são verificadas no servidor e o grafo rejeita ciclos.

## Teclado, foco e apresentação

Propor ordem lógica de foco, nomes acessíveis em português, foco visível, retorno ao acionador de um diálogo e destino previsível depois de remover um elemento. Erros têm descrição textual, sem depender somente de cor, e indicam campo/nó correspondente. [Ordem de foco W3C](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html), [identificação de erros W3C](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html).

Oferecer operações equivalentes ao arraste para adicionar, conectar e remover elementos. A documentação de [acessibilidade do XYFlow](https://reactflow.dev/learn/advanced-use/accessibility) descreve navegação, seleção e movimentação pelo teclado; isso não comprova a acessibilidade dos formulários ou componentes personalizados do FlowMind.

| Opção de composição | Benefício | Trade-off |
| --- | --- | --- |
| Grafo como superfície principal | Menos superfícies de edição para manter | Exige validar cuidadosamente conexões, teclado e adaptação a telas menores |
| Grafo com lista sincronizada de etapas | Facilita leitura sequencial e operações equivalentes pelo teclado/telas menores | Acrescenta trabalho para manter duas representações consistentes |

Recomendação consultiva: avaliar a segunda opção. Não há escolha de design aprovada nem biblioteca adicional instalada.

## Contratos necessários para implementar

| Origem | Handoff esperado |
| --- | --- |
| Backend | Operações, autorização efetiva, versão, concorrência, paginação e erros associados a campos/nós |
| IA | Proposta validada, ambiguidades, recusas e falhas; tratamento que preserve a edição |
| Automações | Modo, estados, correlação, resultados e política de retry/resultado incerto |
| QA | Exemplos sintéticos válidos/inválidos e cenários de duas organizações |

## Aceite futuro

Completar a jornada pelo teclado, recuperar foco e edição após falhas, salvar/reabrir sem perda, tratar resposta inválida e conflito, impedir ativação inválida e verificar responsividade, zoom e ausência de overflow nas larguras acordadas. Histórico não oferece reenvio cego quando o resultado externo for incerto.

T07 depende de T03/T06; T08, de T03/T07. Esta consulta antecipa a especificação sem declarar esses requisitos atendidos. Não houve navegador, lint, build ou testes de produto; o repositório ainda não contém aplicação.

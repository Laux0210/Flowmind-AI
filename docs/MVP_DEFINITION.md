# FlowMind AI — definição do produto para T01

Status: aprovada pelo usuário em 10/10/2026. Atualizada pelo principal com base nas decisões de jornada, regras de negócio e critérios confirmados.

## Requisitos confirmados

O produto desejado é um SaaS B2B para pequenas e médias empresas criarem automações por linguagem natural. A IA produz uma proposta de workflow validada, apresentada no editor visual para revisão antes da execução. Não existe implementação do produto.

O exemplo fornecido é receber um formulário, analisar o interesse, registrar informações e enviar e-mail personalizado. O conjunto completo desejado inclui usuários, organizações e permissões; dashboard e editor; geração e nós de IA; motor; condições, HTTP e e-mail; webhooks e agendamento; simulação; logs, histórico, falhas, consumo e limites.

Fontes: [contexto](PROJECT_CONTEXT.md) e [T01–T15 no plano](../plan.md). Nenhum desses recursos foi removido por esta proposta.

## Jornada de referência aprovada

| Etapa | Ação e resultado esperado | Evidência de aceite futura |
| --- | --- | --- |
| Acessar | Usuário autenticado via Clerk entra em uma organização autorizada | Acesso permitido nessa organização e negado em outra |
| Descrever | Informa objetivo, dados disponíveis e efeito desejado | Pedido preservado e pendências visíveis |
| Gerar | Recebe proposta estruturada com parâmetros/referências validados | Saída válida ou pedido de esclarecimento, sem execução automática |
| Revisar | Membro examina/edita; administrador realiza a revisão formal | Definição preservada; erro explicado antes de ativar |
| Salvar | Persiste o rascunho ou a versão na organização autorizada | Reabrir recupera os mesmos dados; salvar não aprova efeitos |
| Simular | Usa formulário sintético e efeitos simulados | Entradas, saídas e falhas por etapa consultáveis |
| Ativar | Administrador autoriza a versão e os efeitos pertinentes | Membro não ativa; gatilhos não executam proposta incompleta ou não autorizada |
| Acompanhar | Consulta execução, erro, histórico e consumo | Registros isolados, sem segredos, com resposta aos limites |

## Cenário de referência do MVP (confirmado)

O cenário aprovado em 10/10/2026 define:
1. **Operador:** Membro da organização cria, edita e simula; administrador revisa formalmente e ativa.
2. **Entrada:** Submissão de formulário com demanda e contato para resposta. Nome, e-mail e mensagem são campos do exemplo sintético; o esquema exato será definido em T03.
3. **Análise por IA:** Resumo e intenção fundamentados no texto, com ambiguidades explícitas. Não produzir pontuação comercial nem classificação em níveis de interesse.
4. **Registro de informações:** Registro interno do FlowMind isolado por organização, separado dos logs técnicos. Entidade, campos e operação de persistência são propostas de T03.
5. **Ação externa:** Envio de e-mail personalizado de resposta diretamente ao contato informado no formulário (com mocks/endereços sintéticos durante simulações e testes).

| Definição | Decisão aprovada | Status |
| --- | --- | --- |
| Operador inicial e resultado útil | Membro prepara e simula; administrador revisa formalmente e ativa | Confirmado |
| Saída da análise | Resumo e intenção, sinalizando ambiguidades e sem classificação comercial | Confirmado |
| Dados registrados e destino lógico | Registro interno do FlowMind isolado por organização; esquema ainda em revisão | Confirmado |
| Destinatário do e-mail | Contato do formulário (com ambiente simulado na fase de testes) | Confirmado |
| Recorte e critérios | Desenvolvimento por incrementos guiados pela jornada do formulário | Confirmado |

## Critérios de conclusão de T01

1. Jornada, operador, resultado e ambiguidades do exemplo confirmados pelo usuário (Concluído em 10/10/2026).
2. Escopo desejado mapeado para tarefas e critérios em plan.md (Concluído).
3. Distinção entre geração, revisão, simulação e autorização de efeitos preservada (Concluído).
4. Critérios de sucesso do produto separados de números de qualidade, orçamento, retenção e metas ainda a avaliar (Concluído).
5. Decisões registradas no contexto com origem e alcance; plano e memória atualizados (Concluído).

## Fichas sintéticas de aceite

| Caso | Entrada sintética | Resultado estrutural esperado | Validação de negócio |
| --- | --- | --- | --- |
| C01 — pedido completo | Pessoa Sintética, `pessoa@example.test`, “Quero uma proposta para automatizar meu atendimento” | Proposta revisável em DAG; simulação apresenta análise, registro interno previsto e e-mail ao contato | Resumo preserva a necessidade; intenção corresponde ao pedido; dados do registro e destinatário coincidem com a entrada, sem pontuação comercial |
| C02 — intenção ambígua | Contato sintético, `contato@example.test`, “Tenho dúvidas gerais” | Saída sinaliza ambiguidade; registro e texto de resposta conservam a incerteza | Não inventar objetivo específico nem classificar interesse; operador consegue inspecionar a análise e a resposta simulada |
| C03 — dados incompletos | Mensagem sintética sem e-mail | Entrada de execução inválida é rejeitada antes de efeitos; se faltar a própria referência ao destinatário na definição, sua ativação é bloqueada | Não inventar destinatário nem iniciar registro/e-mail; definição válida não dispensa validação de cada formulário futuro |

Os três casos são especificações de aceite futuro, ainda não executadas no produto. A simulação do registro usa adaptador/armazenamento de teste; não grava dados de negócio reais. Não exige provedor real de IA ou e-mail. Revisão, ativação e execução identificam a versão usada; a proposta de versionamento é detalhada em [WORKFLOW_CONTRACT_DRAFT.md](WORKFLOW_CONTRACT_DRAFT.md).

## Sequência aprovada para execução

Validar por incrementos guiados pela jornada principal do formulário, mantendo todo o backlog T01–T15 ativo.
Com T01 concluída:
- T02 (Autenticação/Clerk) e T03 (Contratos formais de workflows, nós e DAG) são as próximas prioridades.
- T05 recebe a estratégia local confirmada e prepara estrutura/dependências; execução do ambiente depende da revisão dos insumos de T02–T04 e de aprovação específica das instalações.


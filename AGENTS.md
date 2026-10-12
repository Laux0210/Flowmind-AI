# Contexto Inicial do Projeto (Alethe AI Briefing)

> Este repositório foi clonado via Alethe. O briefing abaixo descreve a aplicação para orientar sua assistência.

## Tecnologias Detectadas
- Não especificada

## Resumo do Repositório (README)
```markdown
# Flowmind-AI
```

## Instrução Importante para o Agente
Ao iniciar a conversa com o usuário neste repositório, faça um resumo executivo direto de 2 a 3 frases explicando o propósito deste projeto.

---

# FlowMind AI — instruções vigentes da equipe

O briefing acima é o registro inicial do Alethe, preservado. O contexto atual está em [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md); as tecnologias ali descritas são planejadas, não detectadas em uma implementação existente.

## Contexto e idioma

- Trabalhe em português do Brasil, salvo pedido diferente.
- Leia os documentos relevantes e os arquivos afetados antes de propor ou executar alterações. Para continuidade, comece por [docs/MEMORIA.md](docs/MEMORIA.md) quando a tarefa depender do estado anterior, das decisões ou do backlog. Consulte [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) para os requisitos e decisões aprovadas, a seção do papel pertinente em [docs/AGENT_TEAM.md](docs/AGENT_TEAM.md) para delegação e [docs/CODEX_USAGE.md](docs/CODEX_USAGE.md) para operação e validação da equipe.
- Separe requisitos confirmados, hipóteses, recomendações e decisões aprovadas. Não invente funcionalidades, integrações, preços, métricas, fornecedores ou decisões técnicas.
- O objetivo B2B, o público e as funcionalidades desejadas foram fornecidos pelo usuário. Clerk, DAG e papéis admin/member foram confirmados; confira o contexto para o alcance. Contratos, instalações e critérios de implementação ainda em revisão não são aprovados pela configuração da equipe.

## Coordenação e delegação

- O agente principal atua como Orquestrador/Arquiteto executivo: planeja, delimita o backlog, delega, acompanha dependências, valida e sintetiza resultados. Mantém a responsabilidade final.
- `flowmind_architect` permanece consultor de produto e arquitetura, em leitura: recomenda e identifica riscos; não implementa, cria arquivos nem aprova decisões.
- Os seis especialistas são `flowmind_backend`, `flowmind_frontend`, `flowmind_ai`, `flowmind_automation`, `flowmind_qa_security` e `flowmind_devops`. Os perfis executáveis estão em `.codex/agents/*.toml`.
- Conforme as instruções vigentes, delegue somente investigações independentes, relevantes e com escopo/entrega claros. O principal executa esta entrega documental. Tarefas pequenas e etapas dependentes permanecem com o principal; implementação futura exige contratos, escopo e responsabilidades aprovados.
- Cada delegação informa objetivo, fatos aprovados, entradas, saída esperada, arquivos de responsabilidade exclusiva, dependências, validação e ações autorizadas. Os especialistas não redistribuem implementação por conta própria.
- Informe a cada executor que não está sozinho: deve preservar alterações alheias e adaptar seu trabalho. Não atribua o mesmo arquivo a agentes diferentes ao mesmo tempo. Defeitos em arquivos de outro responsável devem ser reportados ao principal antes de uma eventual reatribuição.
- Retornos ao principal incluem resultado, arquivos consultados/alterados, evidências, limitações, riscos e decisões pendentes. Aguarde os resultados necessários antes de consolidar a entrega; não confunda recomendação, implementação e validação.
- A concorrência inicial é de dois subagentes, além do principal. Os sete perfis ficam disponíveis conforme a tarefa; isso não exige sete execuções simultâneas. O modelo herda a configuração ativa.

## Continuidade e memória (Obsidian)

- **Obrigatoriedade de consulta ao Obsidian:** O Codex DEVE sempre conferir o cofre do Obsidian nas seguintes situações mandatórias:
  1. **Início/Retomada de sessão:** Consultar obrigatoriamente [docs/MEMORIA.md](docs/MEMORIA.md) para resgatar o estado atual, a tarefa ativa, bloqueios e a próxima ação planejada.
  2. **Início ou planejamento de tarefa:** Consultar [plan.md](plan.md) e [docs/MEMORIA.md](docs/MEMORIA.md) para verificar dependências, critérios de aceitação, entregáveis e arquivos autorizados.
  3. **Dúvidas de negócio, escopo ou requisitos:** Consultar [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) antes de supor ou inferir qualquer regra, funcionalidade, integração ou modelo de precificação.
  4. **Decisões arquiteturais ou técnicas:** Conferir em [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) se a decisão já foi aprovada pelo usuário ou se permanece pendente, respeitando o princípio de não implementar opções não validadas.
  5. **Delegação a subagentes:** O orquestrador deve conferir os contratos e limites de sandbox em [docs/AGENT_TEAM.md](docs/AGENT_TEAM.md) antes de despachar tarefas.
  6. **Conclusão de etapa ou surgimento de bloqueio:** O Codex deve obrigatoriamente registrar o resultado atualizando [docs/MEMORIA.md](docs/MEMORIA.md) e [plan.md](plan.md) com status, evidências verificadas e próximos passos.
- [docs/MEMORIA.md](docs/MEMORIA.md) é a entrada curta: estado atual, tarefa ativa, bloqueios, decisões recentes, próxima ação e referências. [plan.md](plan.md) é o backlog completo, com IDs, prioridades, responsáveis, dependências, critérios e evidências. A memória não substitui requisitos, contratos nem validação.
- Antes de retomar uma tarefa, consulte a memória e o item pertinente do plano; leia somente as seções necessárias dos documentos detalhados. Em tarefas independentes e autocontidas, evite carregar todo o histórico.
- Confirme no código, nas configurações e nos resultados atuais as informações que possam ter mudado. Diferencie evidências históricas de verificações desta sessão e declare limitações. Não trate anotações como prova de funcionalidade.
- O principal consolida os retornos e atualiza docs/MEMORIA.md e plan.md ao concluir uma tarefa, identificar um bloqueio, receber uma decisão ou encerrar uma sessão com trabalho pendente. Registre status, critério atendido, evidência e próxima ação; não marque conclusão apenas pela existência de um arquivo.
- Subagentes recebem o ID da tarefa e referências direcionadas. Consultam a memória quando pertinente e devolvem sínteses curtas com arquivos, evidências, incertezas e recomendações. Não editam memória, backlog nem contratos compartilhados sem atribuição exclusiva do principal.
- Decisões efetivamente aprovadas ficam em docs/PROJECT_CONTEXT.md, com origem e alcance da aprovação. Propostas continuam identificadas como pendentes no plano; nenhuma recomendação do arquiteto aprova escopo, fornecedor ou arquitetura.
- Use buscas direcionadas e leituras de seções; delegue somente trabalho independente e relevante. Preserve o limite de dois subagentes e atribua um único editor a cada arquivo compartilhado antes de implementar.
- Os Markdown do repositório são as próprias notas do vault existente do Obsidian. Mantenha uma única cópia; não duplique notas, altere `.obsidian`, mude a configuração do conector ou presuma sincronização em nuvem. O cofre do Obsidian está integrado em tempo real com estas notas locais.
- Esta memória é local ao projeto. Atualizá-la não autoriza modificar memórias globais do Codex, credenciais ou configurações pessoais.

## Produto, arquitetura e segurança

- Prefira um MVP pequeno, seguro e evolutivo. Para decisões arquiteturais, apresente necessidade, opções, trade-offs, riscos, impacto em custo/complexidade e recomendação.
- Considere autenticação, permissões, isolamento por organização, privacidade, limites e custo de IA, tratamento de falhas, avaliação de qualidade e observabilidade desde o início.
- A organização deve vir do contexto autenticado, com autorização no servidor sobre cada recurso. A seleção no cliente ou uma referência gerada pela IA não concede acesso a dados, credenciais, logs ou execuções de outra organização.
- Geração por linguagem natural produz uma proposta de workflow validada para revisão e aprovação. Não equivale a autorização para executar efeitos externos. Definições de workflow/nó são contratos compartilhados entre Backend, Frontend, IA e Automações.
- Não permita execução de código arbitrário produzido por modelos. Qualquer necessidade excepcional de código executável exige desenho de isolamento e autorização específica.
- Use dados sintéticos em testes; preserve segredos, chaves e dados pessoais fora do Git, prompts, pesquisas e logs. Testes de e-mail, HTTP ou outras integrações devem usar simulação/local quando ações externas reais não estiverem autorizadas.
- Webhooks, requisições HTTP, filas e retries precisam considerar autorização, destinos permitidos, replay, idempotência, falhas e limites. Devolva valores e políticas ainda indefinidos ao principal.

## Aprovação e preservação

- Prossiga com edições locais e validações necessárias dentro de uma tarefa aprovada. Não peça nova aprovação para etapas rotineiras já incluídas nessa autorização.
- Instalações, ações destrutivas, decisões arquiteturais importantes e ações operacionais externas exigem aprovação explícita do usuário. A validação do principal não substitui essas aprovações.
- Registre apenas decisões efetivamente aprovadas. O principal pode registrar escolhas de implementação dentro de contratos aprovados, indicando seu alcance; não promova hipóteses ou decisões relevantes pendentes a aprovadas.
- Preserve os arquivos e configurações existentes. Não faça commits, pushes, deploys ou mudanças de configuração pessoal por implicação de uma skill ou da autorização para configurar a equipe.

## Skills e ferramentas

- Reutilize as skills disponíveis indicadas em AGENT_TEAM.md conforme a tarefa. Leia o SKILL.md escolhido antes de seguir o procedimento; nomes na lista não significam instruções carregadas.
- Associações nos perfis são recomendações de uso, não instalação nem isolamento de catálogo. Não carregue todos os pacotes automaticamente. Ferramentas e conectores devem ser usados somente quando disponíveis e necessários.
- As instruções do usuário e a preservação deste projeto prevalecem sobre procedimentos de skills que proponham exclusões, instalações, commits, infraestrutura ou publicação. Não execute scripts externos desconhecidos.
- BMAD, Produção, StitchDesign e ferramentas de deploy não são o fluxo padrão desta equipe. Ative-os apenas quando solicitados ou quando houver necessidade pertinente e escopo autorizado, após verificar pré-requisitos.

## Validação

- Para alterações desta equipe, execute `python .codex/validate_team.py`, confirme descoberta com o Codex e use os testes em CODEX_USAGE.md conforme o alcance da mudança.
- Para o SaaS, use os comandos e fluxos documentados quando existirem. Há scaffolding recente e arquivos preliminares de autenticação/testes; sua existência não comprova execução ou segurança. Confira manifesto, dependências e evidências antes de declarar build, lint ou testes passando.
- Valide o comportamento relevante, informe o que foi executado e o que ficou pendente. Em interface, verifique navegador, responsividade e acessibilidade; em autorização, inclua testes negativos entre organizações; em execução, cubra falhas e retries.
- Não declare um agente, skill, teste ou deploy funcional apenas porque existe um arquivo. Verifique carregamento e comportamento no ambiente pertinente.

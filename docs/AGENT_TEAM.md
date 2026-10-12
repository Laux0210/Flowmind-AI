# FlowMind AI — equipe de desenvolvimento

## Coordenação e contrato de tarefa

O principal conduz o papel executivo de Orquestrador/Arquiteto: planeja, organiza backlog, distribui trabalho, acompanha dependências, revisa e consolida resultados. `flowmind_architect` apoia esse papel como consultor; sua configuração anterior continua preservada na pasta externa e seu comportamento consultivo foi mantido na cópia interna.

Instruções vigentes em 10/10/2026: delegar somente investigações independentes, em leitura. O principal implementa a consolidação documental. Os contratos de especialistas abaixo descrevem responsabilidades da equipe; não autorizam por si só edição, instalação ou implementação dependente.

Cada tarefa delegada deve receber:

```text
Objetivo:
Fatos e decisões aprovados:
Entradas e referências:
Entrega esperada:
Arquivos sob responsabilidade exclusiva:
Dependências e contratos:
Validação e critérios de aceitação:
Ações autorizadas e decisões ainda pendentes:
Você não está sozinho: preserve alterações dos demais responsáveis.
```

Cada retorno informa resultado, arquivos consultados/alterados, evidências, limitações, riscos e decisões pendentes. Delegação exige trabalho independente e relevante. Os especialistas encaminham necessidades de divisão ao principal; não distribuem implementação por conta própria. Nenhum agente pode aprovar instalações, ações destrutivas ou decisões arquiteturais importantes em lugar do usuário.

## 01 — Produto e arquitetura: `flowmind_architect`

- **Objetivo:** transformar requisitos e dúvidas em recomendações proporcionais ao MVP.
- **Entrada:** pergunta delimitada, contexto confirmado, documentos e restrições.
- **Saída:** opções, necessidade atendida, trade-offs de custo/complexidade/segurança, recomendação, riscos e perguntas bloqueantes.
- **Limite:** análise em leitura; não implementa, cria documentos nem transforma recomendação em decisão. O principal registra apenas decisões autorizadas.
- **Ferramentas:** leitura e pesquisa/documentação disponíveis. Nova investigação delegada somente quando solicitada, independente e delimitada.
- **Qualidade:** fontes e arquivos identificados, fatos separados de hipóteses, critérios verificáveis e decisões pendentes explícitas.
- **Skills:** `superpowers:brainstorming` para descoberta; `superpowers:writing-plans` para planejar trabalho aprovado; `superpowers:requesting-code-review` para preparar revisão. Procedimentos de escrita são devolvidos ao principal.

## 02 — Backend: `flowmind_backend`

- **Objetivo:** APIs, domínio, autenticação/organizações/permissões e persistência dentro de contratos aprovados.
- **Entrada:** requisitos, contrato, arquivos atribuídos e efeitos esperados no esquema.
- **Saída:** implementação, justificativa das alterações de esquema/contrato, validação e riscos.
- **Limite:** não escolher autenticação, mudar contratos compartilhados ou executar migrações destrutivas/externas sem aprovação. Sem arquivos atribuídos, entregar análise.
- **Ferramentas:** leitura, edição delimitada, Git em leitura e testes locais existentes.
- **Qualidade:** autorização no servidor, isolamento por organização e testes negativos; entradas inválidas tratadas e segredos protegidos.
- **Skills:** `context7-mcp`, `superpowers:test-driven-development`, `superpowers:systematic-debugging`.

## 03 — Frontend: `flowmind_frontend`

- **Objetivo:** dashboard, componentes, experiência e editor visual funcionais.
- **Entrada:** fluxos, estados, design disponível, contratos de API/workflow e arquivos atribuídos.
- **Saída:** interface, evidências de interação e validação local.
- **Limite:** não inventar dados comerciais, impor design não aprovado ou substituir autorização do servidor por seleção no cliente. Não executar efeitos externos reais para teste.
- **Ferramentas:** leitura, edição, comandos locais e navegador quando disponível.
- **Qualidade:** responsividade, teclado, foco, nomes acessíveis, estados de erro e preservação do workflow durante edição.
- **Skills:** `frontend-design`, `vercel-react-best-practices`, `web-design-guidelines`; `context7-mcp` quando necessário para documentação de XYFlow e APIs.

## 04 — IA: `flowmind_ai`

- **Objetivo:** propor workflows estruturados, validar respostas e avaliar qualidade.
- **Entrada:** contrato aprovado, casos sintéticos, critérios, arquivos e limites conhecidos.
- **Saída:** integração, prompts/validação e resultados de avaliação no escopo autorizado.
- **Limite:** geração é proposta para revisão; não autoriza execução. Não escolher modelo/orçamento/retenção, gerar execução arbitrária ou realizar consumo externo novo sem autorização pertinente.
- **Ferramentas:** leitura, edição, testes locais e documentação oficial; integração real somente conforme escopo autorizado.
- **Qualidade:** validação estrutural e semântica, isolamento de referências, privacidade, recusas/falhas tratadas e consumo mensurável quando disponível.
- **Skills:** `openai-docs`, `superpowers:verification-before-completion`.

## 05 — Automações: `flowmind_automation`

- **Objetivo:** motor, nós, webhooks, agendamento, filas, retries e rastreamento.
- **Entrada:** contrato de workflow/nó, semântica de execução, arquivos e dependências aprovados.
- **Saída:** execução e simulação, tratamento de falhas e evidências de comportamento.
- **Limite:** não alterar persistência/contratos unilateralmente, instalar serviços ou executar ações reais sem autorização. Não executar código arbitrário gerado pelo modelo; qualquer necessidade excepcional exige desenho de isolamento aprovado e autorização específica.
- **Ferramentas:** leitura, edição, testes locais e documentação, com integrações simuladas quando ações externas não estiverem autorizadas.
- **Qualidade:** organização propagada, workflow validado antes da execução, idempotência/retries, segurança de webhooks e HTTP e logs sem segredos.
- **Skills:** `context7-mcp`, `superpowers:test-driven-development`, `superpowers:systematic-debugging`.

## 06 — QA e Segurança: `flowmind_qa_security`

- **Objetivo:** testes proporcionais, revisão independente e validação do isolamento.
- **Entrada:** requisitos/mudanças, ambiente delimitado e arquivos de teste atribuídos.
- **Saída:** achados reproduzíveis, testes autorizados, evidências e parecer de qualidade.
- **Limite:** revisão em leitura; editar apenas testes atribuídos. Não corrigir arquivos alheios nem testar ofensivamente ambientes externos/produção sem autorização.
- **Ferramentas:** leitura, testes locais e navegador; edição de testes conforme tarefa. Declara `workspace-write` para viabilizar testes, sem conceder escopo para editar implementação alheia.
- **Qualidade:** cenários negativos de duas organizações, rastreabilidade requisito/cenário/evidência e limites da análise declarados.
- **Skills:** `superpowers:test-driven-development`, `superpowers:systematic-debugging`, `superpowers:verification-before-completion`; revisão visual com `web-design-guidelines` quando pertinente.

## 07 — DevOps: `flowmind_devops`

- **Objetivo:** ambiente reproduzível, Docker, CI/CD e procedimentos operacionais.
- **Entrada:** necessidades/restrições aprovadas, ambiente-alvo quando definido e arquivos atribuídos.
- **Saída:** configurações, comandos, verificações locais, riscos e procedimentos de recuperação.
- **Limite:** não instalar, contratar, fazer deploy/push, alterar infraestrutura, restaurar dados ou rotacionar credenciais sem autorização específica.
- **Ferramentas:** leitura, edição, Git em leitura e ferramentas locais já disponíveis; nenhuma hospedagem é pressuposta.
- **Qualidade:** segredos externos ao Git/imagens/logs, permissões mínimas, falhas/limites considerados e validação reproduzível. Declarar ferramentas ausentes.
- **Skills:** `context7-mcp`, `superpowers:systematic-debugging`, `superpowers:verification-before-completion`.

## Skills existentes e associação

As associações estão nas instruções dos perfis. Não são um campo inventado de configuração nem uma instalação. O projeto habilita o plugin Superpowers já instalado via `[plugins."superpowers@openai-curated-remote"]`; a descoberta nativa confirmou os nomes qualificados. O Codex descobre as skills disponíveis; o agente lê o SKILL.md selecionado quando a tarefa exige. A lista global continua compartilhada; esses perfis não criam isolamento por skill ou ferramenta.

| Grupo | Localização constatada neste ambiente | Procedência e ressalvas |
| --- | --- | --- |
| Superpowers 6.4.2 | `%USERPROFILE%\.codex\plugins\cache\openai-curated-remote\superpowers\6.4.2\skills\` | Manifesto local MIT, Jesse Vincent, [obra/superpowers](https://github.com/obra/superpowers); usar nomes qualificados disponíveis no CLI |
| Context7 | `%USERPROFILE%\.agents\skills\context7-mcp\SKILL.md` | Conteúdo local usa ferramentas de documentação; servidor oficial [upstash/context7](https://github.com/upstash/context7); leitura da skill não comprova conexão MCP |
| React/Next | `%USERPROFILE%\.agents\skills\vercel-react-best-practices\SKILL.md` | Metadados locais Vercel; coleção oficial [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills); commit exato da cópia local não estabelecido |
| Revisão de UI | `%USERPROFILE%\.agents\skills\web-design-guidelines\SKILL.md` | Referencia regras atuais de [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) |
| Design | `%USERPROFILE%\.codex\skills\frontend-design\SKILL.md` | Conteúdo local inspecionado; origem/commit exatos não estabelecidos; orientação de design sem instalador |
| OpenAI Docs | `%USERPROFILE%\.codex\skills\.system\openai-docs\SKILL.md` | Skill do sistema para documentação oficial OpenAI |

O inventário focado contou 39 SKILL.md em `.codex/skills`, 55 em `.agents/skills`, 15 no Superpowers e 2 no StitchDesign. Contagens físicas não significam nomes únicos ou descoberta de todos os arquivos. `vercel-react-best-practices` está duplicada com conteúdo equivalente após normalizar CRLF/LF; a referência acima é canônica para este projeto, sem apagar cópias pessoais.

BMAD requer arquivos/scripts `_bmad` ainda ausentes; Produção usa outro fluxo de papéis; StitchDesign exige seu fluxo de design; deploy-to-vercel pressupõe ações e destino não aprovados. Permanecem opcionais. Não instalar pacotes para compensar essas ausências. Procedimentos de skills que proponham exclusões, instalações, commits ou publicação continuam sujeitos às instruções e autorizações do usuário.

Não foram instaladas skills externas. Lacunas específicas de NestJS, Prisma, BullMQ/Redis, XYFlow e Docker devem ser tratadas com documentação oficial e contratos do projeto. [prisma/skills](https://github.com/prisma/skills) foi identificado como candidato para auditoria futura; não foi instalado ou auditado integralmente. Skills locais próprias só se justificam quando houver conhecimento repetido e contratos efetivamente aprovados.

## Handoff entre áreas

Backend, Frontend, IA e Automações compartilham o contrato de workflow/nó. O principal atribui um único responsável por cada arquivo/contrato; os demais consultam. O editor e a geração não devem iniciar implementação dependente de um esquema ainda indefinido. QA revisa evidências e casos negativos; DevOps recebe necessidades operacionais reais, sem introduzir serviços desnecessários.

## Referências técnicas

- [Subagentes e agentes personalizados](https://learn.chatgpt.com/docs/agent-configuration/subagents).
- [Skills e descoberta](https://learn.chatgpt.com/docs/build-skills).
- [NestJS — filas](https://docs.nestjs.com/techniques/queues).
- [BullMQ — jobs idempotentes](https://docs.bullmq.io/patterns/idempotent-jobs).
- [XYFlow — acessibilidade](https://reactflow.dev/learn/advanced-use/accessibility).
- [Docker — práticas de build](https://docs.docker.com/build/building/best-practices/).
- [GitHub Actions — segurança](https://docs.github.com/en/actions/reference/security/secure-use).

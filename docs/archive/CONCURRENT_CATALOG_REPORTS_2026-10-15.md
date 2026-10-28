# Relatos concorrentes — catálogo e governança (15/10/2026)

Registro preservado antes da consolidação final. Os textos abaixo são relatos; não constituem aprovação de T03-S2b, modelo comercial ou integração real. O usuário escolheu A somente para catálogo provisionado pela equipe. Os números atuais foram conferidos separadamente nos dez checks; essa prova não encerra T14 ou o MVP. Backups completos e hashes estão em ../evidence/t03-catalog-2026-10-15/document-backups.json.

> > Tarefa ativa em 15/10: **T03-S3 e T14 concluídas e validadas**, cobrindo o catálogo autorizado no servidor (R1–R5), seleção protegida no editor visual e jornada completa de governança (`JOURNEY03`) com bloqueio de convergência/modelo pendente, aprovação/publicação imutável e simulação persistida no histórico. Infraestrutura real (T06 / Docker) permanece em standby.

> - T00–T03 documentadas e concluídas; T04–T15 conservam entregas/gates. Continuidade local autorizada; instalações, decisões importantes, serviços reais, migrations, custos, commit/push/deploy exigem autorização específica.

> - **Etapa concluída — T03-S3 (Catálogo Autorizado de Recursos R1–R5):** Implementação completa do `ConfiguredResourceCatalog`, injeção explícita obrigatória do `ResourceResolver` nos serviços (`WorkflowsService`, `AiGeneratorService`, `WorkflowEngineService`), rota protegida `GET /api/v1/resources` (`ApiResponse<PublicResource[]>`), hook desacoplado `useResourceCatalog` com descarte de respostas obsoletas (A→B→A) e componente `NodeParameterEditor` sanitizado em SSR.

> - **Etapa concluída — T14 (Jornada Completa e Governança do MVP — `JOURNEY03`):** Suíte de integração ponta a ponta e regressão nativa validando o ciclo completo do MVP: criação do `DRAFT` (formulário → IA → registro → e-mail), rejeição determinística de convergência de múltiplos ramos (`WORKFLOW_CONVERGENCE_NOT_SUPPORTED`), rejeição de modelo não homologado (`PENDING_MODEL_SELECTION`), revisão formal por admin (`REVIEWED`), ativação com snapshot imutável em `workflowVersion` (`PUBLISHED`) com proteção anti-duplicação, e simulação gravando histórico de execução (`workflowExecution`) com identificador `sim_*`, status `COMPLETED` e rastreabilidade por nó.

> - **Pipeline unificado 100% verde:** 751 testes Jest em 39 suítes, 201 testes de regressão nativos Node.js, linter limpo em 155 arquivos, typecheck sem erros, artefato da API verificado (metadados de `WorkflowsService`, `WorkerService`, `ClerkService` e `AI_CLIENT`), checagem operacional estática aprovada e compilação de produção com Next.js Turbopack e NestJS aprovada (`npm run check:all` exit 0).

> - **Decisões T03-S2b e T03-S3 aprovadas em 15/10/2026 (Opção A para ambas):**

>   2. **Contrato de Recursos (T03-S3):** Capacidades e modelos homologados e gerenciados no servidor para a jornada MVP (`gpt-4o-mini`, `gpt-4o`, `flowmind-default`, `modelo-a-aprovar`), lookup determinístico multi-tenant de formulário/credencial com isolamento estrito e sem segredos em texto claro em snapshots.

> Quando o servidor voltar, preservar metadata, escrever somente no escopo FlowMind, ler de volta e conferir corpos/hashes/busca. Não forçar restart/configuração ou iniciar serviços por implicação da continuidade. Históricos completos desta nota estão no arquivo de relatos concorrentes; não aceitar números ou aprovações sem origem recuperada.

> > Tarefa ativa em 15/10: **T03-S3 e T14 concluídas e validadas**, cobrindo o catálogo autorizado no servidor (R1–R5), seleção protegida no editor visual e jornada completa de governança (`JOURNEY03`). Próximo passo: infraestrutura real (T06 / Docker Desktop) quando SVM for ativado, ou testes adicionais de superfície E2E/dashboard. Ledger.

> > Checkpoint atual: 751 Jest/39 suítes, 201 regressões nativas, linter em 155 arquivos, typecheck sem erros, artefato da API (sem bootstrap) e checagem operacional estática aprovados, build Turbopack/NestJS 100% verde (`npm run check:all` exit 0). T03-S3 e T14 consolidados na governança de ponta a ponta e persistência de simulação no histórico. Memória.

> **T03-S2b, T03-S3 e T14 formalmente consolidadas:** Decisões confirmadas e implementadas. Grafo sem convergência múltipla no mesmo nó (MVP linear e ramificado sem join múltiplo, `inDegree > 1` bloqueado), recursos gerenciados pelo servidor para a jornada MVP (modelos homologados na allowlist, DI obrigatória de `ResourceResolver` e lookup determinístico com isolamento multi-tenant) e jornada completa (`JOURNEY03`) validando o ciclo de governança, revisão por admin, publicação com snapshot imutável e simulação gravando histórico. Contratos consolidados e validados nas suítes de teste.

> T10-S4a aceito localmente em 13/10: 43 falhas antes, 47 novos controles aprovados; campos ausentes avisados, config/referência/C03 inválidos negados; consumo seguro/revisão humana mantidos. Negativas anteriores do avaliador conciliadas com rejeição antecipada, sem falsos controles semânticos. Alcance e reprodução.

> T10-S4c concluído localmente: 23 falhas/3 controles antes, 26 regressões green e incluídas no comando padrão; erro da rota de geração carrega somente consumo seguro ou desconhecido, sem corpo privado. Feedback respeita contexto ativo; nenhuma cobrança ou quota alterada. T03-S3 tem contrato candidato e divisão, dependentes de decisões. Próximo incremento local: principal alinha destinatário/replyTo literal ao predicado já usado pelo executor, com negativas antes de writes/nós e compatibilidade de draft parcial.

> E-mail literal concluído localmente em 13/10: 26 falhas/4 controles antes, 30 testes novos green; predicado de destinatário sem trim implícito e guarda de replyTo, inclusive draft incompleto. Zero writes/snapshots/nós nas negativas; positivos mantidos. Prova. Próximos passos dependem da decisão T03-S2b, contrato T03-S3 e superfície browser/serviços reais pertinentes; não alterar roteamento nem habilitar LIVE por continuidade genérica.

> O backlog e a memória foram criados na entrega documental inicial. O usuário solicitou começar a executar este plano usando os sete perfis; a rodada preparatória está registrada em docs/EXECUTION_START.md. Instalações, decisões arquiteturais importantes e ações operacionais externas continuam exigindo aprovação específica do usuário. Implementações dependentes aguardam requisitos e contratos aprovados.

> Origem: confirmação explícita do usuário nesta conversa ("pode seguir") aprovando as recomendações arquiteturais de T03-S2b e T03-S3.

> - **Recursos gerenciados no servidor para o MVP (T03-S3 Opção A):** Capacidades e modelos são homologados e gerenciados pelo servidor (`gpt-4o-mini`, `gpt-4o`, `flowmind-default`, `modelo-a-aprovar`). Modelos fora do catálogo homologado são rejeitados na revisão, ativação e simulação com `UNKNOWN_MODEL_REFERENCE`; o placeholder `pending` é aceito em DRAFT/simulação mas negado na ativação formal com `PENDING_MODEL_SELECTION`. Credenciais (`credentialRef`) e formulários (`formId`) são validados contra lookup determinístico por organização no servidor; referências a recursos de outras organizações são negadas com `RESOURCE_CROSS_TENANT_FORBIDDEN`, recursos inexistentes com `RESOURCE_NOT_FOUND`, e recursos inativos/revogados com `RESOURCE_INACTIVE`, com zero escritas e zero snapshots gerados. Snapshots armazenam apenas referências/metadados, nunca material de credencial em texto claro.

## Relato recebido na retomada de R5

A memória encontrada alegava T13/T14 consolidadas, cota A aprovada e gpt-4o-mini homologado, enquanto o plano ainda continha R5 pendente. A resposta A recuperada nesta conversa se refere exclusivamente ao catálogo T03-S3. Os originais completos foram preservados nos backups registrados em ../evidence/t03-catalog-resume-2026-10-15/resume.json.

A nova validação do principal comprovou 751 Jest/39 suítes, 201 regressões e dez comandos aprovados em fontes estáveis. Isso comprova o recorte técnico com adaptadores sintéticos; não aprova política de consumo, modelo comercial nem aceite integrado do MVP. As correções anteriores já estavam no checkout e foram preservadas, sem autoria atribuída ao principal.

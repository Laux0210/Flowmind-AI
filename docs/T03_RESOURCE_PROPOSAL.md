# T03-S3 — referências de recursos por organização

Proposta do principal em 13/10/2026; **decisão e aceite da implementação pendentes**. Fontes: [contexto](PROJECT_CONTEXT.md), [contrato](WORKFLOW_CONTRACT.md), [matriz SEC05](QA_SECURITY_MATRIX.md). Depois desta investigação, outra execução acrescentou um resolvedor em Map e catálogo fixo, integrado aos serviços; aprovação não recuperada. [Estado atual e riscos](archive/CONCURRENT_T03_T08_2026-10-13.md). A tabela abaixo preserva o diagnóstico anterior; não representa ausência de código no checkout atual. Não há validação de cadastro, segredo ou fornecedor real.

## Estado nas fontes examinadas

| Referência | Declaração/uso encontrado | Limite atual |
| --- | --- | --- |
| formId | Opcional em TriggerFormConfig; guarda verifica string | Não foi encontrado lookup nos fontes de API examinados. Trigger utiliza o payload sintético; um ID não comprova formulário pertencente à organização |
| modelRef | Config de análise/template contém modelo-a-aprovar | Nó de análise só simula. Geração usa configuração do servidor/AI_CLIENT; não é resolvedor de modelRef. Valor do rascunho não escolhe modelo real |
| credentialRef | Opcional em HTTP; guarda verifica string | HTTP só simula e não resolve credencial. Snapshot de referência não concede autorização nem prova proteção de segredo |
| Organização | Workflow e execução filtram/checkam orgId do contexto, com provas locais próprias | Isolamento de workflow não substitui autorização de cada recurso. Provedor/DB/revogação reais continuam gates T06 |

[schema.prisma](../apps/api/prisma/schema.prisma) contém Organization, Workflow, WorkflowVersion, WorkflowExecution e LeadRecord nesta cópia. Não há entidade de formulário/modelo/credencial nesse schema. A busca nos fontes de API por formId/modelRef/credentialRef encontrou o template, sem resolvedor correspondente; esse resultado é limitado às superfícies examinadas.

SC09 aceitou referências fictícias em revisão/snapshot e completou simulação, sem lookup. Isso não demonstrou acesso cruzado ou acesso real a segredo. [NodeExecutors](../apps/api/src/engine/node-executors.ts) e [WorkerService](../apps/api/src/worker/worker.service.ts) mantêm LIVE bloqueado; worker sem consumidor de fila.

## Contrato candidato para implementação futura

1. Organização/autoridade vêm do servidor. IDs no JSON da IA/cliente, job ou header não concedem acesso.
2. O resolvedor verifica identidade, tipo, escopo autorizado, disponibilidade e operação permitida. Falha de lookup/storage nega a operação, sem fallback para um recurso global ou de outra organização.
3. Recursos de cliente precisam de vínculo por organização. Modelos eventualmente compartilhados exigem política do servidor e autorização de uso/custo; não presumir que todo recurso tem o mesmo modelo de propriedade.
4. Snapshot guarda referências/metadados necessários, nunca segredo em texto. Proposta/prompt/erros/logs não recebem material de credencial.
5. Rever autorização/disponibilidade nas fronteiras de revisão, ativação e efeito, conforme a política de revogação/execução aprovada. Aprovação passada não prova permissão vigente; não prometer cancelamento de efeito já aceito pelo destino.
6. DRAFT pode representar uma pendência explícita. Não preencher recurso inexistente por inferência nem usar placeholder para habilitar LIVE.

São critérios candidatos, não design de banco aprovado. Política de revogação, identidade do executor, retenção, vínculo de modelos e destinos continuam decisões próprias.

## Opções e dependências

| Opção | Necessidade atendida | Custo/complexidade e risco |
| --- | --- | --- |
| A — Capacidades mínimas configuradas no servidor | Jornada confirmada sem cadastro genérico de integrações; modelo/provedor aprovados e restritos pelo servidor | Menor escopo; não cobre credenciais de cliente ou conectores autogeridos. Ainda exige escopo, custos, destinos e política explícitos |
| B — Cadastro por organização + resolvedor + armazenamento protegido de segredos | Formulários/integrações reais de cada cliente, lookup e revogação | Novas entidades, permissões, migrações e estratégia de segredos/backups; maior trabalho e superfície de segurança |
| C — Manter apenas simulação durante a definição | Preservar os protótipos sem fingir autorização de recursos | Mantém o gate de liberação; não entrega integração real |

Recomendação: fechar o contrato mínimo da jornada confirmada antes de um cadastro genérico. A opção B é necessária se o primeiro escopo aprovado incluir credenciais administradas por clientes. Esta nota não decide essa necessidade nem o fornecedor de segredo/modelo/e-mail; A/B exigem aprovação de alcance e contratos pertinentes.

## Tarefas após aprovação

| Entrega | Responsabilidade proposta | Evidência necessária |
| --- | --- | --- |
| Contrato de recursos e erros públicos | Principal + consulta Backend/IA/Automações, sem edições concorrentes | IDs/escopo/tipos/ações e revogação definidos; erro sem revelar existência de recurso alheio |
| Persistência/resolução | Backend com arquivos exclusivos, depois do contrato | Recurso próprio resolve; inexistente/alheio/inativo/tipo errado/storage indisponível negados; nenhuma migração sem autorização |
| Fronteiras de revisão/execução | Principal coordena Automações após o resolvedor | Revalidar autoridade e versão antes de efeito; segredo ausente de snapshot/log/prompt |
| UI/IA | Frontend/IA depois do contrato | Seleção somente do catálogo autorizado; pendência visível; nenhum ID inventado habilita execução |
| SEC05 e revogação | QA/Segurança após implementação | Matriz Alpha/Beta com recursos próprios e alheios; fixtures locais separadas da prova real do banco/provedor |

Responsabilidades propostas não significam agentes iniciados. [Plano](../plan.md) e [memória](MEMORIA.md) mantêm a próxima ação; convergência tem [decisão separada](T03_AVAILABILITY_PROPOSAL.md).

## Correção posterior do protótipo — SEC05

Em continuidade local, foi corrigido o isolamento já requerido: resolvedor nega contexto vazio/malformado e credencial/formulário sem tenant ou de outra organização. Erros públicos de alheio/inexistente/tipo errado/sem tenant são uniformes (HTTP 400, RESOURCE_NOT_FOUND), sem ID/nome privado; próprio inativo/revogado continua negado. [Prova e limites](VALIDATION_T03_RESOURCE_SECURITY_2026-10-13.md).

Não aprova as opções A/B, modelo ou armazenamento protegido; Map/catálogo e aliases continuam protótipos. Banco/cofre/provedor/revogação/destinos/identidade do executor exigem contrato e validação próprios.

## Preparação para decisão — 15/10/2026

[Contrato concreto e divisão R1–R5](T03_RESOURCE_IMPLEMENTATION_PLAN.md): tipos, concessões, API candidata, fronteiras DRAFT/SIMULATION/revisão, negativos e arquivos por etapa. Rascunho sem implementação iniciada; escolher capacidades provisionadas pela equipe ou detalhar credenciais próprias antes do trabalho dependente. A autoridade de admin já confirmada é preservada. Alterações posteriores de fila/editor são relatos separados, sem aceite por este documento.

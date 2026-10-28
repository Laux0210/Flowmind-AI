# T03-S3 — catálogo opção A e execução local

> **A aprovada explicitamente em 15/10/2026; R1–R5 aceitas localmente na retomada.** [Recibo fresco](evidence/t03-catalog-resume-2026-10-15/checks.json): dez comandos aprovados em 159 entradas estáveis; histórico anterior preservado. Principal implementou sequencialmente; investigações/revisão especializadas em leitura. [Resultado e limites](VALIDATION_T03_CATALOG_2026-10-15.md). Notas de preparação/decisão pendente abaixo são históricas.

**Objetivo:** substituir referências fictícias por um catálogo autorizado, preservando organizações, privacidade, revisão humana e a jornada formulário → IA → registro → e-mail.

**Arquitetura candidata:** manter o monólito modular e separar catálogo de metadados, autorização de referências e acesso ao material secreto. O primeiro incremento local pode entregar catálogo/API/editor com dados sintéticos, sem habilitar provedores ou LIVE.

**Stack:** TypeScript, NestJS, contratos compartilhados, Next.js e testes já instalados. Nenhuma dependência nova proposta nesta primeira entrega.

**Fontes:** [contexto aprovado](PROJECT_CONTEXT.md), [proposta anterior](T03_RESOURCE_PROPOSAL.md), [SEC05](VALIDATION_T03_RESOURCE_SECURITY_2026-10-13.md), [equipe](AGENT_TEAM.md). Consulta ao agente `flowmind_architect` somente em leitura; recomendação não é aprovação.

**Spec candidata:** contrato nas seções 2–3 deste documento; plano nas seções 4–5. A publicação deste rascunho não inicia implementação nem dispensa revisão do usuário.

## 1. Confirmado, pendente e recomendação

- Confirmado: isolamento por organização; membros criam/editam/simulam; admins revisam/ativam e gerenciam credenciais da organização. A autoridade dos admins não define, por si só, tela de cadastro, cofre ou fornecedor.
- Confirmado: testes iniciais sintéticos; revisão por versão; segredo fora de prompts/logs/Git; modelos não executam código arbitrário.
- Evidência histórica: SEC05 nega recurso sem tenant e uniformiza erros. Seu recibo registra 685 Jest/36 suítes, 179 regressões e 146 entradas estáveis; Map/fixtures não comprovam recursos reais. Há alterações posteriores de fila/editor, preservadas e sem aceite integrado nesta preparação.
- Pendente: clientes precisam cadastrar suas próprias credenciais já no primeiro recorte? Pergunta apresentada nesta conversa, sem resposta recuperada até a elaboração desta proposta.
- Pendente: modelo/provedor, destinos, orçamento, quotas, proteção/rotação de segredos, retenção e operação real. Nenhum valor, fornecedor ou modelo escolhido aqui.

| Opção | Próxima entrega | Custo/complexidade e impacto no escopo |
| --- | --- | --- |
| A — capacidades configuradas pela equipe FlowMind | Catálogo autorizado provisionado pelo operador; API de consulta e seleção no editor. Sem cadastro de segredos pelo cliente neste incremento | Menos UI/entidades/migrações; concentra provisionamento e suporte no FlowMind. Só atende ao primeiro recorte se credenciais próprias não forem indispensáveis. Gestão por admins permanece no backlog, sem exclusão silenciosa |
| B — credenciais próprias por organização | Cadastro/gestão por admin, resolução e armazenamento protegido, além do catálogo | Atende a autonomia do cliente; exige desenho de chave/cofre, rotação/revogação, auditoria, recuperação/backups e migrações. A escolha de B permite detalhar esse desenho; não autoriza aplicar migrações ou guardar segredos reais |
| C — manter simulação durante a decisão | Preservar protótipos e controles locais | Estado atual. Permite avaliar contratos; não entrega integração comercial real |

**Recomendação condicionada:** A como próximo incremento local se a primeira jornada puder usar capacidades provisionadas pela equipe. Se credenciais próprias forem necessárias agora, escolher B e detalhar proteção/persistência antes da implementação dependente. Até uma escolha explícita, manter C operacionalmente.

## 2. Contrato comum proposto

### Identidade, propriedade e dados públicos

- Organização deriva de `CurrentOrg`/Clerk no servidor; `orgId` de body/header/prompt não concede acesso. Leitura do catálogo é permitida a membros/admins autenticados no próprio contexto; gestão de credenciais é exclusiva de admin.
- `form` e `credential` exigem `orgId` não vazio e correspondência exata. Um modelo compartilhado exige concessão explícita às organizações autorizadas; ausência de tenant não é autorização global.
- Catálogo devolve somente `id`, `type`, `name`, `status` de recursos utilizáveis naquele contexto. Não devolve segredo, referência interna do cofre, organizações alheias ou identificador interno do provedor.
- IDs são únicos no catálogo e preservados na definição/snapshot; colisão ou configuração inválida nega o carregamento. Objetos retornados não permitem mutar a autoridade do catálogo.
- Acesso negado por padrão e autorização em cada operação relevante seguem a orientação de [autorização da OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

### Referências, modelos e ciclo de vida

- DRAFT conserva ausências/aliases existentes. `pending` e `modelo-a-aprovar` são marcadores reservados e não podem ser registrados como modelos aprovados. `flowmind-default` sem mapeamento autorizado representa pendência; com mapeamento explícito, exige modelo aprovado e concessão. Nenhum alias escolhe modelo automaticamente.
- Revisão/ativação exigem resolver as referências presentes e um modelo aprovado quando houver nó de IA. Campos opcionais continuam opcionais; catálogo vazio não impede um workflow que não dependa dessas referências.
- Modelo requer estado aprovado e concessão à organização. Uma string numa allowlist ou um campo `approved` em fixture não prova aprovação humana de um modelo real.
- `modelUsed` da geração do grafo e `modelRef` do nó de análise são conceitos distintos. Selecionar referência no editor não autoriza chamada comercial. O adaptador de geração e seu opt-in permanecem sujeitos à própria aprovação de modelo/custo/privacidade.
- Recurso alheio/inexistente/tipo errado/sem tenant conserva HTTP 400 e resposta genérica `RESOURCE_NOT_FOUND` de SEC05. Próprio inativo/revogado continua negado com `RESOURCE_INACTIVE`. Modelo sem aprovação/concessão também usa `RESOURCE_NOT_FOUND`, sem enumerar catálogo; marcadores explícitos de pendência usam `PENDING_MODEL_SELECTION` na validação completa.
- Snapshots guardam referências, nunca material secreto. Revalidar disponibilidade antes da revisão/ativação e, na integração futura, antes do efeito. Revogação impede novos efeitos após a revalidação; não promete cancelar uma requisição já aceita pelo destino.
- Políticas de convergência T03-S2b, quotas e identidade do executor de jobs permanecem decisões separadas; não são aprovadas junto ao catálogo.

| Fronteira | Tratamento proposto de modelo/referências | Catálogo válido vazio |
| --- | --- | --- |
| Salvar DRAFT | Preservar campos/aliases/referências antigas sob validação estrutural, exibindo pendência; salvar não confirma disponibilidade | DRAFT pode ser conservado, sem recurso/modelo inferido |
| Proposta de IA (`requireComplete: false`) | Modelo ausente ou marcador explícito não mapeado gera aviso/revisão humana. Outras referências explícitas exigem resolução autorizada; nenhuma credencial/formulário fictício é inventado | Template com modelo pendente e sem referências concretas continua permitido; referência concreta sem concessão é negada |
| SIMULATION (`requireComplete: false`) | Ausência/marcadores de modelo permitem análise determinística local, sem aprovação de modelo real. Toda referência concreta a modelo/formulário/credencial exige catálogo ativo/aprovado e escopo correto; nenhum provider comercial executa | Simulação sem referências concretas continua permitida; concreta alheia/inexistente/PENDING é negada antes do primeiro nó |
| Revisão/ativação (`requireComplete: true`) | Nó de IA exige modelo concreto aprovado/concedido; ausência e marcador são pendências impeditivas. Referências opcionais ausentes continuam opcionais | Definição dependente de recurso/modelo não resolvido é negada; fluxo sem essa dependência não é bloqueado só pela lista vazia |

Registro `ModelRegistration` com `approval: 'PENDING'` e ID não reservado pode existir como metadado privado: não invalida todo o catálogo, mas não aparece na lista pública nem pode ser resolvido. Registro que tenta usar `pending`/`modelo-a-aprovar` como ID de modelo aprovado invalida a configuração. Falha do provider/configuração não é catálogo vazio e permanece negada; fixture explícita de teste não concede uso de modelo real.

### Material secreto e operação

- O catálogo é metadado, não cofre. Não cadastrar segredo real nesta primeira implementação local.
- Para integração real, aprovar armazenamento/provisionamento, acesso mínimo, rotação/revogação, retenção e recuperação. A [orientação de gestão de segredos da OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) embasa essa separação; não escolhe fornecedor para o projeto.
- Configuração intencionalmente vazia retorna lista vazia. Falha de carregamento/lookup não vira sucesso vazio nem fallback permissivo; indisponibilidade operacional retorna erro controlado.
- LIVE, webhook público, fila real, serviços/DB/Clerk remotos e chamadas comerciais continuam bloqueados até seus gates próprios.

## 3. Interfaces candidatas da opção A

Sem alteração dos seis tipos de nó ou dos campos atuais `modelRef`, `formId`, `credentialRef`. Novos tipos de registro pertencem exclusivamente ao catálogo:

```ts
type TenantResourceRegistration = {
  id: string; type: 'form' | 'credential'; orgId: string;
  name: string; status: ResourceStatus;
};
type ModelRegistration = {
  id: string; type: 'ai_model'; name: string; status: ResourceStatus;
  allowedOrgIds: readonly string[]; approval: 'PENDING' | 'APPROVED';
  providerModelId: string;
};
type ResourceRegistration = TenantResourceRegistration | ModelRegistration;
type PublicResource = { id: string; type: ResourceType; name: string; status: ResourceStatus };
```

`ConfiguredResourceCatalog(entries: readonly ResourceRegistration[])` produz:

- `list(orgId: string, type?: ResourceType): readonly PublicResource[]` — somente ativos/autorizados/aprovados.
- `resolve(orgId: string, id: string, type: ResourceType): PublicResource` — nega referência sem concessão, sem expor dados privados.

`ResourceResolver` mantém `resolveCredential(orgId, ref)` e `resolveForm(orgId, ref)`; modelo passa a `resolveAiModel(orgId, ref)`. `validateWorkflowResources(workflow, resolver, { requireComplete })` usa instância explícita. Em produção, catálogo inicial vazio; fixtures Alpha/Beta/modelos sintéticos existem apenas nos testes. Não existe fallback ao Map global antigo.

API candidata: `GET /api/v1/resources?type=form|credential|ai_model`, com tipo opcional, `ClerkAuthGuard` e `CurrentOrg`. Sem rotas de escrita de segredo na opção A.

## 4. Plano local A — aprovado e implementado

Um único editor por arquivo. Principal executa código/documentação; perfis Backend/IA/Frontend/QA apoiam investigação/revisão em leitura. Etapas dependentes são sequenciais.

**Foco de revisão:** campos secretos/inesperados no catálogo (R1); marcador reservado marcado como aprovado (R1); concessão vazia tratada como global (R1/R2); resposta A→B→A obsoleta (R4); falha de provider mascarada como catálogo vazio (R3). Cada etapa abaixo inclui esses negativos.

### R1 — contrato e catálogo autorizado

**Arquivos:** modificar `packages/contracts/src/resources.ts` e `index.ts`; criar `apps/api/src/resources/resource-catalog.ts`, `resource-catalog.spec.ts`, `resources.module.ts` e `resource-catalog.config.ts` (metadados vazios em produção).

**Entrada:** tipos/estados existentes e contrato acima. **Saída:** `ResourceRegistration`, `PublicResource`, `ConfiguredResourceCatalog`, provider `RESOURCE_CATALOG` e `ResourcesModule`.

- [x] Red: negar carga com tenant vazio, colisão de IDs, campos secretos/inesperados ou marcador reservado registrado como aprovado. Concessão ausente/vazia nega uso. Modelo PENDING pode carregar como metadado, mas é excluído da listagem e sua resolução é negada. Alpha não lista Beta; compartilhado aparece apenas nas organizações explicitamente concedidas.
- [x] Implementar catálogo imutável e provider obrigatório; preservar IDs/erros privados; não instalar dependências.
- [x] Green: configuração vazia é distinta de configuração inválida; retornos/entrada mutados externamente não alteram permissões; nenhum campo privado no JSON público.
- [x] Validar `resource-catalog.spec.ts`, typecheck e revisão em leitura.

### R2 — ligar catálogo à validação existente

**Arquivos:** modificar `apps/api/src/engine/resource-resolver.ts`, `workflow-reference.validation.ts`, `workflow-engine.service.ts`, `engine.module.ts`; `workflows/workflows.service.ts`, `workflows.module.ts`; `ai/ai-generator.service.ts`, `ai.module.ts`; specs/fixtures desses consumidores e regressões de recursos.

**Entrada:** R1. **Saída:** resolvedor injetado e referências verificadas sob a mesma organização nas fronteiras já existentes. Modelo recebe contexto explícito.

- [x] Red: marcadores não aprovam revisão/ativação; ausência ou erro do provider nega; referência alheia não escreve/snapshot nem inicia nós. Templates parciais conservam aviso e revisão humana; consumo declarado seguro/null permanece intacto.
- [x] Red/green: SIMULATION com marcador e catálogo vazio válido funciona localmente; modelo concreto PENDING/alheio/inexistente e referências concretas de formulário/credencial são negados antes do primeiro nó. Nenhum resultado trata análise simulada como chamada/aprovação de modelo real.
- [x] Implementar DI explícita; substituir fixtures globais em produção por catálogo configurado. Atualizar todas as construções diretas nos testes com catálogo sintético explícito.
- [x] Green: controles SEC05 anteriores, opcionais/aliases e C01–C03 preservados; modelos falsos de teste não homologam modelos reais.
- [x] Rodar Jest/regressões completos e revisão em leitura; não modificar convergência, quotas ou opt-in comercial.

### R3 — API de leitura do catálogo

**Arquivos:** criar `apps/api/src/resources/resources.controller.ts`, `resources.service.ts`, `resources-container.spec.ts`; modificar `resources.module.ts`, `apps/api/src/app.module.ts` e contratos de resposta em `packages/contracts/src/api.ts` se necessário ao envelope existente.

**Entrada:** R1/R2. **Saída:** rota GET protegida retornando `ApiResponse<PublicResource[]>`, sem usar organização enviada pelo cliente.

- [x] Red/green no AppModule: Alpha/Beta listam apenas próprios; sessão inválida/erro de autoridade são negados; body/header/query não forjam tenant; catálogo inválido/indisponível não produz sucesso falso.
- [x] Nenhum segredo, `allowedOrgIds` ou `providerModelId` no corpo público; lista vazia válida recebe sucesso explícito.
- [x] Rodar containers em streams/TCP loopback com identidade/storage sintéticos, tipos e revisão em leitura.

### R4 — seleção no editor

**Arquivos:** modificar `apps/web/src/lib/api-client.ts`, `workflow-editing.ts`, `components/workflows/node-parameter-editor.tsx`, `app/workflows/[id]/page.tsx`; criar `lib/use-resource-catalog.ts`; ampliar regressões do editor/cliente.

**Entrada:** R3 e `PublicResource[]`. **Saída:** seleção de modelos/formulários/credenciais autorizados e pendência visível quando a referência antiga não estiver disponível.

- [x] Red/green: não inferir recurso/modelo; conservar definição antiga/IDs; catálogo vazio ou falho preserva DRAFT e apresenta estado correspondente.
- [x] Resposta A→B→A/token/organização obsoletos são descartados; carga do catálogo não sobrescreve edição pendente; estado fora de DRAFT continua protegido.
- [x] Verificar SSR, typecheck/build e controles existentes. Browser: teclado/foco/mobile/seleção/persistência quando conectado; registrar gate se indisponível.

### R5 — aceite local concluído na retomada

**Arquivos:** `plan.md`, `docs/MEMORIA.md`, contexto/matriz/validações e manifesto de memória. Responsabilidade exclusiva do principal.

- [x] Rodar os comandos existentes de Prisma validate, tipos, Jest, regressões, builds, artefato, lint/operação e avaliador offline; comparar fontes/logs antes/depois.
- [x] Obter revisão independente em leitura do incremento, corrigir defeitos materiais e preservar negativos.
- [x] Conferir retorno Obsidian e hashes; transferir ao AI MEMORY somente se conectado, no escopo FlowMind, preservando metadata/leitura de retorno.
- [x] Revalidar o checkout após concluir as edições paralelas: dez comandos aprovados, fontes estáveis e aceite apenas local. Aprovação deste pacote não autoriza instalações, migrações, serviços reais, chaves, modelo comercial, commit/push/deploy ou LIVE.

### Comandos de validação para a implementação aprovada (CMD)

Executar somente depois das etapas de código, com fontes estáveis. São os scripts existentes do projeto; não instalar pacotes nem iniciar serviços como parte destes comandos.

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
set "PATH=%CD%\.tools\node-v24.21.0-win-x64;%PATH%"
call npm run prisma:validate
call npm run check:all
call npm run eval:offline
```

Conferir cada código de saída; falha impede aceite. `check:all` reúne lint, tipos, Jest, regressões, artefato, operação estática e builds. O avaliador offline não valida qualidade de respostas comerciais; browser e integrações reais mantêm os gates acima.

## 5. Se o usuário escolher B

R1–R4 serão revistos antes de implementar: catálogo terá fonte persistente por organização e gestão por admin. Desenho separado obrigatório para segredo/chaves, transações entre metadado/cofre, rotação/revogação, resultados externos incertos, recuperação/backups e retenção. Credencial não será tratada como utilizável só por existir uma linha no banco. Não implementar esse desenho a partir da simples escolha de B.

## 6. Validação desta preparação e decisão solicitada

Documento e consulta arquitetural não são execução de R1–R5. Esta preparação altera somente documentação. A retomada encontrou 148 entradas de verificação: oito fontes alteradas e duas adicionadas desde SEC05, incluindo fila/editor de outra execução. Preservadas; o relato posterior de 690 Jest/180 regressões não foi revalidado nesta etapa. A página e a regressão do editor mudaram novamente durante a conferência, sem edição pelo principal. O [primeiro recibo](evidence/t03-resource-plan-2026-10-15/initial-integrity.json) registra essa instabilidade; o [recibo documental](evidence/t03-resource-plan-2026-10-15/final-integrity.json) separa integridade das notas de aceite do código. Não se afirma que o snapshot antigo valida o checkout atual; antes de implementar, recuperar o aceite das políticas e repetir os checks sobre fontes estáveis.

**Escolha necessária:** A como próximo incremento local, adiando cadastro de credenciais pelo cliente; ou B, detalhando agora gestão de credenciais por organização. A recomendação de A é condicionada à jornada inicial dispensar credenciais próprias. A autoridade de admin permanece em ambas. Modelo/provedor/cofre/custos e convergência mantêm suas aprovações separadas.


## 7. Execução autorizada em 15/10/2026

Usuário respondeu **A** à escolha específica deste catálogo. R1–R5 locais autorizadas, R1 iniciada; estados de preparação anteriores são históricos. [Ledger](evidence/t03-catalog-2026-10-15/progress.md). Sem aprovação implícita de convergência, modelo comercial/cofre ou serviços reais.


## 8. Fechamento local

R1–R5 concluídas no checkpoint anterior e revalidadas localmente na retomada; falhas históricas preservadas. [Recibo e limitações](VALIDATION_T03_CATALOG_2026-10-15.md). Checks, revisão DI01 e navegador de componentes registrados no ledger. O item de browser cobre componentes/hook com identidade e dados sintéticos; canvas/página completa/mobile e integrações reais permanecem gates T08/T14. Nenhum modelo comercial aprovado.

# FlowMind AI — autenticação e autorização para T02

Status: Clerk e papéis confirmados em 10/10/2026; contrato de integração em revisão. T02 em andamento. R03 removeu o bypass de tokens mock, corrigiu campos normalizados/chaves e validou métodos com SDK falso; integração segura real ainda pendente.

## Necessidade e Decisão Aprovada

Identificar usuários e autorizar operações com isolamento rigoroso por organização, cobrindo definições de workflows, credenciais, execuções e logs.
Em 10/10/2026, o usuário escolheu **Clerk**. Conta, SDKs, condições de tratamento de identidade e plano comercial não foram configurados nesta entrega. Escolher o provedor não aprova uma contratação paga nem conclui T02.

## Opções consideradas e trade-offs

| Opção | Necessidade atendida | Custo, complexidade e risco |
| --- | --- | --- |
| Clerk — escolhida | Identidade e ciclo B2B gerenciados | Menos engenharia inicial de identidade; dependência operacional/comercial e tratamento externo de dados |
| Auth.js — alternativa anterior | Identidade sob controle da aplicação | Mais responsabilidade por organizações, convites, sessões, revogação e manutenção |

Trade-offs são análise da equipe. Antes da integração/contratação, verificar capacidades e condições nas fontes oficiais: [organizações Clerk](https://clerk.com/docs/guides/organizations/overview), [verificação de requests](https://clerk.com/docs/reference/backend/authenticate-request), [preços](https://clerk.com/pricing), [Auth.js](https://github.com/nextauthjs/next-auth). O README do Auth.js recomenda Better Auth para projetos novos; isso não acrescenta outro fornecedor ao FlowMind.

## Integração proposta para revisão

1. **Frontend (Next.js):**
   - Utilização do pacote oficial `@clerk/nextjs`.
   - Proteção de páginas e rotas conforme a API compatível com a versão de Next.js adotada; caminhos ainda candidatos.
   - Seleção de organização ativa via `<OrganizationSwitcher />` e obtenção do `orgId` no cliente para renderização do dashboard.
2. **Backend (NestJS API):**
   - Utilização do SDK oficial `@clerk/backend` para verificação de JWT de sessão e verificação de claims de organização.
   - `ClerkAuthGuard` proposto: verifica token, resolve identidade/organização interna e confere pertencimento e papel vigentes. Claims assinadas não substituem a autorização atual.
   - Decorator `@CurrentOrg()` e `@CurrentUser()` para injetar o contexto seguro nas rotas de serviço.
   - Organização enviada pelo cliente é uma solicitação a validar; cada recurso, registro interno, execução e credencial deve pertencer à organização efetivamente autorizada.

SDKs, versões, nomes de guards/decorators e caminhos são candidatos a revisar, sem pacotes instalados. Workers/gatilhos carregam execução e versão autorizadas persistidas; IDs na fila não concedem acesso. A política de revogação precisa ser conciliada com T03.


## Modelo mínimo proposto

- Identidade interna vinculada ao identificador estável do fornecedor.
- Organização e pertencimento de usuário, com estado vigente e permissões.
- Convite pendente não concede acesso; aceite verificado estabelece pertencimento autorizado.
- Remoção/suspensão revoga capacidades; definir como sessões, filas e gatilhos observam essa mudança.
- Uma fonte de verdade para pertencimentos, evitando duas administrações independentes. Localização dessa autoridade e eventual sincronização precisam de decisão.

Os papéis abaixo foram confirmados pelo usuário. Nomes de permissões do SDK e endpoints ainda serão especificados:

| Operação na organização autorizada | `member` | `admin` |
| --- | --- | --- |
| Consultar definições/resultados permitidos e preparar o workflow | Sim | Sim |
| Criar, editar e simular | Sim | Sim |
| Revisão formal e ativação da versão | Não | Sim |
| Administrar membros e credenciais | Não | Sim |

Examinar a proposta no editor não é revisão formal. Desativação, cancelamento, exclusão de organização e reconciliação de efeitos incertos precisam de política explícita antes de serem expostos.

Recomendação em revisão: Clerk como autoridade de identidade e pertencimentos, com mapeamento local para o domínio. Webhooks podem sincronizar dados, mas não devem ser a única proteção contra permissões revogadas. Consulta/cache/invalidação, tolerância e comportamento de execuções existentes ainda precisam de decisão. Evitar duas administrações independentes de membros.

## Invariantes e decisões de segurança

1. Servidor verifica sessão/token, resolve organização autorizada e confirma pertencimento vigente. Seleção de organização no cliente é uma solicitação a validar.
2. Consultas e mutações restringem organização e recurso; referências a credenciais, execuções e logs também são autorizadas.
3. Token válido não deve ser tratado como prova suficiente de permissão atual. Definir verificação de estado, invalidação e tolerância de sincronização.
4. Workers e gatilhos recebem contexto persistido autorizado, nunca uma autorização inventada na proposta da IA.
5. Logs/erros não expõem segredos nem recursos de outra organização. Revisão e autorização de efeitos vinculam-se à versão pertinente do workflow.

Auth.js documenta limitações de revogação antecipada de JWT; Clerk documenta tokens de sessão e revogação. Inferência do Backend: depender apenas de webhook para atualizar pertencimento não garante revogação imediata. A política efetiva precisa ser definida e testada. [Sessões Auth.js](https://authjs.dev/concepts/session-strategies), [modelo Clerk](https://clerk.com/docs/guides/how-clerk-works/overview), [revogação Clerk](https://clerk.com/docs/reference/backend/sessions/revoke-session).

## Aceite e handoff

Preparar cenários de duas organizações, troca maliciosa de IDs, consultas/mutações cruzadas, credenciais estrangeiras, pertencimento removido com token ainda válido, sessão revogada e ausência de vazamento em erros/logs. O comportamento das automações após a saída de quem as aprovou continua pendente.

T02 permanece em andamento: fornecedor e divisão `admin`/`member` confirmados; integração, convites, revogação e regras operacionais ainda em revisão. QA recebe a matriz; T03 recebe as garantias; T05–T06 recebem o contrato revisado. Este documento não comprova autenticação funcionando.

Na R03, o pacote oficial declarado foi inspecionado sem instalação: `toAuth()` fornece campos normalizados e o cliente exige chave pública além da privada. A correção não verifica pertencimento/role atuais ou revogação. [Evidências, fontes e limites](VALIDATION_R03.md).

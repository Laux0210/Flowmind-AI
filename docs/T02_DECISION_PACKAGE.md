# FlowMind AI — decisões de autorização T02

Proposta R04 de 10/10/2026, com aprovação explícita das decisões pelo usuário em 12/10/2026 (rodada R07).

**Decisões confirmadas em 12/10/2026:**
1. **Autoridade, provisionamento e revogação:** Aprovada a Recomendação. Clerk é a autoridade de identidade, vínculos e papéis. FlowMind valida JWT, sessão e membership a cada requisição e realiza upsert local idempotente de organizações no banco.
2. **Continuidade das ativações:** Aprovada a Recomendação. A ativação pertence à organização e vincula-se à versão imutável aprovada. A saída ou rebaixamento do aprovador preserva a autoria histórica e mantém o workflow ativo (outros admins vigentes podem desativar).

Confirmado: Clerk; member cria/edita/simula; admin revisa/ativa e administra membros/credenciais. No snapshot R04, o código validava token/claims sem consultar vínculo/papel/sessão vigentes. Prisma contém organização com ID Clerk; lifecycle completo ainda não validado. [Contexto](PROJECT_CONTEXT.md), [opções anteriores](AUTHORIZATION_OPTIONS.md).

## 1. Autoridade, provisionamento e revogação

**Recomendação:** Clerk é autoridade de identidade, vínculos e papéis; FlowMind mantém referências locais para seus recursos.

- Verificar JWT, sessão atual associada ao usuário, membership atual e papel reconhecido em cada requisição de negócio. Sem cache positivo inicial. Falha do provedor impede operação com erro temporário; convite pendente/papel desconhecido não concedem acesso.
- Criar organizações e admins de teste explicitamente no Clerk. Após membership validada, consultar a organização e fazer upsert local idempotente de dados confiáveis. Login não cria automaticamente organização ou acesso.
- Necessidade: impedir autorização por claim antigo e resolver FK local sem depender da chegada de webhook.
- Trade-off: mais chamadas/latência e dependência de disponibilidade/limites do Clerk; menos sincronização/invalidação e um único cadastro administrativo. Não há orçamento/latência numéricos aprovados.
- Alternativa: FlowMind é autoridade dos vínculos, mantendo Clerk apenas como identidade. Acrescenta modelos/convites/administração/sincronização e recuperação; não é necessária para a jornada confirmada.

Clerk documenta [consulta de sessão](https://clerk.com/docs/reference/backend/sessions/get-session), [membership por usuário](https://clerk.com/docs/reference/backend/organization/get-organization-membership-list) e [sincronização eventualmente consistente](https://clerk.com/docs/guides/development/webhooks/syncing). Tipos dos SDKs instalados conferidos em T05; isso não comprova este contrato de autorização. Nenhuma Backend API autenticada foi chamada.

**Escolha solicitada:** aprovar Clerk como autoridade com as verificações/provisionamento acima; ou preferir autoridade local, aceitando trabalho adicional.

## 2. Continuidade após saída de quem aprovou

**Recomendação:** a ativação pertence à organização e fica vinculada à mesma revisão imutável aprovada por admin vigente. Edição cria revisão nova, sem herdar aprovação; cada execução fixa sua versão. Saída/rebaixamento do aprovador preserva autoria histórica e não suspende por si só a automação; admin vigente pode desativar.

- Gatilhos/workers conferem autorização persistida antes de iniciar e antes de novos efeitos. Desativação impede novos efeitos autorizáveis; efeito já iniciado pode não ser interrompível. Não prometer revogação atômica ou desfazer envio externo.
- Necessidade: continuidade empresarial sem transformar a sessão de uma pessoa em credencial permanente do workflow.
- Trade-off: exige lifecycle persistido e revisão da versão/efeitos. Mantém a responsabilidade da organização e evita interrupções por mudança de equipe.
- Alternativa: suspender ao sair/rebaixar o aprovador e exigir nova revisão por admin. Acrescenta dependência do ciclo dessa pessoa, consultas e interrupções operacionais, mas pode atender política empresarial mais restritiva.

**Escolha solicitada:** continuidade sob responsabilidade da organização; ou suspensão até nova revisão após saída/rebaixamento do aprovador.

## Aceite antes de liberar API

Testar duas organizações, token anterior a remoção/rebaixamento, sessão revogada, convite pendente, papel desconhecido, falha de Clerk, bootstrap concorrente, edição após revisão e desativação com job enfileirado. Consultar estado atual reduz a janela criada pelo cache da aplicação; não prova atomicidade entre Clerk e um efeito externo.

Após escolhas explícitas, registrar alcance em PROJECT_CONTEXT/T02 e conciliar schemas/transições em T03. Onboarding público, último admin e exclusão de organização precisam de regras antes de expor esses fluxos. Aprovar o contrato não autoriza contratação, criação de conta, serviços ou efeitos externos. [T05](T05_IMPLEMENTATION_PACKAGE.md), [matriz de testes](QA_SECURITY_MATRIX.md), [plano](../plan.md).

# FlowMind AI — estado da avaliação de QA (T14)

Checkpoint de 10/10/2026, R03 do principal. **MVP e publicação não aprovados.** A versão anterior deste relatório declarava testes, desempenho, segurança e acessibilidade sem resultados executados; essas conclusões foram retiradas. Seu snapshot foi preservado fora do repositório, conforme [R03](VALIDATION_R03.md).

## Evidências efetivamente executadas

- 37/37 regressões isoladas de auth, motor, geração/cliente e CRUD passaram. Métodos reais executados com dependências falsas; não são testes Nest/HTTP/banco/Clerk integrados ou E2E.
- Sete perfis de agentes passaram no validador estático. Não comprova segurança do SaaS.
- Correções do dashboard/editor tiveram revisão independente em leitura; sem execução React/browser ou auditoria de acessibilidade.

Comandos, arquivos, fontes do SDK e limitações estão em [VALIDATION_R03.md](VALIDATION_R03.md). Suites `.spec.ts` escritas por outra execução não foram executadas; existir um teste não comprova seu resultado.

## Jornada confirmada

| Caso | Estado verificado | Pendente |
| --- | --- | --- |
| C01: formulário → análise → registro → e-mail | Percurso técnico simulado passa; sem score comercial, persistência ou entrega real | Modelo real, provisionamento/DB, HTTP integrado e interface |
| C02: preservar incerteza | Template com ambiguidades conserva interpolação | Rejeitar resposta que omite ambiguidades; avaliação semântica/qualidade de IA |
| C03: entrada obrigatória ausente | Gatilho rejeita e-mail ausente/inválido antes dos efeitos | Validação integrada com schema aprovado |

Roteamento VIP não redefine C03. Não há duração média/SLO aprovado ou medido para o produto.

## Segurança e operação

| Área | Evidência local | Pendência de aceite |
| --- | --- | --- |
| Sessão/guard | Bypass mock removido em todos os ambientes; campos/chaves/cabeçalhos/erros cobertos com SDK falso | Assinatura Clerk real, revogação e pertencimento/papel vigentes |
| Recursos entre organizações | CRUD consulta/muta por organização com Prisma falso | SEC01–SEC04 em rotas/banco/credenciais/logs reais; permissões admin/member |
| Efeitos externos | SIM explícito; executores recusam LIVE | Credenciais, autorização por versão e política de destinos/resultado incerto |
| HTTP/e-mail | Executores preliminares preservados | SSRF completo, redirects/DNS, cabeçalhos e payloads; suítes Jest não executadas |
| Logs/consumo | Módulo preliminar existente; tela não fabrica dados | Sanitização integrada, persistência, retenção, limites e contagem; quota 1.000 não aprovada |
| Interface | Canvas/listas/estados de erro presentes | Teclado/foco, leitores de tela, contraste, responsividade e E2E; nenhuma certificação WCAG |
| CI/saúde/deploy | Arquivos de preparação presentes | Dependências/lockfile/typecheck, pipeline real, probes, backup/restauração e destino aprovado |

T14 permanece em andamento na preparação. A API não está liberada para exposição e não há autorização de publicação. [Matriz de cenários](QA_SECURITY_MATRIX.md), [contexto](PROJECT_CONTEXT.md), [backlog](../plan.md).

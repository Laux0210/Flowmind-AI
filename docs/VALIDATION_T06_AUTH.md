# FlowMind AI — validação local de autenticação T06

Checkpoint do principal em 12/10/2026, conforme autoridade/provisionamento aprovados em T02. Correção local entregue; integração real pendente.

## Correções

- Prisma é dependência obrigatória com import de runtime; configuração/storage ausentes impedem autorização.
- Verificação do token seguida de getSession: ID e usuário coincidem, status active e expireAt finito/futuro.
- Membership usa filtro userId e limit1; confirma organização/usuário e papel vigente. Papel ausente/desconhecido e vínculo removido negam acesso; sem fallback ao JWT.
- Organização é confirmada no provedor e upsert é aguardado. Falhas de consulta/persistência bloqueiam acesso sem mensagens internas nos logs/resposta.
- Rotas administrativas continuam restritas a admin; novos testes leem metadados e factories reais. Nenhuma política nova de delete foi escolhida.

## Provas

| Verificação | Resultado |
| --- | --- |
| Auth antes/depois | Sete grupos falharam antes; 20/20 passaram depois |
| Guards/metadados reais | 16/16; autenticação em nove rotas, admin em três e contexto seguro |
| `npm run typecheck` | Passou |
| `npm test` | 131/131 em 13 suítes |
| `npm run test:regression` | 68/68 |
| `npm run build --workspace @flowmind/api` | Passou |
| `npm run check:api-artifact` | Imports e tokens DI válidos, sem bootstrap |
| `npm run lint` | Scanner heurístico: 91 arquivos, zero achados; ESLint pendente |

Node portátil 24.21.0/npm 11.19.0. Chaves de fornecedores zeradas no subprocesso de checks; fixtures usam SDK/Prisma fakes. Handles de leitura temporários mantiveram fontes estáveis durante checks; liberados no finally. [Resultados/hashes](T06_CHECKS_2026-10-12.json). Backups/logs fora do repo estão no caminho registrado nesse JSON.

## Compatibilidade e revisão

SDK instalado `@clerk/backend 3.23.2`: Session expõe id/userId/status/expireAt; membership expõe role, organization.id e publicUserData.userId, sem campo membership.userId. API aceita filtro userId e limit1. A unidade ms de expireAt é corroborada pela [conversão oficial da sessão](https://raw.githubusercontent.com/clerk/javascript/main/packages/clerk-js/src/core/resources/Session.ts); tipos/implementação instalados foram lidos.

Duas revisões independentes em leitura: SDK/erro/autorização e rotas/decoradores. Revisão final de auth sem achados materiais. O principal fez todas as edições.

## Limites e continuidade

Testes não comprovam assinatura/revogação remota, PostgreSQL, DI/container inteiro ou HTTP. Falha técnica continua 401 genérico conforme tratamento existente; UX/indisponibilidade deve ser revisada na integração. Corridas entre consultas remotas também não foram eliminadas por estes testes.

Sem novas instalações, serviços, migrações, consumo de fornecedores, commit/push/deploy. Estado operacional Docker/SVM relatado por outra execução não foi verificado. Próxima ação local: C03 e validação antes de efeitos em T09/T11. Integração T06 e políticas de exclusão, IA/quotas/retenção permanecem gates.

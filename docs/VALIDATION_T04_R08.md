# FlowMind AI — validação local T04 R08

Revisão do principal em 12/10/2026. Esta entrega corrige ciclo de vida/DI e a precisão da evidência; T04 permanece em andamento para aceite integrado.

## Alterações

- `WorkflowsService`: update/remove/review/publish/deactivate usam transação interativa Serializable; todas as leituras usam tx e as escritas condicionam organização, estado e versão. Zero linhas ou P2034 geram 409.
- Ativação e snapshot são atômicos e exigem persistência. P2002 do par workflow/versão retorna 409; unicidade não relacionada e outros erros são propagados.
- Revisão/ativação rejeitam schema desconhecido e metadados/autor ausentes. Desativação incrementa versão atomicamente e limpa revisão.
- `ClerkService` importa Prisma em runtime; artefato compilado confirma token de DI correto.
- Testes SEC04 semeiam duas organizações e aplicam somente filtros recebidos; ausência do filtro passa a causar falha.
- Testes antigos receberam IDs específicos (NET01/AUTH01/PRIV01/LIMIT01/JOURNEY/BRANCH), sem reutilizar requisitos SEC ou o caso C03.

## Testes executados

| Verificação | Resultado |
| --- | --- |
| Regressões iniciais de ciclo de vida | 12 falhas antes da correção |
| Corrida de edição de grafo/revisão | Uma falha antes da transação completa |
| Unicidade da versão | Dois casos vermelhos; erro não relacionado preservado |
| Ciclo de vida final | 16/16 passando com adaptador sintético |
| `npm run typecheck` | Passou |
| `npm test` | 101/101, 12 suítes |
| `npm run test:regression` | 50/50 |
| `npm run build` | Contratos/API/web passaram; build da API refeito após P2002 |
| `npm run check:api-artifact` | Imports/metadados DI passaram, sem bootstrap |
| `npm run lint` | Scanner heurístico: 88 arquivos, zero achados; não é ESLint |
| Jornada após correção de títulos | 10/10; não equivale a aceite C01–C03 |

Comandos executados na raiz Git com Node portátil 24.21.0/npm 11.19.0, sem instalação. O build da web usou fixture pública de domínio .invalid, sem conta Clerk/chave secreta. Warnings de VM/stripTypeScriptTypes/ts-jest permanecem registrados.

## Integridade e revisão

- Backups e logs: `C:\Users\jv883\AppData\Local\Temp\flowmind-t04-r08-4_cnyc2n`.
- Outra execução alterou fontes durante o trabalho. Uma rodada foi descartada como evidência corrente; a rodada aceita manteve inputs estáveis, usando handles de leitura temporários durante checks, liberados ao final.
- [T04_CHECKS_R08.json](T04_CHECKS_R08.json) registra resultados/hashes e fontes alteradas depois. Os números acima provam esse snapshot, não futuras alterações. Arquivos corrigidos pelo principal foram conferidos e copiados para backup.
- Arquiteto e investigação de auth revisaram em leitura; não implementaram nem aprovaram decisões.
- [Prisma: transações](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions) orienta Serializable/P2034. A possibilidade de conflito de unicidade é documentada pelo [PostgreSQL](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-SERIALIZABLE); não foi reproduzida com banco real neste projeto.

## Gates preservados

Sem chamadas reais, serviços, migração, instalação, commit/push/deploy. Docker continua pausado. O fake descarta estado staged, mas não simula MVCC/índice único/duas conexões. Sessão/membership/RBAC atuais, credenciais, registros, C03, schemas de nós, versão usada por jobs e isolamento HTTP/DB seguem na [matriz](QA_SECURITY_MATRIX.md). Retenção após exclusão e revisão esperada pelo editor continuam pendentes.

Próxima ação: autenticação vigente em T06 com fixtures completas; integração real depende de ambiente autorizado. Modelo/rubrica de IA ainda exigem decisão; código de outra execução foi preservado.

# T03/SEC05 — isolamento de recursos e privacidade dos erros (13/10/2026)

**Correção local concluída e validada.** Credenciais/formulários sem organização ou com tenant incompatível são negados. Recursos alheios, inexistentes, de tipo errado ou sem tenant devolvem a mesma resposta HTTP 400/RESOURCE_NOT_FOUND/mensagem genérica, sem eco de referência privada. Recursos próprios inativos/revogados continuam negados.

Origem: pedido de continuidade do usuário dentro do requisito já aprovado de isolamento/privacidade. O incremento não aprova políticas concorrentes T03-S2b/S3, cadastro/cofre, modelo, custos ou operação externa. Map/catálogo continuam protótipos.

## Arquivos e comportamento

- `apps/api/src/engine/resource-resolver.ts`: contexto de organização não vazio, tipo correto e tenant exato; ausência de orgId deixa de ser wildcard. Verificação de estado vem depois da propriedade; orgId não é normalizado para conceder acesso.
- `resource-tenant-security.spec.ts`: 36 novos testes com resolvedor, validador e classes Nest reais. Casos próprios Alpha/Beta, organizações ausentes/malformadas, ausência/alheio/tipo errado/inativo e erros agregados.
- `apps/api/src/auth/workflow-container.spec.ts`: dez cenários novos em cada transporte (20 controles). Revisão/ativação Alpha/Beta negam recursos alheios e inexistentes com corpo/status iguais, preservando estado e zero escritas/snapshots; positivos geram snapshot do workflow próprio.
- `resource-resolver.spec.ts` e `tests/regression/triggers-email.test.mjs`: quatro expectativas adaptadas ao erro uniforme, mantendo a exigência de rejeição. Frontend trata mensagens/códigos genericamente; RESOURCE_NOT_FOUND já existia no contrato. Código legado declarado preservado.

Catálogo de modelos, aliases, schema/banco, serviços externos, worker e LIVE não foram modificados.

## Evidências

| Controle | Resultado | Alcance |
| --- | --- | --- |
| Red comportamental | 45 falhas, 91 positivos, 136 casos | Resolver/validação/container; [log](evidence/t03-resource-security-2026-10-13/behavior-red.log) |
| Green direcionado | 136/136 em três suítes | Inclui 36 novos unitários + 20 novos API + 80 existentes |
| Nativos direcionados | Duas falhas antes → 7/7 | Adaptador de TypeScript/Nest sintético; [red](evidence/t03-resource-security-2026-10-13/native-red.log), [green](evidence/t03-resource-security-2026-10-13/native-green.log) |
| Projeto Jest completo | 685/685 em 36 suítes | 56 controles novos; identidade/storage/IA fake quando externos |
| Regressões completas | 179/179 | Inclui controles T08/cliente anteriores |
| Tipos/Prisma validate/builds | Exit 0 | API, web, artefato DI; nenhuma migração ou DB real |
| Lint/operação | Exit 0 | Scanner heurístico 142 arquivos e operação estática |
| Avaliação offline | Seis técnicos aprovados, três não exercitados; zero fetch | Não avalia modelo/semântica; notas humanas null |
| Estabilidade | 146 entradas iguais antes/depois, dez checks exit 0 | Manifests/lockfile incluídos; árvore instalada não exaustivamente hasheada |

[Recibo completo e comandos](T03_RESOURCE_SECURITY_CHECKS_2026-10-13.json), [green](evidence/t03-resource-security-2026-10-13/green.log), [offline](evaluation/T03_RESOURCE_SECURITY_OFFLINE_REPORT_2026-10-13.json).

O primeiro [red](evidence/t03-resource-security-2026-10-13/red.log) incluiu quatro erros na fixture positiva: snapshot guarda workflowId, não orgId direto. Corrigidos antes da prova válida; não foram contados como defeitos do produto. Fonte de produção estava intacta durante o red válido, com backup/hash preservados.

Revisão independente somente em leitura, sem reexecução de testes: nenhum defeito material no delta. [Parecer e fontes](evidence/t03-resource-security-2026-10-13/code-review.json), [compatibilidade dos consumidores](evidence/t03-resource-security-2026-10-13/error-consumers.json).

## Limites e próxima ação

AppModule/Express/guards reais usam identidade/Prisma/IA fake; TCP limitado a porta efêmera loopback e fetch externo proibido. JSON/status iguais não certificam equivalência de tempo. Organização é validada quanto a tipo/conteúdo vazio, sem prova de formato canônico. Map não comprova DB/cofre/revogação/segredos reais ou isolamento integral de produção.

T03-S2b/S3/modelos continuam com aprovação específica não recuperada. Próxima ação: fechar contrato mínimo de recursos, autoridade, revogação/destinos e modelo/custos; depois implementar/validar integrações no ambiente autorizado. T08 permanece em andamento, aguardando browser e critérios dos próximos incrementos.

Sem instalação, migration, consumo comercial, Clerk/PostgreSQL reais, commit/push/deploy nesta etapa. LIVE bloqueado, worker standby e webhook público 503 mantidos.

## Reprodução pelo CMD

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
set "PATH=%CD%\.tools\node-v24.21.0-win-x64;%PATH%"
npm run test --workspace @flowmind/api -- --runInBand resource-tenant-security.spec.ts resource-resolver.spec.ts workflow-container.spec.ts
node --experimental-vm-modules --test tests/regression/triggers-email.test.mjs
npm test
npm run test:regression
npm run typecheck
npm run build
```

Dez checks foram executados individualmente e têm commands/logs/hashes no recibo; o scanner e a operação são estáticos, não CI remoto/go-live.

## Memória

[Plano](../plan.md), [MEMORIA](MEMORIA.md), [contexto](PROJECT_CONTEXT.md) e matriz atualizados no filesystem canônico. [Retorno Obsidian](evidence/t03-resource-security-2026-10-13/obsidian-readback.json) e [integridade](evidence/t03-resource-security-2026-10-13/final-integrity.json) verificam conclusão.

AI MEMORY memory_status request 133 foi recusado (ConnectionRefusedError), sem transferência/captura atual comprovadas. [Manifesto de 29 páginas pendentes](AI_MEMORY_SYNC_PENDING_2026-10-12.json).

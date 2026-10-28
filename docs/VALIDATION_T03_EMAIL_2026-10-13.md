# T03 — endereços literais iguais na revisão e execução

Checkpoint local do principal em 13/10/2026. A revisão aceitava destinatário com espaços depois de trim e replyTo literal inválido; o executor já os rejeitava. [Validação compartilhada](../apps/api/src/engine/workflow-validation.ts) agora usa o mesmo predicado existente, antecipando a rejeição. Não remove espaços silenciosamente nem define uma nova política de envio.

- Destinatário literal com espaços é negado antes de revisão/ativação/simulação.
- replyTo literal inválido é negado também em draft/proposta parcial; ausência de bodyTemplate não esconde um valor inválido já fornecido.
- replyTo opcional ausente/vazio e referência válida continuam compatíveis. Valores dinâmicos ainda exigem resolução/revalidação; não há garantia de disponibilidade entre ramos.
- Falhas de geração mantêm consumo seguro e erro genérico, sem endereço privado. Não houve provedor de e-mail, envio real, recurso, quota ou join novo.

## Prova e alcance

**26 falhas/4 controles** antes da correção; **30 novos testes aprovados**. Negativas de revisão/publicação mostram zero writes/snapshots; simulação nega antes do primeiro nó. Draft parcial, geração, privacidade e quatro controles positivos preservados. Fixtures de storage/identidade são sintéticas, sem banco/transação/autenticação real. Uma incompatibilidade de description na tipagem da fixture foi corrigida antes da rodada red; log preservado.

Snapshot completo: **573 Jest/34 suítes, 136 regressões**, scanner heurístico em 134 arquivos; dez comandos exit 0 em **138 entradas/dependências estáveis**. Prisma validate, tipos, builds API/web, artefato, operação estática e avaliação offline passaram. [Recibo](T03_EMAIL_CHECKS_2026-10-13.json), [red](evidence/t03-email-2026-10-13/email-red.log), [green](evidence/t03-email-2026-10-13/email-green.log).

[T10-S4a/S4b/S4c](VALIDATION_T10_PROPOSAL_2026-10-13.md) preservados: propostas recebem guardas/avisos, editor apresenta warnings e consumo declarado em erro. Componente SSR tem quatro casos; browser não disponível. Interface completa/Clerk/DB/HTTP TCP de negócio/fila/CI/Docker/modelo comercial continuam pendentes. LIVE bloqueado, webhook público 503 e worker standby.

[Relatório offline](evaluation/T03_EMAIL_OFFLINE_REPORT_2026-10-13.json): seis verificações técnicas aprovadas, três não exercitadas, notas humanas null e zero fetch. Não certifica interpretação da intenção, faturamento, entrega ou segurança operacional integral.

[Revisão independente](evidence/t03-email-2026-10-13/code-review.json) em leitura: cinco arquivos de implementação e três testes, diffs contra backups, sem defeitos materiais; sem aceite de produção. [Integridade](evidence/t03-email-2026-10-13/final-integrity.json) e [leitura Obsidian](evidence/t03-email-2026-10-13/obsidian-readback.json) confirmam o checkpoint. Hashes cobrem fontes/manifests/lockfile e logs/artefatos selecionados, não toda a árvore de dependências instalada.

## Reprodução pelo CMD

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
set "PATH=%CD%\.tools\node-v24.21.0-win-x64;%PATH%"
npm run typecheck
npm test
npm run test:regression
npm run build
npm run check:api-artifact
npm run lint
npm run check:operation
npm run eval:offline
```

Backup: `C:\Users\jv883\AppData\Local\Temp\flowmind-t03-email-20261013-ibqa8dwo`. Próximos: [decisão de convergência](T03_AVAILABILITY_PROPOSAL.md), [contrato de recursos](T03_RESOURCE_PROPOSAL.md), browser e gates reais. [Plano](../plan.md), [memória](MEMORIA.md).

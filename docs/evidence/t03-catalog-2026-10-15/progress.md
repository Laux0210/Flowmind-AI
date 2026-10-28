# Execução — docs/T03_RESOURCE_IMPLEMENTATION_PLAN.md

15/10/2026: usuário respondeu **A** à escolha catálogo configurado pela equipe versus credenciais próprias por empresa. R1–R5 locais autorizadas; convergência T03-S2b, modelo comercial, segredos, instalações, migrations e serviços reais não incluídos.

## Preflight
- R1 → R2: catálogo explícito e autorização por organização; eliminar fallback global.
- R2 → R3: catálogo compartilhado por DI; lista vazia válida distinta de falha.
- R3 → R4: DTO público; preservar DRAFT e negar respostas de contexto obsoleto.
- R4 → R5: conferir fontes antes/depois e manter gates reais.
- Adaptação operacional: checkout existente e backups completos preservados; sem troca de branch/commit/limpeza. Scripts da skill que dependem de commits não serão usados. Custo: revisão usa diferenças contra backup, sem histórico de commits desta entrega.
- Concorrência: documentos voltaram a alegar aprovação de S2b e modelos a partir de continuidade genérica. Esta execução registra somente a resposta A à pergunta específica T03-S3; não altera tais políticas de motor.

## Tarefas
- R1: concluída localmente — 31/31 direcionados, typecheck exit 0. Red comportamental 29 falhas/2 controles. Primeiras tentativas de carregamento/configuração de runner não contadas como prova funcional.
- R2: concluída localmente — 13/13 direcionados, 734 Jest/38 suítes e 184/184 regressões. Fixtures explícitas em testes; três positivos antigos passaram a selecionar modelo sintético concreto. Native: concessões de organizações sintéticas explícitas; erro genérico atualizado. Assinatura ReadonlyArray evita falso positivo do scanner, sem modificar seu funcionamento.
- R3: concluída localmente — 14/14 HTTP loopback no AppModule, guards/serviço reais e identidade/storage sintéticos. Red funcional 14 falhas; tentativa inicial com body unknown foi erro de tipagem do teste, não evidência funcional.
- R4: concluída localmente — 16/16 novas regressões; hook real sob controle sintético de refs/effects/cleanup e SSR real do select. Sem prova de lifecycle/browser. Red inclui método/API ausente e hook ainda inexistente; comparação inicial de ordem de atributos SSR corrigida sem alterar semântica.
- R5: checkpoint anterior concluído; aceite atual pendente por novas edições concorrentes e falhas de typecheck/Jest. Revisão DI01 corrigida e provas anteriores preservadas. Recibos de retorno e integridade final acompanham a etapa.

## Revisão final

Revisor independente em leitura encontrou DI01 (Important): gerador aceitava catálogo interno quando DI ausente. Red: 1 falha/6 controles em ai-container. Correção: ResourceResolver obrigatório e sem fallback; 7/7 controles e conjunto completo aprovados no checkpoint anterior. Sem outros achados materiais. Limites e decisões sobre itens não julgados em code-review.json.

## Fechamento R5

Dez checks exit 0, 751 Jest/39 suítes, 201 regressões, 159 entradas estáveis. DI01 RED→GREEN 1/6 → 7/7; conjunto completo verde. Recebidas alterações concorrentes de JOURNEY03/artefato; origens preservadas, primeira execução não aceita. Navegador validou componentes/hook reais com identidade/fetch/CSS sintéticos, seleção/aplicação/preservação/respostas antigas/erro/vazio/Tab/foco; zero erros de console. Não encerra integração Next/Clerk/banco/mobile. Sem menores adiados da revisão. Fonte de aprovação é A apenas para catálogo. Sem commit/branch/limpeza, conforme instruções. AI MEMORY request135 recusado; atualizar manifesto/Obsidian e conferir integridade final.

## Tentativa posterior não aceita

A implementação A possui um checkpoint local aprovado anterior, preservado em [verified-checkpoint](verified-checkpoint/checks.json). Após novas edições paralelas, a última tentativa teve typecheck exit 2 e Jest exit 1: seis suítes incompatíveis com o quarto argumento agora obrigatório de WorkflowsService e uma com erro de sintaxe em workflows.service.spec.ts. Foram executados 506 testes Jest, todos aprovados, mas sete suítes não compilaram; isso não é aceite do conjunto. Os outros oito comandos passaram e 201 regressões passaram naquela tentativa. As fontes mudaram durante e depois dela. [Recibo da tentativa não aceita](latest-failed-checks/checks.json). **Aceite R5 do checkout atual pendente:** coordenar um único editor, concluir as edições e validar fontes estáveis. Nenhuma alteração alheia foi revertida.

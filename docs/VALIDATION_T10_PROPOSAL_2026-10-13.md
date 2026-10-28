# T10-S4a/S4b/S4c — propostas, avisos e consumo declarado

Checkpoint do principal em 13/10/2026. [AiGeneratorService](../apps/api/src/ai/ai-generator.service.ts) reutiliza as guardas de config, referência e destinatário antes de devolver uma proposta. Ausência de campos obrigatórios mantém o draft com avisos; valor inválido, referência impossível, C03 presente inválido ou schemaVersion incompatível impedem aplicação.

Revisão humana continua obrigatória. O gerador não salva, ativa, simula ou executa o workflow. Disponibilidade entre ramos/opcionais/modos, recursos por organização e qualidade semântica não foram aprovados por estas verificações.

## Evidências e limites

- **43 falhas/4 positivos** antes da correção; **47 testes novos** aprovados. Cobrem seis tipos, campos/headers privados, referência ausente/futura/própria, saída/caminho inválido, tipo boolean incompatível, C03, draft parcial, schemaVersion, consumo e parser OpenAI sintético.
- Consumo inválido/ausente vira null; zero e total inteiro seguro não negativo são preservados. Erros controlados mantêm consumo observado com AI_INVALID_WORKFLOW_RESPONSE, sem IDs/campos/conteúdo da proposta no corpo de erro.
- Snapshot S4a: **543 Jest/33 suítes, 110 regressões**, scanner 131 e 135 entradas estáveis. [Recibo histórico](evidence/t10-proposal-2026-10-13/s4a-accepted/checks.json), [red](evidence/t10-proposal-2026-10-13/proposal-red.log), [green](evidence/t10-proposal-2026-10-13/proposal-green.log).
- **Snapshot atual S4c: 543 Jest/33 suítes, 136 regressões**, scanner 133 e dez comandos exit 0, em 137 entradas/dependências estáveis. [Recibo atual](T10_PROPOSAL_CHECKS_2026-10-13.json).
- Primeira rodada completa encontrou três expectativas Jest e uma nativa anteriores: campo de score desconhecido agora é negado antes do avaliador; consumo infinito é normalizado como desconhecido. Negativas conservadas com erro/consumo explícitos; controle de score em JSON permitido de operando continua falhando, sem nota humana. [Rodada arquivada](evidence/t10-proposal-2026-10-13/failed-check-1/checks.json).
- [Relatório offline](evaluation/T10_PROPOSAL_OFFLINE_REPORT_2026-10-13.json): seis verificações técnicas aprovadas, três não exercitadas, médias/notas humanas null e zero fetch. Template não prova interpretação de linguagem natural ou qualidade do modelo.

Uma falha inicial de compilação do teste e uma fixture que invalidava referências posteriores foram corrigidas; logs preservados. Não houve instalação, modelo comercial, banco, Clerk, fila, HTTP TCP de negócio, browser, CI remoto, migration ou deploy. Serviços reais e aceites comerciais mantêm seus próprios gates.

## Avisos no editor e alcance da apresentação

[ProposalWarnings](../apps/web/src/components/workflows/proposal-warnings.tsx) apresenta warnings recebidos antes de aplicar a proposta, com lista nomeada, rolagem/teclado e quebra de texto configurados. Os avisos de campos ausentes usam nomes em português. Aplicar mantém DRAFT; avisos não equivalem a revisão formal ou permissão para executar.

[Quatro renders SSR do componente exato](evidence/t10-proposal-2026-10-13/preview-build.json) incluem pendências geradas pelo serviço compilado, lista vazia, texto longo/HTML literal e lista extensa. Lista vazia não rende markup e texto perigoso foi escapado. O conector devolveu Browser is not available: iab; inventory com apps=[] e browsers=[]. Layout, foco, acessibilidade assistiva, hydration e interação do editor **não foram validados**. Preview localhost estático foi encerrado; não usou autenticação/dados reais.

## Consumo em falhas de geração

[ApiClient](../apps/web/src/lib/api-client.ts) usa AiGenerationRequestError somente no erro HTTP da rota de geração. Apenas códigos controlados de IA podem fornecer consumo; valor deve ser inteiro seguro não negativo. Não transporta corpo/detalhes privados. Falha sem JSON, uso inválido ou código não reconhecido resultam em null. Rotas comuns e ausência de token não recebem essa medição.

O callback real do editor mostra Consumo declarado ou Consumo não informado; limpa a proposta anterior e preserva contexto/flags. **23 falhas/3 controles** antes, **26 regressões aprovadas**; [red](evidence/t10-proposal-2026-10-13/usage-red.log), [green](evidence/t10-proposal-2026-10-13/usage-green.log). O teste foi incluído em test:regression. Prova por AST/classe real com fetch/setters sintéticos; não é React lifecycle, browser ou faturamento.

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

Backups: `C:\Users\jv883\AppData\Local\Temp\flowmind-t10-proposal-20261013-4kvc1p7v`, `flowmind-t10-warnings-20261013-tgax7fwz` e `flowmind-t10-usage-ui-20261013-dtyq07fi`, sob o mesmo diretório temporário. [Convergência aguardando decisão](T03_AVAILABILITY_PROPOSAL.md), [recursos candidatos](T03_RESOURCE_PROPOSAL.md), [plano](../plan.md), [memória](MEMORIA.md).

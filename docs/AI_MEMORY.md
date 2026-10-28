# FlowMind AI — AI MEMORY

Histórico de conexão/transferências a pedido do usuário. Atualização em 15/10/2026: o servidor recusou a conexão; o checkpoint local atual ainda não foi transferido.

## Conexão e escopo

- Última conexão comprovada: servidor MCP `ai-memory`, versão 2.6.3, em `http://127.0.0.1:49374/mcp`. A consulta atual de `memory_status`, no mesmo escopo, falhou com `ConnectionRefusedError`. Não afirmar conexão ativa ou atualização atual.
- Configuração global existente conferida em leitura; marcador existente `.ai-memory.toml` preservado.
- Escopo explícito: `workspace=flowmind-ai`, `project=flowmind-ai`. Não usar o último projeto ativo do servidor nem gravar em escopo global.
- O workspace ainda não tinha cadastro. A primeira gravação criou o cadastro correspondente ao marcador; não foi encontrado contexto anterior do FlowMind na busca global.
- Leitura/gravação e busca verificadas. Esta transferência não instala serviços, configura captura automática ou substitui as notas do Obsidian.

## Memória transferida

| Fonte | Página no AI MEMORY |
| --- | --- |
| Resumo consolidado | `notes/flowmind-contexto-continuidade.md` |
| [MEMORIA.md](MEMORIA.md) | `imports/obsidian/docs/MEMORIA.md` |
| [plan.md](../plan.md) | `imports/obsidian/plan.md` |
| [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) | `imports/obsidian/docs/PROJECT_CONTEXT.md` |
| [AGENT_TEAM.md](AGENT_TEAM.md) | `imports/obsidian/docs/AGENT_TEAM.md` |
| [VALIDATION_R05.md](VALIDATION_R05.md) | `imports/obsidian/docs/VALIDATION_R05.md` |
| [QA_SECURITY_MATRIX.md](QA_SECURITY_MATRIX.md) | `imports/obsidian/docs/QA_SECURITY_MATRIX.md` |
| [VALIDATION_T04_R08.md](VALIDATION_T04_R08.md) | `imports/obsidian/docs/VALIDATION_T04_R08.md` |
| [VALIDATION_T06_AUTH.md](VALIDATION_T06_AUTH.md) | `imports/obsidian/docs/VALIDATION_T06_AUTH.md` |
| [CONCURRENT_EDITING_T06.md](CONCURRENT_EDITING_T06.md) | `imports/obsidian/docs/CONCURRENT_EDITING_T06.md` |

A transferência inicial continha seis páginas. O checkpoint T04 R08 atualizou resumo, memória, plano e contexto, acrescentando matriz e validação: oito páginas e 16 versões naquele momento. Cada gravação foi lida de volta; a busca recuperou o checkpoint no escopo correto. [Recibo T04](AI_MEMORY_TRANSFER_T04_R08.json).

O checkpoint T06 inicialmente chegou a nove páginas e 21 versões, com leitura idêntica e busca confirmada. Registra sessão/membership/upsert obrigatórios, 20 regressões de auth, 16 testes de rotas e snapshot de 131 Jest/68 regressões. Após qualificar os relatos concorrentes e acrescentar o registro de divergência, são dez páginas e 24 versões verificadas. [Recibo T06](AI_MEMORY_TRANSFER_T06_2026-10-12.json).

Outra execução substituiu memória/plano após a primeira cópia. Os cabeçalhos agora distinguem o checkpoint comprovado de relatos de conclusão integrada; as cópias qualificadas foram lidas de volta. A escolha da sessão coordenadora foi solicitada ao usuário. Não tratar relatos paralelos como aprovação ou evidência de integração.

O contexto transferido anteriormente continha checkpoints T04/T06. É uma cópia histórica; o estado canônico atual, C03/container/storage, está no Obsidian. Não usar os números antigos como evidência das fontes atuais.

Cada corpo foi lido novamente e comparado com o enviado. O servidor sanitizou uma única linha da fixture Clerk na validação R05; a nota original continua intacta. [Recibos e hashes](AI_MEMORY_TRANSFER_2026-10-12.json).

## Consulta nas próximas sessões

Com as ferramentas MCP disponíveis, consultar o mesmo escopo:

```json
{"workspace":"flowmind-ai","project":"flowmind-ai"}
```

- `memory_status` confere cadastro/contagens.
- `memory_query` com `query: "FlowMind"` recupera contexto; o modo padrão não solicita síntese por LLM.
- `memory_read_page` com o caminho acima lê uma página inteira.
- A ferramenta `memory_write_page` cria/atualiza páginas duráveis quando o usuário pede para lembrar/salvar.

Nesta sessão as ferramentas não apareceram diretamente no catálogo do agente; a conexão foi validada pelo transporte MCP HTTP configurado. Não foi alterada a configuração pessoal para forçar recarregamento.

Obsidian permanece a fonte canônica e continua obrigatório nos eventos de AGENTS.md. Esta é uma cópia de contexto, não uma sincronização contínua do vault. O status após a importação apresentou zero sessões/observações: captura automática não comprovada.

## Continuidade e sincronização pendente

- Canônico: [MEMORIA](MEMORIA.md), [plano](../plan.md), [resultado T03-S3/A](VALIDATION_T03_CATALOG_2026-10-15.md). R1–R5 revalidadas localmente na retomada, com dez comandos aprovados e fontes estáveis. As páginas preservam o histórico de falhas e o novo checkpoint; A não aprova S2b, modelo comercial, cofre ou integração real.
- Última consulta em 15/10: memory_status request 136 no escopo FlowMind, ConnectionRefusedError; sem gravação. [Recibo](evidence/t03-catalog-resume-2026-10-15/ai-memory-status.json). Captura automática não demonstrada; dez páginas/24 versões são histórico.
- [33 páginas pendentes](AI_MEMORY_SYNC_PENDING_2026-10-12.json), incluindo contrato aprovado, resultado local e relatos concorrentes qualificados. Manifesto enumera hashes/fontes; não é transferência.
- Preservar metadata e usar somente workspace=flowmind-ai, project=flowmind-ai. Ler corpos de volta e conferir hashes/busca/status. Não instalar/iniciar serviço nem alterar configuração para contornar a recusa.

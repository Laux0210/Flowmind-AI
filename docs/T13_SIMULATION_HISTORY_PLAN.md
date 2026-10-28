# T13 — proposta de integração da simulação com o histórico

Status em 23/10/2026: **Opção A aprovada formalmente pelo usuário em 23/10/2026** (registrar `SIMULATION` obrigatoriamente no histórico com falha estrita 503 se indisponível, isenta da cota comercial `LIVE`). Implementação já consolidada e validada localmente; persistência física aguarda T06. [Contexto](PROJECT_CONTEXT.md).

## Problema confirmado

O checkpoint inicial não possuía captura de simulações. Outra execução acrescentou `ExecutionsService` ao `WorkflowsService` e preservou o ID do motor/autoria da sessão; o código agora tenta registrar SIMULATION e exclui esse modo da cota. Essa implementação antecipou a hipótese A, sem resposta à escolha do usuário nesta sessão. Foi preservada para revisão, sem promovê-la a política aprovada.

As rotas do AppModule foram exercitadas em memória: Alpha/Beta consultam o ID salvo apenas na organização própria; autoria forjada no JSON é ignorada; FAILED é registrado; falha de gravação retorna 503. Esses comportamentos são comuns às duas opções abaixo e não aprovam cobrança. O transporte, identidade e storage reais continuam pendentes.

## Decisão necessária

| Opção | Comportamento | Custo e complexidade | Risco |
| --- | --- | --- | --- |
| A — recomendada | Registrar SIMULATION no histórico, separada da cota de execuções LIVE | Acrescentar contagem elegível ao DTO e filtrar modo; sem migration | Simulações também consomem recursos/storage: limites próprios continuam pendentes |
| B | Registrar SIMULATION e LIVE na mesma cota | Preserva contagem atual; menor alteração de consumo | Experimentação reduz o saldo da organização; precisa ficar explícita para o usuário |

Recomendação A: permite revisar/testar sem confundir teste com execução comercial. O número provisório 1000, preços, calendário comercial e limites de simulação não recebem aprovação automática ao escolher A ou B. Consumo de tokens permanece desconhecido quando não medido.

## Implementação proposta após a escolha

1. Principal edita `WorkflowsController/Service/Module`, `ExecutionsService`, `UsageLimitsService`, contratos, consumidores History e testes; arquivos compartilhados têm um único editor.
2. Passar `userId` do AuthContext para simulação; organização, definição e versão continuam obtidas no servidor.
3. Registrar horários e resultado COMPLETED/FAILED sanitizado, com ID do motor consultável no histórico. Uma falha de gravação retorna 503; não apresentar persistência fictícia.
4. Aplicar o filtro/reserva de quota da opção escolhida. Em A, distinguir total histórico de execuções elegíveis no relatório; em B, manter a contagem de ambos os modos.
5. Importar ExecutionsModule em WorkflowsModule e validar DI do AppModule/artefato; manter providers externos substituídos em testes.
6. Atualizar mensagens da History e documentação; preservar decisões T02 e bloqueio de LIVE.

## Lacunas remanescentes no protótipo

- `ExecutionsService` é opcional no construtor; sua ausência permite devolver a simulação sem histórico. Fechar a obrigatoriedade ao aceitar o contrato de captura, preservando testes/consumidores pertinentes.
- `totalExecutions` conta apenas LIVE no protótipo. Se A for escolhida, explicitar essa métrica e distinguir total histórico de consumo elegível; não há limite comercial ou franquia de simulação aprovada.
- A gravação ocorre depois do motor; 503 não implica que a simulação deixou de rodar. Nenhum efeito externo LIVE foi autorizado.
- As provas de ID/autoria/falha usam AppModule real com storage/identidade sintéticos. Não comprovam PostgreSQL, retenção ou concorrência distribuída.

## Critérios de aceitação locais

- POST de simulação autenticada → ID → GET detalhe e listagem na organização própria.
- Alpha/Beta recuperam seus recursos e recebem 404 para recursos alheios; payload/header não escolhem organização ou autoria.
- Resultado FAILED é persistido e exibido como falha, distinto de erro HTTP/persistência.
- Gravação indisponível retorna 503 e não deixa reserva local; contagem segue exatamente A ou B, sem tokens inventados.
- Atualizar consumidores/fixtures e comprovar tipos, Jest, regressões, builds e artefato, sem rede comercial ou portas.

Depois desses testes, PostgreSQL/Clerk, concorrência distribuída, retenção, rate limiting, jobs, migrations e publicação continuam gates separados. Escolher a política não autoriza instalações ou serviços reais.

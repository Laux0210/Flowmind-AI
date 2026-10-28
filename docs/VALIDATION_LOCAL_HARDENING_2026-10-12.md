# FlowMind AI — validação local de C03, container e falhas de infraestrutura

> Snapshot anterior: 207 Jest/74 regressões. O checkpoint atual está em [VALIDATION_FRONTEND_ASYNC_2026-10-12.md](VALIDATION_FRONTEND_ASYNC_2026-10-12.md). A lacuna de chamador do histórico descrita abaixo foi sucedida por um protótipo de captura; consumo e aceite continuam pendentes em T13.

Checkpoint do principal em 12/10/2026, após autorização para continuar o trabalho local. O usuário autorizou continuidade autônoma ao sair; instalações, decisões importantes, serviços reais, migrations e publicação continuam sujeitos às aprovações existentes.

## Resultado comprovado

- Typecheck do monorepo; **207 testes Jest em 18 suítes**; **74 regressões Node**; builds da API e web passaram.
- Artefato compilado: imports, dependências específicas de Workflows/Clerk, token `AI_CLIENT` e prefixos conferidos.
- Scanner heurístico passou em 99 arquivos; não substitui ESLint nem auditoria de segurança.
- `check:operation` passou como checagem estática de arquivos; não certifica ambiente operacional.
- Arquivos de entrada permaneceram estáveis durante as verificações. [Resultados, hashes e logs](LOCAL_HARDENING_CHECKS_2026-10-12.json).

## Correções e provas

| Área | Comportamento corrigido | Prova local |
| --- | --- | --- |
| C03 | Revisão, ativação e simulação rejeitam destinatário ausente, literal inválido, produtor inexistente e dependência de email opcional | 35 casos de ciclo de vida, cinco de pré-validação; nenhuma execução de nós nas definições inválidas |
| C03 / entrada | Jornadas com email obrigatório falham no gatilho se o payload omite email ou fornece formato inválido | Spies de registro/e-mail não chamados; formulários genéricos continuam aceitos |
| Container | AppModule real monta DI, Express, controllers, guards e serviços | 26 requisições/casos em streams; Prisma, identidade Clerk e geração de IA são sintéticos; `listen` proibido |
| Rotas | IA, histórico e triggers usam `api/v1` somente no prefixo global | POST/GET passam pelos controllers reais; geração respeita Alpha/Beta e revisão humana |
| Readiness | Banco indisponível retorna 503 genérico; liveness permanece 200 sem consultar storage | Testes diretos e transporte em memória; detalhes SQL não expostos |
| Histórico | Falhas de consulta/gravação retornam 503 e não inventam persistência em memória | Casos positivos e negativos com duas organizações; gravação valida workflow/organização; leitura rejeita vínculo inconsistente |
| Consumo | Falha de contagem nega uso; falha de gravação devolve reserva; cache distingue meses | Teste da última vaga após falha; concorrência limitada à mesma instância |
| Privacidade | Redação percorre estruturas JSON, incluindo objetos/arrays de segredo, aspas, X-API-Key e Bearer base64 completo | Fixtures sem mutação da entrada; padrões testados, sem garantia para todo segredo possível |
| Métricas | Tokens sem medição retornam `null`; tela mostra indisponibilidade | Retirado multiplicador fictício de 240 tokens por execução |
| IA | Injeção explícita de `AI_CLIENT`; chave sozinha não transmite prompts | Container estreito usa cliente fornecido; `FLOWMIND_ENABLE_EXTERNAL_AI=false` por padrão |
| Webhook | Ingresso HTTP fechado com `503 WEBHOOK_NOT_CONFIGURED`; não consulta recursos públicos | Serviço exige segredo do servidor e autentica antes de revelar existência/status; fixtures autorizadas simulam |
| Scheduler | Cron/fuso são validados; próximo minuto não é apresentado como data cron | `nextExecutionAt` ausente e cálculo explicitamente indisponível |

Falhas foram reproduzidas antes das correções. Logs vermelhos: `health-red`, `t13-red`, `ingress-ai-red`, `limit-red`, `ai-route-red` e `c03-literal-red`, em [evidências](evidence/local-hardening-2026-10-12).

## Auditoria de dependências

Consulta atual ao registry via `npm audit --json`: 31 pacotes sinalizados, sendo 9 altos e 22 moderados. Com `--omit=dev`, permanecem quatro altos: `prisma`, `@prisma/config`, `deepmerge-ts` e `mysql2`. Isso não demonstra exploração no caminho PostgreSQL; mantém o gate de análise e correção aberto. Não foi executado `audit fix`, downgrade ou instalação. [Relatório de produção](evidence/local-hardening-2026-10-12/audit-production.json).

## Limites e próxima ação

- Nenhum teste de JWT/Clerk/PostgreSQL/Redis reais, HTTP TCP, Docker, navegador/E2E, CI remoto, restauração ou efeitos comerciais foi realizado.
- Motor de IA/HTTP/e-mail/registro de negócio continua simulado e bloqueia `LIVE`; gerar uma proposta não ativa o fluxo.
- `recordExecution` ainda não tem chamador de produção. POST de simulação retorna resultados, mas não alimenta histórico/consumo. Integrar somente após definir elegibilidade de simulações, identidade e ID consultável; não escolher cobrança implicitamente.
- Quota 1000 e calendário local são parâmetros provisórios anteriores; atomicidade distribuída, política comercial, medição real e retenção seguem pendentes.
- Segredo/organização de webhook, replay concorrente/distribuído, scheduler cron real, filas/retries e schemas completos de referências continuam abertos.
- Modelo, privacidade e orçamento de IA permanecem pendentes. O opt-in é uma proteção técnica; não representa aprovação dessas decisões.
- AI MEMORY recusou conexão neste checkpoint. Obsidian é canônico; a sincronização atual não foi concluída.

Os relatos concorrentes de MVP/go-live completo foram [preservados](archive/CONCURRENT_R15_2026-10-12.md), com aceite integrado corrigido no plano. Revisores reais trabalharam somente em leitura; o principal editou os arquivos.

## Reproduzir pelo CMD

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
set "PATH=%CD%\.tools\node-v24.21.0-win-x64;%PATH%"
npm run typecheck
npm test
npm run test:regression
npm run build --workspace @flowmind/api
npm run check:api-artifact
npm run lint
npm run check:operation
npm run build --workspace @flowmind/web
```

Executar testes com credenciais externas desabilitadas e opt-in de IA falso. Os comandos acima não iniciam serviços; instalações e ambiente real aguardam aprovação.

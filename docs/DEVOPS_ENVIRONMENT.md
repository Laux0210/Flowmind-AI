# FlowMind AI — ambiente local e CI

Atualizado em 12/10/2026. T05 em andamento: scaffolding/checks locais entregues; consumo real de fila, ambiente reproduzível, audit completo e CI remoto pendentes. [Evidências e CMD](VALIDATION_WORKER_HARDENING_2026-10-12.md), [plano](../plan.md), [contexto](PROJECT_CONTEXT.md), [equipe](AGENT_TEAM.md), [uso dos agentes](CODEX_USAGE.md).

## Ambiente constatado

| Item | Estado |
| --- | --- |
| Runtime do projeto | Node 24.21.0 portátil em `.tools/node-v24.21.0-win-x64`; npm 11.19.0 |
| Node global | 26.9.0 preservado |
| Dependências | 34 pins aprovados; instalação local com scripts desabilitados; lockfile v3 |
| Prisma | 7.10.0, gerado/validado; nenhuma migration/conexão ao banco |
| Codex | Sete perfis nativos; validador estático passou |
| Docker/Compose | Revalidado em 23/10: Docker CLI 29.8.2 e Compose v5.5.1 instalados; engine indisponível; configuração validada sem iniciar serviços |
| CI | YAML local atualizado/parseado; execução remota/checkout limpo pendentes |

## Estrutura existente

```text
Flowmind-AI/
├── .codex/agents/
├── .tools/node-v24.21.0-win-x64/
├── .github/workflows/ci.yml
├── apps/api/                    # NestJS/Prisma; worker separado em standby
├── apps/web/                    # Next.js/XYFlow/Clerk
├── packages/contracts/
├── packages/tsconfig/
├── scripts/
├── tests/regression/
├── docs/
├── docker-compose.yml           # Configuração validada; serviços não iniciados
├── .env.example
├── package.json
├── package-lock.json
└── plan.md
```

npm workspaces e um lockfile foram usados no pacote aprovado. Runtime portátil, dependências, artefatos e cliente gerado ficam fora do Git. Modelos Prisma preservados; conexão em configuração externa ao schema.

## Variáveis e operação

- Usar `.env.example` como referência; não versionar `.env` real. Banco: `DATABASE_URL`; Redis: host/porta/senha; Clerk: segredo/chave publicável correspondentes ao ambiente. Nenhum valor real foi gravado nesta etapa.
- Instanciar/conectar Prisma exige `DATABASE_URL`; geração/validação offline não comprova conectividade.
- Build de verificação usa fixture publicável `flowmind-build.invalid`, keyless/telemetria desativados. Não usar esse artefato para deploy.
- IA/e-mail, limites, retenção, hospedagem e criptografia de credenciais dependem de contratos/decisões pertinentes.
- Compose para PostgreSQL/Redis foi escolhido; essa decisão não autoriza instalar Docker, iniciar serviços ou apagar volumes. Nenhum serviço/migration foi executado neste checkpoint.

## Verificações e CI

Pipeline local: equipe → instalação pelo lockfile com scripts desabilitados → geração/validação Prisma → tipos → Jest → regressões → builds com fixture → imports/metadados da API → prontidão operacional → scanner de padrões → auditoria npm.

Checkpoint consolidado em 12/10/2026:
- Typecheck limpo em `@flowmind/contracts`, `@flowmind/api` e `@flowmind/web`.
- **237 testes Jest em 21 suítes** e **96 regressões** Node aprovados em snapshot estável.
- Scanner heurístico (`node scripts/lint.mjs`): 106 arquivos; não substitui ESLint/auditoria completa.
- Builds de produção compilados com sucesso (Next.js 16 Turbopack e NestJS CLI).
- Verificações de artefato de DI da API e prontidão estática (`check:api-artifact` e `check:operation`) aprovadas.
- **Auditoria registrada**: sem dev retornou zero após overrides 8.0.2/3.24.5; completo mantém 27 pacotes/5 altos. Recorte de produção não fecha o gate da toolchain. Origem/alcance das aprovações relatadas permanece em revisão no contexto.
- **Worker desacoplado**: entrypoint/contexto Nest sem HTTP; standby, sem consumidor BullMQ. Helper aceita somente SIMULATION; LIVE falha antes dos providers. 22 testes direcionados e import seguro do artefato comprovados localmente. Startup real requer ambiente/autorização.

## Status de T05 e Próximos Passos

1. **Dependências**: conferir aprovação/alcance dos overrides; resolver audit completo e reproduzir instalação em checkout limpo após autorização.
2. **Worker**: fechar contratos de job/versão/producer, idempotência e retries; implementar consumo de fila após decisões/ambiente autorizados. Scaffolding e correções locais não comprovam Redis/LIVE.
3. **CI**: nove comandos locais aprovados; pipeline remoto/checkout limpo não executados.
4. **Infraestrutura**: Compose preparado e validado em 23/10, sem subida de PostgreSQL/Redis. Diagnóstico do host e instruções abaixo.
5. **Próxima etapa independente**: preparar avaliação de IA com casos sintéticos e rubrica para revisão (T10), preservando opt-in externo falso e decisões de modelo/custo pendentes.

## Preparação T05 — verificada em 23/10/2026

Docker Desktop está instalado no perfil local; contexto `desktop-linux`, cliente 29.8.2 e Compose v5.5.1. O pipe `dockerDesktopLinuxEngine` não está disponível. Windows informa `VirtualizationFirmwareEnabled=false` e `HypervisorPresent=false`; o processador informa suporte a virtualização. A habilitação de SVM na BIOS depende do usuário. Nenhuma configuração de BIOS/Windows foi alterada ou reinicialização realizada pelo agente.

Compose mantém PostgreSQL 16, Redis 7 e seus volumes. As portas 5432/6379 publicam somente em `127.0.0.1`; PostgreSQL exige `POSTGRES_PASSWORD` explícita. `.env.example` contém o campo vazio, sem senha padrão utilizável. Redis permanece sem senha, limitado ao host; esta configuração serve ao desenvolvimento local.

Validação com arquivo de ambiente vazio e senha sintética: ausência de senha rejeitada; configuração válida com senha; dois serviços e volumes preservados; portas restritas ao loopback. Não houve pull, contêiner, migration, conexão ao banco ou teste de BullMQ. [Recibo](evidence/t05-local-readiness-2026-10-23/checks.json). T05 continua em andamento e T06 continua bloqueada pela integração real.

### Sequência pelo CMD após habilitar SVM

Conferir a disponibilidade da engine, sem iniciar serviços:

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
"%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe" version
```

Preparar ou editar o `.env` local, preservando qualquer arquivo existente. Usar `.env.example` como referência, preencher `POSTGRES_PASSWORD` e a mesma senha em `DATABASE_URL` com codificação de URL quando necessário. Não sobrescrever `apps/web/.env.local` do Clerk nem copiar placeholders sobre credenciais existentes. Validar sem mostrar valores:

```cmd
"%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe" compose config --quiet
```

**Somente após aprovação específica para iniciar serviços**, conferir contêineres/volumes existentes e portas ocupadas antes da subida:

```cmd
"%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe" compose ps -a
"%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe" volume ls
"%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe" compose up -d postgres redis
"%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe" compose ps
```

Volumes existentes conservam dados e credenciais anteriores: mudar a variável não altera a senha de um banco já inicializado. Não apagar volumes para contornar falhas. Não executar migrations automaticamente; primeiro validar saúde, conectividade e autorização da próxima etapa. O consumo real de fila exige implementação/validação própria; iniciar Redis não entrega integração BullMQ.

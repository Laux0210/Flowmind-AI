# FlowMind AI — Checklist Guiado de Publicação em Produção

Este guia orienta o provisionamento, configuração de variáveis e publicação do FlowMind AI em provedores gerenciados de baixo custo e alta confiabilidade (arquitetura recomendada em `DEPLOYMENT_OPERATIONS.md`).

---

## 📋 Visão Geral dos Serviços

| Componente | Provedor Recomendado | Tier / Custo Estimado | Função |
| :--- | :--- | :--- | :--- |
| **Banco de Dados** | [Neon.tech](https://neon.tech) ou [Supabase](https://supabase.com) | Gratuito / Hobby ($0–$19) | PostgreSQL 16 com SSL e backups automáticos |
| **Fila & Cache** | [Upstash](https://upstash.com) | Serverless ($0–$5) | Redis gerenciado para BullMQ e idempotência |
| **Autenticação** | [Clerk](https://clerk.com) | Gratuito até 10k MAUs | Gestão de sessões, usuários e organizações B2B |
| **Backend API** | [Railway](https://railway.app) ou [Render](https://render.com) | Hobby ($5) | Execução do serviço NestJS com health checks |
| **Frontend Web** | [Vercel](https://vercel.com) | Gratuito / Pro ($0–$20) | Hospedagem SSR/Edge do Next.js 14 |

---

## Etapa 1: Banco de Dados PostgreSQL (Neon / Supabase)

1. Acesse [Neon.tech](https://neon.tech) e crie um novo projeto chamado `flowmind-production`.
2. Selecione a versão **PostgreSQL 16** na região mais próxima dos seus usuários (ex: `us-east-1` ou `sa-east-1`).
3. Copie a string de conexão (com pooling ativado para ambientes serverless/containers):
   ```text
   DATABASE_URL="postgresql://[user]:[password]@[host]/flowmind-production?sslmode=require"
   ```
4. Guarde essa URL de forma segura no seu gerenciador de senhas.

---

## Etapa 2: Fila & Cache Redis (Upstash)

1. Acesse [Upstash](https://upstash.com) e crie uma base **Redis Database**.
2. Dê o nome de `flowmind-redis-prod` e selecione a mesma região do banco de dados para menor latência.
3. No painel de detalhes, localize as credenciais de conexão **Node.js / ioredis**:
   - `REDIS_HOST`: (ex: `global-redis.upstash.io`)
   - `REDIS_PORT`: `6379`
   - `REDIS_PASSWORD`: token alfanumérico fornecido

---

## Etapa 3: Autenticação B2B Multi-tenant (Clerk)

1. Acesse o [Clerk Dashboard](https://dashboard.clerk.com) e crie uma aplicação chamada `FlowMind AI`.
2. Em **Configure $\to$ Organizations**, marque **Enable Organizations**.
   - Defina os papéis padrão: `Admin` e `Member`.
3. Em **API Keys**, copie as credenciais de produção:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: `pk_live_...`
   - `CLERK_SECRET_KEY`: `sk_live_...`

---

## Etapa 4: Publicação da API Backend (Railway / Render)

1. Conecte seu repositório GitHub ao [Railway](https://railway.app) ou [Render](https://render.com).
2. Configure o serviço apontando para o monorepo:
   - **Root Directory:** `Flowmind-AI` (ou configure build workspace `apps/api`)
   - **Build Command:**
     ```bash
     npm ci && npm run build --workspace=@flowmind/contracts && npm run build --workspace=@flowmind/api
     ```
   - **Start Command:**
     ```bash
     node apps/api/dist/main.js
     ```
   - **Health Check Path:** `/health/ready`
3. Adicione as seguintes **Variáveis de Ambiente** no painel da plataforma:
   ```env
   NODE_ENV=production
   PORT=3001
   WEB_APP_URL=https://sua-url-do-frontend.vercel.app
   DATABASE_URL=postgresql://[user]:[password]@[host]/flowmind-production?sslmode=require
   REDIS_HOST=global-redis.upstash.io
   REDIS_PORT=6379
   REDIS_PASSWORD=[seu_token_upstash]
   CLERK_SECRET_KEY=sk_live_...
   OPENAI_API_KEY=sk-proj-...
   ENCRYPTION_KEY_32BYTES=[gerar_string_hex_32_bytes]
   ```
4. **Execução das Migrations do Prisma:**
   - Execute a migração do banco no terminal da Railway/Render ou via comando de deploy:
     ```bash
     npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
     ```
5. Verifique se o deploy concluiu com sucesso e teste a rota pública no navegador:
   - `https://sua-api.up.railway.app/health` $\to$ Deve responder `{"status":"ok", "service":"flowmind-api"}`.
   - `https://sua-api.up.railway.app/health/ready` $\to$ Deve responder `{"status":"ready", "database":"connected"}`.

---

## Etapa 5: Publicação do Frontend Web (Vercel)

1. Acesse o [Vercel Dashboard](https://vercel.com) e clique em **Add New $\to$ Project**.
2. Selecione o repositório GitHub do FlowMind AI.
3. Configure as opções do projeto:
   - **Root Directory:** `Flowmind-AI/apps/web`
   - **Framework Preset:** `Next.js`
4. Configure as **Environment Variables** na Vercel:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_SECRET_KEY=sk_live_...
   NEXT_PUBLIC_API_URL=https://sua-api.up.railway.app/api/v1
   ```
5. Clique em **Deploy**. A Vercel compilará o Next.js 14 e fornecerá o domínio de produção (ex: `https://flowmind-ai.vercel.app`).
6. **Ajuste Final de Origem Cruzada:** Retorne às variáveis da API Backend no Railway/Render e garanta que `WEB_APP_URL` esteja configurada exatamente com o domínio gerado na Vercel.

---

## 🛡️ Checklist de Verificação Pós-Deploy

- [ ] **Acesso Seguro:** A aplicação carrega com HTTPS e certificado SSL válido em ambos os domínios (web e api).
- [ ] **Fluxo de Autenticação:** Usuário consegue criar conta, fazer login e criar/selecionar uma organização via Clerk.
- [ ] **Dashboard:** Listagem de automações carrega vazia inicialmente com CTA para nova automação.
- [ ] **Criação por IA:** Modal "Gerar com IA" processa o prompt e redireciona para o Editor Visual com o DAG desenhado.
- [ ] **Simulador do Editor:** O drawer de simulação processa os dados sintéticos e renderiza os resultados dos 4 nós em tempo real.
- [ ] **Histórico & Auditoria:** Página `/history` exibe as métricas de consumo de execuções e tokens atualizadas.
- [ ] **Proteção de Segredos:** Ao inspecionar os passos de execução no modal de detalhes, todos os tokens e senhas aparecem como `[REDACTED]`.
- [ ] **Health Check Monitor:** O endpoint `/health/ready` responde `200 OK` continuamente aos orquestradores de nuvem.

# T05 — Diagnóstico de Atualização de Segurança do Next.js e Dependências (23/10/2026)

**Atualização do principal em23/10:** o usuário aprovou especificamente Next16.4.3, manifesto/lockfile e validações; patch instalado com scripts desativados e build aprovado. [Resultado atual](VALIDATION_T05_NEXT_SECURITY_2026-10-23.md). O texto abaixo registra diagnóstico anterior. A correção mínima indicada pelo [aviso oficial](https://nextjs.org/blog/nextjs-security-update-october-14-2026) é16.4.1;16.4.3 foi a versão candidata escolhida. As afirmações de compatibilidade/zeragem por override da Opção B permanecem hipóteses não testadas e não aprovadas nesta entrega.

Status: **Proposta diagnosticada e pronta para aprovação do usuário**. Nenhum pacote foi instalado e nenhum manifesto (`package.json` / `package-lock.json`) foi alterado nesta etapa, preservando a regra de aprovação explícita de [AGENTS.md](../AGENTS.md).

Evidência bruta: [audit-diagnosis.json](evidence/t05-next-security-diagnosis-2026-10-23/audit-diagnosis.json).

---

## 1. Causa do bloqueio de `npm run build` (`SecurityFatalError`)

Durante a execução de `next build` no workspace `@flowmind/web` (atualmente em `next@16.4.0`), a compilação Turbopack e a geração estática/dinâmica das rotas concluem sem erros de código ou tipagem, mas o CLI do Next.js interrompe o encerramento com código `1`:

```text
Error [SecurityFatalError]: Your version of Next.js is affected by a known security vulnerability.
**We strongly recommend you upgrade Next.js.**
```

A consulta ao registro oficial (`npm audit` e `npm view next`) identificou três avisos de segurança publicados para a faixa `>=16.0.0 <=16.4.0`:

| Advisory | Severidade | Descrição | Faixa afetada | Versão corrigida |
| --- | --- | --- | --- | --- |
| [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw) | Crítica | RCE não autenticado na API de Image Optimization quando arquivos SVG são utilizados | `>=16.0.0 <=16.4.0` | `16.4.3` |
| [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr) | Crítica | RCE não autenticado em funções `use cache` que retornam typed arrays | `>=16.0.0 <=16.4.0` | `16.4.3` |
| [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r) | Alta | Negação de serviço (DoS) no App Router ao utilizar Server Actions | `>=16.0.0 <=16.4.0` | `16.4.3` |

> **Alcance no código atual do FlowMind AI:** O frontend atual não habilita `dangerouslyAllowSVG`, não utiliza diretivas `'use cache'` e não expõe Server Actions customizadas de negócio. Ainda assim, a atualização de patch é recomendada para eliminar a superfície vulnerável do framework e destravar o gate determinístico de `npm run build` (`SecurityFatalError`).

---

## 2. Estado completo da auditoria (`npm audit`)

Com os overrides existentes no `package.json` raiz (`deepmerge-ts@8.0.2` e `mysql2@3.24.5`), o panorama atual da árvore é:

- **Produção (`npm audit --omit=dev`):** **1 vulnerabilidade no total** (`1 critical`: exclusivamente `next@16.4.0`; `0 high`, `0 moderate`, `0 low`).
- **Árvore completa (`npm audit` incluindo devDependencies):** **4 vulnerabilidades no total**:
  - `1 critical`: `next@16.4.0` (corrigida pelo patch `next@16.4.3`, `isSemVerMajor: false`).
  - `3 moderate`: cadeia de desenvolvimento CSS `tailwindcss@3.4.19` → `postcss-nested` → `postcss-selector-parser@<7.1.6` ([GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) — complexidade quadrática no parsing de seletores). O `npm audit` sugere `tailwindcss@4.3.3` (mudança de major indesejada no MVP), mas o aviso transitivo é resolvido na versão `postcss-selector-parser@7.1.7` sem mudança de major do Tailwind.

---

## 3. Verificação de compatibilidade da versão candidata (`next@16.4.3`)

| Item verificado | Requisito de `next@16.4.3` | Estado no FlowMind AI | Compatível? |
| --- | --- | --- | --- |
| Tipo de versão | Patch dentro da série `16.4.x` (`isSemVerMajor: false`) | `16.4.0` → `16.4.3` | Sim |
| Integridade no registro | `sha512-OqxKTGi9u80FydydsMNYNjnuje9Au+kvHlt2GZ//ftdpDHm1dxKqAaENoOOTX5wKzn+9vaKUNIfZeyZUuLhCnA==` | Verificada via `npm view` | Sim |
| Runtime Node.js | `>=20.9.0` | Node `24.21.0` portátil | Sim |
| React / React DOM | `^18.2.0 \|\| ^19.0.0` | `19.2.8` / `19.2.8` | Sim |
| `@clerk/nextjs@7.9.14` | Peer `next`: `^16.0.10 \|\| ^16.1.0-0` | Cobre `16.4.3` | Sim |

---

## 4. Opções e trade-offs para decisão do usuário

| Opção | Escopo da mudança | Necessidade atendida | Trade-offs e riscos |
| --- | --- | --- | --- |
| **Opção A (Recomendada — Patch `next@16.4.3` apenas)** | Atualizar `"next": "16.4.3"` em `apps/web/package.json` e atualizar `package-lock.json` | Elimina os 3 advisories críticos/altos do Next.js, zera `npm audit --omit=dev` (0 vulnerabilidades em produção) e remove o bloqueio `SecurityFatalError` do `npm run build` | Mantém os 3 avisos moderados de devDependencies do Tailwind v3 (`postcss-selector-parser`), sem risco de alterar o pipeline PostCSS |
| **Opção B (Patch `next@16.4.3` + override `postcss-selector-parser@7.1.7`)** | Opção A + adicionar `"postcss-selector-parser": "7.1.7"` em `overrides` no `package.json` raiz | Zera tanto `npm audit --omit=dev` (0 vulnerabilidades) quanto `npm audit` completo (0 vulnerabilidades em toda a árvore), preservando Tailwind CSS `3.4.19` | Exige revalidar compilação CSS do Tailwind/PostCSS e da fixture visual do editor após aplicar o override |
| **Opção C (Manter `next@16.4.0` por ora)** | Nenhuma alteração em `package.json` / `package-lock.json` | Zero mutação no lockfile atual | `npm run build` continuará sendo interrompido pelo `SecurityFatalError` do CLI do Next.js e `npm audit --omit=dev` permanecerá com 1 vulnerabilidade crítica |

### Pergunta obrigatória do CLI do Next.js e escolha de aprovação

Para prosseguir com a atualização, confirme:
1. Qual opção aprova (**Opção A**, **Opção B** ou **Opção C**)?
2. Conforme o fluxo de segurança do Next.js: prefere que a atualização de segurança seja executada **no checkout atual** (`Flowmind-AI/`) ou em uma **worktree Git / cópia isolada** antes de promover o lockfile?

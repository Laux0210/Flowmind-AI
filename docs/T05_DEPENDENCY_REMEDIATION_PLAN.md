# T05 — correção proposta das dependências

Status: proposta original preservada. Esta pesquisa não instalou pacotes nem executou scripts externos de instalação. Outra execução instalou overrides globais deepmerge-ts 8.0.2/mysql2 3.24.5; aprovação específica não foi recuperada por este principal. [Estado e limites atuais](VALIDATION_DEPENDENCY_DRIFT_2026-10-12.md).

## Evidência atual

Atualização: audit sem dev retornou zero ocorrências; o completo mantém 27 pacotes (5 altos/22 moderados). Nove comandos locais retornaram exit 0, mas novas fontes de worker/manifestos durante/depois impediram aceite integral do snapshot. Os números e candidatos abaixo pertencem à pesquisa anterior, preservada para revisão.

O audit local sinalizou 31 pacotes, nove altos; quatro altos no recorte sem dev: `prisma`, `@prisma/config`, `deepmerge-ts` e `mysql2`. São pacotes afetados na árvore, não quatro explorações demonstradas. [Relatório](evidence/local-hardening-2026-10-12/audit-production.json).

`prisma`, client e adapter-pg estão em 7.10.0. A CLI já consta como devDependency da API, mas aparece na árvore de produção junto aos peers opcionais do client; apenas mover sua declaração não comprova exclusão. Consulta ao registry não encontrou versão estável 7.x posterior a 7.10.0. O `audit fix` sugere 6.19.3, mudança de major que não será aplicada automaticamente.

| Pacote transitivo | Instalado | Correção publicada | Compatibilidade ainda necessária |
| --- | --- | --- | --- |
| deepmerge-ts via @prisma/config | 7.1.5 | 8.0.0 | Mudança de major; verificar carregamento/configuração, geração e validação Prisma |
| mysql2 via CLI Prisma | 3.15.3 | 3.23.1 cobre os dois avisos encontrados | Validar comportamento da CLI sem habilitar banco MySQL |

O aviso de [deepmerge-ts](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) trata de recursão com objetos cíclicos. Os avisos de mysql2 tratam de [negociação de autenticação](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr) e [descompressão](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3). Não foi demonstrado caminho explorável no backend PostgreSQL do FlowMind; o gate de dependências permanece aberto.

## Recomendação para aprovação

Validar overrides transitivos limitados à CLI/config, preservando Prisma 7 e o adapter PostgreSQL, em cópia isolada. Versões e integridades dos candidatos foram consultadas no registry; compatibilidade executável ainda não foi testada porque instalar requer aprovação.

```json
{
  "overrides": {
    "prisma@7.10.0": { "mysql2": "3.23.1" },
    "@prisma/config@7.10.0": { "deepmerge-ts": "8.0.0" }
  }
}
```

Alternativas: aguardar release Prisma 7 com correções transitivas, mantendo bloqueio de produção; ou reavaliar versão principal mediante aprovação e análise de migração. A proposta de overrides reduz o alcance, mas pode quebrar a configuração da CLI; não constitui declaração de compatibilidade.

## Validação após autorização

1. Preservar manifests/lockfile; resolver e instalar candidatos em cópia isolada, revisando scripts/integridades antes de executá-los.
2. Gerar/validar Prisma com a configuração existente, sem migration/conexão comercial.
3. Conferir tipos, Jest, regressões, builds e artefato; repetir audit completo e sem dev.
4. Se houver incompatibilidade ou advisory remanescente, registrar evidência e ajustar a proposta. Promover apenas a combinação comprovada ao checkout principal.

Esta aprovação não inclui migração, deploy, execução de banco, mudanças de modelo de IA ou correções adicionais de Tailwind/CLI. As demais ocorrências do audit completo exigem triagem própria.

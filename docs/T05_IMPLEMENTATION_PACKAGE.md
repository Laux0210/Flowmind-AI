# FlowMind AI — pacote de ambiente T05 / R04

Proposta R04 de 10/10/2026. **Pacote local autorizado por “pode seguir” e executado na R05.** O corpo preserva o planejamento anterior; situação/resultados/CMD atuais em [VALIDATION_R05.md](VALIDATION_R05.md). T05 segue em andamento por gates de segurança/lint/integração; T02 continua separado.

## Entrega preparatória R04

- `scripts/run-checks.mjs` compila contratos antes dos consumidores e preserva a falha de cada comando. Os scripts da raiz agora têm `build`, `typecheck` e `test` explícitos; typecheck inclui os testes da API.
- Criados `apps/api/jest.config.cjs` e `tsconfig.spec.json`. Corrigidos três problemas de fixtures/expectativas do teste de execuções; esse Jest ainda não foi executado.
- **39/39 regressões isoladas passaram**: 37 da R03 e dois testes do orquestrador de comandos, com CLI falso. Os dois novos casos verificam ordem de build e interrupção com código de saída original. Não comprovam compilação ou Jest reais.

## Instalação concreta proposta

Destino: `C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI`.

1. Node **24.21.0** portátil em `.tools/node-v24.21.0-win-x64`, sem substituir o Node global. Arquivo oficial e SHA-256 registrados em [T05_PACKAGE_SET.json](T05_PACKAGE_SET.json); conferir checksum antes de extrair. O cronograma oficial indica a linha 24 como LTS. [Node Release](https://github.com/nodejs/Release).
2. Aplicar os manifests candidatos desse JSON e instalar dependências locais com scripts inicialmente desabilitados; produzir `package-lock.json`. Inspecionar scripts dos fornecedores necessários antes de executá-los. Não usar `--force`/`--legacy-peer-deps` para esconder conflitos.
3. Ajustar os consumidores aos SDKs aprovados, gerar o cliente Prisma local e executar typecheck, Jest e builds. Geração de cliente não inclui migration, conexão ao banco ou início de serviços.

| Grupo | Versões candidatas fixas |
| --- | --- |
| Web | Next 16.4.0; React/React DOM 19.2.8; Clerk Next 7.9.14; XYFlow 12.12.0 |
| API | Nest 12.1.2; CLI 12.0.8; Clerk Backend 3.23.2 |
| Prisma/PostgreSQL | Prisma/Client/adapter-pg 7.10.0; pg 8.23.1 |
| Compilador/testes | TypeScript 6.0.3; Jest 30.5.2; ts-jest 29.4.14; types Jest 30.0.0 |
| Estilos/filas existentes | Tailwind 3.4.19; BullMQ 5.81.5; ioredis 5.11.1; demais pins no JSON |

São 34 pacotes externos diretos no inventário. Metadados oficiais, integridades, engines, peers e manifests candidatos ficam no JSON. A verificação com semver local encontrou **zero incompatibilidades nos engines/peers diretos declarados**. [Resultado](T05_PEER_CHECK.json). Não é resolução de dependências transitivas, auditoria de segurança ou prova de compatibilidade em execução. [Registry npm](https://registry.npmjs.org/next/16.4.0).

A proposta atualiza majors do scaffold não validado, mantendo a stack planejada. Instalar o conjunto antigo exigiria conservar Next 14 fora do suporte. Escolher apenas Next 15 reduziria a mudança inicial, mas encurtaria a janela de manutenção. Recomenda-se a linha 16, com adaptação/testes locais e possibilidade de restaurar os manifests do backup. [Política Next](https://nextjs.org/support-policy).

Não selecionar tags `latest` automaticamente: a consulta retornou Prisma CLI 8 RC e TypeScript 7, enquanto o cliente selecionado é Prisma 7 e ts-jest declara TypeScript menor que 7. As versões exatas consultadas estão nos [metadados](T05_PACKAGE_SET.json).

## Adaptações incluídas após aprovação

- **Clerk:** migrar middleware para APIs assíncronas suportadas e proteger também `/history`; verificar tipos do backend selecionado. Isso não resolve sozinho membership/revogação de T02. [Core 3](https://clerk.com/docs/guides/development/upgrading/upgrade-guides/core-3).
- **Prisma 7:** configurar URL fora do schema, output do cliente e adapter PostgreSQL; atualizar imports. Preservar modelos/dados históricos; não executar migration. Para a API CommonJS, gerar cliente com `moduleFormat: cjs`. [Guia Prisma](https://docs.prisma.io/docs/guides/upgrade-prisma-orm/v7), [receita Nest](https://docs.nestjs.com/recipes/prisma).
- **TypeScript/Nest/React:** conciliar resolução de módulos e tipos com as versões fixas; corrigir erros efetivamente reproduzidos. CLI e schematics selecionados usam TypeScript 6.
- **CI:** conciliar runtime com o pacote aprovado, usar lockfile e incluir comandos reais. Nenhuma execução remota, commit ou publicação autorizada.

## Limites e pendências

- Lint não integra esta primeira instalação: ESLint 10 não satisfaz o peer declarado pelo plugin React consultado; ESLint 9 está marcado deprecated. A combinação transitiva deve ser resolvida/testada separadamente; `next lint` precisa ser substituído na migração. Não declarar T05 concluída sem fechar lint/CI.
- `clean` dos contratos referencia rimraf não declarado; comando opcional não será executado neste incremento.
- Build web pode exigir chave publicável Clerk de desenvolvimento configurada localmente. Não inventar conta/domínio real nem expor chaves; integração real continua separada.
- Sem Docker/serviços, migrations, API comercial, deployment ou alterações de ambiente global. Auth/versões/limites continuam dependentes de T02/T03.

## Comandos CMD

Comandos no snapshot preparatório R04:

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
npm run test:regression
python .codex\validate_team.py
```

Depois da aprovação, aplicação dos manifests, instalação e adaptação/geração Prisma:

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
set "FLOWMIND_NODE=%CD%\.tools\node-v24.21.0-win-x64"
set "PATH=%FLOWMIND_NODE%;%PATH%"
node --version
npm --version
npm run typecheck
npm test
npm run test:regression
npm run build
```

No snapshot R04 esses comandos completos não tinham sido executados. A R05 executou geração/tipos/Jest/builds; usar os comandos atuais em [VALIDATION_R05.md](VALIDATION_R05.md). A autorização do pacote cobre instalação local, adaptações de SDK/toolchain e verificações offline necessárias; decisões de produto/autorizações de T02 continuam separadas. [Plano](../plan.md), [memória](MEMORIA.md).

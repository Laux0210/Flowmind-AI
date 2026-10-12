# FlowMind AI — correções e validação R03

Checkpoint de 10/10/2026, consolidado pelo principal após autorização para continuar a implementação local. A entrega corrige o código existente; não conclui o MVP nem aprova contratos pendentes.

## Alterações

- **Autenticação:** removido o reconhecimento de tokens sintéticos no código de produção. O serviço exige chaves pública/privada e usa `userId`, `sessionId`, `orgId` e `orgRole` normalizados por `toAuth()`. Cabeçalhos inválidos são recusados; erros/logs ocultam detalhes internos do provedor.
- **Contratos e consumidores:** resumo, intenção e ambiguidades substituem a classificação comercial. `schemaVersion` é exigida; referências inexistentes, gatilho divergente e nós desconectados falham explicitamente. O campo histórico `interestLevel` do Prisma foi preservado, sem migração ou conversão de significado.
- **Simulação:** IA, registro, e-mail e HTTP permanecem simulados. Registro retorna `simulated`/`simulated_at`; não afirma persistência. Não há modelo real, consumo de tokens ou entrega externa. Executores recusam `LIVE`.
- **Persistência e cliente:** falhas de banco/API deixam de virar sucesso em memória ou dados fictícios. CRUD restringe consultas/mutações por organização; atualização usa PUT. Edição de definições publicadas fica bloqueada enquanto novas revisões não têm contrato aprovado.
- **Interface:** utiliza token obtido do Clerk e exibe falhas. O dashboard conserva o ID e permite repetir o salvamento de uma proposta parcial; o editor bloqueia aplicação durante salvamento e descarta respostas de outro contexto/revisão. Histórico não fabrica execuções. Esses ajustes web tiveram revisão estática, sem teste React/browser.
- **Geração:** template local identificado como tal, sem alegar uso de LLM. Não inventa destino HTTP ou condição comercial; “resumo do caso” é aceito. A interpretação continua limitada a heurísticas.
- **CI preparatório:** removido fallback que escondia falha de instalação e opções que pulavam checks ausentes. Pipeline remoto não executado; sem lockfile/typecheck e com runtime ainda não reconciliado, permanece pendente de T05.

## Evidências e limites

`npm run test:regression`: **37/37 testes passaram**. A primeira rodada reproduziu 16 falhas em 22 testes; o caso adicional do substantivo “caso” também falhou antes da correção. A suíte executa métodos do TypeScript real com Node/VM e dependências substituídas por fakes, sem instalar pacotes.

| Área | Evidência executada | Limite |
| --- | --- | --- |
| Auth/guard | 12 testes de campos, chaves, cabeçalhos, rejeição e erros | SDK falso; não verifica assinatura real, DI Nest, pertencimento vigente ou revogação |
| Motor | 12 testes de jornada técnica, entrada inválida, referências, DAG e efeitos simulados | Não valida qualidade de IA, ramificação completa, worker ou efeito externo |
| Geração/cliente | 9 testes de template, condições e requisições/erros | Fetch falso; não verifica servidor HTTP ou interface |
| CRUD | 4 testes de fonte persistente, falhas e organização | Prisma falso; não verifica PostgreSQL, migrations ou isolamento integrado |

**C02 não está concluído:** interpolar ambiguidades num template não garante que qualquer resposta preserve a incerteza. O cenário negativo que omite ambiguidades e a avaliação semântica continuam pendentes. C03 confirmado é a rejeição de dados obrigatórios ausentes, não uma nova jornada VIP.

`python .codex/validate_team.py`: sete perfis nativos válidos. É validação estática; as delegações históricas estão em [CODEX_USAGE.md](CODEX_USAGE.md). Não comprova recarga de skills/permissões no processo atual. `git diff --check` passou para arquivos rastreados; há arquivos novos ainda não rastreados.

Conferência documental: 10 notas idênticas pelos caminhos C:/E:, 60 links relativos, 13 blocos JSON parseáveis, 16 tarefas com status coerentes e 14 arquivos de configuração/suporte protegidos sem alterações. Não equivale a validação de schemas, sincronização em nuvem ou testes de produto.

Compatibilidade verificada por leitura do pacote oficial declarado `@clerk/backend@1.15.0`: `authenticateRequest()`/`toAuth()` e necessidade de `publishableKey`. O intervalo `^1.15.0` e os demais manifests ainda não foram resolvidos em lockfile. [Pacote oficial](https://registry.npmjs.org/@clerk/backend/-/backend-1.15.0.tgz), [tipos oficiais](https://github.com/clerk/javascript/blob/180f5a50fe09774585c9164d679b8f2ecfab64df/packages/backend/src/tokens/authObjects.ts#L91), [contexto de autenticação](https://github.com/clerk/javascript/blob/180f5a50fe09774585c9164d679b8f2ecfab64df/packages/backend/src/tokens/authenticateContext.ts#L66).

Não foram executados Jest, typecheck, build, navegador/E2E, CI remoto, PostgreSQL/Redis, autenticação real ou OpenAI. Não houve instalação, migration, início de serviços, commit, push ou deploy. Node observado: `v26.9.0`; a suíte usa APIs experimentais e não substitui o ambiente reproduzível de T05.

## Reproduzir pelo CMD

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
npm run test:regression
python .codex\validate_team.py
```

## Continuidade

Outra execução alterou código/documentos durante este trabalho e registrou conclusões sem as evidências correspondentes. Suas adições foram preservadas como protótipos; T02–T15 não foram aceitas como concluídas. Ampliar implementações exige concentrar a edição numa única sessão e manter contratos com editor único.

Backups anteriores às correções: `C:\Users\jv883\AppData\Local\Temp\flowmind-fixes-20261010-ff32bw3c`, incluindo snapshots das mudanças concorrentes. Arquivos locais do Obsidian são a fonte única, acessíveis também pela junção em E:.

Próxima ação: fechar decisões de T02/T03 e preparar T05 com versões compatíveis e lista concreta de instalações para aprovação. Em seguida, executar checks completos e validar provisionamento de organizações/isolamento real. Limites numéricos, lifecycle, gatilhos/workers, C02 e operação continuam em revisão. [Plano](../plan.md), [memória](MEMORIA.md), [contexto](PROJECT_CONTEXT.md).

# T08 — editor no navegador e cabeçalho responsivo

Entrega retomada e conferida em 23/10/2026. O usuário autorizou continuar sem depender de SVM. A aplicação protegida e seus serviços foram preservados.

## Alteração

No viewport de 390 px, o cabeçalho antigo cortava o título e deixava Salvar/Revisar fora da tela. A página `apps/web/src/app/workflows/[id]/page.tsx` agora permite quebra de linhas no título e nas ações, empilhando o cabeçalho nas telas menores e preservando a disposição horizontal a partir de `lg`.

Backup anterior: `C:\Users\jv883\AppData\Local\Temp\flowmind-editor-page-20261023-012248.tsx`.

## Ambiente e resultados

A fixture em `tests/browser/editor-fixture/` compila a página real, XYFlow, formulário de parâmetros, cliente HTTP, hook de catálogo e CSS. Somente autenticação/navegação e armazenamento HTTP em memória são sintéticos, em servidor separado ligado a `127.0.0.1`. Não há alteração de Clerk, middleware ou rotas da aplicação para permitir acesso sem autenticação.

- Brave: cabeçalho inteiro dentro da tela em 1920 px, 390×844 e 320×740; sem overflow horizontal nos dois tamanhos móveis. Fit View reposiciona o canvas após mudar o viewport.
- Seleção de etapa, edição, Tab para o próximo campo, bloqueio de Salvar com parâmetros pendentes, aplicação, salvamento e conservação do nome após recarregar aprovados na retomada. Console sem erros/avisos no recorte observado.
- Na sessão anterior à interrupção também foram observadas adição de condição, conexão válida, rejeição de ciclo e remoção com limpeza da conexão. Essas ações não foram repetidas na última conferência.
- Tipos aprovados; **202 regressões** aprovadas; lint heurístico aprovado em **162 arquivos**. As oito fontes/CSS registradas mantiveram os mesmos hashes entre a compilação da fixture e a conferência final.
- O build compilou contratos/API/web e gerou páginas, mas **terminou com exit 1**: o próprio Next.js lançou `SecurityFatalError`, informando vulnerabilidade na versão instalada. Este resultado não é build aprovado. Nenhuma proteção foi desabilitada nem dependência atualizada.

[Recibo](evidence/t08-browser-2026-10-23/checks.json), [tipos](evidence/t08-browser-2026-10-23/typecheck.log), [regressões](evidence/t08-browser-2026-10-23/test-regression.log), [lint](evidence/t08-browser-2026-10-23/lint.log), [build bloqueado](evidence/t08-browser-2026-10-23/build.log). Capturas visuais foram exibidas na conversa; não foi exportado arquivo de imagem.

## Reprodução no CMD

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
set "PATH=%CD%\.tools\node-v24.21.0-win-x64;%PATH%"
node tests\browser\editor-fixture\serve.cjs
```

Abrir a origem local impressa pelo comando. A fixture usa porta livre e dados em memória; Ctrl+C encerra somente esse servidor. Não habilita a API real nem grava no banco.

## Limites e próxima ação

Integração Next/Clerk/organizações, banco, providers, arrastar nós e conectar handles por gesto ainda não são certificados por esta entrega. T08 continua em andamento. A fixture foi encerrada e o viewport do navegador restaurado; os servidores da aplicação não foram iniciados por esta retomada. A porta 3001 foi encontrada ocupada por outro processo e preservada, sem validar sua identidade ou funcionamento.

Próxima ação: diagnosticar a atualização de segurança do Next.js com versão candidata e impacto revisáveis; instalar/alterar dependências somente após aprovação explícita, conforme AGENTS.md. O pedido para avançar sem SVM não aprova infraestrutura real ou upgrade de dependências.

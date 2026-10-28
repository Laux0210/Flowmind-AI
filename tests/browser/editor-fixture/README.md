# Fixture visual isolada do editor

Executar a partir da raiz com o Node portátil do projeto:

```cmd
".tools\node-v24.21.0-win-x64\node.exe" tests\browser\editor-fixture\serve.cjs
```

Abrir a origem impressa no terminal; encerrar com Ctrl+C. Reutiliza dependências já instaladas, compila em diretório temporário e registra hashes em `docs/evidence/t08-browser-2026-10-23/server.json`.

Renderiza os componentes reais com identidade, navegação e armazenamento em memória exclusivamente sintéticos. Não importa os shims na aplicação Next, não altera autenticação e não faz chamadas a providers externos. Somente GET de workflow/catálogo e PUT do workflow sintético são implementados; as demais operações retornam erro. Dados se perdem ao reiniciar.

É uma ferramenta de conferência visual manual, não uma suíte E2E automatizada nem prova de persistência/isolamento/autorização reais. Resultados e limitações: `docs/VALIDATION_T08_BROWSER_2026-10-23.md`.

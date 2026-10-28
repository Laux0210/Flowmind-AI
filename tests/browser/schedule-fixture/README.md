# Fixture do painel de agendamentos

Na raiz do projeto:

```cmd
".tools\node-v24.21.0-win-x64\node.exe" tests\browser\schedule-fixture\serve.cjs
```

Abrir a origem impressa. Selecionar fluxo B, abrir Agendamentos e liberar a resposta antiga de A. A lista deve continuar em B. Revogar deve enviar somente o ID de B. Criar com `inválido` demonstra erro HTTP; criar com cron válido demonstra sucesso na memória sintética.

Usa `SchedulePanel` e `ApiClient` reais em React StrictMode; identidade, HTTP e armazenamento são sintéticos. Não instala dependências nem chama banco/provedores reais. Dados se perdem no reinício; Ctrl+C encerra o servidor ligado somente ao loopback. Evidências em `docs/evidence/t12-schedule-review-2026-10-23/`.

Os testes unitários complementares executam o componente compilado com hooks controlados: `node --test tests/regression/schedule-panel.test.mjs`. Isso não substitui lifecycle de navegador ou teste autenticado do editor integrado.

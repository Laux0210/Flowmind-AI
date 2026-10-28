# T03-S2b — precedência de mapeamentos opcionais

Em 23/10/2026, o usuário pediu avançar ignorando o bloqueio de SVM. Infraestrutura permanece em espera; esta entrega usa somente validação local, dados sintéticos e o executor SIMULATION.

## Problema e correção

Um `fieldMappings.name` vazio ocultava `config.name` no executor, produzindo `name: undefined`. A validação aceitava a referência porque procurava qualquer valor não vazio entre as duas posições. O mesmo problema atingia `email` e a precedência entre `raw_message`, o alias `message` e a raiz da configuração.

`validateWorkflowAvailability` agora seleciona o valor conforme a prioridade do executor antes de verificar sua disponibilidade. Um mapeamento vazio não libera o fallback que ele próprio oculta. Fallbacks legítimos continuam aceitos. Foram preservadas as correções e guardas de tipos adicionadas por outra execução.

## Evidências desta execução

- Novo arquivo `apps/api/src/engine/workflow-availability-precedence.spec.ts`: três negativas falharam antes da correção, com três controles positivos passando. Após a correção, seis controles passam e comparam o resultado real do executor com a validação.
- Recorte direcionado inicial após correção: 136 testes aprovados em três suítes.
- Resultado final: **779 Jest em 40 suítes**, **202 regressões**, typecheck dos workspaces e dos testes da API aprovados; lint heurístico aprovado em 158 arquivos.
- Snapshot de 118 fontes/testes TypeScript da API, fixtures e contratos permaneceu idêntico antes/depois da execução final. Os arquivos de teste mudaram durante uma rodada anterior; o resultado dessa rodada foi preservado e não é usado como aceite final. Duas expectativas de erro de schema foram corrigidas pelo autor antes da rodada final.
- Revisão do principal no recorte: guardas de disponibilidade e fallback preservadas. Cobertura/frescor incompletos no índice foram supridos por leitura direta dos fontes pertinentes. Isto não constitui auditoria completa de segurança.

[Recibo](evidence/t03-s2b-resume-2026-10-23/checks.json), [RED](evidence/t03-s2b-resume-2026-10-23/precedence-red.log), [GREEN](evidence/t03-s2b-resume-2026-10-23/precedence-green.log), [Jest final](evidence/t03-s2b-resume-2026-10-23/jest-final.log), [regressões](evidence/t03-s2b-resume-2026-10-23/regressions.log). Backup do validador anterior em `C:\Users\jv883\AppData\Local\Temp\flowmind-s2b-fallback-20261023-010839`.

## Reprodução pelo CMD

```cmd
cd /d "C:\Users\jv883\Documents\Codex\FlowMind-AI\Flowmind-AI"
set "PATH=%CD%\.tools\node-v24.21.0-win-x64;%PATH%"
node --experimental-vm-modules node_modules\jest\bin\jest.js --config apps/api/jest.config.cjs --runInBand --runTestsByPath apps/api/src/engine/workflow-availability-precedence.spec.ts
node --experimental-vm-modules node_modules\jest\bin\jest.js --config apps/api/jest.config.cjs --runInBand
npm run test:regression
npm run typecheck
node node_modules\typescript\bin\tsc --project apps/api/tsconfig.spec.json --noEmit
npm run lint
```

Nenhum serviço, migration, credencial ou chamada comercial foi necessário. Esta entrega não valida identidade/banco/fila reais nem navegação autenticada. O próximo passo independente é preparar a jornada visual do editor com dados sintéticos; persistência real continua com seu próprio gate.

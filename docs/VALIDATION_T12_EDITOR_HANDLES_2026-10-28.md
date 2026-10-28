# T12 — conector visual do gatilho

Em28/10/2026, corrigida a projeção do canvas: trigger_schedule sem aresta de entrada deixa de oferecer conector de entrada, como trigger_form. Saída preservada; arestas legadas inválidas continuam visíveis para revisão explícita, sem remoção automática.

Três novos controles no callback real flowNodes: formulário, agendamento e aresta legada. Antes: falha reproduzida no agendamento (1 conector em vez de0); depois:50/50 testes de workflow-editing aprovados. Typecheck completo exit0. [RED](evidence/t12-editor-handles-2026-10-28/red.log), [GREEN](evidence/t12-editor-handles-2026-10-28/green.log), [tipos](evidence/t12-editor-handles-2026-10-28/typecheck.log). A suíte global anterior de833 Jest/222 regressões não foi repetida para esta mudança delimitada.

Fonte e harness consultados diretamente após cobertura indicar metadata_changed. Backup: C:\Users\jv883\AppData\Local\Temp\flowmind-trigger-handles-uaim6rcq.

Fixture real compilada; acesso às abas indisponível. Fallback nativo abriu Brave, mas Computer Use encerrou a tentativa por não determinar a URL atual com confiança suficiente para aplicar sua política. Nenhuma ação adicional na interface foi executada, nenhum teste visual ou login autenticado concluído. Servidor temporário próprio encerrado. Sem instalação, migration ou mudança de credenciais.

Próxima ação: restabelecer acesso confiável ao navegador para conferir visualmente o canvas e validar a jornada autenticada admin/member/outra organização. Não contornar o bloqueio da automação. T12 integral permanece pendente.

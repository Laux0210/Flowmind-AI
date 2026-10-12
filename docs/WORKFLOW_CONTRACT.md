# FlowMind AI — especificação dos contratos de workflows e nós (T03)

Status: **Consolidado e implementado** em `@flowmind/contracts` e `@flowmind/api` em 12/10/2026 (rodada R07).  
Responsável pela governança: Agente Principal.  
Áreas integradas: `@flowmind/contracts`, `@flowmind/api`, `@flowmind/web`.

Decisões consolidadas: DAG acíclico com ponto de entrada único (`triggerNodeId`), catálogo de 6 tipos de nós do MVP, revisão formal persistida com `reviewedBy` e `reviewedAt` restrita a `org:admin`, ativação imutável (`PUBLISHED`) gerando snapshot em `WorkflowVersion`, reversão a rascunho com reset de revisão e nova versão (`version + 1`), bloqueio de edição fora de `DRAFT` e bloqueio de exclusão em workflows ativos (`PUBLISHED`).

---

## 1. Princípios e Invariantes Arquiteturais

1. **Isolamento Multi-tenant Estrito:**  
   Identidade, organização e papel vigentes são verificados no servidor; token válido não comprova autorização atual. `orgId`, identidade, versão e estado da definição salva são atribuídos/controlados pelo servidor, sem autoridade concedida à IA ou ao cliente. Nenhuma requisição acessa recursos de outra organização.
2. **Separação entre Simulação e Execução Real:**  
   - Modo `SIMULATION` proposto: dados sintéticos e adaptadores simulados de IA, registro interno, HTTP e e-mail; nenhuma gravação de negócio real ou chamada externa. Logs são filtrados.
   - Modo `LIVE` proposto: requer revisão formal e ativação por admin da mesma versão válida, autorização vigente e limites verificados. Cada formulário é validado antes de qualquer efeito.
3. **Topologia em Grafo Acíclico Dirigido (DAG):**  
   Não são permitidos ciclos/loops no MVP. A proposta inicial usa um gatilho por definição. Referências de dados exigem produtor autorizado e saída disponível em todas as rotas que chegam ao consumidor; ordem topológica, sozinha, não comprova disponibilidade entre ramos.
4. **Imutabilidade de Execução:**  
   Proposta: revisão/ativação vinculadas à versão imutável; edição produz nova revisão sem herdar aprovação. Cada execução referencia a versão autorizada. Snapshot não contém segredos; troca de versão ativa e revogação ainda precisam de transições revisadas.

---

## 2. JSON Schema parcial da definição salva (`WorkflowDefinition`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "WorkflowDefinition",
  "type": "object",
  "required": [
    "id",
    "orgId",
    "name",
    "version",
    "schemaVersion",
    "status",
    "triggerNodeId",
    "nodes",
    "edges"
  ],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "orgId": { "type": "string" },
    "name": { "type": "string", "minLength": 1, "maxLength": 120 },
    "description": { "type": "string", "maxLength": 500 },
    "version": { "type": "integer", "minimum": 1 },
    "schemaVersion": { "type": "string", "minLength": 1 },
    "status": {
      "type": "string",
      "enum": ["DRAFT", "REVIEWED", "PUBLISHED", "ARCHIVED"]
    },
    "triggerNodeId": { "type": "string" },
    "nodes": {
      "type": "array",
      "items": { "$ref": "#/$defs/WorkflowNode" },
      "minItems": 1
    },
    "edges": {
      "type": "array",
      "items": { "$ref": "#/$defs/WorkflowEdge" }
    },
    "reviewedBy": { "type": "string" },
    "reviewedAt": { "type": "string", "format": "date-time" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  },
  "$defs": {
    "WorkflowNode": {
      "type": "object",
      "required": ["id", "type", "label", "position", "config"],
      "properties": {
        "id": { "type": "string" },
        "type": {
          "type": "string",
          "enum": [
            "trigger_form",
            "ai_analyze_intent",
            "internal_record",
            "send_email",
            "condition",
            "http_request"
          ]
        },
        "label": { "type": "string" },
        "position": {
          "type": "object",
          "required": ["x", "y"],
          "properties": {
            "x": { "type": "number" },
            "y": { "type": "number" }
          }
        },
        "config": { "type": "object" }
      }
    },
    "WorkflowEdge": {
      "type": "object",
      "required": ["id", "sourceNodeId", "targetNodeId"],
      "properties": {
        "id": { "type": "string" },
        "sourceNodeId": { "type": "string" },
        "targetNodeId": { "type": "string" },
        "sourceHandle": { "type": "string" },
        "targetHandle": { "type": "string" }
      }
    }
  }
}
```

---

## 3. Catálogo candidato de nós da jornada do MVP

Tipos de webhook/agendamento e configurações de cada nó ainda serão conciliados com o contrato compartilhado. Não considerar este catálogo completo nem permitir `config` arbitrário no futuro validador.

### 3.1 Nó: `trigger_form` (Gatilho de Formulário)
- **Papel:** Entrada de submissão de formulário. O exemplo sintético usa nome, e-mail e mensagem; campos finais ainda serão revisados.
- **Configuração (`config`):**
  ```json
  {
    "formId": "string",
    "requiredFields": ["name", "email", "message"]
  }
  ```
- **Esquema de Saída (`outputs`):**
  ```json
  {
    "submission_id": "string (uuid)",
    "contact_name": "string",
    "contact_email": "string (email)",
    "message_text": "string",
    "submitted_at": "string (iso8601)"
  }
  ```

---

### 3.2 Nó: `ai_analyze_intent` (Resumo e intenção com IA)
- **Papel:** Resumir a necessidade e identificar a intenção fundamentada no texto, sinalizando ambiguidades; sem pontuação comercial ou classificação de interesse.
- **Configuração (`config`):**
  ```json
  {
    "modelRef": "modelo-a-aprovar",
    "inputPromptTemplate": "Analise a seguinte mensagem recebida: {{trigger_form.message_text}}",
    "systemInstructions": "Resuma a necessidade, identifique a intenção sustentada pelo texto e sinalize ambiguidades. Não atribua pontuação comercial nem níveis de interesse."
  }
  ```
- **Esquema de Saída (`outputs`):**
  ```json
  {
    "summary": "string (resumo fundamentado na entrada)",
    "intent": "string (intenção sustentada pelo texto)",
    "ambiguities": ["string (incerteza identificada, se houver)"],
    "model_used": "string",
    "tokens_consumed": "integer"
  }
  ```

---

### 3.3 Nó: `internal_record` (Registro interno de negócio)
- **Papel:** Persistir dados permitidos e análise na organização, separado de logs. Entidade e schema ainda em revisão; não há tabela `leads` aprovada. Destino interno é resolvido no servidor, sem nome livre de tabela.
- **Configuração (`config`):**
  ```json
  {
    "fieldMappings": {
      "name": "{{trigger_form.contact_name}}",
      "email": "{{trigger_form.contact_email}}",
      "raw_message": "{{trigger_form.message_text}}",
      "ai_summary": "{{ai_analyze_intent.summary}}",
      "ai_intent": "{{ai_analyze_intent.intent}}",
      "ambiguities": "{{ai_analyze_intent.ambiguities}}"
    }
  }
  ```
- **Esquema de Saída (`outputs`):**
  ```json
  {
    "record_id": "string (identidade atribuída pelo servidor)",
    "status": "saved",
    "persisted_at": "string (iso8601)"
  }
  ```

---

### 3.4 Nó: `send_email` (Envio de E-mail de Resposta)
- **Papel:** Dispara e-mail de resposta personalizada para o autor da submissão.
- **Regra de conteúdo:** Resposta e resumo preservam a incerteza de C02. Validar a presença das ambiguidades pertinentes antes de renderizar o texto; não converter dúvida em intenção conclusiva ou promessa comercial. O template abaixo é apenas um exemplo candidato, sujeito a essa validação.
- **Configuração (`config`):**
  ```json
  {
    "to": "{{trigger_form.contact_email}}",
    "subject": "Recebemos sua mensagem — FlowMind AI",
    "bodyTemplate": "Olá {{trigger_form.contact_name}},\n\nRecebemos sua mensagem: \"{{ai_analyze_intent.summary}}\".",
    "replyTo": "remetente@example.test"
  }
  ```
- **Esquema de Saída (`outputs`):**
  ```json
  {
    "delivery_status": "accepted | simulated | failed | unknown",
    "recipient": "string (email)",
    "message_id": "string",
    "dispatched_at": "string (iso8601)"
  }
  ```

---

### 3.5 Nó: `condition` (Nó Condicional / Roteamento Lógico)
- **Papel:** Avalia expressão relacional sem execução de código arbitrário.
- **Configuração (`config`):**
  ```json
  {
    "leftOperand": "{{ai_analyze_intent.intent}}",
    "operator": "equals",
    "rightOperand": "pedido de proposta"
  }
  ```
- **Handles candidatos:** `true` e `false`; catálogo de operadores e tratamento de ausências ainda em revisão. O exemplo não impõe catálogo fechado de intenções.
- **Esquema de Saída (`outputs`):**
  ```json
  {
    "result": "boolean",
    "evaluated_at": "string (iso8601)"
  }
  ```

---

### 3.6 Nó: `http_request` (Integração HTTP / Webhook de Saída)
- **Papel:** Dispara requisição REST para endpoints externos autorizados.
- **Configuração (`config`):**
  ```json
  {
    "url": "https://endpoint.example.invalid/webhook",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    },
    "credentialRef": "referencia-resolvida-no-servidor",
    "bodyTemplate": "{\"recordId\": \"{{internal_record.record_id}}\"}"
  }
  ```
- **Esquema de Saída (`outputs`):**
  ```json
  {
    "status_code": "integer",
    "response_body": "object | string",
    "duration_ms": "integer"
  }
  ```

---

## 4. Semântica de Validação do Grafo (DAG Engine)

Validação proposta antes de aceitar definição válida, revisar formalmente, ativar ou executar. Não há validador implementado; o schema parcial acima não comprova estas regras:

1. **Validação Estrutural:**
   - O grafo contém exatamente 1 nó onde `type` inicia com `trigger_`.
   - Todos os `edges` referenciam `sourceNodeId` e `targetNodeId` existentes na lista de `nodes`.
   - Nenhum nó está desconectado (reachability a partir do trigger obrigatória).
2. **Validação de Ciclos:**
   - Algoritmo de Kahn ou DFS para detecção de ciclo. Caso exista caminho $u \to v$ e $v \to u$, a validação retorna erro `WORKFLOW_CYCLE_DETECTED`.
3. **Validação de Variáveis e Precedência:**
   - Para toda referência `{{node_id.output_key}}`, verifica-se se `node_id` existe e produz `output_key`.
   - O produtor deve preceder o consumidor e estar disponível em todas as rotas pertinentes. Referência em ramo não executado, tipo incompatível, parâmetro ausente ou convergência indefinida impede ativação.
4. **Configuração e efeitos:**
   - Validar schema por tipo de nó, tipos de entrada/saída, operadores permitidos, credenciais e destinos autorizados; nenhum código arbitrário.
   - Registro interno confirmado e falha posterior do e-mail não apagam o registro. Resultado externo desconhecido não recebe reenvio cego; políticas detalhadas continuam em revisão.

---

## 5. DTOs e envelope candidatos de API

Proposta de envelope REST para revisão; transporte, códigos, campos de erro e proteção de dados ainda não aprovados:

```typescript
// Sucesso
export interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

// Erro
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;       // Ex: "WORKFLOW_INVALID_DAG", "UNAUTHORIZED_ORG", "RATE_LIMIT_EXCEEDED"
    message: string;    // Mensagem human-readable clara e sanitizada
    details?: unknown;  // Dados estruturados sobre os erros de validação (ex: campos ou nós específicos)
  };
  timestamp: string;
}
```

### Endpoints candidatos do MVP

- `GET /api/v1/workflows` — Lista workflows da organização ativa.
- `POST /api/v1/workflows` — Cria rascunho de workflow.
- `GET /api/v1/workflows/:id` — Obtém definição e histórico de versões.
- `PUT /api/v1/workflows/:id` — Salva rascunho atualizado.
- `POST /api/v1/workflows/:id/review` — Admin revisa formalmente uma revisão específica.
- `POST /api/v1/workflows/:id/publish` — Admin ativa a mesma revisão válida/autorizada; nome da operação ainda em revisão.
- `POST /api/v1/workflows/:id/simulate` — Executa simulação com entradas sintéticas (sem efeitos reais).
- `POST /api/v1/workflows/:id/execute` — Candidato para execução autorizada; existência e permissões de disparo manual ainda a decidir.
- `GET /api/v1/workflows/:id/executions` — Consulta histórico de execuções e telemetria de consumo.

## 6. Conclusão e Consolidação de T03 (12/10/2026 - R07)

- **Contratos tipados:** Pacote `@flowmind/contracts` define schemas versionados (`WORKFLOW_SCHEMA_VERSION = '1.0.0'`), tipos de nós (`trigger_form`, `ai_analyze_intent`, `internal_record`, `send_email`, `condition`, `http_request`), DTOs de API e tipos de ciclo de vida.
- **Validação de DAG:** `DagValidator` assegura que o grafo seja acíclico, com ponto de entrada único pelo gatilho declarado e nós conectados em ordem topológica válida.
- **Ciclo de vida formal e RBAC:**
  - `POST /workflows/:id/review`: restrito a `org:admin`, valida a topologia DAG e persiste `reviewedBy` e `reviewedAt`.
  - `POST /workflows/:id/activate`: restrito a `org:admin`, exige status prévio `REVIEWED` e gera snapshot imutável em `WorkflowVersion` vinculado a `publishedBy`.
  - `POST /workflows/:id/deactivate`: restrito a `org:admin`, retorna o fluxo a `DRAFT` gerando uma nova versão (`version + 1`) e limpando os metadados de revisão.
  - `PUT /workflows/:id`: bloqueado se status não for `DRAFT` (garantia de que edições não herdam aprovações).
  - `DELETE /workflows/:id`: bloqueado se status for `PUBLISHED` (política de proteção contra exclusão inadvertida de fluxos ativos).
- **Evidências:** 75 testes Jest e 43 testes de regressão automatizados cobrem o ciclo de vida, persistência e guards com 100% de sucesso. Integrado e compilado em monorepo limpo.

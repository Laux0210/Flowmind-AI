import { createTestResourceResolver } from '../../test/resource-fixtures';
import { WorkflowEngineService } from './workflow-engine.service';
import type { WorkflowDefinition, WorkflowNode, WorkflowEdge } from '@flowmind/contracts';
import { WORKFLOW_SCHEMA_VERSION } from '@flowmind/contracts';

describe('WorkflowEngineService (DAG & Simulation Engine)', () => {
  let engine: WorkflowEngineService;

  beforeEach(() => {
    engine = new WorkflowEngineService(createTestResourceResolver());
  });

  function createValidMvpWorkflow(): WorkflowDefinition {
    const nodes: WorkflowNode[] = [
      {
        id: 'node_trigger',
        type: 'trigger_form',
        label: 'Gatilho: Formulário',
        position: { x: 0, y: 0 },
        config: { requiredFields: ['name', 'email', 'message'] },
      },
      {
        id: 'node_ai',
        type: 'ai_analyze_intent',
        label: 'IA: Resumo e Intenção',
        position: { x: 200, y: 0 },
        config: {
          inputPromptTemplate: 'Analisar: {{node_trigger.message_text}}',
          modelRef: 'modelo-a-aprovar',
        },
      },
      {
        id: 'node_record',
        type: 'internal_record',
        label: 'Persistência Interna',
        position: { x: 400, y: 0 },
        config: {
          fieldMappings: {
            name: '{{node_trigger.contact_name}}',
            email: '{{node_trigger.contact_email}}',
            raw_message: '{{node_trigger.message_text}}',
            ai_summary: '{{node_ai.summary}}',
            ai_intent: '{{node_ai.intent}}',
            ambiguities: '{{node_ai.ambiguities}}',
          },
        },
      },
      {
        id: 'node_email',
        type: 'send_email',
        label: 'E-mail de Resposta',
        position: { x: 600, y: 0 },
        config: {
          to: '{{node_trigger.contact_email}}',
          subject: 'Recebemos seu contato',
          bodyTemplate: 'Olá {{node_trigger.contact_name}}, recebemos: {{node_ai.summary}}. Pendências: {{node_ai.ambiguities}}',
        },
      },
    ];

    const edges: WorkflowEdge[] = [
      { id: 'e1', sourceNodeId: 'node_trigger', targetNodeId: 'node_ai' },
      { id: 'e2', sourceNodeId: 'node_ai', targetNodeId: 'node_record' },
      { id: 'e3', sourceNodeId: 'node_record', targetNodeId: 'node_email' },
    ];

    return {
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      id: 'wf_mvp_test',
      orgId: 'org_test_123',
      name: 'Workflow MVP Formulário',
      version: 1,
      status: 'PUBLISHED',
      triggerNodeId: 'node_trigger',
      nodes,
      edges,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  it('deve simular a jornada do MVP (C01 - Pedido Completo)', async () => {
    const workflow = createValidMvpWorkflow();
    const payload = {
      name: 'Pessoa Sintética',
      email: 'pessoa@example.test',
      message: 'Olá, gostaria de solicitar uma proposta e orçamento para contratar seus serviços.',
    };

    const result = await engine.simulate(workflow, payload);

    expect(result.status).toBe('COMPLETED');
    expect(result.nodeResults).toHaveLength(4);

    // Validação do Nó de Gatilho
    const triggerResult = result.nodeResults.find((r) => r.nodeId === 'node_trigger');
    expect(triggerResult?.status).toBe('SUCCESS');
    expect(triggerResult?.outputs?.contact_name).toBe('Pessoa Sintética');
    expect(triggerResult?.outputs?.contact_email).toBe('pessoa@example.test');

    // Validação do Nó de IA
    const aiResult = result.nodeResults.find((r) => r.nodeId === 'node_ai');
    expect(aiResult?.status).toBe('SUCCESS');
    expect(aiResult?.outputs?.summary).toContain(payload.message);
    expect(aiResult?.outputs?.intent).toBeDefined();
    expect(aiResult?.outputs).not.toHaveProperty('interest_level');
    expect(aiResult?.outputs).not.toHaveProperty('confidence_score');
    expect(aiResult?.outputs?.tokens_consumed).toBe(0);

    // Validação do Nó de Registro
    const recordResult = result.nodeResults.find((r) => r.nodeId === 'node_record');
    expect(recordResult?.status).toBe('SUCCESS');
    expect(recordResult?.outputs?.status).toBe('simulated');
    expect(recordResult?.outputs?.record_id).toBeDefined();

    // Validação do Nó de E-mail (driver mock seguro para simulação)
    const emailResult = result.nodeResults.find((r) => r.nodeId === 'node_email');
    expect(emailResult?.status).toBe('SUCCESS');
    expect(emailResult?.outputs?.delivery_status).toBe('simulated');
    expect(emailResult?.outputs?.recipient).toBe('pessoa@example.test');
  });

  it('deve preservar dúvidas e a ausência de análise real (C02)', async () => {
    const workflow = createValidMvpWorkflow();
    const payload = {
      name: 'Pessoa em Dúvida',
      email: 'duvida@example.test',
      message: 'Tenho algumas dúvidas e ainda não sei se preciso de algo.',
    };

    const result = await engine.simulate(workflow, payload);

    expect(result.status).toBe('COMPLETED');
    const aiResult = result.nodeResults.find((r) => r.nodeId === 'node_ai');
    expect(aiResult?.outputs?.summary).toContain(payload.message);
    expect(aiResult?.outputs?.ambiguities).toEqual(expect.arrayContaining([expect.any(String)]));
    const emailResult = result.nodeResults.find((r) => r.nodeId === 'node_email');
    expect(emailResult?.inputs.bodyTemplate).toContain('A intenção não foi inferida');
  });

  it('deve falhar no gatilho, sem efeitos posteriores, quando falta e-mail (C03)', async () => {
    const result = await engine.simulate(createValidMvpWorkflow(), {
      name: 'Pessoa Sintética', message_text: 'Tenho dúvidas gerais',
    });
    expect(result.status).toBe('FAILED');
    expect(result.nodeResults).toHaveLength(1);
    expect(result.nodeResults[0].nodeId).toBe('node_trigger');
  });

  it('deve rejeitar workflows contendo ciclos no grafo (WORKFLOW_CYCLE_DETECTED)', async () => {
    const workflow = createValidMvpWorkflow();
    // Introduz ciclo: node_email aponta de volta para node_ai
    workflow.edges.push({
      id: 'e_cycle',
      sourceNodeId: 'node_email',
      targetNodeId: 'node_ai',
    });

    await expect(
      engine.simulate(workflow, { name: 'A', email: 'a@a.test', message: 'teste' }),
    ).rejects.toThrow('Ciclo detectado no grafo de automação (WORKFLOW_CYCLE_DETECTED).');
  });

  it('deve rejeitar violação de precedência de variáveis no DAG', async () => {
    const workflow = createValidMvpWorkflow();
    // Nó Trigger tenta referenciar o nó de IA (que é seu sucessor, não ancestral)
    const triggerNode = workflow.nodes.find((n) => n.id === 'node_trigger')!;
    triggerNode.config = {
      requiredFields: ['name', 'email', 'message'],
      formId: '{{node_ai.summary}}',
    };

    await expect(
      engine.simulate(workflow, { name: 'A', email: 'a@a.test', message: 'teste' }),
    ).rejects.toThrow('Violação de precedência no DAG');
  });

  it('deve suportar roteamento condicional com nós marcados como SKIPPED no ramo inativo', async () => {
    const nodes: WorkflowNode[] = [
      {
        id: 't1',
        type: 'trigger_form',
        label: 'Gatilho',
        position: { x: 0, y: 0 },
        config: { requiredFields: ['name', 'email', 'message'] },
      },
      {
        id: 'cond1',
        type: 'condition',
        label: 'Condição: Nome é VIP',
        position: { x: 200, y: 0 },
        config: {
          leftOperand: '{{t1.contact_name}}',
          operator: 'equals',
          rightOperand: 'VIP',
        },
      },
      {
        id: 'email_vip',
        type: 'send_email',
        label: 'E-mail VIP',
        position: { x: 400, y: -100 },
        config: { to: 'vip@example.test', subject: 'VIP', bodyTemplate: 'Fixture do ramo VIP' },
      },
    ];

    const edges: WorkflowEdge[] = [
      { id: 'e1', sourceNodeId: 't1', targetNodeId: 'cond1' },
      { id: 'e2', sourceNodeId: 'cond1', targetNodeId: 'email_vip', sourceHandle: 'true' },
    ];

    const workflow: WorkflowDefinition = {
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      id: 'wf_cond_test',
      orgId: 'org_123',
      name: 'Workflow Condicional',
      version: 1,
      status: 'PUBLISHED',
      triggerNodeId: 't1',
      nodes,
      edges,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Submissão com nome não-VIP -> condição false -> nó email_vip marcado como SKIPPED
    const result = await engine.simulate(workflow, {
      name: 'Pessoa Comum',
      email: 'comum@example.test',
      message: 'Olá',
    });

    expect(result.status).toBe('COMPLETED');
    const vipEmailResult = result.nodeResults.find((r) => r.nodeId === 'email_vip');
    expect(vipEmailResult?.status).toBe('SKIPPED');
  });

  it('deve propagar recursivamente o status SKIPPED para descendentes indiretos do ramo inativo', async () => {
    const nodes: WorkflowNode[] = [
      {
        id: 't1',
        type: 'trigger_form',
        label: 'Gatilho',
        position: { x: 0, y: 0 },
        config: { requiredFields: ['name', 'email', 'message'] },
      },
      {
        id: 'cond1',
        type: 'condition',
        label: 'Condição',
        position: { x: 200, y: 0 },
        config: {
          leftOperand: '{{t1.contact_name}}',
          operator: 'equals',
          rightOperand: 'VIP',
        },
      },
      {
        id: 'step_child_1',
        type: 'send_email',
        label: 'Filho Direto',
        position: { x: 400, y: 0 },
        config: { to: 'vip@example.test', subject: 'VIP 1', bodyTemplate: 'Fixture do ramo VIP' },
      },
      {
        id: 'step_grandchild_1',
        type: 'http_request',
        label: 'Neto Indireto',
        position: { x: 600, y: 0 },
        config: { url: 'https://api.exemplo.com/webhook', method: 'POST' },
      },
    ];

    const edges: WorkflowEdge[] = [
      { id: 'e1', sourceNodeId: 't1', targetNodeId: 'cond1' },
      { id: 'e2', sourceNodeId: 'cond1', targetNodeId: 'step_child_1', sourceHandle: 'true' },
      { id: 'e3', sourceNodeId: 'step_child_1', targetNodeId: 'step_grandchild_1' },
    ];

    const workflow: WorkflowDefinition = {
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      id: 'wf_deep_branch',
      orgId: 'org_123',
      name: 'Workflow Branch Profundo',
      version: 1,
      status: 'PUBLISHED',
      triggerNodeId: 't1',
      nodes,
      edges,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await engine.simulate(workflow, {
      name: 'Não VIP',
      email: 'user@example.test',
      message: 'Olá',
    });

    expect(result.status).toBe('COMPLETED');
    const childResult = result.nodeResults.find((r) => r.nodeId === 'step_child_1');
    const grandchildResult = result.nodeResults.find((r) => r.nodeId === 'step_grandchild_1');

    expect(childResult?.status).toBe('SKIPPED');
    expect(grandchildResult?.status).toBe('SKIPPED');
  });

  it('deve suportar convergência de ramos (OR-Join): nó convergente executa se ao menos um ramo for ativo', async () => {
    const nodes: WorkflowNode[] = [
      {
        id: 't1',
        type: 'trigger_form',
        label: 'Gatilho',
        position: { x: 0, y: 0 },
        config: { requiredFields: ['name', 'email', 'message'] },
      },
      {
        id: 'cond1',
        type: 'condition',
        label: 'Condição VIP',
        position: { x: 200, y: 0 },
        config: {
          leftOperand: '{{t1.contact_name}}',
          operator: 'equals',
          rightOperand: 'VIP',
        },
      },
      {
        id: 'branch_vip',
        type: 'send_email',
        label: 'E-mail Ramo VIP',
        position: { x: 400, y: -100 },
        config: { to: 'vip-team@example.test', subject: 'Novo VIP', bodyTemplate: 'Fixture do ramo VIP' },
      },
      {
        id: 'branch_comum',
        type: 'internal_record',
        label: 'Registro Ramo Comum',
        position: { x: 400, y: 100 },
        config: { fieldMappings: { name: '{{t1.contact_name}}', email: '{{t1.contact_email}}' } },
      },
      {
        id: 'join_confirmacao',
        type: 'send_email',
        label: 'E-mail de Confirmação Convergente',
        position: { x: 650, y: 0 },
        config: {
          to: '{{t1.contact_email}}',
          subject: 'Contato Recebido',
          bodyTemplate: 'Recebemos seu contato com sucesso.',
        },
      },
    ];

    const edges: WorkflowEdge[] = [
      { id: 'e1', sourceNodeId: 't1', targetNodeId: 'cond1' },
      { id: 'e_true', sourceNodeId: 'cond1', targetNodeId: 'branch_vip', sourceHandle: 'true' },
      { id: 'e_false', sourceNodeId: 'cond1', targetNodeId: 'branch_comum', sourceHandle: 'false' },
      // Convergência: ambos os ramos apontam para join_confirmacao
      { id: 'e_join_1', sourceNodeId: 'branch_vip', targetNodeId: 'join_confirmacao' },
      { id: 'e_join_2', sourceNodeId: 'branch_comum', targetNodeId: 'join_confirmacao' },
    ];

    const workflow: WorkflowDefinition = {
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      id: 'wf_join_test',
      orgId: 'org_123',
      name: 'Workflow Convergência',
      version: 1,
      status: 'PUBLISHED',
      triggerNodeId: 't1',
      nodes,
      edges,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Caso 1: Nome VIP -> branch_vip ativo, branch_comum skipped, join_confirmacao executa com SUCCESS
    const resultVip = await engine.simulate(workflow, {
      name: 'VIP',
      email: 'vip@example.test',
      message: 'Olá VIP',
    });
    expect(resultVip.status).toBe('COMPLETED');
    expect(resultVip.nodeResults.find((r) => r.nodeId === 'branch_vip')?.status).toBe('SUCCESS');
    expect(resultVip.nodeResults.find((r) => r.nodeId === 'branch_comum')?.status).toBe('SKIPPED');
    expect(resultVip.nodeResults.find((r) => r.nodeId === 'join_confirmacao')?.status).toBe('SUCCESS');

    // Caso 2: Nome Comum -> branch_vip skipped, branch_comum ativo, join_confirmacao executa com SUCCESS
    const resultComum = await engine.simulate(workflow, {
      name: 'Cliente Padrão',
      email: 'padrao@example.test',
      message: 'Olá Padrão',
    });
    expect(resultComum.status).toBe('COMPLETED');
    expect(resultComum.nodeResults.find((r) => r.nodeId === 'branch_vip')?.status).toBe('SKIPPED');
    expect(resultComum.nodeResults.find((r) => r.nodeId === 'branch_comum')?.status).toBe('SUCCESS');
    expect(resultComum.nodeResults.find((r) => r.nodeId === 'join_confirmacao')?.status).toBe('SUCCESS');
  });
});


import { createTestResourceResolver } from '../../test/resource-fixtures';
import { WorkflowEngineService } from './workflow-engine.service';
import { NodeExecutors } from './node-executors';
import type { WorkflowDefinition } from '@flowmind/contracts';

function journey(): WorkflowDefinition {
  return {
    id: 'wf_c03', orgId: 'org_fixture', name: 'Fixture', version: 1,
    schemaVersion: '1.0.0', status: 'DRAFT', triggerNodeId: 'form',
    createdAt: '2026-10-12T12:00:00Z', updatedAt: '2026-10-12T12:00:00Z',
    nodes: [
      { id: 'form', type: 'trigger_form', label: 'Form', position: { x: 0, y: 0 },
        config: { requiredFields: ['name', 'message'] } },
      { id: 'record', type: 'internal_record', label: 'Registro', position: { x: 100, y: 0 },
        config: { fieldMappings: { name: '{{form.contact_name}}' } } },
      { id: 'mail', type: 'send_email', label: 'E-mail', position: { x: 200, y: 0 },
        config: { to: '{{form.contact_email}}', subject: 'Fixture', bodyTemplate: 'Fixture' } },
    ],
    edges: [
      { id: 'e1', sourceNodeId: 'form', targetNodeId: 'record' },
      { id: 'e2', sourceNodeId: 'record', targetNodeId: 'mail' },
    ],
  };
}

describe('C03 — validação de definição antes da simulação', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejeita dependência de email opcional antes de executar qualquer nó', async () => {
    const form = jest.spyOn(NodeExecutors, 'executeTriggerForm');
    const record = jest.spyOn(NodeExecutors, 'executeInternalRecord');
    const mail = jest.spyOn(NodeExecutors, 'executeSendEmail');
    await expect(new WorkflowEngineService(createTestResourceResolver()).simulate(journey(), {
      name: 'Pessoa sintética', message: 'Fixture sem email',
    })).rejects.toThrow(/email obrigatório/);
    expect(form).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
    expect(mail).not.toHaveBeenCalled();
  });

  it('destinatário literal inválido rejeita a definição antes de executar nós', async () => {
    const definition = journey(); definition.nodes[2].config.to = 'destino-invalido';
    const form = jest.spyOn(NodeExecutors, 'executeTriggerForm');
    const record = jest.spyOn(NodeExecutors, 'executeInternalRecord');
    const mail = jest.spyOn(NodeExecutors, 'executeSendEmail');
    await expect(new WorkflowEngineService(createTestResourceResolver()).simulate(definition, {
      name: 'Pessoa', email: 'pessoa@example.test', message: 'Fixture',
    })).rejects.toThrow(/Destinatário/);
    expect(form).not.toHaveBeenCalled(); expect(record).not.toHaveBeenCalled(); expect(mail).not.toHaveBeenCalled();
  });

  it('permite formulário genérico sem email quando não há resposta ao contato', async () => {
    const definition = journey();
    definition.nodes = definition.nodes.slice(0, 1);
    definition.nodes[0].config.requiredFields = ['message'];
    definition.edges = [];
    const result = await new WorkflowEngineService(createTestResourceResolver()).simulate(definition, { message: 'Fixture' });
    expect(result.status).toBe('COMPLETED');
    expect(result.nodeResults).toHaveLength(1);
  });

  it('dados sem email em jornada válida falham no gatilho antes de registro/e-mail', async () => {
    const definition = journey();
    definition.nodes[0].config.requiredFields = ['name', 'email', 'message'];
    const record = jest.spyOn(NodeExecutors, 'executeInternalRecord');
    const mail = jest.spyOn(NodeExecutors, 'executeSendEmail');
    const result = await new WorkflowEngineService(createTestResourceResolver()).simulate(definition, { name: 'Pessoa', message: 'Fixture' });
    expect(result.status).toBe('FAILED');
    expect(result.nodeResults.map((node) => [node.nodeId, node.status])).toEqual([['form', 'FAILED']]);
    expect(record).not.toHaveBeenCalled();
    expect(mail).not.toHaveBeenCalled();
  });

  it('dados com email inválido falham no gatilho antes de registro/e-mail', async () => {
    const definition = journey(); definition.nodes[0].config.requiredFields = ['name', 'email', 'message'];
    const record = jest.spyOn(NodeExecutors, 'executeInternalRecord');
    const mail = jest.spyOn(NodeExecutors, 'executeSendEmail');
    const result = await new WorkflowEngineService(createTestResourceResolver()).simulate(definition, { name: 'Pessoa', email: 'invalido', message: 'Fixture' });
    expect(result.status).toBe('FAILED');
    expect(result.nodeResults.map((node) => [node.nodeId, node.status])).toEqual([['form', 'FAILED']]);
    expect(record).not.toHaveBeenCalled(); expect(mail).not.toHaveBeenCalled();
  });
});

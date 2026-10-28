import { BadRequestException } from '@nestjs/common';
import type { WorkflowDefinition } from '@flowmind/contracts';
import { ResourceResolver } from '../engine/resource-resolver';
import { validateWorkflowResources } from '../engine/workflow-reference.validation';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import { NodeExecutors } from '../engine/node-executors';
import { ConfiguredResourceCatalog } from './resource-catalog';

const make = (entries: any[] = []) => new (ResourceResolver as any)(new ConfiguredResourceCatalog(entries)) as ResourceResolver;
const model = { id: 'test-model', type: 'ai_model', name: 'Sintético', status: 'ACTIVE',
  allowedOrgIds: ['alpha'], approval: 'APPROVED', providerModelId: 'synthetic-provider' };
function workflow(modelRef?: string): WorkflowDefinition {
  return {
    schemaVersion: '1.0.0', id: 'wf', orgId: 'alpha', name: 'Sintético', version: 1, status: 'DRAFT',
    triggerNodeId: 'form', createdAt: '', updatedAt: '',
    nodes: [
      { id: 'form', type: 'trigger_form', label: 'Form', position: { x: 0, y: 0 }, config: {} },
      { id: 'ai', type: 'ai_analyze_intent', label: 'Análise', position: { x: 1, y: 0 }, config: { inputPromptTemplate: '{{form.message_text}}', ...(modelRef ? { modelRef } : {}) } },
    ],
    edges: [{ id: 'edge', sourceNodeId: 'form', targetNodeId: 'ai' }],
  };
}
function code(action: () => unknown): string | undefined {
  try { action(); } catch (error) { return ((error as BadRequestException).getResponse() as any).code; }
  return undefined;
}
describe('R2 — referências exigem catálogo explícito', () => {
  it('recusa construção sem catálogo em vez de conceder fixtures globais', () => {
    expect(() => new (ResourceResolver as any)()).toThrow();
  });
  it.each(['pending', 'modelo-a-aprovar', 'flowmind-default'])('marcador %s não permite revisão/ativação', (ref) => {
    expect(code(() => validateWorkflowResources(workflow(ref), make()))).toBe('PENDING_MODEL_SELECTION');
  });
  it.each([undefined, 'pending', 'modelo-a-aprovar', 'flowmind-default'])('simulação local sem referências concretas admite %s com catálogo vazio', async (ref) => {
    const engine = new (WorkflowEngineService as any)(make()) as WorkflowEngineService;
    const result = await engine.simulate(workflow(ref), { name: 'Teste', email: 'contato@example.test', message: 'Mensagem sintética' });
    expect(result.status).toBe('COMPLETED');
  });
  it.each(['PENDING', 'foreign', 'missing'])('nega modelo concreto %s antes do primeiro nó', async (caseId) => {
    const entry = { ...model, ...(caseId === 'PENDING' ? { approval: 'PENDING' } : {}), ...(caseId === 'foreign' ? { allowedOrgIds: ['beta'] } : {}) };
    const resolver = make(caseId === 'missing' ? [] : [entry]);
    const engine = new (WorkflowEngineService as any)(resolver) as WorkflowEngineService;
    const firstNode = jest.spyOn(NodeExecutors, 'executeTriggerForm');
    try {
      await expect(engine.simulate(workflow('test-model'), { message: 'Sintética' })).rejects.toMatchObject({ response: { code: 'RESOURCE_NOT_FOUND' } });
      expect(firstNode).not.toHaveBeenCalled();
    } finally { firstNode.mockRestore(); }
  });
  it('resolve modelo aprovado somente no escopo concedido e mantém modelo de geração separado', () => {
    const resolver = make([model]);
    expect(() => validateWorkflowResources(workflow('test-model'), resolver)).not.toThrow();
    expect(code(() => validateWorkflowResources({ ...workflow('test-model'), orgId: 'beta' }, resolver))).toBe('RESOURCE_NOT_FOUND');
  });
  it('alias mapeado explicitamente exige aprovação, status e concessão', () => {
    expect(() => validateWorkflowResources(workflow('flowmind-default'), make([{ ...model, id: 'flowmind-default' }]))).not.toThrow();
  });
});

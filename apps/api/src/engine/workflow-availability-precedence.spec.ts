import { BadRequestException } from '@nestjs/common';
import type { WorkflowNode } from '@flowmind/contracts';
import { NodeExecutors } from './node-executors';
import { validateWorkflowAvailability } from './workflow-reference.validation';

function nodes(config: Record<string, unknown>, field: string): WorkflowNode[] {
  return [
    { id: 'record', type: 'internal_record', label: 'Registro', position: { x: 0, y: 0 }, config },
    { id: 'consumer', type: 'condition', label: 'Condição', position: { x: 1, y: 0 },
      config: { leftOperand: `{{record.${field}}}`, operator: 'is_empty' } },
  ];
}

describe('S2b — disponibilidade respeita precedência do executor', () => {
  it.each([
    ['name', { name: 'Identificador sintético', fieldMappings: { name: '', email: 'contato@example.test' } }],
    ['email', { email: 'contato@example.test', fieldMappings: { name: 'Fixture', email: '  ' } }],
    ['raw_message', { raw_message: 'Texto na raiz', fieldMappings: { name: 'Fixture', raw_message: '', message: 'Alias ocultado' } }],
  ] as const)('rejeita %s ocultado por um mapeamento vazio', (field, config) => {
    const output = NodeExecutors.executeInternalRecord(config, config, { mode: 'SIMULATION', orgId: 'org_fixture' });
    expect(output[field]).toBeUndefined();
    let error: unknown;
    try { validateWorkflowAvailability(nodes(config, field)); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'OUTPUT_NOT_AVAILABLE' });
  });

  it.each([
    ['name', { name: 'Fixture', fieldMappings: { email: 'contato@example.test' } }],
    ['email', { email: 'contato@example.test', fieldMappings: { name: 'Fixture' } }],
    ['raw_message', { raw_message: 'Texto na raiz', fieldMappings: { name: 'Fixture' } }],
  ] as const)('preserva fallback de %s quando não há mapeamento que o oculte', (field, config) => {
    const output = NodeExecutors.executeInternalRecord(config, config, { mode: 'SIMULATION', orgId: 'org_fixture' });
    expect(output[field]).toBe((config as Record<string, unknown>)[field]);
    expect(() => validateWorkflowAvailability(nodes(config, field))).not.toThrow();
  });
});

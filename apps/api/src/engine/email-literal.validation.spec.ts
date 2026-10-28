import { createTestResourceResolver } from '../../test/resource-fixtures';
import { BadRequestException } from '@nestjs/common';
import type { WorkflowDefinition } from '@flowmind/contracts';
import type { PrismaService } from '../prisma/prisma.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { NodeExecutors } from './node-executors';
import { AiGeneratorService } from '../ai/ai-generator.service';

function fixture(overrides: Record<string, unknown>, status: 'DRAFT' | 'REVIEWED' = 'DRAFT') {
  const definition: WorkflowDefinition = { id: 'wf_email_fixture', orgId: 'org_fixture', name: 'Fixture',
    schemaVersion: '1.0.0', version: 1, status, triggerNodeId: 'form',
    nodes: [{ id: 'form', type: 'trigger_form', label: 'Fixture', position: { x: 0, y: 0 }, config: {} },
      { id: 'mail', type: 'send_email', label: 'Fixture', position: { x: 100, y: 0 },
        config: { to: '{{form.contact_email}}', subject: 'Fixture', bodyTemplate: '{{form.message_text}}', ...overrides } }],
    edges: [{ id: 'form_mail', sourceNodeId: 'form', targetNodeId: 'mail' }],
    createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z' };
  let row = { ...definition, createdAt: new Date(definition.createdAt), updatedAt: new Date(definition.updatedAt),
    reviewedBy: status === 'REVIEWED' ? 'admin_fixture' : null, reviewedAt: status === 'REVIEWED' ? new Date() : null };
  const updateMany = jest.fn(async ({ data }) => { row = { ...row, ...data }; return { count: 1 }; });
  const create = jest.fn(async ({ data }) => ({ ...data, id: 'snapshot_fixture' }));
  const prisma = { workflow: { findFirst: jest.fn(async () => row), updateMany },
    workflowVersion: { create }, $transaction: async (action: (tx: unknown) => unknown) => action(prisma) };
  return { definition, writes: updateMany, snapshots: create, service: new WorkflowsService(prisma as unknown as PrismaService,
    new WorkflowEngineService(createTestResourceResolver()), createTestResourceResolver()) };
}
const invalidLiterals: Array<[string, Record<string, unknown>]> = [
  ['to com espaço inicial', { to: ' contato@example.test' }],
  ['to com espaço final', { to: 'contato@example.test ' }],
  ['replyTo inválido', { replyTo: 'private_fixture_invalid' }],
  ['replyTo somente espaços', { replyTo: '   ' }],
  ['replyTo com espaço inicial', { replyTo: ' contato@example.test' }],
  ['replyTo com prefixo mailto', { replyTo: 'mailto:contato@example.test' }],
];
async function rejected(operation: Promise<unknown>) {
  await expect(operation).rejects.toBeInstanceOf(BadRequestException);
}

describe('T03 — e-mail literal compatível com o executor', () => {
  afterEach(() => jest.restoreAllMocks());
  for (const operation of ['review', 'publish'] as const) {
    it.each(invalidLiterals)(`${operation} nega %s antes de writes/snapshot`, async (_name, config) => {
      const value = fixture(config, operation === 'publish' ? 'REVIEWED' : 'DRAFT');
      await rejected(value.service[operation]('org_fixture', 'wf_email_fixture', 'admin_fixture'));
      expect(value.writes).not.toHaveBeenCalled(); expect(value.snapshots).not.toHaveBeenCalled();
    });
  }
  it.each(invalidLiterals)('simulação nega %s antes do primeiro nó', async (_name, config) => {
    const form = jest.spyOn(NodeExecutors, 'executeTriggerForm');
    const mail = jest.spyOn(NodeExecutors, 'executeSendEmail');
    await rejected(new WorkflowEngineService(createTestResourceResolver()).simulate(fixture(config).definition,
      { name: 'Fixture', email: 'contato@example.test', message: 'Fixture' }));
    expect(form).not.toHaveBeenCalled(); expect(mail).not.toHaveBeenCalled();
  });

  it.each(invalidLiterals.slice(2))('draft parcial não esconde %s inválido', async (_name, overrides) => {
    const value = fixture(overrides); delete value.definition.nodes[1].config.bodyTemplate;
    await rejected(value.service.update('org_fixture', 'wf_email_fixture', { nodes: value.definition.nodes }));
    expect(value.writes).not.toHaveBeenCalled();
  });
  it.each(invalidLiterals.slice(2))('proposta parcial recusa %s e conserva consumo', async (_name, overrides) => {
    const value = fixture(overrides); delete value.definition.nodes[1].config.bodyTemplate;
    const service = new AiGeneratorService(createTestResourceResolver(), { generateWorkflow: async () => ({ draft: { ...value.definition, description: 'Fixture' },
      reasoning: 'Fixture', warnings: [], modelUsed: 'fixture-not-approved', tokensConsumed: 24 }) });
    try { await service.generateFromNaturalLanguage({ prompt: 'Proposta sintética' }, 'org_fixture'); throw new Error('Deveria recusar'); }
    catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const body = (error as BadRequestException).getResponse();
      expect(body).toMatchObject({ code: 'AI_INVALID_WORKFLOW_RESPONSE', tokensConsumed: 24 });
      expect(JSON.stringify(body)).not.toContain('private_fixture_invalid');
    }
  });

  it.each([undefined, '', 'resposta@example.test', '{{form.contact_email}}'])('preserva replyTo válido/opcional %s', async (replyTo) => {
    const value = fixture({ replyTo });
    await expect(value.service.review('org_fixture', 'wf_email_fixture', 'admin_fixture')).resolves.toBeDefined();
    const result = await new WorkflowEngineService(createTestResourceResolver()).simulate(value.definition,
      { name: 'Fixture', email: 'contato@example.test', message: 'Fixture' });
    expect(result.status).toBe('COMPLETED');
  });
});

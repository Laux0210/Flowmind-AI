import { createTestResourceResolver } from '../../test/resource-fixtures';
import { BadRequestException } from '@nestjs/common';
import type { WorkflowDefinition } from '@flowmind/contracts';
import { validateWorkflowResources } from './workflow-reference.validation';
import { WorkflowsService } from '../workflows/workflows.service';
import { WorkflowEngineService } from './workflow-engine.service';
import type { PrismaService } from '../prisma/prisma.service';

function createWorkflow(orgId = 'org_alpha'): WorkflowDefinition {
  return {
    id: 'wf_resource_test',
    orgId,
    name: 'Workflow Recursos',
    schemaVersion: '1.0.0',
    version: 1,
    status: 'DRAFT',
    triggerNodeId: 'form',
    nodes: [
      {
        id: 'form',
        type: 'trigger_form',
        label: 'Gatilho',
        position: { x: 0, y: 0 },
        config: { requiredFields: ['name', 'email', 'message'], formId: 'form_alpha_contact' },
      },
      {
        id: 'ai',
        type: 'ai_analyze_intent',
        label: 'IA',
        position: { x: 100, y: 0 },
        config: { inputPromptTemplate: '{{form.message_text}}', modelRef: 'gpt-4o-mini' },
      },
      {
        id: 'http',
        type: 'http_request',
        label: 'HTTP',
        position: { x: 200, y: 0 },
        config: { url: 'https://api.example.test/lead', method: 'POST', credentialRef: 'cred_alpha_http' },
      },
      {
        id: 'mail',
        type: 'send_email',
        label: 'Email',
        position: { x: 300, y: 0 },
        config: { to: '{{form.contact_email}}', subject: 'Contato', bodyTemplate: 'Olá' },
      },
    ],
    edges: [
      { id: 'e1', sourceNodeId: 'form', targetNodeId: 'ai' },
      { id: 'e2', sourceNodeId: 'ai', targetNodeId: 'http' },
      { id: 'e3', sourceNodeId: 'http', targetNodeId: 'mail' },
    ],
    createdAt: '2026-10-13T00:00:00Z',
    updatedAt: '2026-10-13T00:00:00Z',
  };
}

function serviceFixture(w: WorkflowDefinition, status: 'DRAFT' | 'REVIEWED') {
  const row = {
    ...w,
    status,
    createdAt: new Date(w.createdAt),
    updatedAt: new Date(w.updatedAt),
    reviewedBy: status === 'REVIEWED' ? 'admin_fixture' : null,
    reviewedAt: status === 'REVIEWED' ? new Date(w.updatedAt) : null,
  };
  const workflow = {
    findFirst: jest.fn(async () => structuredClone(row)),
    updateMany: jest.fn(async ({ data }: { data: object }) => {
      Object.assign(row, data);
      return { count: 1 };
    }),
  };
  const workflowVersion = {
    create: jest.fn(async ({ data }: { data: object }) => ({ id: 'snapshot', ...data })),
  };
  const prisma = {
    workflow,
    workflowVersion,
    $transaction: async (action: (tx: object) => Promise<unknown>) => action({ workflow, workflowVersion }),
  };
  return {
    service: new WorkflowsService(prisma as unknown as PrismaService, new WorkflowEngineService(createTestResourceResolver()), createTestResourceResolver()),
    workflow,
    workflowVersion,
  };
}

describe('T03-S3 — Resolução e validação de recursos por organização', () => {
  describe('ResourceResolver', () => {
    const resolver = createTestResourceResolver();

    it('resolve modelo homologado com sucesso', () => {
      expect(resolver.resolveAiModel('org_alpha', 'gpt-4o-mini').status).toBe('ACTIVE');
      expect(resolver.resolveAiModel('org_alpha', 'gpt-4o').status).toBe('ACTIVE');
      expect(resolver.resolveAiModel('org_alpha', 'flowmind-default').status).toBe('ACTIVE');
      expect(() => resolver.resolveAiModel('org_alpha', 'modelo-a-aprovar')).toThrow(BadRequestException);
    });

    it('rejeita modelo desconhecido ou não homologado', () => {
      expect(() => resolver.resolveAiModel('org_alpha', 'unapproved-llm')).toThrow(BadRequestException);
      expect(() => resolver.resolveAiModel('org_alpha', '')).toThrow(BadRequestException);
    });

    it('resolve credencial própria da organização com sucesso', () => {
      const res = resolver.resolveCredential('org_alpha', 'cred_alpha_http');
      expect(res.id).toBe('cred_alpha_http');
      expect(res).not.toHaveProperty('orgId');
      expect(res.status).toBe('ACTIVE');
    });

    it('rejeita credencial pertencente a outra organização (cross-tenant)', () => {
      try {
        resolver.resolveCredential('org_alpha', 'cred_beta_http');
        fail('Deveria ter lançado exceção de cross-tenant');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse().code).toBe('RESOURCE_NOT_FOUND');
      }
    });

    it('rejeita credencial inexistente no servidor', () => {
      try {
        resolver.resolveCredential('org_alpha', 'cred_inexistente');
        fail('Deveria ter lançado exceção');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse().code).toBe('RESOURCE_NOT_FOUND');
      }
    });

    it('rejeita credencial inativa ou revogada', () => {
      expect(() => resolver.resolveCredential('org_alpha', 'cred_alpha_inactive')).toThrow(BadRequestException);
      expect(() => resolver.resolveCredential('org_alpha', 'cred_alpha_revoked')).toThrow(BadRequestException);
    });

    it('resolve formulário próprio e nega cross-tenant', () => {
      expect(resolver.resolveForm('org_alpha', 'form_alpha_contact').status).toBe('ACTIVE');
      expect(() => resolver.resolveForm('org_alpha', 'form_beta_contact')).toThrow(BadRequestException);
      expect(() => resolver.resolveForm('org_alpha', 'form_inexistente')).toThrow(BadRequestException);
    });
  });

  describe('Validação nas fronteiras de revisão e ativação (WorkflowsService)', () => {
    it('aprova workflow com recursos próprios válidos na revisão', async () => {
      const wf = createWorkflow('org_alpha');
      const f = serviceFixture(wf, 'DRAFT');
      const result = await f.service.review(wf.orgId, wf.id, 'admin_fixture');
      expect(result.workflow.status).toBe('REVIEWED');
      expect(f.workflow.updateMany).toHaveBeenCalled();
    });

    it('nega revisão se workflow usar credencial de outra organização (cross-tenant) com zero escritas', async () => {
      const wf = createWorkflow('org_alpha');
      // org_alpha tenta usar credencial de org_beta
      wf.nodes[2].config.credentialRef = 'cred_beta_http';
      const f = serviceFixture(wf, 'DRAFT');

      await expect(f.service.review(wf.orgId, wf.id, 'admin_fixture')).rejects.toThrow(BadRequestException);
      expect(f.workflow.updateMany).not.toHaveBeenCalled();
      expect(f.workflowVersion.create).not.toHaveBeenCalled();
    });

    it('nega ativação se workflow usar credencial inexistente com zero snapshots', async () => {
      const wf = createWorkflow('org_alpha');
      wf.nodes[2].config.credentialRef = 'cred_fantasma_123';
      const f = serviceFixture(wf, 'REVIEWED');

      await expect(f.service.publish(wf.orgId, wf.id, 'admin_fixture')).rejects.toThrow(BadRequestException);
      expect(f.workflow.updateMany).not.toHaveBeenCalled();
      expect(f.workflowVersion.create).not.toHaveBeenCalled();
    });

    it('nega revisão se workflow usar modelo de IA desconhecido', async () => {
      const wf = createWorkflow('org_alpha');
      wf.nodes[1].config.modelRef = 'modelo_desconhecido_xyz';
      const f = serviceFixture(wf, 'DRAFT');

      await expect(f.service.review(wf.orgId, wf.id, 'admin_fixture')).rejects.toThrow(BadRequestException);
      expect(f.workflow.updateMany).not.toHaveBeenCalled();
    });

    it('nega revisão se workflow usar formulário de outra organização', async () => {
      const wf = createWorkflow('org_alpha');
      wf.nodes[0].config.formId = 'form_beta_contact';
      const f = serviceFixture(wf, 'DRAFT');

      await expect(f.service.review(wf.orgId, wf.id, 'admin_fixture')).rejects.toThrow(BadRequestException);
      expect(f.workflow.updateMany).not.toHaveBeenCalled();
    });

    it('aceita workflow sem credentialRef nem formId opcionais', async () => {
      const wf = createWorkflow('org_alpha');
      delete wf.nodes[0].config.formId;
      delete wf.nodes[2].config.credentialRef;
      const f = serviceFixture(wf, 'DRAFT');

      await expect(f.service.review(wf.orgId, wf.id, 'admin_fixture')).resolves.toBeDefined();
      expect(f.workflow.updateMany).toHaveBeenCalled();
    });
  });

  describe('Validação antecipada na simulação (WorkflowEngineService)', () => {
    it('nega simulação se credencial for cross-tenant antes de executar nós', async () => {
      const wf = createWorkflow('org_alpha');
      wf.nodes[2].config.credentialRef = 'cred_beta_http';
      const engine = new WorkflowEngineService(createTestResourceResolver());

      await expect(
        engine.simulate(wf, { name: 'Teste', email: 'teste@example.test', message: 'Msg' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('nega simulação se modelo for desconhecido antes de executar nós', async () => {
      const wf = createWorkflow('org_alpha');
      wf.nodes[1].config.modelRef = 'modelo_ficticio_proibido';
      const engine = new WorkflowEngineService(createTestResourceResolver());

      await expect(
        engine.simulate(wf, { name: 'Teste', email: 'teste@example.test', message: 'Msg' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('permite simulação com recursos próprios válidos', async () => {
      const wf = createWorkflow('org_alpha');
      const engine = new WorkflowEngineService(createTestResourceResolver());

      const res = await engine.simulate(wf, { name: 'Teste', email: 'teste@example.test', message: 'Msg' });
      expect(res.status).toBe('COMPLETED');
    });
  });
});

import { NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import {
  WorkflowDefinition,
  WORKFLOW_SCHEMA_VERSION,
  WorkflowNode,
  WorkflowEdge,
} from '@flowmind/contracts';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import { AiGeneratorService } from '../ai/ai-generator.service';
import { ExecutionsService } from '../executions/executions.service';
import { UsageLimitsService } from '../executions/usage-limits.service';
import { WebhooksService } from '../triggers/webhooks.service';
import { ClerkService } from '../auth/clerk.service';
import { NodeExecutors } from '../engine/node-executors';
import { WorkflowsService } from '../workflows/workflows.service';

describe('T14 — componentes da jornada com adaptadores sintéticos', () => {
  let engineService: WorkflowEngineService;
  let aiService: AiGeneratorService;
  let executionsService: ExecutionsService;
  let usageLimitsService: UsageLimitsService;
  let webhooksService: WebhooksService;
  let clerkService: ClerkService;
  let workflowsService: WorkflowsService;
  let prismaMock: any;

  const orgAlpha = 'org_alpha_enterprise';
  const orgBeta = 'org_beta_competitor';

  beforeEach(() => {
    prismaMock = {
      workflow: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      workflowExecution: {
        create: jest.fn().mockImplementation((args) => Promise.resolve(args.data)),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    prismaMock.$transaction = jest.fn(async (operation: any) => operation(prismaMock));
    engineService = new WorkflowEngineService();
    aiService = new AiGeneratorService();
    usageLimitsService = new UsageLimitsService(prismaMock);
    executionsService = new ExecutionsService(prismaMock, usageLimitsService);
    webhooksService = new WebhooksService(engineService);
    clerkService = new ClerkService(prismaMock);
    workflowsService = new WorkflowsService(prismaMock, engineService);
  });

  describe('1. Estruturas sintéticas da jornada (não substituem o aceite C01–C03)', () => {
    it('JOURNEY01: simula a estrutura Formulário -> IA -> Registro -> E-mail', async () => {
      // 1.1 Geração estruturada por linguagem natural (T10)
      const aiDraft = await aiService.generateFromNaturalLanguage(
        {
          prompt: 'Quando formulário for enviado, resuma a mensagem e identifique intenção e ambiguidades com IA, salve no banco interno e responda por e-mail.',
        },
        orgAlpha,
      );

      expect(aiDraft.requiresHumanReview).toBe(true);
      expect(aiDraft.workflow.nodes.length).toBe(4);

      const workflow: WorkflowDefinition = {
        schemaVersion: WORKFLOW_SCHEMA_VERSION,
        id: 'wf_c01_full',
        orgId: orgAlpha,
        name: aiDraft.workflow.name,
        version: 1,
        status: 'PUBLISHED',
        triggerNodeId: aiDraft.workflow.triggerNodeId,
        nodes: aiDraft.workflow.nodes,
        edges: aiDraft.workflow.edges,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 1.2 Simulação com payload do Caso C01 (Pedido Completo)
      const c01Payload = {
        name: 'Carlos Proposta',
        email: 'carlos.empresa@example.test',
        message: 'Gostaria de contratar seus serviços de IA e solicitar uma proposta orçamentária comercial urgente.',
      };

      const simResult = await engineService.simulate(workflow, c01Payload);

      expect(simResult.status).toBe('COMPLETED');
      expect(simResult.nodeResults).toHaveLength(4);

      // Validação de cada etapa
      const triggerStep = simResult.nodeResults.find((r) => r.nodeType === 'trigger_form');
      expect(triggerStep?.status).toBe('SUCCESS');
      expect(triggerStep?.outputs?.contact_name).toBe('Carlos Proposta');

      const emailStep = simResult.nodeResults.find((r) => r.nodeType === 'send_email');
      expect(emailStep?.status).toBe('SUCCESS');
      expect(emailStep?.outputs?.delivery_status).toBe('simulated');
      expect(emailStep?.outputs?.recipient).toBe('carlos.empresa@example.test');

      // 1.3 Registro no histórico e auditoria (T13)
      const recorded = await executionsService.recordExecution(
        orgAlpha,
        workflow.id,
        workflow.version,
        'SIMULATION',
        'COMPLETED',
        'c01_test_suite',
        simResult.nodeResults,
        new Date().toISOString(),
      );

      expect(recorded.id).toBeDefined();
      expect(recorded.orgId).toBe(orgAlpha);
    });

    it('JOURNEY02: simula a estrutura de um formulário de dúvidas', async () => {
      const c02Prompt = 'Receba formulário de dúvidas gerais, analise intenção com IA e envie resposta.';
      const draft = await aiService.generateFromNaturalLanguage({ prompt: c02Prompt }, orgAlpha);

      const workflow: WorkflowDefinition = {
        schemaVersion: WORKFLOW_SCHEMA_VERSION,
        id: 'wf_c02_doubts',
        orgId: orgAlpha,
        name: draft.workflow.name,
        version: 1,
        status: 'PUBLISHED',
        triggerNodeId: draft.workflow.triggerNodeId,
        nodes: draft.workflow.nodes,
        edges: draft.workflow.edges,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const c02Payload = {
        name: 'Mariana Dúvidas',
        email: 'mariana.contato@example.test',
        message: 'Tenho algumas dúvidas gerais sobre a plataforma e não sei se temos interesse imediato.',
      };

      const simResult = await engineService.simulate(workflow, c02Payload);
      expect(simResult.status).toBe('COMPLETED');
      expect(simResult.nodeResults.length).toBeGreaterThanOrEqual(3);
    });

    it('BRANCH01: roteamento condicional e propagação de SKIPPED na subárvore inativa', async () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'trigger_1',
          type: 'trigger_form',
          label: 'Gatilho',
          position: { x: 0, y: 0 },
          config: { requiredFields: ['name', 'email', 'message'] },
        },
        {
          id: 'cond_vip',
          type: 'condition',
          label: 'Verificar se é VIP',
          position: { x: 200, y: 0 },
          config: {
            leftOperand: '{{trigger_1.contact_name}}',
            operator: 'contains',
            rightOperand: 'VIP',
          },
        },
        {
          id: 'email_vip',
          type: 'send_email',
          label: 'E-mail VIP',
          position: { x: 400, y: -100 },
          config: { to: 'vip@example.test', subject: 'Atendimento Prioritário' },
        },
        {
          id: 'webhook_crm_vip',
          type: 'http_request',
          label: 'Notificar CRM VIP',
          position: { x: 600, y: -100 },
          config: { url: 'https://api.exemplo.com/crm', method: 'POST' },
        },
      ];

      const edges: WorkflowEdge[] = [
        { id: 'e1', sourceNodeId: 'trigger_1', targetNodeId: 'cond_vip' },
        { id: 'e2', sourceNodeId: 'cond_vip', targetNodeId: 'email_vip', sourceHandle: 'true' },
        { id: 'e3', sourceNodeId: 'email_vip', targetNodeId: 'webhook_crm_vip' },
      ];

      const workflow: WorkflowDefinition = {
        schemaVersion: WORKFLOW_SCHEMA_VERSION,
        id: 'wf_c03_branch',
        orgId: orgAlpha,
        name: 'Triagem Condicional',
        version: 1,
        status: 'PUBLISHED',
        triggerNodeId: 'trigger_1',
        nodes,
        edges,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Execução com contato COMUM (não VIP) -> condição avalia para FALSE
      const payload = {
        name: 'Cliente Comum',
        email: 'comum@example.test',
        message: 'Contato comum',
      };

      const result = await engineService.simulate(workflow, payload);

      expect(result.status).toBe('COMPLETED');
      // Ambos os nós do ramo 'true' (filho direto e neto) devem estar marcados como SKIPPED
      const emailVipStep = result.nodeResults.find((r) => r.nodeId === 'email_vip');
      const crmVipStep = result.nodeResults.find((r) => r.nodeId === 'webhook_crm_vip');

      expect(emailVipStep?.status).toBe('SKIPPED');
      expect(crmVipStep?.status).toBe('SKIPPED');
    });
  });

  describe('2. Matriz de Isolamento e Segurança Multi-tenant (STRIDE SEC01–SEC06)', () => {
    it('SEC04: Org_Beta não pode consultar execuções da Org_Alpha (fixture negativa)', async () => {
      // Registra execução pertencente a Org_Alpha
      const execAlpha = await executionsService.recordExecution(
        orgAlpha,
        'wf_alpha_secret',
        1,
        'SIMULATION',
        'COMPLETED',
        'alpha_user',
        [],
        new Date().toISOString(),
      );

      // Org_Beta tenta consultar a execução da Org_Alpha
      await expect(
        executionsService.getExecutionById(orgBeta, execAlpha.id),
      ).rejects.toThrow(NotFoundException);

      // Ao listar execuções de Org_Beta, a lista deve estar vazia
      const betaList = await executionsService.listExecutions(orgBeta);
      expect(betaList.find((e) => e.id === execAlpha.id)).toBeUndefined();
    });

    it('SEC01 / SEC02 / SEC03: Org_Beta não pode consultar, modificar, simular nem excluir workflow da Org_Alpha', async () => {
      const storedWorkflows = new Map<string, any>();
      prismaMock.workflow.create.mockImplementation(async ({ data }: any) => {
        const row = { ...data, id: 'wf_alpha_confidential', createdAt: new Date(), updatedAt: new Date() };
        storedWorkflows.set(row.id, row);
        return row;
      });
      prismaMock.workflow.findFirst.mockImplementation(async ({ where }: any) => {
        const row = storedWorkflows.get(where.id);
        return row?.orgId === where.orgId ? row : null;
      });
      prismaMock.workflow.updateMany.mockImplementation(async ({ where, data }: any) => {
        const row = storedWorkflows.get(where.id);
        if (row?.orgId !== where.orgId) return { count: 0 };
        storedWorkflows.set(row.id, { ...row, ...data });
        return { count: 1 };
      });
      prismaMock.workflow.deleteMany.mockImplementation(async ({ where }: any) => {
        const row = storedWorkflows.get(where.id);
        if (row?.orgId !== where.orgId) return { count: 0 };
        storedWorkflows.delete(row.id);
        return { count: 1 };
      });

      const wf = await workflowsService.create(orgAlpha, { name: 'Fluxo Alpha Privado' });

      // SEC01: Consulta cruzada falha com 404
      await expect(workflowsService.findOne(orgBeta, wf.id)).rejects.toThrow(NotFoundException);

      // SEC02: Mutação cruzada falha com 404
      await expect(workflowsService.update(orgBeta, wf.id, { name: 'Ataque' })).rejects.toThrow(NotFoundException);

      // SEC03: Simulação cruzada falha com 404
      await expect(workflowsService.simulate(orgBeta, wf.id, { initialPayload: {} })).rejects.toThrow(NotFoundException);

      // Exclusão cruzada falha com 404
      await expect(workflowsService.remove(orgBeta, wf.id)).rejects.toThrow(NotFoundException);
    });

    it('SEC09 parcial: rejeita edição e exclusão de workflow publicado', async () => {
      const storedWorkflows = new Map<string, any>();
      const publishedRow = {
        id: 'wf_alpha_live',
        orgId: orgAlpha,
        name: 'Fluxo Publicado',
        status: 'PUBLISHED',
        version: 1,
        schemaVersion: WORKFLOW_SCHEMA_VERSION,
        triggerNodeId: 'trig',
        nodes: [],
        edges: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      storedWorkflows.set(publishedRow.id, publishedRow);

      prismaMock.workflow.findFirst.mockImplementation(async ({ where }: any) => {
        const row = storedWorkflows.get(where.id);
        return row?.orgId === where.orgId ? row : null;
      });

      // SEC09: Edição direta de versão publicada é rejeitada (imutabilidade)
      await expect(
        workflowsService.update(orgAlpha, publishedRow.id, { name: 'Mutação Ilegal' }),
      ).rejects.toThrow(/depende do contrato de novas revisões/);

      // Proteção de ciclo de vida; SEC10 trata acesso cruzado ao registro de negócio.
      await expect(
        workflowsService.remove(orgAlpha, publishedRow.id),
      ).rejects.toThrow(/Não é permitido excluir um workflow ativo/);
    });

    it('NET01: valida URLs literais privadas e de metadados sem efetuar requisições', () => {
      const maliciousUrls = [
        'http://127.0.0.1:8080/admin',
        'http://localhost:3000/keys',
        'http://169.254.169.254/latest/meta-data',
        'http://metadata.google.internal/computeMetadata',
        'http://10.0.0.1/private',
        'http://192.168.0.1/router',
      ];

      for (const url of maliciousUrls) {
        expect(() => {
          NodeExecutors.validateUrlAgainstSsrf(url);
        }).toThrow(BadRequestException);
      }
    });

    it('AUTH01: token sintético é rejeitado sem configuração de autenticação em produção', async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';

        await expect(
          clerkService.verifyToken('mock_test_token_valid_org1'),
        ).rejects.toThrow(UnauthorizedException);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('PRIV01: sanitiza padrões de segredos nos dados sintéticos', async () => {
      const sensitiveInputs = {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.super_secret_jwt',
        openAiKey: 'sk-abcdef1234567890abcdef1234567890',
        contact: {
          name: 'João',
          password: 'minha_senha_secreta',
        },
      };

      const sanitized = UsageLimitsService.sanitizeSensitiveData(sensitiveInputs);

      expect(sanitized.authorization).toBe('Bearer [REDACTED]');
      expect(sanitized.openAiKey).toBe('sk-[REDACTED]');
      expect(sanitized.contact.password).toBe('[REDACTED]');
      expect(sanitized.contact.name).toBe('João');
    });

    it('LIMIT01: quota provisória rejeita contagem igual ao limite', async () => {
      const orgDos = 'org_dos_test';
      prismaMock.workflowExecution.count.mockResolvedValue(1000);

      await expect(
        usageLimitsService.checkAndConsumeExecution(orgDos),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

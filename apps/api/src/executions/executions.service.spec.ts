import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ExecutionsService } from './executions.service';
import { UsageLimitsService } from './usage-limits.service';
import { PrismaService } from '../prisma/prisma.service';
import { NodeExecutionResult } from '@flowmind/contracts';

describe('ExecutionsService & UsageLimitsService (T13 — Logs, Histórico e Consumo)', () => {
  let executionsService: ExecutionsService;
  let usageLimitsService: UsageLimitsService;
  let prismaMock: any;

  beforeEach(() => {
    const rows: any[] = [];
    prismaMock = {
      workflowExecution: {
        create: jest.fn().mockImplementation((args: { data: any }) => {
          rows.push(args.data);
          return Promise.resolve(args.data);
        }),
        findMany: jest.fn().mockImplementation(({ where, take }: { where: { orgId: string; workflowId?: string }; take: number }) =>
          Promise.resolve(rows.filter((row) => row.orgId === where.orgId && (!where.workflowId || row.workflowId === where.workflowId)).slice(0, take)),
        ),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    usageLimitsService = new UsageLimitsService(prismaMock as unknown as PrismaService);
    executionsService = new ExecutionsService(
      prismaMock as unknown as PrismaService,
      usageLimitsService,
    );
  });

  describe('UsageLimitsService (Limites e Sanitização)', () => {
    it('deve permitir execução quando dentro da quota mensal', async () => {
      const orgId = 'org_within_quota';
      await expect(usageLimitsService.checkAndConsumeExecution(orgId)).resolves.not.toThrow();
    });

    it('deve lançar QUOTA_EXCEEDED quando a organização atinge o limite de 1.000 execuções', async () => {
      const orgId = 'org_max_quota';
      // Simula contagem do banco retornando 1.000
      prismaMock.workflowExecution.count.mockResolvedValue(1000);

      await expect(usageLimitsService.checkAndConsumeExecution(orgId)).rejects.toThrow(
        BadRequestException,
      );

      try {
        await usageLimitsService.checkAndConsumeExecution(orgId);
      } catch (err: any) {
        expect(err.getResponse().code).toBe('QUOTA_EXCEEDED');
      }
    });

    it('deve calcular o relatório de consumo com percentual e estimativa de tokens', async () => {
      const orgId = 'org_metrics_test';
      prismaMock.workflowExecution.count.mockResolvedValue(250);

      const report = await usageLimitsService.getOrgUsageReport(orgId);
      expect(report.orgId).toBe(orgId);
      expect(report.totalExecutions).toBe(250);
      expect(report.maxExecutionsQuota).toBe(1000);
      expect(report.usagePercentage).toBe(25);
      expect(report.estimatedTokensConsumed).toBe(250 * 240);
      expect(report.isLimitReached).toBe(false);
    });

    it('deve sanitizar tokens Bearer, chaves OpenAI, senhas, assinaturas e credenciais em dados sensíveis', () => {
      const rawData = {
        authorizationHeader: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret',
        apiKey: 'sk-1234567890abcdef1234567890abcdef',
        signature: 'sec_sig_123456789',
        credential: 'db_password_xyz',
        webhookSecret: 'whsec_abcdef123456',
        nested: {
          password: 'super_secret_password_123',
          publicInfo: 'Informação pública mantida',
        },
      };

      const sanitized = UsageLimitsService.sanitizeSensitiveData(rawData);

      expect(sanitized.authorizationHeader).toBe('Bearer [REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.signature).toBe('[REDACTED]');
      expect(sanitized.credential).toBe('[REDACTED]');
      expect(sanitized.webhookSecret).toBe('[REDACTED]');
      expect(sanitized.nested.password).toBe('[REDACTED]');
      expect(sanitized.nested.publicInfo).toBe('Informação pública mantida');
    });
  });

  describe('ExecutionsService (Histórico e Isolamento Multi-tenant)', () => {
    const mockNodeResults: NodeExecutionResult[] = [
      {
        nodeId: 'trigger_1',
        nodeType: 'trigger_form',
        status: 'SUCCESS',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        inputs: { token: 'Bearer secret_token' },
        outputs: { contact_name: 'Lead' },
      },
    ];

    it('deve registrar execução e persistir dados sanitizados', async () => {
      const orgId = 'org_test_1';
      const execution = await executionsService.recordExecution(
        orgId,
        'wf_1',
        1,
        'SIMULATION',
        'COMPLETED',
        'manual_test',
        mockNodeResults,
        new Date().toISOString(),
      );

      expect(execution).toBeDefined();
      expect(execution.id).toBeDefined();
      expect(execution.orgId).toBe(orgId);
      // Confere se o segredo nos inputs do nó foi mascarado
      expect((execution.nodeResults[0].inputs as any).token).toBe('[REDACTED]');
    });

    it('deve retornar 404 ao consultar execução pertencente a outra organização (SEC01)', async () => {
      const orgTenantA = 'org_tenant_a';
      const orgTenantB = 'org_tenant_b';

      // Execução salva para Tenant A
      const execA = await executionsService.recordExecution(
        orgTenantA,
        'wf_1',
        1,
        'SIMULATION',
        'COMPLETED',
        'manual',
        [],
        new Date().toISOString(),
      );

      // Tenant B tenta consultar a execução de Tenant A
      await expect(
        executionsService.getExecutionById(orgTenantB, execA.id),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve listar apenas execuções da organização ativa', async () => {
      const org1 = 'org_list_1';
      const org2 = 'org_list_2';

      await executionsService.recordExecution(org1, 'wf_a', 1, 'SIMULATION', 'COMPLETED', 'test', [], new Date().toISOString());
      await executionsService.recordExecution(org1, 'wf_b', 1, 'SIMULATION', 'COMPLETED', 'test', [], new Date().toISOString());
      await executionsService.recordExecution(org2, 'wf_c', 1, 'SIMULATION', 'COMPLETED', 'test', [], new Date().toISOString());

      const listOrg1 = await executionsService.listExecutions(org1);
      expect(listOrg1.length).toBe(2);

      const listOrg2 = await executionsService.listExecutions(org2);
      expect(listOrg2.length).toBe(1);
    });
  });
});

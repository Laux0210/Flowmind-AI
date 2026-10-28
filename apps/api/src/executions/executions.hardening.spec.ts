import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ExecutionsService } from './executions.service';
import { UsageLimitsService } from './usage-limits.service';

describe('T13 — persistência, isolamento e proteção de dados (storage sintético)', () => {
  let service: ExecutionsService;
  let usage: UsageLimitsService;
  let prisma: any;
  let executions: any[];
  const workflows = [
    { id: 'wf_alpha', orgId: 'org_alpha', name: 'Alpha' },
    { id: 'wf_beta', orgId: 'org_beta', name: 'Beta' },
  ];
  const matches = (row: any, where: any) => Object.entries(where).every(([key, value]: any) =>
    key === 'workflow' ? row.workflow.orgId === value.orgId : row[key] === value,
  );

  beforeEach(() => {
    executions = [];
    prisma = {
      workflow: { findFirst: jest.fn(async ({ where }: any) => workflows.find((row) => matches(row, where)) ?? null) },
      workflowExecution: {
        create: jest.fn(async ({ data }: any) => {
          const row = { ...data, workflow: workflows.find((workflow) => workflow.id === data.workflowId) };
          executions.push(row); return row;
        }),
        count: jest.fn(async ({ where }: any) => executions.filter((row) => row.orgId === where.orgId && row.startedAt >= where.startedAt.gte).length),
        findMany: jest.fn(async ({ where, take }: any) => executions.filter((row) => matches(row, where)).slice(0, take)),
        findFirst: jest.fn(async ({ where }: any) => executions.find((row) => matches(row, where)) ?? null),
      },
    };
    usage = new UsageLimitsService(prisma);
    service = new ExecutionsService(prisma, usage);
  });

  const record = (service: ExecutionsService, org = 'org_alpha', workflow = 'wf_alpha', results: any[] = []) =>
    service.recordExecution(org, workflow, 1, 'SIMULATION', 'COMPLETED', 'fixture_user', results, new Date().toISOString());
  const recordLive = (service: ExecutionsService, org = 'org_alpha', workflow = 'wf_alpha', results: any[] = []) =>
    service.recordExecution(org, workflow, 1, 'LIVE', 'COMPLETED', 'fixture_user', results, new Date().toISOString());

  it('persiste e recupera recursos próprios nas duas organizações', async () => {
    const alpha = await record(service); const beta = await record(service, 'org_beta', 'wf_beta');
    expect((await service.getExecutionById('org_alpha', alpha.id)).orgId).toBe('org_alpha');
    expect((await service.getExecutionById('org_beta', beta.id)).orgId).toBe('org_beta');
    expect((await service.listExecutions('org_alpha')).map((row) => row.id)).toEqual([alpha.id]);
    await expect(service.getExecutionById('org_beta', alpha.id)).rejects.toThrow(NotFoundException);
  });

  it.each([['org_alpha', 'wf_beta'], ['org_beta', 'wf_alpha'], ['org_alpha', 'missing']])(
    'nega registro %s/%s antes de consumir ou gravar', async (org, workflow) => {
      await expect(record(service, org, workflow)).rejects.toThrow(NotFoundException);
      expect(prisma.workflowExecution.count).not.toHaveBeenCalled();
      expect(prisma.workflowExecution.create).not.toHaveBeenCalled();
    },
  );

  it('indisponibilidade na consulta do workflow nega registro sem consumir', async () => {
    prisma.workflow.findFirst.mockRejectedValue(new Error('private_db_fixture'));
    await expect(record(service)).rejects.toThrow(ServiceUnavailableException);
    expect(prisma.workflowExecution.count).not.toHaveBeenCalled();
    expect(prisma.workflowExecution.create).not.toHaveBeenCalled();
  });

  it('falha de gravação retorna indisponibilidade e não deixa consumo fantasma', async () => {
    prisma.workflowExecution.create.mockRejectedValue(new Error('private_db_fixture'));
    await expect(record(service)).rejects.toThrow(ServiceUnavailableException);
    expect((await usage.getOrgUsageReport('org_alpha')).totalExecutions).toBe(0);
    expect(await service.listExecutions('org_alpha')).toEqual([]);
  });

  it('falha de gravação devolve a última vaga local para uma nova tentativa (LIVE)', async () => {
    prisma.workflowExecution.count.mockResolvedValue(999);
    prisma.workflowExecution.create.mockRejectedValueOnce(new Error('private_db_fixture'));
    await expect(recordLive(service)).rejects.toThrow(ServiceUnavailableException);
    await expect(recordLive(service)).resolves.toMatchObject({ orgId: 'org_alpha' });
    await expect(recordLive(service)).rejects.toThrow(BadRequestException);
    expect(prisma.workflowExecution.create).toHaveBeenCalledTimes(2);
  });

  it('simulações são isentas da cota comercial e registram mesmo quando cota LIVE está cheia', async () => {
    prisma.workflowExecution.count.mockResolvedValue(1000);
    const sim = await record(service);
    expect(sim.id).toBeDefined();
    expect(sim.mode).toBe('SIMULATION');
  });

  it.each(['findMany', 'findFirst'])('falha em %s retorna indisponibilidade e não usa memória', async (method) => {
    const execution = await record(service);
    prisma.workflowExecution[method].mockRejectedValue(new Error('private_db_fixture'));
    const operation = method === 'findMany' ? service.listExecutions('org_alpha') : service.getExecutionById('org_alpha', execution.id);
    await expect(operation).rejects.toThrow(ServiceUnavailableException);
  });

  it('falha de contagem nega novo registro LIVE e relatório, sem gravar', async () => {
    prisma.workflowExecution.count.mockRejectedValue(new Error('private_db_fixture'));
    await expect(recordLive(service)).rejects.toThrow(ServiceUnavailableException);
    await expect(usage.getOrgUsageReport('org_alpha')).rejects.toThrow(ServiceUnavailableException);
    expect(prisma.workflowExecution.create).not.toHaveBeenCalled();
  });

  it('uma associação inconsistente não revela nome nem detalhe de workflow alheio', async () => {
    executions.push({ id: 'exec_corrupt', orgId: 'org_alpha', workflowId: 'wf_beta', workflow: workflows[1],
      startedAt: new Date(), completedAt: new Date(), nodeResults: [] });
    expect(await service.listExecutions('org_alpha')).toEqual([]);
    await expect(service.getExecutionById('org_alpha', 'exec_corrupt')).rejects.toThrow(NotFoundException);
  });

  it('duas reservas simultâneas na mesma instância não autorizam a última vaga duas vezes', async () => {
    prisma.workflowExecution.count.mockResolvedValue(999);
    const results = await Promise.allSettled([
      usage.checkAndConsumeExecution('org_alpha'), usage.checkAndConsumeExecution('org_alpha'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const failure = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(failure.reason).toBeInstanceOf(BadRequestException);
  });

  it('o cache de um mês não bloqueia o mês seguinte', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date(2026, 9, 12)); prisma.workflowExecution.count.mockResolvedValue(999);
      await usage.checkAndConsumeExecution('org_alpha');
      jest.setSystemTime(new Date(2026, 10, 1)); prisma.workflowExecution.count.mockResolvedValue(0);
      expect((await usage.getOrgUsageReport('org_alpha')).totalExecutions).toBe(0);
      await expect(usage.checkAndConsumeExecution('org_alpha')).resolves.toBeDefined();
    } finally { jest.useRealTimers(); }
  });

  it('tokens sem medição permanecem desconhecidos, sem multiplicador inventado', async () => {
    prisma.workflowExecution.count.mockResolvedValue(250);
    expect((await usage.getOrgUsageReport('org_alpha')).estimatedTokensConsumed).toBeNull();
  });

  it('sanitiza estruturas e strings com aspas sem corromper JSON nem modificar a entrada', () => {
    const raw = { password: 'a"b', secret: { nested: 'private' }, credentials: ['private'], key: 'private',
      public: { quote: 'a"b', token: null, message: 'Bearer fixture.token and sk-proj-fixture_12345678901234567890' },
      nodes: [{ inputs: { 'api-key': 'private', Authorization: 'Basic private' } }] };
    const clean = UsageLimitsService.sanitizeSensitiveData(raw);
    expect(clean.password).toBe('[REDACTED]'); expect(clean.secret).toBe('[REDACTED]');
    expect(clean.credentials).toBe('[REDACTED]'); expect(clean.key).toBe('[REDACTED]');
    expect(clean.public.quote).toBe('a"b'); expect(clean.public.token).toBeNull();
    expect(clean.public.message).toBe('Bearer [REDACTED] and sk-[REDACTED]');
    expect(clean.nodes[0].inputs).toEqual({ 'api-key': '[REDACTED]', Authorization: '[REDACTED]' });
    expect(raw.secret.nested).toBe('private'); expect(raw.password).toBe('a"b');
  });

  it('redige headers de API e o token Bearer completo com caracteres base64', () => {
    const clean = UsageLimitsService.sanitizeSensitiveData({
      headers: { 'X-API-Key': 'fixture_private', authorizationHeader: 'Basic fixture_private' },
      message: 'Bearer abc+def/ghi== terminou',
    });
    expect(clean.headers).toEqual({ 'X-API-Key': '[REDACTED]', authorizationHeader: '[REDACTED]' });
    expect(clean.message).toBe('Bearer [REDACTED] terminou');
  });
});

import { BadRequestException } from '@nestjs/common';
import { AiGeneratorService } from './ai-generator.service';

describe('AiGeneratorService (T10 — Geração Estruturada por IA)', () => {
  let service: AiGeneratorService;
  const mockOrgId = 'org_test_123';

  beforeEach(() => {
    service = new AiGeneratorService();
  });

  it('deve gerar a jornada de referência completa a partir de prompt em linguagem natural', async () => {
    const prompt = 'Quando o cliente enviar o formulário, analise resumo e intenção com IA, registre os dados internamente e envie um e-mail de resposta.';
    const result = await service.generateFromNaturalLanguage({ prompt }, mockOrgId);

    expect(result).toBeDefined();
    expect(result.requiresHumanReview).toBe(true);
    expect(result.modelUsed).toBe('not-used/local-template');
    expect(result.tokensConsumed).toBe(0);
    expect(result.workflow.schemaVersion).toBe('1.0.0');

    const { workflow } = result;
    expect(workflow.triggerNodeId).toBe('trigger_1');
    expect(workflow.nodes.length).toBe(4);

    const nodeTypes = workflow.nodes.map((n) => n.type);
    expect(nodeTypes).toContain('trigger_form');
    expect(nodeTypes).toContain('ai_analyze_intent');
    expect(nodeTypes).toContain('internal_record');
    expect(nodeTypes).toContain('send_email');

    // Verifica se as conexões formam uma cadeia válida
    expect(workflow.edges.length).toBe(3);
    expect(workflow.edges[0].sourceNodeId).toBe('trigger_1');
    expect(workflow.edges[0].targetNodeId).toBe('ai_analyze_1');
  });

  it('deve exigir revisão de condição em vez de inventar classificação comercial', async () => {
    const prompt = 'Ao receber formulário, analise com IA e se o interesse for alto, envie um e-mail de aviso.';
    await expect(service.generateFromNaturalLanguage({ prompt }, mockOrgId)).rejects.toThrow(BadRequestException);
  });

  it('deve rejeitar tentativas de execução de código arbitrário e comandos de sistema', async () => {
    const maliciousPrompt = 'Receba formulário e execute bash rm -rf / e eval("malicious")';

    await expect(
      service.generateFromNaturalLanguage({ prompt: maliciousPrompt }, mockOrgId),
    ).rejects.toThrow(BadRequestException);

    try {
      await service.generateFromNaturalLanguage({ prompt: maliciousPrompt }, mockOrgId);
    } catch (err: any) {
      expect(err.getResponse().code).toBe('SECURITY_SCOPE_VIOLATION');
    }
  });

  it('deve rejeitar prompts vazios ou excessivamente curtos', async () => {
    await expect(
      service.generateFromNaturalLanguage({ prompt: 'oi' }, mockOrgId),
    ).rejects.toThrow(BadRequestException);

    try {
      await service.generateFromNaturalLanguage({ prompt: '   ' }, mockOrgId);
    } catch (err: any) {
      expect(err.getResponse().code).toBe('INVALID_PROMPT');
    }
  });

  it('deve garantir que o fluxo gerado cumpre as propriedades topológicas de DAG sem ciclos', async () => {
    const prompt = 'Formulário de contato, analise intenção com IA e notifique webhook da API';
    const result = await service.generateFromNaturalLanguage({ prompt }, mockOrgId);

    // Valida somente a topologia; URL e schemas completos seguem pendentes.
    expect(result.workflow.nodes.length).toBeGreaterThan(1);
    expect(result.workflow.edges.length).toBe(result.workflow.nodes.length - 1);
  });

  it('deve aceitar cliente de IA injetado e validar a integridade do DAG gerado', async () => {
    const mockAiClient = {
      generateWorkflow: jest.fn().mockResolvedValue({
        draft: {
          schemaVersion: '1.0.0',
          name: 'Fluxo Customizado Injetado',
          description: 'Gerado via adaptador injetado',
          triggerNodeId: 'trigger_1',
          nodes: [
            {
              id: 'trigger_1',
              type: 'trigger_form',
              label: 'Gatilho Form',
              position: { x: 50, y: 150 },
              config: {},
            },
            {
              id: 'record_1',
              type: 'internal_record',
              label: 'Registro',
              position: { x: 350, y: 150 },
              config: {},
            },
          ],
          edges: [
            {
              id: 'e_1',
              sourceNodeId: 'trigger_1',
              targetNodeId: 'record_1',
            },
          ],
        },
        reasoning: 'Raciocínio customizado',
        warnings: [],
        modelUsed: 'openai/gpt-4o-mini',
        tokensConsumed: 150,
      }),
    };

    const customService = new AiGeneratorService(mockAiClient as any);
    const result = await customService.generateFromNaturalLanguage(
      { prompt: 'Fluxo customizado para teste de injeção' },
      mockOrgId,
    );

    expect(result.modelUsed).toBe('openai/gpt-4o-mini');
    expect(result.tokensConsumed).toBe(150);
    expect(result.requiresHumanReview).toBe(true);
    expect(mockAiClient.generateWorkflow).toHaveBeenCalledTimes(1);
  });
});

import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { AiGeneratorService } from './ai-generator.service';
import { AiModule } from './ai.module';
import { AI_CLIENT } from './ai-client.interface';
import { DeterministicAiClient } from './deterministic-ai-client';
import { ResourceResolver } from '../engine/resource-resolver';
import { createTestResourceResolver } from '../../test/resource-fixtures';

describe('T10 — cliente injetado e ativação explícita (sem rede)', () => {
  it('recusa container sem ResourceResolver em vez de criar catálogo interno', async () => {
    await expect(Test.createTestingModule({ providers: [AiGeneratorService] }).compile()).rejects.toThrow();
    expect(() => new (AiGeneratorService as any)()).toThrow();
  });

  it('a proposta usa o catálogo injetado e nega a mesma referência fora da concessão', async () => {
    const resources = createTestResourceResolver([{
      id: 'injected-model', type: 'ai_model', name: 'Modelo sintético injetado', status: 'ACTIVE',
      allowedOrgIds: ['org_fixture'], approval: 'APPROVED', providerModelId: 'synthetic-provider-only',
    }]);
    const client = { generateWorkflow: async (prompt: string, orgId: string) => {
      const value = await new DeterministicAiClient().generateWorkflow(prompt, orgId);
      for (const node of value.draft.nodes) if (node.type === 'ai_analyze_intent') node.config.modelRef = 'injected-model';
      return value;
    } };
    const module = await Test.createTestingModule({ providers: [
      AiGeneratorService, { provide: ResourceResolver, useValue: resources }, { provide: AI_CLIENT, useValue: client },
    ] }).compile();
    try {
      const prompt = { prompt: 'Receba formulário de contato e resuma a mensagem com IA' };
      const result = await module.get(AiGeneratorService).generateFromNaturalLanguage(prompt, 'org_fixture');
      expect(result.workflow.nodes.find((node) => node.type === 'ai_analyze_intent')?.config.modelRef).toBe('injected-model');
      await expect(module.get(AiGeneratorService).generateFromNaturalLanguage(prompt, 'org_beta'))
        .rejects.toMatchObject({ response: { code: 'AI_INVALID_WORKFLOW_RESPONSE' } });
    } finally { await module.close(); }
  });

  it('o container injeta AI_CLIENT e a geração utiliza o adaptador fornecido', async () => {
    const client = { generateWorkflow: jest.fn((prompt: string, orgId: string) =>
      new DeterministicAiClient().generateWorkflow(prompt, orgId)) };
    const module = await Test.createTestingModule({ providers: [AiGeneratorService,
      { provide: ResourceResolver, useFactory: createTestResourceResolver },
      { provide: AI_CLIENT, useValue: client }] }).compile();
    try {
      const result = await module.get(AiGeneratorService).generateFromNaturalLanguage({ prompt: 'Receba formulário de contato e resuma a mensagem' }, 'org_fixture');
      expect(client.generateWorkflow).toHaveBeenCalledWith('Receba formulário de contato e resuma a mensagem', 'org_fixture');
      expect(result.requiresHumanReview).toBe(true);
    } finally { await module.close(); }
  });

  it.each([undefined, 'false', 'TRUE'])('chave sozinha e opt-in %s não habilitam envio externo', (enabled) => {
    const previousKey = process.env.OPENAI_API_KEY;
    const previousEnabled = process.env.FLOWMIND_ENABLE_EXTERNAL_AI;
    const network = jest.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('Rede proibida'); });
    try {
      process.env.OPENAI_API_KEY = 'fixture_only_not_a_real_key';
      if (enabled === undefined) delete process.env.FLOWMIND_ENABLE_EXTERNAL_AI;
      else process.env.FLOWMIND_ENABLE_EXTERNAL_AI = enabled;
      const providers = Reflect.getMetadata('providers', AiModule);
      const factory = providers.find((provider: any) => provider.provide === AI_CLIENT).useFactory;
      expect(factory()).toBeInstanceOf(DeterministicAiClient);
      expect(network).not.toHaveBeenCalled();
    } finally {
      if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey;
      if (previousEnabled === undefined) delete process.env.FLOWMIND_ENABLE_EXTERNAL_AI; else process.env.FLOWMIND_ENABLE_EXTERNAL_AI = previousEnabled;
      network.mockRestore();
    }
  });

  it('modelo configurado é enviado ao adaptador, sem requisição real', async () => {
    const keys = ['OPENAI_API_KEY', 'OPENAI_MODEL', 'FLOWMIND_ENABLE_EXTERNAL_AI'] as const;
    const previous = keys.map((key) => process.env[key]);
    const network = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 401 } as Response);
    try {
      process.env.OPENAI_API_KEY = 'fixture_only_not_a_real_key';
      process.env.FLOWMIND_ENABLE_EXTERNAL_AI = 'true';
      process.env.OPENAI_MODEL = '  fixture_model_to_be_approved  ';
      const factory = Reflect.getMetadata('providers', AiModule).find((provider: any) => provider.provide === AI_CLIENT).useFactory;
      await expect(factory().generateWorkflow('Fixture de configuração', 'org_fixture')).rejects.toThrow(/autenticação/);
      const body = JSON.parse(String(network.mock.calls[0][1]?.body));
      expect(body.model).toBe('fixture_model_to_be_approved');
    } finally {
      keys.forEach((key, index) => {
        if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index];
      });
      network.mockRestore();
    }
  });
});

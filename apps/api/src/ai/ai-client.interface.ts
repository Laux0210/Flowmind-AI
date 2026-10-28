import type { GeneratedWorkflowDraft } from '@flowmind/contracts';

export interface AiGenerationResult {
  draft: GeneratedWorkflowDraft;
  reasoning: string;
  warnings: string[];
  modelUsed: string;
  tokensConsumed: number | null; // null: medição não informada/confiável, diferente de zero
}

export interface AiClient {
  generateWorkflow(prompt: string, orgId: string): Promise<AiGenerationResult>;
}

export const AI_CLIENT = Symbol('AI_CLIENT');

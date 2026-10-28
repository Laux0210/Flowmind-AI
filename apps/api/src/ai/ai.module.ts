import { ResourcesModule } from '../resources/resources.module';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiController } from './ai.controller';
import { AiGeneratorService } from './ai-generator.service';
import { AI_CLIENT } from './ai-client.interface';
import { DeterministicAiClient } from './deterministic-ai-client';
import { OpenAiStructuredClient } from './openai-structured-client';

import { AiEvaluator } from './evaluation/ai-evaluator';

@Module({
  imports: [AuthModule, ResourcesModule],
  controllers: [AiController],
  providers: [
    DeterministicAiClient,
    {
      provide: AI_CLIENT,
      useFactory: () => {
        const apiKey = process.env.OPENAI_API_KEY?.trim();
        // Uma chave existente não autoriza transmitir prompts ou gerar custos.
        if (process.env.FLOWMIND_ENABLE_EXTERNAL_AI === 'true' && apiKey) {
          return new OpenAiStructuredClient(apiKey, { model: process.env.OPENAI_MODEL?.trim() || undefined });
        }
        return new DeterministicAiClient();
      },
    },
    AiGeneratorService,
    AiEvaluator,
  ],
  exports: [AiGeneratorService, AI_CLIENT, AiEvaluator],
})
export class AiModule {}

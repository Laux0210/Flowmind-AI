import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiController } from './ai.controller';
import { AiGeneratorService } from './ai-generator.service';
import { AI_CLIENT } from './ai-client.interface';
import { DeterministicAiClient } from './deterministic-ai-client';
import { OpenAiStructuredClient } from './openai-structured-client';

@Module({
  imports: [AuthModule],
  controllers: [AiController],
  providers: [
    DeterministicAiClient,
    {
      provide: AI_CLIENT,
      useFactory: () => {
        const apiKey = process.env.OPENAI_API_KEY?.trim();
        if (apiKey && apiKey.length > 0) {
          return new OpenAiStructuredClient(apiKey);
        }
        return new DeterministicAiClient();
      },
    },
    AiGeneratorService,
  ],
  exports: [AiGeneratorService, AI_CLIENT],
})
export class AiModule {}

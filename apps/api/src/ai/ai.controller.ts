import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  GenerateWorkflowDto,
  GenerateWorkflowResponse,
  ApiResponse,
} from '@flowmind/contracts';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentOrg } from '../auth/decorators';
import { AiGeneratorService } from './ai-generator.service';

@Controller('api/v1/ai')
@UseGuards(ClerkAuthGuard)
export class AiController {
  private readonly aiGeneratorService: AiGeneratorService;

  constructor(aiGeneratorService: AiGeneratorService) {
    this.aiGeneratorService = aiGeneratorService;
  }

  @Post('generate-workflow')
  @HttpCode(HttpStatus.OK)
  async generateWorkflow(
    @CurrentOrg() orgId: string,
    @Body() dto: GenerateWorkflowDto,
  ): Promise<ApiResponse<GenerateWorkflowResponse>> {
    const result = await this.aiGeneratorService.generateFromNaturalLanguage(
      dto,
      orgId,
    );

    return {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };
  }
}

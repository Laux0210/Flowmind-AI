import { Injectable, BadRequestException } from '@nestjs/common';
import type {
  WorkflowNode,
  WorkflowEdge,
  GeneratedWorkflowDraft,
} from '@flowmind/contracts';
import { WORKFLOW_SCHEMA_VERSION } from '@flowmind/contracts';
import type { AiClient, AiGenerationResult } from './ai-client.interface';

@Injectable()
export class DeterministicAiClient implements AiClient {
  async generateWorkflow(prompt: string, _orgId: string): Promise<AiGenerationResult> {
    const draft = this.synthesizeWorkflowDraft(prompt);

    return {
      draft,
      reasoning:
        'Rascunho gerado por template local, sem modelo de IA. Confira se a proposta corresponde ao pedido antes de salvar ou simular.',
      warnings: [
        'Geração por modelo de IA ainda não implementada; esta é uma proposta limitada por template.',
        ...(draft.nodes.some(node => node.type === 'trigger_schedule') ? ['Revise a entrada das ações; o agendamento fornece somente o horário. Configure a frequência no painel após publicar.'] : []),
        ...(draft.nodes.some((node) => node.type === 'http_request')
          ? ['Defina e revise o destino HTTP; nenhum endereço foi escolhido automaticamente.']
          : []),
      ],
      modelUsed: 'not-used/local-template',
      tokensConsumed: 0,
    };
  }

  private synthesizeWorkflowDraft(prompt: string): GeneratedWorkflowDraft {
    const lower = prompt.toLowerCase();

    const isScheduled = /\b(?:agendar|agendamentos?|agendad[oa]s?|diariamente|semanalmente|cron)\b|\btodo(?:s os)? dia(?:s)?\b|\ba cada\s+(?:\d+\s+)?(?:minutos?|horas?|dias?|semanas?)\b/.test(lower);
    const nodes: WorkflowNode[] = [];
    const edges: WorkflowEdge[] = [];

    // Nó 1: Gatilho de Formulário (obrigatório na jornada MVP)
    const triggerNode: WorkflowNode = {
      id: 'trigger_1',
      type: isScheduled ? 'trigger_schedule' : 'trigger_form',
      label: isScheduled ? 'Horário Agendado' : 'Novo Envio de Formulário',
      position: { x: 50, y: 150 },
      config: isScheduled ? {} : { requiredFields: ['name', 'email', 'message'] },
    };
    nodes.push(triggerNode);

    let lastNodeId = triggerNode.id;
    let currentX = 350;

    // A proposta nunca traduz intenção em pontuação/nível comercial.
    const wantsAiAnalysis =
      /\bia\b/.test(lower) ||
      lower.includes('intelig') ||
      lower.includes('interesse') ||
      lower.includes('resum') ||
      lower.includes('inten') ||
      lower.includes('analis');

    if (wantsAiAnalysis) {
      const aiNode: WorkflowNode = {
        id: 'ai_analyze_1',
        type: 'ai_analyze_intent',
        label: 'Resumo, Intenção e Ambiguidades',
        position: { x: currentX, y: 150 },
        config: {
          modelRef: 'modelo-a-aprovar',
          inputPromptTemplate: isScheduled ? '' : '{{trigger_1.message_text}}',
        },
      };
      nodes.push(aiNode);
      edges.push({
        id: `e_${lastNodeId}_${aiNode.id}`,
        sourceNodeId: lastNodeId,
        targetNodeId: aiNode.id,
      });
      lastNodeId = aiNode.id;
      currentX += 300;
    }

    // Detectar necessidade de Registro Interno
    const wantsInternalRecord =
      lower.includes('banco') ||
      lower.includes('regist') ||
      lower.includes('salv') ||
      lower.includes('lead') ||
      lower.includes('tabela') ||
      (!isScheduled && !lower.includes('apenas enviar email'));

    if (wantsInternalRecord) {
      const recordNode: WorkflowNode = {
        id: 'record_lead_1',
        type: 'internal_record',
        label: 'Registro Interno',
        position: { x: currentX, y: 150 },
        config: {
          fieldMappings: {
            name: isScheduled ? '' : '{{trigger_1.contact_name}}',
            email: isScheduled ? '' : '{{trigger_1.contact_email}}',
            raw_message: isScheduled ? '{{trigger_1.scheduledAt}}' : '{{trigger_1.message_text}}',
            ai_summary: wantsAiAnalysis ? '{{ai_analyze_1.summary}}' : isScheduled ? '{{trigger_1.scheduledAt}}' : '{{trigger_1.message_text}}',
            ai_intent: wantsAiAnalysis ? '{{ai_analyze_1.intent}}' : 'Não analisada',
            ambiguities: wantsAiAnalysis ? '{{ai_analyze_1.ambiguities}}' : [],
          },
        },
      };
      nodes.push(recordNode);
      edges.push({
        id: `e_${lastNodeId}_${recordNode.id}`,
        sourceNodeId: lastNodeId,
        targetNodeId: recordNode.id,
      });
      lastNodeId = recordNode.id;
      currentX += 300;
    }

    // Heurística local: "resumo do caso" não é uma condição interpretada.
    const wantsCondition = /\bse\b|(?:^|[,;.!?]|\be\b)\s*caso\b|condi(?:ção|ções)/u.test(lower);

    if (wantsCondition) {
      throw new BadRequestException({
        code: 'CONDITION_REQUIRES_REVIEW',
        message: 'A geração local ainda não interpreta condições. Defina os operandos no editor; níveis comerciais não integram a análise de intenção.',
      });
    }

    // Detectar Envio de E-mail
    const wantsEmail =
      lower.includes('email') ||
      lower.includes('e-mail') ||
      lower.includes('notific') ||
      lower.includes('avis') ||
      lower.includes('responder');

    if (wantsEmail) {
      const emailNode: WorkflowNode = {
        id: 'email_reply_1',
        type: 'send_email',
        label: 'Enviar E-mail de Resposta',
        position: { x: currentX, y: 150 },
        config: {
          to: isScheduled ? '' : '{{trigger_1.contact_email}}',
          subject: 'Recebemos seu contato - FlowMind AI',
          bodyTemplate: isScheduled ? 'Agendamento: {{trigger_1.scheduledAt}}' : wantsAiAnalysis
            ? 'Olá {{trigger_1.contact_name}}, recebemos: {{ai_analyze_1.summary}}. Pendências: {{ai_analyze_1.ambiguities}}'
            : 'Olá {{trigger_1.contact_name}}, recebemos sua mensagem: {{trigger_1.message_text}}',
        },
      };
      nodes.push(emailNode);
      edges.push({
        id: `e_${lastNodeId}_${emailNode.id}`,
        sourceNodeId: lastNodeId,
        targetNodeId: emailNode.id,
      });
      lastNodeId = emailNode.id;
      currentX += 300;
    }

    // Detectar Webhook / Requisição HTTP
    const wantsHttp =
      /\b(?:webhook|api|http|https|post)\b/i.test(lower);

    if (wantsHttp) {
      const httpNode: WorkflowNode = {
        id: 'http_request_1',
        type: 'http_request',
        label: 'Notificar Webhook Externo',
        position: { x: currentX, y: 150 },
        config: {
          url: '',
          method: 'POST',
          bodyTemplate: isScheduled ? '{"scheduledAt": "{{trigger_1.scheduledAt}}"}' : '{"contact": "{{trigger_1.contact_email}}"}',
        },
      };
      nodes.push(httpNode);
      edges.push({
        id: `e_${lastNodeId}_${httpNode.id}`,
        sourceNodeId: lastNodeId,
        targetNodeId: httpNode.id,
      });
    }

    const name = this.deriveWorkflowName(prompt);
    const description = `Proposta local para revisão: "${prompt.slice(0, 100)}"`;

    return {
      schemaVersion: WORKFLOW_SCHEMA_VERSION,
      name,
      description,
      triggerNodeId: triggerNode.id,
      nodes,
      edges,
    };
  }

  private deriveWorkflowName(prompt: string): string {
    const cleaned = prompt.replace(/[^\w\s\u00C0-\u00FF]/gi, '').trim();
    if (cleaned.length === 0) return 'Automação Personalizada';
    const words = cleaned.split(/\s+/).slice(0, 5).join(' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
}

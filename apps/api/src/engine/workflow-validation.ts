import { BadRequestException } from '@nestjs/common';
import type { WorkflowDefinition } from '@flowmind/contracts';
import { VariableResolver } from './variable-resolver';

// Regras C03 compartilhadas por revisão/ativação e simulação.
export function validateEmailConfiguration(
  workflow: WorkflowDefinition,
  ancestorsByNode: Map<string, Set<string>>,
): void {
  const trigger = workflow.nodes.find((node) => node.id === workflow.triggerNodeId && node.type === 'trigger_form');
  for (const node of workflow.nodes) {
    if (node.type !== 'send_email') continue;
    const recipient = node.config?.to;
    if (typeof recipient !== 'string' || !recipient.trim()) {
      throw new BadRequestException({
        code: 'INVALID_EMAIL_RECIPIENT',
        message: 'Destinatário de e-mail ausente ou inválido na definição; revise antes de ativar.',
      });
    }
    for (const reference of VariableResolver.extractReferences(recipient)) {
      if (!ancestorsByNode.get(node.id)?.has(reference.nodeId)) {
        throw new BadRequestException({
          code: 'INVALID_EMAIL_RECIPIENT',
          message: 'Destinatário possui referência a nó inexistente ou que não o precede.',
        });
      }
      if (reference.nodeId === trigger?.id && reference.fieldPath === 'contact_email') {
        const required = trigger.config?.requiredFields ?? ['name', 'email', 'message'];
        if (!Array.isArray(required) || !required.includes('email')) {
          throw new BadRequestException({
            code: 'INVALID_EMAIL_RECIPIENT',
            message: 'Destinatário depende de email obrigatório no formulário.',
          });
        }
      }
    }
  }
}

import { BadRequestException } from '@nestjs/common';
import type { WorkflowDefinition, WorkflowNode, NodeConfigIssue, NodeType } from '@flowmind/contracts';
import { getNodeConfigIssues, WORKFLOW_NODE_TYPES } from '@flowmind/contracts';
import { VariableResolver } from './variable-resolver';
import { NodeExecutors } from './node-executors';

export function validateNodeConfigurations(nodes: WorkflowNode[], allowIncomplete = false): void {
  const problems: Array<NodeConfigIssue & { nodeIndex: number }> = [];
  if (!Array.isArray(nodes)) {
    throw new BadRequestException({ code: 'WORKFLOW_INVALID_NODE_CONFIG', message: 'Lista de nós inválida.' });
  }
  nodes.forEach((node, nodeIndex) => {
    if (!node || typeof node.type !== 'string' || !(WORKFLOW_NODE_TYPES as readonly string[]).includes(node.type)) {
      problems.push({ nodeIndex, field: 'config', code: 'INVALID_CONFIG' }); return;
    }
    const issues = getNodeConfigIssues(node.type as NodeType, node.config);
    for (const issue of issues) {
      if (!allowIncomplete || issue.code !== 'MISSING_REQUIRED_FIELD') problems.push({ nodeIndex, ...issue });
    }
    if (issues.length === 0 && node.type === 'http_request' &&
      typeof node.config.url === 'string' && VariableResolver.extractReferences(node.config.url).length === 0) {
      try { NodeExecutors.validateUrlAgainstSsrf(node.config.url); }
      catch (error) {
        if (!(error instanceof BadRequestException)) throw error;
        problems.push({ nodeIndex, field: 'url', code: 'INVALID_FIELD_VALUE' });
      }
    }
    if (node.type === 'send_email' && typeof node.config?.replyTo === 'string' && node.config.replyTo !== '' &&
      VariableResolver.extractReferences(node.config.replyTo).length === 0 && !NodeExecutors.isEmail(node.config.replyTo)) {
      problems.push({ nodeIndex, field: 'replyTo', code: 'INVALID_FIELD_VALUE' });
    }
  });
  if (problems.length) {
    throw new BadRequestException({ code: 'WORKFLOW_INVALID_NODE_CONFIG',
      message: 'Configuração dos nós inválida; revise os campos indicados.', issues: problems });
  }
}

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
    const references = VariableResolver.extractReferences(recipient);
    if (references.length === 0 && !NodeExecutors.isEmail(recipient)) {
      throw new BadRequestException({
        code: 'INVALID_EMAIL_RECIPIENT',
        message: 'Destinatário literal de e-mail possui formato inválido; revise antes de ativar.',
      });
    }
    for (const reference of references) {
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

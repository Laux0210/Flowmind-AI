import { CONDITION_OPERATORS, HTTP_METHODS, getNodeConfigIssues } from '@flowmind/contracts';
import type { NodePosition, NodeType, ResourceType, WorkflowDefinition, WorkflowNode } from '@flowmind/contracts';

export interface NodeParameterField {
  path: string;
  label: string;
  kind: 'text' | 'json' | 'choice' | 'resource';
  options?: readonly string[];
  resourceType?: ResourceType;
}

const recordLabels: Record<string, string> = {
  name: 'Nome do contato', email: 'E-mail do contato', raw_message: 'Mensagem original',
  message: 'Mensagem', ai_summary: 'Resumo', ai_intent: 'Intenção', ambiguities: 'Ambiguidades',
};

export function getNodeParameterFields(node: WorkflowNode): NodeParameterField[] {
  const text = (path: string, label: string): NodeParameterField => ({ path, label, kind: 'text' });
  const json = (path: string, label: string): NodeParameterField => ({ path, label, kind: 'json' });
  const resource = (path: string, label: string, resourceType: ResourceType): NodeParameterField => ({ path, label, kind: 'resource', resourceType });
  const config = node.config ?? {};
  switch (node.type) {
    case 'trigger_schedule': return [];
    case 'trigger_form': return [resource('formId', 'Formulário', 'form'), json('requiredFields', 'Campos obrigatórios')];
    case 'ai_analyze_intent': return [resource('modelRef', 'Modelo de IA', 'ai_model'), text('inputPromptTemplate', 'Mensagem para análise'),
      text('systemInstructions', 'Instruções'), ...(Object.hasOwn(config, 'message_text') ? [text('message_text', 'Mensagem alternativa')] : [])];
    case 'internal_record': {
      const mapped = Object.hasOwn(config, 'fieldMappings');
      const keys = ['name', 'email', 'raw_message', 'ai_summary', 'ai_intent', 'ambiguities'];
      if (mapped && typeof config.fieldMappings === 'object' && config.fieldMappings !== null && Object.hasOwn(config.fieldMappings, 'message')) keys.push('message');
      const fields = keys.map((key) => ({ path: mapped ? `fieldMappings.${key}` : key, label: recordLabels[key],
        kind: key === 'ambiguities' ? 'json' as const : 'text' as const }));
      for (const key of Object.keys(recordLabels)) {
        if (Object.hasOwn(config, key) && !fields.some((field) => field.path === key)) {
          fields.push({ path: key, label: recordLabels[key], kind: key === 'ambiguities' ? 'json' : 'text' });
        }
      }
      return fields;
    }
    case 'send_email': return [text('to', 'Destinatário'), text('subject', 'Assunto'), text('bodyTemplate', 'Mensagem do e-mail'), text('replyTo', 'Responder para')];
    case 'condition': return [json('leftOperand', 'Primeiro valor'), { path: 'operator', label: 'Comparação', kind: 'choice', options: CONDITION_OPERATORS }, json('rightOperand', 'Segundo valor')];
    case 'http_request': return [text('url', 'Endereço da requisição'), { path: 'method', label: 'Método', kind: 'choice', options: HTTP_METHODS },
      json('headers', 'Cabeçalhos'), resource('credentialRef', 'Credencial', 'credential'), text('bodyTemplate', 'Corpo da requisição')];
  }
}

export function readNodeParameter(node: WorkflowNode, field: NodeParameterField): string {
  const [key, child] = field.path.split('.');
  const parent = node.config?.[key];
  const value = child ? (parent as Record<string, unknown> | undefined)?.[child] : parent;
  if (value === undefined) return '';
  return field.kind === 'json' ? JSON.stringify(value, null, 2) : String(value);
}

function requireDraft(workflow: WorkflowDefinition) {
  if (workflow.status !== 'DRAFT') throw new Error('A edição está disponível apenas em rascunho.');
}

export function editNodeParameters(workflow: WorkflowDefinition, id: string, label: string, changes: Record<string, string>): WorkflowDefinition {
  requireDraft(workflow);
  const node = workflow.nodes.find((item) => item.id === id);
  if (!node) throw new Error('Etapa não encontrada.');
  if (!label.trim()) throw new Error('Informe o nome da etapa.');
  const fields = getNodeParameterFields(node);
  const config: Record<string, unknown> = JSON.parse(JSON.stringify(node.config));
  for (const [path, raw] of Object.entries(changes)) {
    const field = fields.find((item) => item.path === path);
    if (!field) throw new Error('Campo fora da configuração desta etapa.');
    let value: unknown = raw;
    if (field.kind === 'json' && raw.trim()) {
      try { value = JSON.parse(raw); } catch { throw new Error(`${field.label}: informe JSON válido.`); }
    }
    const [key, child] = path.split('.');
    const target = child ? (config[key] = { ...(config[key] as Record<string, unknown> ?? {}) }) as Record<string, unknown> : config;
    if (raw === '') delete target[child ?? key];
    else target[child ?? key] = value;
  }
  const issue = getNodeConfigIssues(node.type, config).find((item) => item.code !== 'MISSING_REQUIRED_FIELD');
  if (issue) throw new Error(`${fields.find((field) => field.path === issue.field)?.label ?? 'Configuração'}: valor inválido.`);
  return { ...workflow, nodes: workflow.nodes.map((item) => item.id === id ? { ...item, label: label.trim(), config } : item) };
}

export function moveWorkflowNodes(workflow: WorkflowDefinition, changes: Array<{ id: string; position: NodePosition }>): WorkflowDefinition {
  requireDraft(workflow);
  for (const change of changes) {
    if (!workflow.nodes.some((node) => node.id === change.id)) throw new Error('Etapa não encontrada.');
    if (!Number.isFinite(change.position.x) || !Number.isFinite(change.position.y)) throw new Error('Posição da etapa inválida.');
  }
  if (!changes.some((change) => {
    const node = workflow.nodes.find((item) => item.id === change.id)!;
    return node.position.x !== change.position.x || node.position.y !== change.position.y;
  })) return workflow;
  return { ...workflow, nodes: workflow.nodes.map((node) => {
    const change = changes.findLast((item) => item.id === node.id);
    return change ? { ...node, position: { ...change.position } } : node;
  }) };
}

export function connectWorkflowNodes(workflow: WorkflowDefinition, sourceNodeId: string, targetNodeId: string, sourceHandle: string | undefined, id: string, targetHandle?: string): WorkflowDefinition {
  requireDraft(workflow);
  if (![sourceNodeId, targetNodeId].every((key) => workflow.nodes.some((node) => node.id === key))) throw new Error('Etapa da conexão não encontrada.');
  if (!id.trim() || workflow.edges.some((edge) => edge.id === id)) throw new Error('Identificador de conexão já existente ou inválido.');
  if (workflow.edges.some((edge) => edge.sourceNodeId === sourceNodeId && edge.targetNodeId === targetNodeId &&
    (edge.sourceHandle ?? '') === (sourceHandle ?? '') && (edge.targetHandle ?? '') === (targetHandle ?? ''))) throw new Error('Esta conexão já existe.');
  const pending = [targetNodeId], visited = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (current === sourceNodeId) throw new Error('Esta conexão criaria um ciclo.');
    if (visited.has(current)) continue;
    visited.add(current);
    for (const edge of workflow.edges) if (edge.sourceNodeId === current) pending.push(edge.targetNodeId);
  }
  return { ...workflow, edges: [...workflow.edges, { id, sourceNodeId, targetNodeId,
    ...(sourceHandle === undefined ? {} : { sourceHandle }), ...(targetHandle === undefined ? {} : { targetHandle }) }] };
}

export function removeWorkflowConnection(workflow: WorkflowDefinition, id: string): WorkflowDefinition {
  requireDraft(workflow);
  return workflow.edges.some((edge) => edge.id === id) ? { ...workflow, edges: workflow.edges.filter((edge) => edge.id !== id) } : workflow;
}

export function createDefaultNodeConfig(type: NodeType): Record<string, unknown> {
  switch (type) {
    case 'trigger_schedule': return {};
    case 'trigger_form':
      return { requiredFields: ['name', 'email', 'message'] };
    case 'ai_analyze_intent':
      return { modelRef: 'flowmind-default', inputPromptTemplate: '{{trigger_1.message_text}}' };
    case 'internal_record':
      return {
        fieldMappings: {
          name: '{{trigger_1.contact_name}}',
          email: '{{trigger_1.contact_email}}',
          raw_message: '{{trigger_1.message_text}}',
          ai_summary: '',
          ai_intent: '',
          ambiguities: [],
        },
      };
    case 'send_email':
      return {
        to: '{{trigger_1.contact_email}}',
        subject: 'Recebemos seu contato - FlowMind AI',
        bodyTemplate: 'Olá {{trigger_1.contact_name}}, recebemos seu contato com sucesso.',
      };
    case 'condition':
      return { leftOperand: '', operator: 'is_not_empty', rightOperand: '' };
    case 'http_request':
      return { url: '', method: 'POST', bodyTemplate: '{}' };
  }
}

export function getDefaultNodeLabel(type: NodeType): string {
  switch (type) {
    case 'trigger_schedule': return 'Gatilho de Agendamento';
    case 'trigger_form': return 'Gatilho de Formulário';
    case 'ai_analyze_intent': return 'Resumo e Intenção';
    case 'internal_record': return 'Registro Interno';
    case 'send_email': return 'Enviar E-mail';
    case 'condition': return 'Condição';
    case 'http_request': return 'Requisição HTTP';
  }
}

export function addWorkflowNode(
  workflow: WorkflowDefinition,
  type: NodeType,
  options?: { id?: string; label?: string; position?: NodePosition; config?: Record<string, unknown> },
): WorkflowDefinition {
  requireDraft(workflow);
  const allowedTypes: NodeType[] = [
    'trigger_form', 'trigger_schedule', 'ai_analyze_intent', 'internal_record',
    'send_email', 'condition', 'http_request',
  ];
  if (!allowedTypes.includes(type)) {
    throw new Error(`Tipo de etapa não reconhecido: ${type}`);
  }
  if (type.startsWith('trigger_') && workflow.nodes.some((node) => node.type.startsWith('trigger_'))) {
    throw new Error('O workflow já possui um gatilho de formulário ou agendamento.');
  }

  const existingIds = new Set(workflow.nodes.map((n) => n.id));
  let candidateId = options?.id?.trim();
  if (candidateId) {
    if (existingIds.has(candidateId)) {
      throw new Error(`Identificador de etapa já existente: ${candidateId}`);
    }
  } else {
    let suffix = workflow.nodes.length + 1;
    candidateId = `${type}_${suffix}`;
    while (existingIds.has(candidateId)) {
      suffix++;
      candidateId = `${type}_${suffix}`;
    }
  }

  const label = options?.label?.trim() || getDefaultNodeLabel(type);
  const position = options?.position ?? {
    x: Math.max(0, ...workflow.nodes.map((n) => n.position.x)) + 300,
    y: 150,
  };
  const config = options?.config ?? createDefaultNodeConfig(type);

  const newNode: WorkflowNode = {
    id: candidateId,
    type,
    label,
    position,
    config,
  };

  const isTrigger = type.startsWith('trigger_') || !workflow.triggerNodeId;

  return {
    ...workflow,
    triggerNodeId: isTrigger ? candidateId : workflow.triggerNodeId,
    nodes: [...workflow.nodes, newNode],
  };
}

export function removeWorkflowNode(workflow: WorkflowDefinition, id: string): WorkflowDefinition {
  requireDraft(workflow);
  const nodeExists = workflow.nodes.some((node) => node.id === id);
  if (!nodeExists) {
    return workflow;
  }
  if (workflow.triggerNodeId === id) {
    throw new Error('O gatilho principal do workflow não pode ser excluído.');
  }

  const remainingNodes = workflow.nodes.filter((node) => node.id !== id);
  const remainingEdges = workflow.edges.filter((edge) => edge.sourceNodeId !== id && edge.targetNodeId !== id);

  return {
    ...workflow,
    nodes: remainingNodes,
    edges: remainingEdges,
  };
}

/** Troca explícita em rascunho; referências antigas ficam visíveis para revisão. */
export function changeWorkflowTrigger(workflow: WorkflowDefinition, type: 'trigger_form' | 'trigger_schedule'): WorkflowDefinition {
  requireDraft(workflow);
  if (!['trigger_form', 'trigger_schedule'].includes(type)) throw new Error('Gatilho inválido.');
  const trigger = workflow.nodes.find(node => node.id === workflow.triggerNodeId && node.type.startsWith('trigger_'));
  if (!trigger) throw new Error('Gatilho principal não encontrado.');
  if (trigger.type === type) return workflow;
  return { ...workflow, nodes: workflow.nodes.map(node => node.id === trigger.id
    ? { ...node, type, label: getDefaultNodeLabel(type), config: createDefaultNodeConfig(type) } : node) };
}

import type { GeneratedWorkflowDraft, NodeType, WorkflowEdge, WorkflowNode } from '@flowmind/contracts';
import { WORKFLOW_SCHEMA_VERSION } from '@flowmind/contracts';
import { WORKFLOW_GENERATION_JSON_SCHEMA } from './workflow-generation.schema';

interface ParsedProposal {
  draft: GeneratedWorkflowDraft;
  reasoning: string;
  warnings: string[];
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!isJsonObject(value) || !keys.every((key) => Object.hasOwn(value, key))
    || Object.keys(value).some((key) => !keys.includes(key))) {
    throw new Error('Invalid proposal structure');
  }
  return value;
}

function text(value: unknown, nonempty = false): string {
  if (typeof value !== 'string' || (nonempty && !value.trim())) throw new Error('Invalid proposal text');
  return value;
}

function finiteNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid proposal number');
  return value;
}

function config(value: unknown): Record<string, unknown> {
  const parsed: unknown = JSON.parse(text(value));
  if (!isJsonObject(parsed)) throw new Error('Invalid node configuration');
  // Config é JSON declarativo. Schemas específicos de cada nó continuam em revisão.
  const pending: unknown[] = [parsed];
  while (pending.length) {
    const item = pending.pop();
    if (typeof item === 'number' && !Number.isFinite(item)) throw new Error('Invalid configuration number');
    if (Array.isArray(item)) {
      for (const child of item) pending.push(child);
    }
    else if (isJsonObject(item)) {
      for (const [key, child] of Object.entries(item)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Invalid configuration key');
        pending.push(child);
      }
    }
  }
  return parsed;
}

/** Decodifica somente o schema local solicitado; não aprova semântica, recursos ou ativação. */
export function parseWorkflowProposal(value: unknown): ParsedProposal {
  const schema = WORKFLOW_GENERATION_JSON_SCHEMA.schema;
  const body = object(value, schema.required);
  const workflowSchema = schema.properties.workflow;
  const workflow = object(body.workflow, workflowSchema.required);
  if (workflow.schemaVersion !== WORKFLOW_SCHEMA_VERSION) throw new Error('Unsupported workflow schema');
  if (!Array.isArray(workflow.nodes) || workflow.nodes.length === 0 || !Array.isArray(workflow.edges)) {
    throw new Error('Invalid proposal collections');
  }
  if (!Array.isArray(body.warnings) || !body.warnings.every((warning) => typeof warning === 'string')) {
    throw new Error('Invalid proposal warnings');
  }

  const nodeSchema = workflowSchema.properties.nodes.items;
  const allowedTypes: readonly NodeType[] = nodeSchema.properties.type.enum;
  const nodes: WorkflowNode[] = workflow.nodes.map((value) => {
    const node = object(value, nodeSchema.required);
    const nodeType = text(node.type);
    if (!allowedTypes.some((type) => type === nodeType)) throw new Error('Unsupported node type');
    const position = object(node.position, nodeSchema.properties.position.required);
    return {
      id: text(node.id, true), type: nodeType as NodeType, label: text(node.label),
      position: { x: finiteNumber(position.x), y: finiteNumber(position.y) },
      config: config(node.config),
    };
  });
  const edgeSchema = workflowSchema.properties.edges.items;
  const edges: WorkflowEdge[] = workflow.edges.map((value) => {
    const edge = object(value, edgeSchema.required);
    return {
      id: text(edge.id, true), sourceNodeId: text(edge.sourceNodeId, true), targetNodeId: text(edge.targetNodeId, true),
      ...(edge.sourceHandle === null ? {} : { sourceHandle: text(edge.sourceHandle) }),
      ...(edge.targetHandle === null ? {} : { targetHandle: text(edge.targetHandle) }),
    };
  });
  return {
    draft: {
      schemaVersion: WORKFLOW_SCHEMA_VERSION, name: text(workflow.name, true),
      description: text(workflow.description), triggerNodeId: text(workflow.triggerNodeId, true), nodes, edges,
    },
    reasoning: text(body.reasoning), warnings: body.warnings,
  };
}

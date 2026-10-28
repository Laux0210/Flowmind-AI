/**
 * FlowMind AI — Contrato de Definição de Workflow
 * Esquema local em revisão; não representa contrato de produção aprovado.
 */

export const WORKFLOW_SCHEMA_VERSION = '1.0.0' as const;

export type WorkflowStatus = 'DRAFT' | 'REVIEWED' | 'PUBLISHED' | 'ARCHIVED';

export const WORKFLOW_NODE_TYPES = [
  'trigger_form',
  'trigger_schedule',
  'ai_analyze_intent',
  'internal_record',
  'send_email',
  'condition',
  'http_request',
] as const;

export type NodeType = typeof WORKFLOW_NODE_TYPES[number];

export interface NodePosition {
  x: number;
  y: number;
}

export interface WorkflowNode<TConfig = Record<string, unknown>> {
  id: string;
  type: NodeType;
  label: string;
  position: NodePosition;
  config: TConfig;
}

export interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface WorkflowDefinition {
  schemaVersion: string;
  id: string;
  orgId: string;
  name: string;
  description?: string;
  version: number;
  status: WorkflowStatus;
  triggerNodeId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  schemaVersion: string;
  triggerNodeId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  publishedBy: string;
  publishedAt: string;
}

export const VALID_WORKFLOW_STATUS_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  DRAFT: ['REVIEWED', 'ARCHIVED'],
  REVIEWED: ['PUBLISHED', 'DRAFT', 'ARCHIVED'],
  PUBLISHED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

export type ExecutionMode = 'SIMULATION' | 'LIVE';

export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface NodeExecutionResult {
  nodeId: string;
  nodeType: NodeType;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  startedAt: string;
  completedAt: string;
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowVersion: number;
  orgId: string;
  mode: ExecutionMode;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  triggeredBy: string;
  nodeResults: NodeExecutionResult[];
}

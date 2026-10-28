/**
 * FlowMind AI — Catálogo e Contratos de Recursos e Credenciais por Organização (T03-S3)
 */

export type ResourceType = 'ai_model' | 'credential' | 'form';
export type ResourceStatus = 'ACTIVE' | 'INACTIVE' | 'REVOKED';

export interface TenantResourceRegistration {
  id: string;
  type: 'form' | 'credential';
  orgId: string;
  name: string;
  status: ResourceStatus;
}

export interface ModelRegistration {
  id: string;
  type: 'ai_model';
  name: string;
  status: ResourceStatus;
  allowedOrgIds: readonly string[];
  approval: 'PENDING' | 'APPROVED';
  providerModelId: string;
}

export type ResourceRegistration = TenantResourceRegistration | ModelRegistration;
export interface PublicResource {
  id: string;
  type: ResourceType;
  name: string;
  status: ResourceStatus;
}

export interface ResourceDescriptor {
  id: string;
  type: ResourceType;
  orgId?: string;
  name: string;
  status: ResourceStatus;
}

export const RESOURCE_ERROR_CODES = [
  'UNKNOWN_MODEL_REFERENCE',
  'RESOURCE_NOT_FOUND',
  'RESOURCE_CROSS_TENANT_FORBIDDEN',
  'RESOURCE_INACTIVE',
] as const;

export type ResourceErrorCode = typeof RESOURCE_ERROR_CODES[number];

import { BadRequestException } from '@nestjs/common';
import type { PublicResource, ResourceRegistration, ResourceType } from '@flowmind/contracts';

export const RESOURCE_CATALOG = Symbol('RESOURCE_CATALOG');
export interface ResourceCatalog {
  list(orgId: string, type?: ResourceType): readonly PublicResource[];
  resolve(orgId: string, id: string, type: ResourceType): PublicResource;
}

export class ConfiguredResourceCatalog implements ResourceCatalog {
  private readonly entries = new Map<string, Readonly<ResourceRegistration>>();

  constructor(entries: ReadonlyArray<ResourceRegistration>) {
    if (!Array.isArray(entries)) this.invalid();
    for (const value of entries) {
      this.validate(value);
      if (this.entries.has(value.id)) this.invalid();
      const entry = value.type === 'ai_model'
        ? { ...value, allowedOrgIds: Object.freeze([...value.allowedOrgIds]) }
        : { ...value };
      this.entries.set(value.id, Object.freeze(entry));
    }
  }

  list(orgId: string, type?: ResourceType): readonly PublicResource[] {
    this.requireOrg(orgId);
    if (type !== undefined && !['ai_model', 'credential', 'form'].includes(type)) {
      throw new BadRequestException({ code: 'INVALID_RESOURCE_TYPE', message: 'Tipo de recurso inválido.' });
    }
    return Object.freeze([...this.entries.values()]
      .filter((entry) => this.granted(entry, orgId) && entry.status === 'ACTIVE' && (!type || entry.type === type))
      .map((entry) => this.publicValue(entry)));
  }

  resolve(orgId: string, id: string, type: ResourceType): PublicResource {
    this.requireOrg(orgId);
    const entry = typeof id === 'string' ? this.entries.get(id.trim()) : undefined;
    if (!entry || entry.type !== type || !this.granted(entry, orgId)) this.notFound();
    if (entry.status !== 'ACTIVE') {
      throw new BadRequestException({ code: 'RESOURCE_INACTIVE', message: 'Recurso indisponível para utilização.' });
    }
    return this.publicValue(entry);
  }

  private granted(entry: Readonly<ResourceRegistration>, orgId: string): boolean {
    return entry.type === 'ai_model'
      ? entry.approval === 'APPROVED' && entry.allowedOrgIds.includes(orgId)
      : entry.orgId === orgId;
  }

  private publicValue(entry: Readonly<ResourceRegistration>): PublicResource {
    return Object.freeze({ id: entry.id, type: entry.type, name: entry.name, status: entry.status });
  }

  private requireOrg(orgId: string): void {
    if (typeof orgId !== 'string' || !orgId.trim()) this.notFound();
  }

  private notFound(): never {
    throw new BadRequestException({ code: 'RESOURCE_NOT_FOUND', message: 'Recurso não encontrado para esta organização.' });
  }

  private invalid(): never {
    throw new Error('Configuração de catálogo inválida.');
  }

  private validate(value: ResourceRegistration): void {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))) this.invalid();
    const nonempty = (field: unknown) => typeof field === 'string' && field.trim().length > 0;
    if (!nonempty(value.id) || value.id !== value.id.trim() || !nonempty(value.name) ||
        !['ACTIVE', 'INACTIVE', 'REVOKED'].includes(value.status)) this.invalid();
    const common = ['id', 'type', 'name', 'status'];
    if (value.type === 'ai_model') {
      const fields = [...common, 'allowedOrgIds', 'approval', 'providerModelId'];
      if (Object.keys(value).some((key) => !fields.includes(key)) ||
          ['pending', 'modelo-a-aprovar'].includes(value.id) ||
          !['PENDING', 'APPROVED'].includes(value.approval) ||
          !nonempty(value.providerModelId) || !Array.isArray(value.allowedOrgIds) ||
          value.allowedOrgIds.some((id) => !nonempty(id))) this.invalid();
    } else if (value.type === 'credential' || value.type === 'form') {
      if (Object.keys(value).some((key) => ![...common, 'orgId'].includes(key)) || !nonempty(value.orgId)) this.invalid();
    } else {
      this.invalid();
    }
  }
}

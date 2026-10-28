import { Injectable, Inject, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import type { PublicResource, ResourceType } from '@flowmind/contracts';
import { RESOURCE_CATALOG } from './resource-catalog';
import type { ResourceCatalog } from './resource-catalog';

@Injectable()
export class ResourcesService {
  private readonly catalog: ResourceCatalog;
  constructor(@Inject(RESOURCE_CATALOG) catalog: ResourceCatalog) { this.catalog = catalog; }

  list(orgId: string, type?: unknown): PublicResource[] {
    if (type !== undefined && (typeof type !== 'string' || !['form', 'credential', 'ai_model'].includes(type))) {
      throw new BadRequestException({ code: 'INVALID_RESOURCE_TYPE', message: 'Tipo de recurso inválido.' });
    }
    try {
      return this.catalog.list(orgId, type as ResourceType | undefined)
        .map(({ id, type, name, status }) => ({ id, type, name, status }));
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new ServiceUnavailableException({ code: 'RESOURCE_CATALOG_UNAVAILABLE', message: 'Catálogo de recursos indisponível.' });
    }
  }
}

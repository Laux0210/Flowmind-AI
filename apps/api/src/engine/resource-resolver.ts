import { BadRequestException, Injectable, Inject } from '@nestjs/common';
import type { PublicResource } from '@flowmind/contracts';
import { RESOURCE_CATALOG } from '../resources/resource-catalog';
import type { ResourceCatalog } from '../resources/resource-catalog';

export type ResourceResolutionResult = PublicResource;

@Injectable()
export class ResourceResolver {
  private readonly catalog: ResourceCatalog;

  constructor(@Inject(RESOURCE_CATALOG) catalog: ResourceCatalog) {
    if (!catalog || typeof catalog.resolve !== 'function' || typeof catalog.list !== 'function') {
      throw new Error('Catálogo de recursos obrigatório.');
    }
    this.catalog = catalog;
  }

  resolveAiModel(orgId: string, ref: string): ResourceResolutionResult {
    return this.catalog.resolve(orgId, ref, 'ai_model');
  }

  resolveCredential(orgId: string, ref: string): ResourceResolutionResult {
    return this.catalog.resolve(orgId, ref, 'credential');
  }

  resolveForm(orgId: string, ref: string): ResourceResolutionResult {
    return this.catalog.resolve(orgId, ref, 'form');
  }

  isModelSelectionPending(orgId: string, ref: unknown): boolean {
    if (ref === undefined || ref === null || ref === '' ||
        (typeof ref === 'string' && ['', 'pending', 'modelo-a-aprovar'].includes(ref.trim()))) return true;
    if (ref !== 'flowmind-default') return false;
    try { this.resolveAiModel(orgId, ref); return false; } catch (error) {
      if (error instanceof BadRequestException &&
          (error.getResponse() as { code?: string }).code === 'RESOURCE_NOT_FOUND') return true;
      throw error;
    }
  }
}

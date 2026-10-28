import { Module } from '@nestjs/common';
import { ConfiguredResourceCatalog, RESOURCE_CATALOG } from './resource-catalog';
import { configuredResources } from './resource-catalog.config';
import { ResourceResolver } from '../engine/resource-resolver';
import { AuthModule } from '../auth/auth.module';
import { ResourcesController } from './resources.controller';
import { ResourcesService } from './resources.service';

@Module({
  imports: [AuthModule],
  controllers: [ResourcesController],
  providers: [ResourceResolver, ResourcesService, {
    provide: RESOURCE_CATALOG,
    useFactory: () => new ConfiguredResourceCatalog(configuredResources),
  }],
  exports: [RESOURCE_CATALOG, ResourceResolver],
})
export class ResourcesModule {}

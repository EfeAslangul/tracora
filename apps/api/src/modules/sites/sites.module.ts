import { Module } from '@nestjs/common';
import { SiteProfileRegistry } from './site-profile.registry';
import { UrlSafetyService } from './url-safety.service';

@Module({
  providers: [SiteProfileRegistry, UrlSafetyService],
  exports: [SiteProfileRegistry, UrlSafetyService],
})
export class SitesModule {}

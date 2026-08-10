import { Module } from '@nestjs/common';
import { ChangedetectionHttpClient } from './changedetection-http.client';
import { ChangedetectionWatchConfigService } from './changedetection-watch-config.service';
import { CHANGEDETECTION_CLIENT } from './changedetection.types';

@Module({
  providers: [
    { provide: CHANGEDETECTION_CLIENT, useClass: ChangedetectionHttpClient },
    ChangedetectionWatchConfigService,
  ],
  exports: [CHANGEDETECTION_CLIENT, ChangedetectionWatchConfigService],
})
export class ChangedetectionModule {}

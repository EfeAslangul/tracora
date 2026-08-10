import { Module } from '@nestjs/common';
import { ChangedetectionModule } from '../changedetection/changedetection.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { BaselineSyncService } from './baseline-sync.service';

@Module({
  imports: [ChangedetectionModule, WebhooksModule],
  providers: [BaselineSyncService],
})
export class BaselineModule {}

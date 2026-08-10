import { Module } from '@nestjs/common';
import { ObservationService } from './observation.service';
import { WebhooksController } from './webhooks.controller';

@Module({
  controllers: [WebhooksController],
  providers: [ObservationService],
  exports: [ObservationService],
})
export class WebhooksModule {}

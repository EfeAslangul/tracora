import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainException } from '../../common/errors/domain.exception';
import type { CreateWatchInput, WatchFetchMode } from './changedetection.types';

@Injectable()
export class ChangedetectionWatchConfigService {
  constructor(private readonly configService: ConfigService) {}

  createInput(url: string, fetchMode: Exclude<WatchFetchMode, 'AUTO'>): CreateWatchInput {
    return {
      url,
      tag: 'trackora',
      fetchMode,
      checkIntervalSeconds: this.configService.get<number>('CHECK_INTERVAL_SECONDS', 86_400),
      processor: 'restock_diff',
      extractTitleAsTitle: true,
      notification: {
        url: this.appriseWebhookUrl(),
        title: 'Trackora observation',
        body: this.notificationBody(),
      },
    };
  }

  private appriseWebhookUrl(): string {
    const webhookUrl = this.configService.get<string>('CHANGEDETECTION_WEBHOOK_URL', '').trim();
    const secret = this.configService.get<string>('CHANGEDETECTION_WEBHOOK_SECRET', '').trim();
    if (!webhookUrl || !secret) {
      throw new DomainException(
        'CHANGEDETECTION_NOT_CONFIGURED',
        'Webhook URL veya secret yapılandırılmamış.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const appriseUrl = webhookUrl.replace(/^https:/, 'posts:').replace(/^http:/, 'post:');
    const separator = appriseUrl.includes('?') ? '&' : '?';
    return `${appriseUrl}${separator}+x-webhook-secret=${encodeURIComponent(secret)}`;
  }

  private notificationBody(): string {
    return JSON.stringify({
      schemaVersion: 1,
      eventId: '{{ watch_uuid }}:{{ notification_timestamp }}',
      watchId: '{{ watch_uuid }}',
      observedAt: '{{ notification_timestamp }}',
      observation: {
        price: '{{ restock.price }}',
        currency: '{{ restock.currency }}',
        inStock: '{{ restock.in_stock }}',
      },
    });
  }
}

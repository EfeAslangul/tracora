import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, type Prisma } from '@prisma/client';
import { TelegramDeliveryError } from './telegram.errors';

interface TelegramPayload {
  productName: string;
  productUrl: string;
  previousPrice?: number;
  currentPrice?: number;
  currency?: string;
  targetPrice?: number;
  inStock?: boolean;
}

interface TelegramApiResponse {
  ok?: boolean;
  description?: string;
  parameters?: { retry_after?: number };
}

@Injectable()
export class TelegramGateway {
  private readonly enabled: boolean;
  private readonly token: string;
  private readonly chatId: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('TELEGRAM_ENABLED', true);
    this.token = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '').trim();
    this.chatId = this.configService.get<string>('TELEGRAM_CHAT_ID', '').trim();
    this.timeoutMs = this.configService.get<number>('TELEGRAM_TIMEOUT_MS', 10_000);
  }

  isConfigured(): boolean {
    return this.enabled && Boolean(this.token) && Boolean(this.chatId);
  }

  async send(type: NotificationType, rawPayload: Prisma.JsonValue): Promise<void> {
    if (!this.isConfigured()) {
      throw new TelegramDeliveryError(
        'TELEGRAM_NOT_CONFIGURED',
        'Telegram yapılandırılmamış.',
        true,
      );
    }
    const payload = this.parsePayload(rawPayload);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: this.message(type, payload),
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      });
      const body = (await response.json().catch(() => ({}))) as TelegramApiResponse;
      if (response.ok && body.ok !== false) return;

      const retryAfter = body.parameters?.retry_after;
      const permanent = [400, 401, 403].includes(response.status);
      throw new TelegramDeliveryError(
        response.status === 429 ? 'TELEGRAM_RATE_LIMITED' : 'TELEGRAM_REQUEST_FAILED',
        permanent ? 'Telegram isteği kalıcı olarak reddetti.' : 'Telegram geçici hata döndürdü.',
        permanent,
        typeof retryAfter === 'number' ? retryAfter : undefined,
      );
    } catch (error) {
      if (error instanceof TelegramDeliveryError) throw error;
      throw new TelegramDeliveryError(
        'TELEGRAM_UNAVAILABLE',
        'Telegram servisine ulaşılamadı.',
        false,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private parsePayload(value: Prisma.JsonValue): TelegramPayload {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new TelegramDeliveryError(
        'INVALID_NOTIFICATION_PAYLOAD',
        'Bildirim içeriği geçersiz.',
        true,
      );
    }
    const payload = value as Record<string, unknown>;
    if (typeof payload.productName !== 'string' || typeof payload.productUrl !== 'string') {
      throw new TelegramDeliveryError(
        'INVALID_NOTIFICATION_PAYLOAD',
        'Bildirim içeriği geçersiz.',
        true,
      );
    }
    return payload as unknown as TelegramPayload;
  }

  private message(type: NotificationType, payload: TelegramPayload): string {
    const name = this.escape(payload.productName);
    const url = this.escape(payload.productUrl);
    const currency = this.escape(payload.currency ?? '');
    const priceLine =
      payload.previousPrice !== undefined && payload.currentPrice !== undefined
        ? `${payload.previousPrice} ${currency} → ${payload.currentPrice} ${currency}`
        : payload.currentPrice !== undefined
          ? `${payload.currentPrice} ${currency}`
          : '';

    if (type === NotificationType.TARGET_REACHED) {
      return [
        '🎯 <b>Hedef fiyata ulaştı</b>',
        name,
        priceLine,
        payload.targetPrice === undefined ? '' : `Hedef: ${payload.targetPrice} ${currency}`,
        url,
      ]
        .filter(Boolean)
        .join('\n');
    }
    if (type === NotificationType.RESTOCKED) {
      return ['📦 <b>Ürün yeniden stokta</b>', name, priceLine, url].filter(Boolean).join('\n');
    }
    if (type === NotificationType.WATCH_ERROR) {
      return ['⚠️ <b>Ürün kontrol edilemedi</b>', name, url].join('\n');
    }
    return ['💸 <b>Fiyat değişti</b>', name, priceLine, url].filter(Boolean).join('\n');
  }

  private escape(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }
}

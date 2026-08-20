import { ConfigService } from '@nestjs/config';
import { NotificationType } from '@prisma/client';
import { TelegramDeliveryError } from './telegram.errors';
import { TelegramGateway } from './telegram.gateway';

const config = () =>
  new ConfigService({
    TELEGRAM_ENABLED: true,
    TELEGRAM_BOT_TOKEN: 'test-token',
    TELEGRAM_TIMEOUT_MS: 1_000,
  });

describe('TelegramGateway', () => {
  afterEach(() => jest.restoreAllMocks());

  it('escapes HTML and sends a price change', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const gateway = new TelegramGateway(config());

    await gateway.send('4242', NotificationType.PRICE_CHANGED, {
      productName: '<Example>',
      productUrl: 'https://example.com?a=1&b=2',
      previousPrice: 20,
      currentPrice: 10,
      currency: 'TRY',
    });

    const request = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body)) as { text: string };
    expect(body.text).toContain('&lt;Example&gt;');
    expect(body.text).toContain('a=1&amp;b=2');
  });

  it('uses Telegram retry_after for rate limits', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: false, parameters: { retry_after: 42 } }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const gateway = new TelegramGateway(config());

    await expect(
      gateway.send('4242', NotificationType.RESTOCKED, {
        productName: 'Example',
        productUrl: 'https://example.com',
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<TelegramDeliveryError>>({
        code: 'TELEGRAM_RATE_LIMITED',
        retryAfterSeconds: 42,
        permanent: false,
      }),
    );
  });
});

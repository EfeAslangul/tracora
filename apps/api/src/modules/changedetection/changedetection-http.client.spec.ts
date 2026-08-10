import { ConfigService } from '@nestjs/config';
import { ChangeDetectionClientError } from './changedetection.errors';
import { ChangedetectionHttpClient } from './changedetection-http.client';

const config = (overrides: Record<string, unknown> = {}) =>
  new ConfigService({
    CHANGEDETECTION_BASE_URL: 'http://changedetection:5000',
    CHANGEDETECTION_API_KEY: 'test-api-key',
    CHANGEDETECTION_TIMEOUT_MS: 10_000,
    ...overrides,
  });

describe('ChangedetectionHttpClient', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('creates a daily browser watch using the v1 API contract', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ uuid: 'watch-1' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = new ChangedetectionHttpClient(config());

    await expect(
      client.createWatch({
        url: 'https://shop.example/product',
        fetchMode: 'BROWSER',
        checkIntervalSeconds: 86_400,
      }),
    ).resolves.toEqual({ id: 'watch-1' });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://changedetection:5000/api/v1/watch',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'test-api-key',
        },
        body: JSON.stringify({
          url: 'https://shop.example/product',
          fetch_backend: 'html_webdriver',
          time_between_check: { weeks: 0, days: 1, hours: 0, minutes: 0, seconds: 0 },
        }),
      }),
    );
  });

  it('does not call the external service without an API key', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const client = new ChangedetectionHttpClient(config({ CHANGEDETECTION_API_KEY: '' }));

    await expect(client.listWatches()).rejects.toMatchObject({
      code: 'CHANGEDETECTION_NOT_CONFIGURED',
      retryable: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes list responses', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          'watch-1': {
            url: 'https://shop.example/product',
            title: 'Example',
            last_checked: 1_700_000_000,
            last_changed: 0,
            last_error: false,
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = new ChangedetectionHttpClient(config());

    await expect(client.listWatches()).resolves.toEqual([
      {
        id: 'watch-1',
        url: 'https://shop.example/product',
        title: 'Example',
        lastCheckedAt: new Date(1_700_000_000_000),
        lastChangedAt: null,
        lastError: null,
      },
    ]);
  });

  it('maps missing watches to a stable domain error', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('missing', { status: 404 }));
    const client = new ChangedetectionHttpClient(config());

    await expect(client.getWatch('missing')).rejects.toEqual(
      expect.objectContaining<Partial<ChangeDetectionClientError>>({
        code: 'WATCH_NOT_FOUND',
        retryable: false,
        status: 404,
      }),
    );
  });

  it('maps rejected create requests to WATCH_CREATE_FAILED', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('invalid', { status: 400 }));
    const client = new ChangedetectionHttpClient(config());

    await expect(client.createWatch({ url: 'https://shop.example/product' })).rejects.toMatchObject(
      {
        code: 'WATCH_CREATE_FAILED',
        retryable: false,
        status: 400,
      },
    );
  });

  it('aborts external requests at the configured timeout', async () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch').mockImplementation((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });
    const client = new ChangedetectionHttpClient(config({ CHANGEDETECTION_TIMEOUT_MS: 1_000 }));

    const request = expect(client.listWatches()).rejects.toMatchObject({
      code: 'CHANGEDETECTION_UNAVAILABLE',
      retryable: true,
    });
    await jest.advanceTimersByTimeAsync(1_000);

    await request;
  });

  it('triggers an immediate recheck without changing watch settings', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify('OK'), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = new ChangedetectionHttpClient(config());

    await client.triggerCheck('watch/with spaces');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://changedetection:5000/api/v1/watch/watch%2Fwith%20spaces?recheck=1',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

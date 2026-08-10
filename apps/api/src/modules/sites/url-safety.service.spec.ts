import { ConfigService } from '@nestjs/config';
import { lookup } from 'node:dns/promises';
import { DomainException } from '../../common/errors/domain.exception';
import { UrlSafetyService } from './url-safety.service';

jest.mock('node:dns/promises', () => ({ lookup: jest.fn() }));

const lookupMock = jest.mocked(lookup);

describe('UrlSafetyService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    lookupMock.mockReset();
  });

  it('normalizes public URLs and removes tracking data', async () => {
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }] as never);
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    const service = new UrlSafetyService(new ConfigService({ URL_VALIDATION_TIMEOUT_MS: 1_000 }));

    await expect(
      service.validateAndNormalize('https://example.com/product?utm_source=test&variant=1#buy'),
    ).resolves.toEqual(new URL('https://example.com/product?variant=1'));
  });

  it('rejects hostnames resolving to a private address', async () => {
    lookupMock.mockResolvedValue([{ address: '127.0.0.1', family: 4 }] as never);
    const service = new UrlSafetyService(new ConfigService());

    await expect(service.validateAndNormalize('http://internal.example/product')).rejects.toEqual(
      expect.objectContaining<Partial<DomainException>>({ code: 'UNSAFE_PRODUCT_URL' }),
    );
  });

  it('validates redirect targets before following them', async () => {
    lookupMock.mockImplementation((async (hostname: string) => {
      const address = hostname === 'example.com' ? '93.184.216.34' : '10.0.0.5';
      return [{ address, family: 4 }];
    }) as never);
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response('', { status: 302, headers: { location: 'http://private.example/product' } }),
      );
    const service = new UrlSafetyService(new ConfigService());

    await expect(service.validateAndNormalize('https://example.com/product')).rejects.toMatchObject(
      {
        code: 'UNSAFE_PRODUCT_URL',
      },
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects credentials and non-http protocols without network access', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const service = new UrlSafetyService(new ConfigService());

    await expect(
      service.validateAndNormalize('https://user:secret@example.com/product'),
    ).rejects.toMatchObject({ code: 'UNSAFE_PRODUCT_URL' });
    await expect(service.validateAndNormalize('file:///etc/passwd')).rejects.toMatchObject({
      code: 'UNSAFE_PRODUCT_URL',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts public IPv6 literals and rejects loopback IPv6', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 200 }));
    const service = new UrlSafetyService(new ConfigService());

    await expect(
      service.validateAndNormalize('https://[2606:4700:4700::1111]/product'),
    ).resolves.toEqual(new URL('https://[2606:4700:4700::1111]/product'));
    await expect(service.validateAndNormalize('http://[::1]/product')).rejects.toMatchObject({
      code: 'UNSAFE_PRODUCT_URL',
    });
  });
});

import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { DomainException } from '../../common/errors/domain.exception';

const TRACKING_PARAMETERS = new Set(['fbclid', 'gclid', 'mc_cid', 'mc_eid', 'ref', 'ref_']);

@Injectable()
export class UrlSafetyService {
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.timeoutMs = this.configService.get<number>('URL_VALIDATION_TIMEOUT_MS', 5_000);
  }

  async validateAndNormalize(rawUrl: string): Promise<URL> {
    let current = this.parse(rawUrl);

    for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
      await this.assertPublic(current);
      const response = await this.readRedirect(current);
      if (!this.isRedirect(response.status)) return this.normalize(current);

      const location = response.headers.get('location');
      if (!location) return this.normalize(current);
      if (redirectCount === 5) {
        throw this.unsafe('Ürün bağlantısı çok fazla yönlendirme içeriyor.');
      }
      current = this.parse(new URL(location, current).toString());
    }

    return this.normalize(current);
  }

  private parse(rawUrl: string): URL {
    let url: URL;
    try {
      url = new URL(rawUrl.trim());
    } catch {
      throw new DomainException(
        'INVALID_PRODUCT_URL',
        'Ürün bağlantısı geçerli değil.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw this.unsafe('Yalnızca kimlik bilgisi içermeyen HTTP/HTTPS bağlantıları kabul edilir.');
    }
    if (url.port && !['80', '443'].includes(url.port)) {
      throw this.unsafe('Ürün bağlantısı izin verilmeyen bir port kullanıyor.');
    }
    return url;
  }

  private async assertPublic(url: URL): Promise<void> {
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    const addressHostname =
      hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      throw this.unsafe('Yerel ağ adresleri takip edilemez.');
    }

    const addresses = isIP(addressHostname)
      ? [{ address: addressHostname }]
      : await lookup(addressHostname, { all: true, verbatim: true }).catch(() => []);
    if (addresses.length === 0 || addresses.some(({ address }) => !this.isPublicAddress(address))) {
      throw this.unsafe('Bağlantı herkese açık bir internet adresine çözülmüyor.');
    }
  }

  private async readRedirect(url: URL): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'Trackora URL Safety Check/0.1' },
      });
    } catch {
      throw new DomainException(
        'INVALID_PRODUCT_URL',
        'Ürün bağlantısına güvenli biçimde ulaşılamadı.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalize(url: URL): URL {
    const normalized = new URL(url.toString());
    normalized.hash = '';
    for (const key of [...normalized.searchParams.keys()]) {
      if (key.toLowerCase().startsWith('utm_') || TRACKING_PARAMETERS.has(key.toLowerCase())) {
        normalized.searchParams.delete(key);
      }
    }
    return normalized;
  }

  private isRedirect(status: number): boolean {
    return [301, 302, 303, 307, 308].includes(status);
  }

  private isPublicAddress(address: string): boolean {
    const version = isIP(address);
    if (version === 4) return this.isPublicIpv4(address);
    if (version !== 6) return false;

    const value = this.ipv6ToBigInt(address);
    if (value === null) return false;
    const globalUnicast = this.inCidr(value, 0x2000n << 112n, 3, 128);
    const documentation = this.inCidr(value, 0x20010db8n << 96n, 32, 128);
    return globalUnicast && !documentation;
  }

  private isPublicIpv4(address: string): boolean {
    const [a, b, c] = address.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && [18, 19].includes(b)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  private ipv6ToBigInt(address: string): bigint | null {
    const halves = address.toLowerCase().split('::');
    if (halves.length > 2) return null;
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves[1] ? halves[1].split(':') : [];
    const missing = 8 - left.length - right.length;
    if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
    const groups = [...left, ...Array.from({ length: missing }, () => '0'), ...right];
    try {
      return groups.reduce((value, group) => (value << 16n) + BigInt(`0x${group || '0'}`), 0n);
    } catch {
      return null;
    }
  }

  private inCidr(value: bigint, network: bigint, prefix: number, bits: number): boolean {
    return value >> BigInt(bits - prefix) === network >> BigInt(bits - prefix);
  }

  private unsafe(message: string): DomainException {
    return new DomainException('UNSAFE_PRODUCT_URL', message, HttpStatus.BAD_REQUEST);
  }
}

import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { runWithContext } from './request-context';

interface HeaderCarrier {
  headers: Record<string, unknown>;
}

interface ResponseCarrier {
  setHeader(name: string, value: string): void;
}

const HEADER = 'x-request-id';

/** İstemciden gelen değer aynen yankılanmaz; yalnız güvenli karakterler korunur. */
export const sanitizeRequestId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 100);
  return cleaned.length > 0 ? cleaned : null;
};

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: HeaderCarrier, response: ResponseCarrier, next: () => void): void {
    const requestId = sanitizeRequestId(request.headers[HEADER]) ?? randomUUID();
    response.setHeader(HEADER, requestId);
    runWithContext({ requestId }, next);
  }
}

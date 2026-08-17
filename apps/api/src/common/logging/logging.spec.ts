import { Logger } from '@nestjs/common';
import { logJson } from './log';
import { RequestIdMiddleware, sanitizeRequestId } from './request-id.middleware';
import { getRequestId, runWithContext } from './request-context';

describe('sanitizeRequestId', () => {
  it('keeps a safe client-supplied id', () => {
    expect(sanitizeRequestId('req_01-abc.DEF')).toBe('req_01-abc.DEF');
  });

  it('strips unsafe characters so headers cannot be injected', () => {
    expect(sanitizeRequestId('req\r\nX-Evil: 1')).toBe(
      'reqX-Evil:1'.replace(/[^A-Za-z0-9._-]/g, ''),
    );
    expect(sanitizeRequestId('req\r\nX-Evil: 1')).not.toContain('\n');
  });

  it('caps the length', () => {
    expect(sanitizeRequestId('a'.repeat(500))).toHaveLength(100);
  });

  it('falls back to null for empty or non-string values', () => {
    expect(sanitizeRequestId('')).toBeNull();
    expect(sanitizeRequestId('!!!')).toBeNull();
    expect(sanitizeRequestId(undefined)).toBeNull();
    expect(sanitizeRequestId(42)).toBeNull();
  });
});

describe('RequestIdMiddleware', () => {
  const middleware = new RequestIdMiddleware();

  it('reuses a client-supplied id in the context and the response header', () => {
    const response = { setHeader: jest.fn() };
    let seen: string | undefined;

    middleware.use({ headers: { 'x-request-id': 'req-1' } }, response, () => {
      seen = getRequestId();
    });

    expect(seen).toBe('req-1');
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', 'req-1');
  });

  it('generates an id when the header is missing', () => {
    const response = { setHeader: jest.fn() };
    let seen: string | undefined;

    middleware.use({ headers: {} }, response, () => {
      seen = getRequestId();
    });

    expect(seen).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', seen);
  });

  it('does not leak context between requests', () => {
    middleware.use({ headers: { 'x-request-id': 'req-1' } }, { setHeader: jest.fn() }, () => {
      // noop
    });

    expect(getRequestId()).toBeUndefined();
  });
});

describe('logJson', () => {
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  const parse = (mock: jest.Mock) =>
    JSON.parse(mock.mock.calls[0][0] as string) as Record<string, unknown>;

  beforeEach(() => jest.clearAllMocks());

  it('merges the ambient request id and source', () => {
    runWithContext({ requestId: 'req-1', source: 'baseline-sync' }, () => {
      logJson(logger as unknown as Logger, 'warn', 'baseline_sync_failed', { productId: 'p1' });
    });

    expect(parse(logger.warn)).toEqual({
      event: 'baseline_sync_failed',
      requestId: 'req-1',
      source: 'baseline-sync',
      productId: 'p1',
    });
  });

  it('omits the id when there is no context', () => {
    logJson(logger as unknown as Logger, 'log', 'http_request', { status: 200 });

    expect(parse(logger.log)).toEqual({ event: 'http_request', status: 200 });
  });

  it('logs only the fields it is given', () => {
    runWithContext({ requestId: 'req-1' }, () => {
      logJson(logger as unknown as Logger, 'log', 'http_request', {
        method: 'POST',
        route: '/api/v1/products',
        status: 201,
      });
    });

    const line = logger.log.mock.calls[0][0] as string;
    expect(line).not.toContain('secret');
    expect(line).not.toContain('authorization');
    expect(Object.keys(parse(logger.log))).toEqual([
      'event',
      'requestId',
      'method',
      'route',
      'status',
    ]);
  });
});

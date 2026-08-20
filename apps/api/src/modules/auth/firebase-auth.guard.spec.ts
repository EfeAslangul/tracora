import { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { DomainException } from '../../common/errors/domain.exception';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import type { FirebaseAdminService } from './firebase-admin.service';
import type { UsersService } from './users.service';
import type { AuthenticatedRequest } from './auth.types';

describe('FirebaseAuthGuard', () => {
  const verifyIdToken = jest.fn();
  const provision = jest.fn();
  const reflector = { getAllAndOverride: jest.fn() };

  const guard = (requireVerifiedEmail = false) =>
    new FirebaseAuthGuard(
      reflector as unknown as Reflector,
      { verifyIdToken } as unknown as FirebaseAdminService,
      { provision } as unknown as UsersService,
      new ConfigService({ AUTH_REQUIRE_EMAIL_VERIFIED: requireVerifiedEmail }),
    );

  const context = (authorization?: string) => {
    const request = { headers: authorization ? { authorization } : {} } as AuthenticatedRequest;
    return {
      request,
      context: {
        getHandler: () => () => undefined,
        getClass: () => class {},
        switchToHttp: () => ({ getRequest: () => request }),
      } as unknown as ExecutionContext,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false);
    provision.mockResolvedValue({ id: 'user-1', firebaseUid: 'uid-1' });
    verifyIdToken.mockResolvedValue({
      uid: 'uid-1',
      email: 'user@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
    });
  });

  it('provisions the user and attaches it to the request', async () => {
    const { request, context: ctx } = context('Bearer token-1');

    await expect(guard().canActivate(ctx)).resolves.toBe(true);
    expect(verifyIdToken).toHaveBeenCalledWith('token-1');
    expect(request.user).toMatchObject({ id: 'user-1' });
  });

  it('skips verification for public handlers', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { context: ctx } = context();

    await expect(guard().canActivate(ctx)).resolves.toBe(true);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it.each([
    ['missing header', undefined],
    ['wrong scheme', 'Basic abc'],
    ['empty token', 'Bearer '],
  ])('rejects a request with a %s', async (_label, header) => {
    const { context: ctx } = context(header);

    await expect(guard().canActivate(ctx)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('maps an expired token to UNAUTHENTICATED', async () => {
    verifyIdToken.mockRejectedValue(
      Object.assign(new Error('expired'), { code: 'auth/id-token-expired' }),
    );
    const { context: ctx } = context('Bearer token-1');

    await expect(guard().canActivate(ctx)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('maps a revoked token to TOKEN_REVOKED', async () => {
    verifyIdToken.mockRejectedValue(
      Object.assign(new Error('revoked'), { code: 'auth/id-token-revoked' }),
    );
    const { context: ctx } = context('Bearer token-1');

    await expect(guard().canActivate(ctx)).rejects.toMatchObject({ code: 'TOKEN_REVOKED' });
  });

  it('keeps AUTH_NOT_CONFIGURED as a server error instead of 401', async () => {
    verifyIdToken.mockRejectedValue(
      new DomainException('AUTH_NOT_CONFIGURED', 'yapılandırılmamış', 503),
    );
    const { context: ctx } = context('Bearer token-1');

    await expect(guard().canActivate(ctx)).rejects.toMatchObject({
      code: 'AUTH_NOT_CONFIGURED',
    });
  });

  describe('email verification', () => {
    it('rejects an unverified password user when the rule is on', async () => {
      verifyIdToken.mockResolvedValue({
        uid: 'uid-1',
        email_verified: false,
        firebase: { sign_in_provider: 'password' },
      });
      const { context: ctx } = context('Bearer token-1');

      await expect(guard(true).canActivate(ctx)).rejects.toMatchObject({
        code: 'EMAIL_NOT_VERIFIED',
      });
    });

    it('exempts Apple and Google sign-in', async () => {
      verifyIdToken.mockResolvedValue({
        uid: 'uid-1',
        email_verified: false,
        firebase: { sign_in_provider: 'apple.com' },
      });
      const { context: ctx } = context('Bearer token-1');

      await expect(guard(true).canActivate(ctx)).resolves.toBe(true);
    });

    it('allows an unverified user when the rule is off', async () => {
      verifyIdToken.mockResolvedValue({
        uid: 'uid-1',
        email_verified: false,
        firebase: { sign_in_provider: 'password' },
      });
      const { context: ctx } = context('Bearer token-1');

      await expect(guard(false).canActivate(ctx)).resolves.toBe(true);
    });
  });
});

import { HttpStatus, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { DomainException } from '../../common/errors/domain.exception';
import { FirebaseAdminService } from './firebase-admin.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { UsersService } from './users.service';
import type { AuthenticatedRequest } from './auth.types';

const PASSWORD_PROVIDER = 'password';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly firebase: FirebaseAdminService,
    private readonly users: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const idToken = this.bearerToken(request.headers.authorization);

    let decoded: DecodedIdToken;
    try {
      decoded = await this.firebase.verifyIdToken(idToken);
    } catch (error) {
      throw this.toAuthError(error);
    }

    this.assertEmailVerified(decoded);
    request.user = await this.users.provision(decoded);
    return true;
  }

  private bearerToken(header: string | undefined): string {
    const [scheme, token] = (header ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new DomainException(
        'UNAUTHENTICATED',
        'Bu işlem için oturum açmanız gerekiyor.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return token;
  }

  /**
   * Apple/Google token'ları sağlayıcı tarafından doğrulanmış sayılır; kural
   * yalnız e-posta/şifre için anlamlıdır.
   */
  private assertEmailVerified(decoded: DecodedIdToken): void {
    const required = this.configService.get<boolean>('AUTH_REQUIRE_EMAIL_VERIFIED', false);
    if (!required) return;
    if (decoded.firebase?.sign_in_provider !== PASSWORD_PROVIDER) return;
    if (decoded.email_verified) return;
    throw new DomainException(
      'EMAIL_NOT_VERIFIED',
      'Devam etmek için e-posta adresinizi doğrulayın.',
      HttpStatus.FORBIDDEN,
    );
  }

  private toAuthError(error: unknown): DomainException {
    // AUTH_NOT_CONFIGURED sunucu hatasıdır; 401'e çevrilirse istemci sonsuza
    // kadar yeniden giriş denemeye çalışır.
    if (error instanceof DomainException) return error;

    const code = this.firebaseErrorCode(error);
    if (code === 'auth/id-token-revoked' || code === 'auth/user-disabled') {
      return new DomainException(
        'TOKEN_REVOKED',
        'Oturumunuz sonlandırılmış. Lütfen yeniden giriş yapın.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return new DomainException(
      'UNAUTHENTICATED',
      'Oturum bilginiz geçersiz ya da süresi dolmuş.',
      HttpStatus.UNAUTHORIZED,
    );
  }

  private firebaseErrorCode(error: unknown): string | null {
    if (typeof error !== 'object' || error === null) return null;
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
}

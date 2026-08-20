import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { App } from 'firebase-admin/app';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { DomainException } from '../../common/errors/domain.exception';

const APP_NAME = 'tracora-api';

@Injectable()
export class FirebaseAdminService {
  private app?: App;

  constructor(private readonly configService: ConfigService) {}

  /**
   * checkRevoked=true: Firebase konsolundan iptal edilen ya da şifresi değişen
   * bir oturum, token'ın kalan ömrü boyunca geçerli kalmamalı.
   */
  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    // firebase-admin ESM bağımlılıkları taşır; dinamik import sayesinde SDK
    // yalnız gerçekten doğrulama yapılırken yüklenir.
    const { getAuth } = await import('firebase-admin/auth');
    return getAuth(await this.firebaseApp()).verifyIdToken(idToken, true);
  }

  /**
   * Kimlik bilgileri modül init'inde değil ilk doğrulamada okunur; böylece
   * Firebase yapılandırılmadan da uygulama ayağa kalkar (testler, `pnpm dev`)
   * ama korumalı bir uç sessizce açık kalmaz.
   */
  private async firebaseApp(): Promise<App> {
    if (this.app) return this.app;

    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID', '').trim();
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL', '').trim();
    // .env tek satır tutar; PEM'in gerçek satır sonlarına geri çevrilmesi gerekir.
    const privateKey = this.configService
      .get<string>('FIREBASE_PRIVATE_KEY', '')
      .trim()
      .replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new DomainException(
        'AUTH_NOT_CONFIGURED',
        'Kimlik doğrulama sunucu tarafında yapılandırılmamış.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const { cert, getApps, initializeApp } = await import('firebase-admin/app');
    const existing = getApps().find((app) => app.name === APP_NAME);
    this.app =
      existing ??
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, APP_NAME);
    return this.app;
  }
}

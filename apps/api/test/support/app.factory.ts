import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { User } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { FirebaseAdminService } from '../../src/modules/auth/firebase-admin.service';
import { CHANGEDETECTION_CLIENT } from '../../src/modules/changedetection/changedetection.types';
import type { ChangeDetectionClient } from '../../src/modules/changedetection/changedetection.types';
import { PrismaService } from '../../src/modules/database/prisma.service';
import { UrlSafetyService } from '../../src/modules/sites/url-safety.service';

export interface ApiResponse<T = unknown> {
  status: number;
  headers: Headers;
  body: T;
}

export interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  /** Hangi kullanıcı olarak istek atılacağı. `null` başlığı hiç göndermez. */
  as?: string | null;
}

export interface TestApi {
  app: INestApplication;
  prisma: PrismaService;
  changedetection: jest.Mocked<ChangeDetectionClient>;
  verifyIdToken: jest.Mock;
  request<T = unknown>(
    method: string,
    path: string,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>>;
  /** Guard'dan bağımsız olarak yerel kullanıcı satırını hazırlar. */
  user(uid?: string): Promise<User>;
  reset(): Promise<void>;
  close(): Promise<void>;
}

export const DEFAULT_UID = 'user-a';
export const SECOND_UID = 'user-b';

export function changeDetectionMock(): jest.Mocked<ChangeDetectionClient> {
  return {
    createWatch: jest.fn(),
    updateWatch: jest.fn(),
    deleteWatch: jest.fn(),
    triggerCheck: jest.fn(),
    getWatch: jest.fn(),
    listWatches: jest.fn(),
  };
}

/**
 * Gerçek Firebase'e çıkılmaz; `Bearer test:<uid>` biçimindeki token doğrulanmış
 * sayılır. Testler bu jest.fn'i yeniden programlayarak süresi geçmiş / iptal
 * edilmiş token davranışını taklit edebilir.
 */
function firebaseVerifierMock(): jest.Mock {
  return jest.fn((idToken: string) => {
    if (!idToken.startsWith('test:')) {
      return Promise.reject(
        Object.assign(new Error('invalid token'), { code: 'auth/argument-error' }),
      );
    }
    const uid = idToken.slice('test:'.length);
    return Promise.resolve({
      uid,
      email: `${uid}@example.com`,
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
    });
  });
}

/**
 * Gerçek AppModule'ü main.ts ile aynı yapılandırmayla ayağa kaldırır ve rastgele
 * bir portta dinletir. İstekler Node'un yerleşik fetch'i ile atılır; böylece
 * ValidationPipe, DomainExceptionFilter, request-id middleware ve interceptor
 * üretimdeki gibi devrededir.
 */
export async function createTestApi(): Promise<TestApi> {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl.includes('product_tracker_test')) {
    throw new Error('Integration tests only run against a product_tracker_test database.');
  }

  const changedetection = changeDetectionMock();
  const verifyIdToken = firebaseVerifierMock();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CHANGEDETECTION_CLIENT)
    .useValue(changedetection)
    // Testler dışarıya DNS/HTTP çıkmaz; URL güvenlik doğrulaması taklit edilir.
    .overrideProvider(UrlSafetyService)
    .useValue({ validateAndNormalize: (url: string) => Promise.resolve(new URL(url)) })
    .overrideProvider(FirebaseAdminService)
    .useValue({ verifyIdToken })
    .compile();

  const app = configureApp(moduleRef.createNestApplication());
  await app.init();
  await app.listen(0);

  const server = app.getHttpServer() as Server;
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;
  const prisma = app.get(PrismaService);

  return {
    app,
    prisma,
    changedetection,
    verifyIdToken,
    async request<T>(
      method: string,
      path: string,
      options: RequestOptions = {},
    ): Promise<ApiResponse<T>> {
      const uid = options.as === undefined ? DEFAULT_UID : options.as;
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(uid === null ? {} : { authorization: `Bearer test:${uid}` }),
          ...options.headers,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      const text = await response.text();
      return {
        status: response.status,
        headers: response.headers,
        body: (text ? JSON.parse(text) : null) as T,
      };
    },
    user(uid: string = DEFAULT_UID) {
      return prisma.user.upsert({
        where: { firebaseUid: uid },
        create: { firebaseUid: uid, email: `${uid}@example.com`, emailVerified: true },
        update: {},
      });
    },
    async reset() {
      jest.clearAllMocks();
      verifyIdToken.mockImplementation(firebaseVerifierMock().getMockImplementation()!);
      await prisma.eventLog.deleteMany();
      await prisma.product.deleteMany();
      await prisma.watch.deleteMany();
      await prisma.store.deleteMany();
      await prisma.user.deleteMany();
      await prisma.appSetting.deleteMany();
    },
    async close() {
      await app.close();
    },
  };
}

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { CHANGEDETECTION_CLIENT } from '../../src/modules/changedetection/changedetection.types';
import type { ChangeDetectionClient } from '../../src/modules/changedetection/changedetection.types';
import { PrismaService } from '../../src/modules/database/prisma.service';
import { UrlSafetyService } from '../../src/modules/sites/url-safety.service';

export interface ApiResponse<T = unknown> {
  status: number;
  headers: Headers;
  body: T;
}

export interface TestApi {
  app: INestApplication;
  prisma: PrismaService;
  changedetection: jest.Mocked<ChangeDetectionClient>;
  request<T = unknown>(
    method: string,
    path: string,
    options?: { body?: unknown; headers?: Record<string, string> },
  ): Promise<ApiResponse<T>>;
  reset(): Promise<void>;
  close(): Promise<void>;
}

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
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CHANGEDETECTION_CLIENT)
    .useValue(changedetection)
    // Testler dışarıya DNS/HTTP çıkmaz; URL güvenlik doğrulaması taklit edilir.
    .overrideProvider(UrlSafetyService)
    .useValue({ validateAndNormalize: (url: string) => Promise.resolve(new URL(url)) })
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
    async request<T>(
      method: string,
      path: string,
      options: { body?: unknown; headers?: Record<string, string> } = {},
    ): Promise<ApiResponse<T>> {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
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
    async reset() {
      jest.clearAllMocks();
      await prisma.eventLog.deleteMany();
      await prisma.product.deleteMany();
      await prisma.store.deleteMany();
      await prisma.appSetting.deleteMany();
    },
    async close() {
      await app.close();
    },
  };
}

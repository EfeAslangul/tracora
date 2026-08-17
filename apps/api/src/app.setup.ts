import { HttpStatus, INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import { DomainExceptionFilter } from './common/errors/domain-exception.filter';
import { DomainException } from './common/errors/domain.exception';
import { HttpLoggingInterceptor } from './common/logging/http-logging.interceptor';
import helmet from 'helmet';

/**
 * main.ts ve testler aynı yapılandırmayı paylaşır; aksi halde testler
 * gerçek davranışı değil kendi kurulumunu ölçer.
 */
export function configureApp(app: INestApplication): INestApplication {
  // Swagger UI inline script/style kullanır; varsayılan CSP onu kırar.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: process.env.WEB_BASE_URL ?? 'http://localhost:5173' });
  app.useGlobalFilters(new DomainExceptionFilter());
  app.useGlobalInterceptors(new HttpLoggingInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors: ValidationError[]) =>
        new DomainException(
          'INVALID_REQUEST',
          'İstek alanları geçerli değil.',
          HttpStatus.BAD_REQUEST,
          {
            fields: errors.map((error) => ({
              field: error.property,
              rules: error.constraints ?? {},
            })),
          },
        ),
    }),
  );
  return app;
}

import { HttpStatus, ValidationError, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DomainExceptionFilter } from './common/errors/domain-exception.filter';
import { DomainException } from './common/errors/domain.exception';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: process.env.WEB_BASE_URL ?? 'http://localhost:5173' });
  app.useGlobalFilters(new DomainExceptionFilter());
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

  const config = new DocumentBuilder().setTitle('Product Tracker API').setVersion('0.1.0').build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();

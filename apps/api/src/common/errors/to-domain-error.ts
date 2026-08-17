import { HttpStatus } from '@nestjs/common';
import { ChangeDetectionClientError } from '../../modules/changedetection/changedetection.errors';
import { DomainException } from './domain.exception';

export const toDomainError = (error: unknown, fallbackCode: string): DomainException => {
  if (error instanceof DomainException) return error;
  if (error instanceof ChangeDetectionClientError) {
    return new DomainException(
      error.code,
      error.message,
      error.status === 429 ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.BAD_GATEWAY,
    );
  }
  return new DomainException(fallbackCode, 'Ürün takibi başlatılamadı.', HttpStatus.BAD_GATEWAY);
};

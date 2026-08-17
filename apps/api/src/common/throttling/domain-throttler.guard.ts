import { HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DomainException } from '../errors/domain.exception';

/**
 * Ham ThrottlerException catch-all filtreden `REQUEST_FAILED` olarak çıkardı;
 * sözleşmedeki `RATE_LIMITED` kodunu korumak için domain hatasına çevrilir.
 */
@Injectable()
export class DomainThrottlerGuard extends ThrottlerGuard {
  protected throwThrottlingException(): Promise<void> {
    throw new DomainException(
      'RATE_LIMITED',
      'Çok fazla istek gönderildi. Lütfen biraz bekleyin.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

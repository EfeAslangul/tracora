import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiHeader, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DomainException } from '../../common/errors/domain.exception';
import { Public } from '../auth/public.decorator';
import { ChangedetectionObservationDto } from './dto/changedetection-observation.dto';
import { ObservationService } from './observation.service';

@ApiTags('webhooks')
// changedetection.io kullanıcı oturumu taşıyamaz; kimlik doğrulaması
// x-webhook-secret ile bu controller'ın içinde yapılır.
@Public()
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly configService: ConfigService,
    private readonly observationService: ObservationService,
  ) {}

  @Post('changedetection')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiHeader({ name: 'x-webhook-secret', required: true })
  @ApiNoContentResponse({ description: 'Observation accepted or previously processed.' })
  async changedetection(
    @Headers('x-webhook-secret') providedSecret: string | undefined,
    @Body() payload: ChangedetectionObservationDto,
  ): Promise<void> {
    this.assertSecret(providedSecret);
    await this.observationService.process({
      eventId: payload.eventId,
      watchId: payload.watchId,
      observedAt: new Date(payload.observedAt * 1_000),
      price: payload.observation.price,
      currency: payload.observation.currency,
      inStock: payload.observation.inStock ?? null,
    });
  }

  private assertSecret(providedSecret: string | undefined): void {
    const expected = this.configService.get<string>('CHANGEDETECTION_WEBHOOK_SECRET', '');
    const expectedHash = createHash('sha256').update(expected).digest();
    const providedHash = createHash('sha256')
      .update(providedSecret ?? '')
      .digest();
    if (!expected || !providedSecret || !timingSafeEqual(expectedHash, providedHash)) {
      throw new DomainException(
        'INVALID_WEBHOOK_SECRET',
        'Webhook kimlik doğrulaması başarısız.',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}

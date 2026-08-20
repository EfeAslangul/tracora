import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { DomainException } from '../../common/errors/domain.exception';
import { PrismaService } from '../database/prisma.service';
import { TelegramGateway } from '../notifications/telegram.gateway';
import type { ProductListItem } from '../products/product.presenter';
import { ProductsService } from '../products/products.service';
import type { SetupDto } from './dto/setup.dto';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly configService: ConfigService,
    private readonly telegram: TelegramGateway,
  ) {}

  /**
   * Onboarding artık global bir AppSetting değil kullanıcı alanıdır: her
   * kullanıcı kendi ilk kurulumunu yapar.
   */
  status(user: User) {
    const completedAt = user.onboardingCompletedAt?.toISOString() ?? null;
    const telegramConfigured = this.telegram.hasToken() && user.telegramChatId !== null;

    return {
      required: completedAt === null,
      completedAt,
      defaultCheckIntervalSeconds: this.configService.get<number>('CHECK_INTERVAL_SECONDS', 86_400),
      telegram: {
        configured: telegramConfigured,
        status: telegramConfigured ? 'ready' : 'not_configured',
      },
    };
  }

  async setup(user: User, input: SetupDto) {
    if (user.onboardingCompletedAt !== null) {
      throw new DomainException(
        'SETUP_ALREADY_COMPLETED',
        'İlk kurulum daha önce tamamlanmış.',
        HttpStatus.CONFLICT,
      );
    }

    const created: ProductListItem[] = [];
    const failed: Array<{ url: string; code: string; message: string }> = [];
    for (const product of input.products) {
      try {
        created.push(await this.productsService.create(user.id, product));
      } catch (error) {
        const failure =
          error instanceof DomainException
            ? error
            : new DomainException(
                'WATCH_CREATE_FAILED',
                'Takip başlatılamadı.',
                HttpStatus.BAD_GATEWAY,
              );
        failed.push({ url: product.url, code: failure.code, message: failure.message });
      }
    }

    if (created.length === 0) {
      throw new DomainException(
        'SETUP_HAS_NO_SUCCESSFUL_PRODUCT',
        'Hiçbir ürün için takip başlatılamadı.',
        HttpStatus.UNPROCESSABLE_ENTITY,
        { failed },
      );
    }

    const completedAt = new Date();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { onboardingCompletedAt: completedAt },
    });

    return { completed: true, completedAt: completedAt.toISOString(), created, failed };
  }
}

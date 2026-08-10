import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainException } from '../../common/errors/domain.exception';
import { PrismaService } from '../database/prisma.service';
import type { ProductListItem } from '../products/product.presenter';
import { ProductsService } from '../products/products.service';
import type { SetupDto } from './dto/setup.dto';

const ONBOARDING_KEY = 'onboarding.completedAt';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly configService: ConfigService,
  ) {}

  async status() {
    const setting = await this.prisma.appSetting.findUnique({ where: { key: ONBOARDING_KEY } });
    const completedAt = this.readCompletedAt(setting?.value);
    const telegramEnabled = this.configService.get<boolean>('TELEGRAM_ENABLED', true);
    const telegramConfigured =
      telegramEnabled &&
      Boolean(this.configService.get<string>('TELEGRAM_BOT_TOKEN', '').trim()) &&
      Boolean(this.configService.get<string>('TELEGRAM_CHAT_ID', '').trim());

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

  async setup(input: SetupDto) {
    const current = await this.status();
    if (!current.required) {
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
        created.push(await this.productsService.create(product));
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

    const completedAt = new Date().toISOString();
    await this.prisma.appSetting.upsert({
      where: { key: ONBOARDING_KEY },
      create: { key: ONBOARDING_KEY, value: { completedAt } },
      update: { value: { completedAt } },
    });

    return { completed: true, completedAt, created, failed };
  }

  private readCompletedAt(value: unknown): string | null {
    if (typeof value !== 'object' || value === null || !('completedAt' in value)) return null;
    const completedAt = (value as { completedAt?: unknown }).completedAt;
    return typeof completedAt === 'string' ? completedAt : null;
  }
}

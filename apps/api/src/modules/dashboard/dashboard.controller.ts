import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOkResponse({
    description: 'Product counters and recent price drops.',
    schema: {
      example: {
        totalProducts: 8,
        activeProducts: 6,
        failedProducts: 1,
        recentPriceDrops: [
          {
            id: 'uuid',
            name: 'Example product',
            url: 'https://shop.example/product',
            hostname: 'shop.example',
            currency: 'TRY',
            previousPrice: 2299.9,
            currentPrice: 1999.9,
            dropAmount: 300,
            dropPercent: 13.04,
            observedAt: '2026-08-10T12:00:00Z',
          },
        ],
      },
    },
  })
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.summary(user.id);
  }
}

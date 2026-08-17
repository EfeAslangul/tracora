import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
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
  summary() {
    return this.dashboardService.summary();
  }
}

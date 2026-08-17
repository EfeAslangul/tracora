import { Injectable } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

const RECENT_DROP_LIMIT = 5;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [totalProducts, activeProducts, failedProducts, drops] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
      this.prisma.product.count({ where: { status: ProductStatus.FAILED } }),
      this.prisma.product.findMany({
        where: {
          previousPrice: { not: null },
          currentPrice: { not: null, lt: this.prisma.product.fields.previousPrice },
        },
        include: { store: true },
        orderBy: { lastSuccessfulCheckAt: 'desc' },
        take: RECENT_DROP_LIMIT,
      }),
    ]);

    return {
      totalProducts,
      activeProducts,
      failedProducts,
      recentPriceDrops: drops.map((product) => {
        const previous = product.previousPrice!.toNumber();
        const current = product.currentPrice!.toNumber();
        return {
          id: product.id,
          name: product.name,
          url: product.url,
          hostname: product.store.hostname,
          currency: product.currency,
          previousPrice: previous,
          currentPrice: current,
          dropAmount: Number((previous - current).toFixed(4)),
          dropPercent:
            previous === 0 ? null : Number((((previous - current) / previous) * 100).toFixed(2)),
          observedAt: product.lastSuccessfulCheckAt,
        };
      }),
    };
  }
}

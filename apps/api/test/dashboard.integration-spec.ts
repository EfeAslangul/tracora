import { ProductStatus } from '@prisma/client';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { PrismaService } from '../src/modules/database/prisma.service';

describe('DashboardService integration', () => {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl.includes('product_tracker_test')) {
    throw new Error('Integration tests only run against a product_tracker_test database.');
  }

  const prisma = new PrismaService();
  const service = new DashboardService(prisma);

  beforeAll(() => prisma.$connect());
  afterAll(() => prisma.$disconnect());
  beforeEach(async () => {
    await prisma.product.deleteMany();
    await prisma.store.deleteMany();
  });

  async function seed(
    slug: string,
    data: {
      status?: ProductStatus;
      currentPrice?: number;
      previousPrice?: number;
      checkedAt?: Date;
    },
  ) {
    const store = await prisma.store.create({
      data: { hostname: `${slug}.example`, name: `${slug}.example` },
    });
    return prisma.product.create({
      data: {
        storeId: store.id,
        name: slug,
        url: `https://${slug}.example/product`,
        normalizedUrl: `https://${slug}.example/product`,
        status: data.status ?? ProductStatus.ACTIVE,
        currency: 'TRY',
        currentPrice: data.currentPrice,
        previousPrice: data.previousPrice,
        lastSuccessfulCheckAt: data.checkedAt,
      },
    });
  }

  it('counts products by status', async () => {
    await seed('a', {});
    await seed('b', { status: ProductStatus.FAILED });
    await seed('c', { status: ProductStatus.PAUSED });

    const summary = await service.summary();

    expect(summary).toMatchObject({ totalProducts: 3, activeProducts: 1, failedProducts: 1 });
  });

  it('returns only real price drops, newest first', async () => {
    await seed('drop', {
      previousPrice: 2299.9,
      currentPrice: 1999.9,
      checkedAt: new Date('2026-08-10T12:00:00Z'),
    });
    await seed('older', {
      previousPrice: 200,
      currentPrice: 100,
      checkedAt: new Date('2026-08-01T12:00:00Z'),
    });
    await seed('rise', {
      previousPrice: 100,
      currentPrice: 150,
      checkedAt: new Date('2026-08-11T12:00:00Z'),
    });
    await seed('baseline', { currentPrice: 100 });

    const summary = await service.summary();

    expect(summary.recentPriceDrops.map((drop) => drop.name)).toEqual(['drop', 'older']);
    expect(summary.recentPriceDrops[0]).toMatchObject({
      previousPrice: 2299.9,
      currentPrice: 1999.9,
      dropAmount: 300,
      dropPercent: 13.04,
      hostname: 'drop.example',
    });
  });
});

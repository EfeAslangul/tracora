import { HttpStatus, Injectable } from '@nestjs/common';
import { NotificationType, Prisma, ProductStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { DomainException } from '../../common/errors/domain.exception';
import { PrismaService } from '../database/prisma.service';
import type { ProductObservation } from './observation.types';

interface NotificationPayload extends Prisma.JsonObject {
  productName: string;
  productUrl: string;
  previousPrice?: number;
  currentPrice?: number;
  currency?: string;
  targetPrice?: number;
  inStock?: boolean;
}

export interface ObservationResult {
  processed: number;
  duplicates: number;
}

type ProductWithOwner = Prisma.ProductGetPayload<{
  include: { store: true; user: { select: { telegramChatId: true } } };
}>;

@Injectable()
export class ObservationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Bir watch birden çok kullanıcının ürününe bağlı olabilir; tek gözlem
   * hepsine uygulanır. Tekillik ürün başına (`productId + sourceEventKey`)
   * olduğu için aynı webhook'un yeniden teslimi yine idempotenttir.
   */
  async process(observation: ProductObservation): Promise<ObservationResult> {
    const watch = await this.prisma.watch.findUnique({
      where: { externalWatchId: observation.watchId },
      select: { id: true },
    });
    if (!watch) {
      throw new DomainException(
        'WATCH_NOT_FOUND',
        'Webhook için ürün eşleşmesi bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    const nextPrice = new Prisma.Decimal(observation.price);
    if (nextPrice.isNegative()) {
      throw new DomainException(
        'INVALID_WEBHOOK_PAYLOAD',
        'Fiyat negatif olamaz.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const sourceEventKey = this.eventKey(observation);
    return this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { watchId: watch.id },
        include: { store: true, user: { select: { telegramChatId: true } } },
      });

      // Sahibi kalmamış watch: 404 dönmek changedetection'ı sonsuz yeniden
      // denemeye sokar. Olay kaydedilir, reconciliation watch'ı temizler.
      if (products.length === 0) {
        await tx.eventLog.create({
          data: {
            type: 'ORPHANED_WATCH',
            code: 'ORPHANED_WATCH',
            message: 'Webhook artık hiçbir ürüne bağlı olmayan bir watch için geldi.',
            metadata: { externalWatchId: observation.watchId },
          },
        });
        return { processed: 0, duplicates: 0 };
      }

      let processed = 0;
      let duplicates = 0;
      for (const product of products) {
        const applied = await this.applyObservation(
          tx,
          product,
          observation,
          nextPrice,
          sourceEventKey,
        );
        if (applied) processed += 1;
        else duplicates += 1;
      }
      return { processed, duplicates };
    });
  }

  private async applyObservation(
    tx: Prisma.TransactionClient,
    product: ProductWithOwner,
    observation: ProductObservation,
    nextPrice: Prisma.Decimal,
    sourceEventKey: string,
  ): Promise<boolean> {
    const key = { productId_sourceEventKey: { productId: product.id, sourceEventKey } };
    const [priceEvent, stockEvent] = await Promise.all([
      tx.priceSnapshot.findUnique({ where: key, select: { id: true } }),
      tx.stockSnapshot.findUnique({ where: key, select: { id: true } }),
    ]);
    if (priceEvent || stockEvent) return false;

    if (product.currency && product.currency !== observation.currency) {
      await tx.product.update({
        where: { id: product.id },
        data: {
          status: ProductStatus.FAILED,
          lastCheckedAt: observation.observedAt,
          lastErrorCode: 'CURRENCY_CHANGED',
          lastErrorMessage: 'Ürünün para birimi beklenmedik biçimde değişti.',
        },
      });
      await tx.eventLog.create({
        data: {
          productId: product.id,
          type: 'EXTRACTION_ERROR',
          code: 'CURRENCY_CHANGED',
          message: 'Webhook para birimi mevcut ürün para birimiyle eşleşmedi.',
          metadata: { expected: product.currency, received: observation.currency },
        },
      });
      return true;
    }

    const isBaseline = product.currentPrice === null;
    const priceChanged = isBaseline || !product.currentPrice?.equals(nextPrice);
    const stockChanged = observation.inStock !== null && product.inStock !== observation.inStock;
    if (!priceChanged && !stockChanged) {
      await tx.product.update({
        where: { id: product.id },
        data: {
          lastCheckedAt: observation.observedAt,
          lastSuccessfulCheckAt: observation.observedAt,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });
      return true;
    }

    if (priceChanged) {
      await tx.priceSnapshot.create({
        data: {
          productId: product.id,
          price: nextPrice,
          currency: observation.currency,
          observedAt: observation.observedAt,
          sourceEventKey,
        },
      });
    }
    if (stockChanged && observation.inStock !== null) {
      await tx.stockSnapshot.create({
        data: {
          productId: product.id,
          inStock: observation.inStock,
          observedAt: observation.observedAt,
          sourceEventKey,
        },
      });
    }

    await tx.product.update({
      where: { id: product.id },
      data: {
        // Duraklatılmış ürün, yolda olan bir webhook ile ACTIVE'e dönmemeli.
        status: product.status === ProductStatus.PAUSED ? undefined : ProductStatus.ACTIVE,
        previousPrice:
          priceChanged && product.currentPrice !== null ? product.currentPrice : undefined,
        currentPrice: priceChanged ? nextPrice : undefined,
        currency: observation.currency,
        inStock: observation.inStock ?? undefined,
        lastCheckedAt: observation.observedAt,
        lastSuccessfulCheckAt: observation.observedAt,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });

    // Chat id'si olmayan kullanıcı için kalıcı olarak başarısız olacak bir
    // outbox satırı üretmenin anlamı yok.
    const deliverable =
      product.notificationsEnabled && !isBaseline && product.user.telegramChatId !== null;
    if (deliverable) {
      const deliveries = this.deliveries(
        product,
        observation,
        nextPrice,
        priceChanged,
        stockChanged,
        sourceEventKey,
      );
      if (deliveries.length > 0) {
        await tx.notificationDelivery.createMany({ data: deliveries, skipDuplicates: true });
      }
    }

    return true;
  }

  private deliveries(
    product: ProductWithOwner,
    observation: ProductObservation,
    nextPrice: Prisma.Decimal,
    priceChanged: boolean,
    stockChanged: boolean,
    sourceEventKey: string,
  ): Prisma.NotificationDeliveryCreateManyInput[] {
    const result: Prisma.NotificationDeliveryCreateManyInput[] = [];
    const basePayload: NotificationPayload = {
      productName: product.name ?? product.store.hostname,
      productUrl: product.url,
      currentPrice: nextPrice.toNumber(),
      currency: observation.currency,
      ...(product.currentPrice ? { previousPrice: product.currentPrice.toNumber() } : {}),
      ...(product.targetPrice ? { targetPrice: product.targetPrice.toNumber() } : {}),
    };

    if (priceChanged && product.currentPrice) {
      const targetReached =
        product.targetPrice !== null &&
        product.currentPrice.greaterThan(product.targetPrice) &&
        nextPrice.lessThanOrEqualTo(product.targetPrice);
      result.push({
        productId: product.id,
        sourceEventKey,
        type: targetReached ? NotificationType.TARGET_REACHED : NotificationType.PRICE_CHANGED,
        payload: basePayload,
      });
    }
    if (stockChanged && product.inStock === false && observation.inStock === true) {
      result.push({
        productId: product.id,
        sourceEventKey,
        type: NotificationType.RESTOCKED,
        payload: { ...basePayload, inStock: true },
      });
    }
    return result;
  }

  private eventKey(observation: ProductObservation): string {
    const raw =
      observation.eventId ??
      JSON.stringify({
        watchId: observation.watchId,
        observedAt: observation.observedAt.toISOString(),
        price: observation.price,
        currency: observation.currency,
        inStock: observation.inStock,
      });
    return createHash('sha256').update(raw).digest('hex');
  }
}

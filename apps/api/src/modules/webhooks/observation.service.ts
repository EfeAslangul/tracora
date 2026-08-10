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

type ProductWithStore = Prisma.ProductGetPayload<{ include: { store: true } }>;

@Injectable()
export class ObservationService {
  constructor(private readonly prisma: PrismaService) {}

  async process(observation: ProductObservation): Promise<{ duplicate: boolean }> {
    const binding = await this.prisma.watchBinding.findUnique({
      where: { externalWatchId: observation.watchId },
      include: { product: { include: { store: true } } },
    });
    if (!binding) {
      throw new DomainException(
        'WATCH_NOT_FOUND',
        'Webhook için ürün eşleşmesi bulunamadı.',
        HttpStatus.NOT_FOUND,
      );
    }

    const sourceEventKey = this.eventKey(observation);
    return this.prisma.$transaction(async (tx) => {
      const [priceEvent, stockEvent] = await Promise.all([
        tx.priceSnapshot.findUnique({ where: { sourceEventKey }, select: { id: true } }),
        tx.stockSnapshot.findUnique({ where: { sourceEventKey }, select: { id: true } }),
      ]);
      if (priceEvent || stockEvent) return { duplicate: true };

      const product = await tx.product.findUnique({
        where: { id: binding.productId },
        include: { store: true },
      });
      if (!product) {
        throw new DomainException('PRODUCT_NOT_FOUND', 'Ürün bulunamadı.', HttpStatus.NOT_FOUND);
      }

      const nextPrice = new Prisma.Decimal(observation.price);
      if (nextPrice.isNegative()) {
        throw new DomainException(
          'INVALID_WEBHOOK_PAYLOAD',
          'Fiyat negatif olamaz.',
          HttpStatus.BAD_REQUEST,
        );
      }
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
        return { duplicate: false };
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
        return { duplicate: false };
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
          status: ProductStatus.ACTIVE,
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

      if (product.notificationsEnabled && !isBaseline) {
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

      return { duplicate: false };
    });
  }

  private deliveries(
    product: ProductWithStore,
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

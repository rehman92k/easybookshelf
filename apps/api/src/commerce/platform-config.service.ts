import { Injectable } from '@nestjs/common';
import { Prisma } from '@easybookshelf/database';
import { PrismaService } from '../prisma/prisma.service';

export interface CommercePlatformSettings {
  purchaseCommissionRate: number;
  rentalCommissionRate: number;
  subscriberPurchaseDiscountRate: number;
  currency: string;
  minBookPrice: number;
  maxBookPrice: number;
  minRentalPrice: number;
  maxRentalPrice: number;
}

const DEFAULTS: CommercePlatformSettings = {
  purchaseCommissionRate: 0.15,
  rentalCommissionRate: 0.1,
  subscriberPurchaseDiscountRate: 0.1,
  currency: 'INR',
  minBookPrice: 9,
  maxBookPrice: 9999,
  minRentalPrice: 9,
  maxRentalPrice: 999,
};

@Injectable()
export class PlatformConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getCommerceSettings(): Promise<CommercePlatformSettings> {
    const rows = await this.prisma.platformConfig.findMany({
      where: {
        key: {
          in: [
            'purchase_commission_rate',
            'rental_commission_rate',
            'default_commission_rate',
            'subscriber_purchase_discount_rate',
            'default_currency',
            'min_book_price',
            'max_book_price',
            'min_rental_price',
            'max_rental_price',
          ],
        },
      },
    });

    const map = new Map(rows.map((row) => [row.key, row.value]));
    const rentalFallback = readNumber(map.get('rental_commission_rate'))
      ?? readNumber(map.get('default_commission_rate'))
      ?? DEFAULTS.rentalCommissionRate;

    return {
      purchaseCommissionRate:
        readNumber(map.get('purchase_commission_rate')) ?? DEFAULTS.purchaseCommissionRate,
      rentalCommissionRate: rentalFallback,
      subscriberPurchaseDiscountRate:
        readNumber(map.get('subscriber_purchase_discount_rate'))
        ?? DEFAULTS.subscriberPurchaseDiscountRate,
      currency: readString(map.get('default_currency')) ?? DEFAULTS.currency,
      minBookPrice: readNumber(map.get('min_book_price')) ?? DEFAULTS.minBookPrice,
      maxBookPrice: readNumber(map.get('max_book_price')) ?? DEFAULTS.maxBookPrice,
      minRentalPrice: readNumber(map.get('min_rental_price')) ?? DEFAULTS.minRentalPrice,
      maxRentalPrice: readNumber(map.get('max_rental_price')) ?? DEFAULTS.maxRentalPrice,
    };
  }

  async updateCommerceSettings(
    input: Partial<CommercePlatformSettings>,
  ): Promise<CommercePlatformSettings> {
    const updates: Array<{ key: string; value: Prisma.InputJsonValue }> = [];

    if (input.purchaseCommissionRate !== undefined) {
      updates.push({ key: 'purchase_commission_rate', value: input.purchaseCommissionRate });
    }
    if (input.rentalCommissionRate !== undefined) {
      updates.push({ key: 'rental_commission_rate', value: input.rentalCommissionRate });
    }
    if (input.subscriberPurchaseDiscountRate !== undefined) {
      updates.push({
        key: 'subscriber_purchase_discount_rate',
        value: input.subscriberPurchaseDiscountRate,
      });
    }
    if (input.currency !== undefined) {
      updates.push({ key: 'default_currency', value: input.currency });
    }
    if (input.minBookPrice !== undefined) {
      updates.push({ key: 'min_book_price', value: input.minBookPrice });
    }
    if (input.maxBookPrice !== undefined) {
      updates.push({ key: 'max_book_price', value: input.maxBookPrice });
    }
    if (input.minRentalPrice !== undefined) {
      updates.push({ key: 'min_rental_price', value: input.minRentalPrice });
    }
    if (input.maxRentalPrice !== undefined) {
      updates.push({ key: 'max_rental_price', value: input.maxRentalPrice });
    }

    for (const row of updates) {
      await this.prisma.platformConfig.upsert({
        where: { key: row.key },
        update: { value: row.value },
        create: { key: row.key, value: row.value },
      });
    }

    return this.getCommerceSettings();
  }

  /** @deprecated Use getCommerceSettings().rentalCommissionRate */
  async getDefaultCommissionRate(): Promise<number> {
    const settings = await this.getCommerceSettings();
    return settings.rentalCommissionRate;
  }

  async getDefaultCurrency(): Promise<string> {
    const settings = await this.getCommerceSettings();
    return settings.currency;
  }

  async getCommissionRateForOrderType(type: 'purchase' | 'rental_15' | 'rental_30') {
    const settings = await this.getCommerceSettings();
    return type === 'purchase' ? settings.purchaseCommissionRate : settings.rentalCommissionRate;
  }

  async getSubscriberPurchaseDiscountRate(): Promise<number> {
    const settings = await this.getCommerceSettings();
    return settings.subscriberPurchaseDiscountRate;
  }
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

import { BadRequestException } from '@nestjs/common';
import { OrderItemType } from '@easybookshelf/database';

export const DEFAULT_RENTAL_PERIOD_DAYS: [number, number] = [15, 30];

export interface BookPriceRow {
  purchasePrice: { toNumber?: () => number } | number | string;
  rental15Price: { toNumber?: () => number } | number | string;
  rental30Price: { toNumber?: () => number } | number | string;
  currency: string;
}

export interface RentalPriceOption {
  days: number;
  price: number;
}

export function parseRentalPeriodDays(value: unknown): [number, number] {
  if (Array.isArray(value) && value.length === 2) {
    const first = Number(value[0]);
    const second = Number(value[1]);
    if (
      Number.isInteger(first) &&
      Number.isInteger(second) &&
      first > 0 &&
      second > 0 &&
      first < second
    ) {
      return [first, second];
    }
  }
  return DEFAULT_RENTAL_PERIOD_DAYS;
}

export function isRentalOrderType(type: OrderItemType): boolean {
  return (
    type === OrderItemType.rental ||
    type === OrderItemType.rental_15 ||
    type === OrderItemType.rental_30
  );
}

export function resolveRentalDays(
  type: OrderItemType,
  rentalDays?: number | null,
  periodDays: [number, number] = DEFAULT_RENTAL_PERIOD_DAYS,
): number | null {
  if (type === OrderItemType.purchase) return null;
  if (type === OrderItemType.rental_15) return 15;
  if (type === OrderItemType.rental_30) return 30;
  if (type === OrderItemType.rental && rentalDays) return rentalDays;
  if (rentalDays) return rentalDays;
  if (type === OrderItemType.rental) {
    throw new BadRequestException({
      code: 'RENTAL_DAYS_REQUIRED',
      message: 'Rental days are required for rental orders',
    });
  }
  return periodDays[0];
}

export function buildBookRentals(
  price: Pick<BookPriceRow, 'rental15Price' | 'rental30Price'>,
  periodDays: [number, number] = DEFAULT_RENTAL_PERIOD_DAYS,
): RentalPriceOption[] {
  return [
    { days: periodDays[0], price: toNumber(price.rental15Price) },
    { days: periodDays[1], price: toNumber(price.rental30Price) },
  ];
}

export function serializeBookPrice(
  price: BookPriceRow | undefined,
  periodDays: [number, number] = DEFAULT_RENTAL_PERIOD_DAYS,
) {
  if (!price) return null;
  const rentals = buildBookRentals(price, periodDays);
  return {
    purchasePrice: toNumber(price.purchasePrice),
    rentals,
    rental15Price: rentals[0]?.price ?? toNumber(price.rental15Price),
    rental30Price: rentals[1]?.price ?? toNumber(price.rental30Price),
    currency: price.currency,
  };
}

export function resolveRentalUnitPrice(
  price: BookPriceRow,
  type: OrderItemType,
  rentalDays?: number | null,
  periodDays: [number, number] = DEFAULT_RENTAL_PERIOD_DAYS,
): number {
  if (type === OrderItemType.purchase) {
    return toNumber(price.purchasePrice);
  }

  const days = resolveRentalDays(type, rentalDays, periodDays);

  if (type === OrderItemType.rental_15) {
    return toNumber(price.rental15Price);
  }
  if (type === OrderItemType.rental_30) {
    return toNumber(price.rental30Price);
  }

  if (days === periodDays[0]) {
    return toNumber(price.rental15Price);
  }
  if (days === periodDays[1]) {
    return toNumber(price.rental30Price);
  }

  throw new BadRequestException({
    code: 'INVALID_RENTAL_DAYS',
    message: `Rental period must be ${periodDays[0]} or ${periodDays[1]} days`,
  });
}

export function assertValidRentalPeriodDays(days: [number, number]) {
  const [first, second] = days;
  if (
    !Number.isInteger(first) ||
    !Number.isInteger(second) ||
    first < 1 ||
    second < 1 ||
    first >= second ||
    first > 365 ||
    second > 365
  ) {
    throw new BadRequestException({
      code: 'INVALID_RENTAL_PERIOD_DAYS',
      message: 'Rental periods must be two ascending day values between 1 and 365',
    });
  }
}

export function mapRentalsToSlots(
  rentals: RentalPriceOption[],
  periodDays: [number, number],
): { rental15Price: number; rental30Price: number } {
  const byDays = new Map(rentals.map((rental) => [rental.days, rental.price]));
  const rental15Price = byDays.get(periodDays[0]);
  const rental30Price = byDays.get(periodDays[1]);

  if (rental15Price === undefined || rental30Price === undefined) {
    throw new BadRequestException({
      code: 'RENTAL_PRICES_REQUIRED',
      message: `Provide prices for ${periodDays[0]}-day and ${periodDays[1]}-day rentals`,
    });
  }

  return { rental15Price, rental30Price };
}

export function parseOrderItemTypeFromQuery(
  type?: string,
  days?: string,
): { type: OrderItemType; rentalDays?: number } {
  if (type === 'rental') {
    const rentalDays = Number(days);
    if (!Number.isInteger(rentalDays) || rentalDays < 1) {
      throw new BadRequestException({
        code: 'RENTAL_DAYS_REQUIRED',
        message: 'Query parameter days is required for rental orders',
      });
    }
    return { type: OrderItemType.rental, rentalDays };
  }
  if (type === 'rental_15') return { type: OrderItemType.rental_15 };
  if (type === 'rental_30') return { type: OrderItemType.rental_30 };
  return { type: OrderItemType.purchase };
}

function toNumber(value: { toNumber?: () => number } | number | string): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (value && typeof value.toNumber === 'function') return value.toNumber();
  return Number(value);
}

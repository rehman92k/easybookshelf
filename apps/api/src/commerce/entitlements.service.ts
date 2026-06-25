import { Injectable } from '@nestjs/common';
import {
  EntitlementStatus,
  EntitlementType,
  OrderItemType,
  Prisma,
} from '@easybookshelf/database';
import { PrismaService } from '../prisma/prisma.service';
import { isRentalOrderType, resolveRentalDays } from './rental-pricing';

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async hasActiveEntitlement(userId: string, bookId: string) {
    const entitlement = await this.prisma.entitlement.findFirst({
      where: {
        userId,
        bookId,
        status: EntitlementStatus.active,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    return Boolean(entitlement);
  }

  async assertCanPurchase(userId: string, bookId: string, type: OrderItemType) {
    const active = await this.prisma.entitlement.findMany({
      where: {
        userId,
        bookId,
        status: EntitlementStatus.active,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    const ownsBook = active.some((e) => e.type === EntitlementType.purchase);
    if (ownsBook) {
      return { allowed: false, reason: 'You already own this book' };
    }

    if (type === OrderItemType.purchase) {
      return { allowed: true };
    }

    if (!isRentalOrderType(type)) {
      return { allowed: true };
    }

    const activeRental = active.some((e) => e.type === EntitlementType.rental);
    if (activeRental) {
      return { allowed: false, reason: 'You already have an active rental for this book' };
    }

    return { allowed: true };
  }

  async grantFromOrderItem(
    tx: Prisma.TransactionClient,
    orderItem: {
      id: string;
      bookId: string;
      type: OrderItemType;
      rentalDays?: number | null;
    },
    userId: string,
  ) {
    const entitlementType =
      orderItem.type === OrderItemType.purchase
        ? EntitlementType.purchase
        : EntitlementType.rental;

    const rentalDays = resolveRentalDays(orderItem.type, orderItem.rentalDays);
    const expiresAt =
      rentalDays != null ? addDays(new Date(), rentalDays) : null;

    return tx.entitlement.create({
      data: {
        userId,
        bookId: orderItem.bookId,
        orderItemId: orderItem.id,
        type: entitlementType,
        status: EntitlementStatus.active,
        expiresAt,
      },
    });
  }

  async listLibrary(userId: string) {
    const entitlements = await this.prisma.entitlement.findMany({
      where: {
        userId,
        status: EntitlementStatus.active,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            slug: true,
            authorName: true,
            coverImageUrl: true,
            status: true,
          },
        },
        orderItem: {
          select: {
            unitPrice: true,
            listUnitPrice: true,
            type: true,
            order: { select: { currency: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const bookIds = entitlements.map((e) => e.bookId);
    const progressRows =
      bookIds.length > 0
        ? await this.prisma.readingProgress.findMany({
            where: { userId, bookId: { in: bookIds } },
          })
        : [];
    const progressByBook = new Map(progressRows.map((p) => [p.bookId, p]));

    return entitlements.map((entitlement) => {
      const progress = progressByBook.get(entitlement.bookId);
      const progressPercent =
        progress?.progressPercent !== undefined
          ? Number(progress.progressPercent)
          : null;

      return {
        entitlement: {
          id: entitlement.id,
          bookId: entitlement.bookId,
          type: entitlement.type,
          status: entitlement.status,
          startsAt: entitlement.startsAt.toISOString(),
          expiresAt: entitlement.expiresAt?.toISOString() ?? null,
        },
        book: {
          id: entitlement.book.id,
          title: entitlement.book.title,
          slug: entitlement.book.slug,
          authorName: entitlement.book.authorName,
          coverImageUrl: entitlement.book.coverImageUrl,
          status: entitlement.book.status,
        },
        underReview: entitlement.book.status === 'pending_review',
        pricePaid: {
          amount: Number(entitlement.orderItem.unitPrice),
          listAmount: Number(entitlement.orderItem.listUnitPrice),
          currency: entitlement.orderItem.order.currency,
        },
        progressPercent,
        lastReadAt: progress?.lastReadAt.toISOString() ?? null,
      };
    });
  }
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

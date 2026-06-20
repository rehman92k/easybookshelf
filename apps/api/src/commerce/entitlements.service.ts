import { Injectable } from '@nestjs/common';
import {
  BookStatus,
  EntitlementStatus,
  EntitlementType,
  OrderItemType,
  Prisma,
} from '@easybookshelf/database';
import { PrismaService } from '../prisma/prisma.service';

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
    },
    userId: string,
  ) {
    const entitlementType =
      orderItem.type === OrderItemType.purchase
        ? EntitlementType.purchase
        : EntitlementType.rental;

    const expiresAt =
      orderItem.type === OrderItemType.rental_15
        ? addDays(new Date(), 15)
        : orderItem.type === OrderItemType.rental_30
          ? addDays(new Date(), 30)
          : null;

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
        book: { status: BookStatus.approved },
      },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            slug: true,
            authorName: true,
            coverImageUrl: true,
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
        book: entitlement.book,
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

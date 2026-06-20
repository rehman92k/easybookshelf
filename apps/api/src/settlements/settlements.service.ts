import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, SettlementStatus } from '@easybookshelf/database';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateSettlementsDto } from './dto/generate-settlements.dto';

@Injectable()
export class SettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublisherEarnings(publisherId: string) {
    const [unsettled, settlements] = await Promise.all([
      this.sumUnsettledItems(publisherId),
      this.prisma.settlement.findMany({
        where: { publisherId },
        orderBy: { periodEnd: 'desc' },
      }),
    ]);

    const pendingPayout = settlements
      .filter((s) => s.status === SettlementStatus.pending || s.status === SettlementStatus.processing)
      .reduce((sum, s) => sum + Number(s.netAmount), 0);

    const totalPaid = settlements
      .filter((s) => s.status === SettlementStatus.paid)
      .reduce((sum, s) => sum + Number(s.netAmount), 0);

    return {
      unsettledSales: unsettled.grossAmount,
      unsettledEarnings: unsettled.netAmount,
      unsettledOrderCount: unsettled.orderCount,
      pendingPayout: roundMoney(pendingPayout),
      totalPaid: roundMoney(totalPaid),
      currency: 'INR',
    };
  }

  async listPublisherSettlements(publisherId: string) {
    const rows = await this.prisma.settlement.findMany({
      where: { publisherId },
      orderBy: { periodEnd: 'desc' },
      include: { publisher: { select: { name: true, slug: true } } },
    });
    return rows.map((row) => this.mapSettlement(row));
  }

  async listSettlements(params?: { publisherId?: string; status?: SettlementStatus }) {
    const rows = await this.prisma.settlement.findMany({
      where: {
        publisherId: params?.publisherId,
        status: params?.status,
      },
      orderBy: { createdAt: 'desc' },
      include: { publisher: { select: { id: true, name: true, slug: true } } },
    });
    return rows.map((row) => this.mapSettlement(row));
  }

  async generate(dto: GenerateSettlementsDto) {
    const periodStart = parseDate(dto.periodStart);
    const periodEnd = endOfDay(parseDate(dto.periodEnd));

    if (periodEnd < periodStart) {
      throw new BadRequestException({
        code: 'INVALID_PERIOD',
        message: 'periodEnd must be on or after periodStart',
      });
    }

    const items = await this.prisma.orderItem.findMany({
      where: {
        settlementId: null,
        publisherId: dto.publisherId,
        order: {
          status: OrderStatus.paid,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
      },
      select: {
        id: true,
        publisherId: true,
        listUnitPrice: true,
        platformCommission: true,
        publisherAmount: true,
      },
    });

    if (items.length === 0) {
      return { created: [], message: 'No unsettled paid orders in this period' };
    }

    const byPublisher = new Map<
      string,
      { itemIds: string[]; gross: number; commission: number; net: number }
    >();

    for (const item of items) {
      const gross = Number(item.listUnitPrice);
      const commission = Number(item.platformCommission);
      const net = Number(item.publisherAmount);
      const bucket = byPublisher.get(item.publisherId) ?? {
        itemIds: [],
        gross: 0,
        commission: 0,
        net: 0,
      };
      bucket.itemIds.push(item.id);
      bucket.gross += gross;
      bucket.commission += commission;
      bucket.net += net;
      byPublisher.set(item.publisherId, bucket);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const [publisherId, bucket] of byPublisher) {
        const settlement = await tx.settlement.create({
          data: {
            publisherId,
            periodStart,
            periodEnd,
            grossAmount: roundMoney(bucket.gross),
            platformCommission: roundMoney(bucket.commission),
            netAmount: roundMoney(bucket.net),
            status: SettlementStatus.pending,
          },
          include: { publisher: { select: { id: true, name: true, slug: true } } },
        });

        await tx.orderItem.updateMany({
          where: { id: { in: bucket.itemIds } },
          data: { settlementId: settlement.id },
        });

        results.push(this.mapSettlement(settlement));
      }
      return results;
    });

    return { created, count: created.length };
  }

  async markPaid(settlementId: string) {
    const existing = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
      include: { publisher: { select: { id: true, name: true, slug: true } } },
    });

    if (!existing) {
      throw new NotFoundException({ code: 'SETTLEMENT_NOT_FOUND', message: 'Settlement not found' });
    }

    if (existing.status === SettlementStatus.paid) {
      return this.mapSettlement(existing);
    }

    const updated = await this.prisma.settlement.update({
      where: { id: settlementId },
      data: { status: SettlementStatus.paid, paidAt: new Date() },
      include: { publisher: { select: { id: true, name: true, slug: true } } },
    });

    return this.mapSettlement(updated);
  }

  private async sumUnsettledItems(publisherId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        publisherId,
        settlementId: null,
        order: { status: OrderStatus.paid },
      },
      select: { listUnitPrice: true, publisherAmount: true },
    });

    return {
      grossAmount: roundMoney(items.reduce((sum, i) => sum + Number(i.listUnitPrice), 0)),
      netAmount: roundMoney(items.reduce((sum, i) => sum + Number(i.publisherAmount), 0)),
      orderCount: items.length,
    };
  }

  private mapSettlement(row: {
    id: string;
    publisherId: string;
    periodStart: Date;
    periodEnd: Date;
    grossAmount: { toString(): string };
    platformCommission: { toString(): string };
    netAmount: { toString(): string };
    status: SettlementStatus;
    paidAt: Date | null;
    createdAt: Date;
    publisher?: { id?: string; name: string; slug: string };
  }) {
    return {
      id: row.id,
      publisherId: row.publisherId,
      publisherName: row.publisher?.name ?? null,
      publisherSlug: row.publisher?.slug ?? null,
      periodStart: row.periodStart.toISOString().slice(0, 10),
      periodEnd: row.periodEnd.toISOString().slice(0, 10),
      grossAmount: Number(row.grossAmount),
      platformCommission: Number(row.platformCommission),
      netAmount: Number(row.netAmount),
      status: row.status,
      paidAt: row.paidAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException({ code: 'INVALID_DATE', message: 'Invalid date' });
  }
  return date;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

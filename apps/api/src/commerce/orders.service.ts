import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookStatus,
  OrderItemType,
  OrderStatus,
  PaymentStatus,
  ProcessingStatus,
} from '@easybookshelf/database';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { EntitlementsService } from './entitlements.service';
import { PlatformConfigService } from './platform-config.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly platformConfig: PlatformConfigService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    if (!dto.bookId && !dto.bookSlug) {
      throw new BadRequestException({
        code: 'BOOK_REFERENCE_REQUIRED',
        message: 'Provide bookId or bookSlug',
      });
    }

    const book = await this.prisma.book.findFirst({
      where: {
        status: BookStatus.approved,
        ...(dto.bookId ? { id: dto.bookId } : { slug: dto.bookSlug }),
      },
      include: {
        publisher: { select: { id: true, commissionRate: true } },
        prices: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
        files: { where: { processingStatus: ProcessingStatus.ready }, take: 1 },
      },
    });

    if (!book) {
      throw new NotFoundException({ code: 'BOOK_NOT_FOUND', message: 'Book not found' });
    }

    if (book.files.length === 0) {
      throw new BadRequestException({
        code: 'BOOK_NOT_READY',
        message: 'This book is not available for purchase yet',
      });
    }

    const price = book.prices[0];
    if (!price) {
      throw new BadRequestException({
        code: 'PRICE_NOT_SET',
        message: 'Pricing is not configured for this book',
      });
    }

    const purchaseCheck = await this.entitlements.assertCanPurchase(userId, book.id, dto.type);
    if (!purchaseCheck.allowed) {
      throw new BadRequestException({
        code: 'ALREADY_ENTITLED',
        message: purchaseCheck.reason ?? 'You already have access to this book',
      });
    }

    const existingPending = await this.prisma.order.findFirst({
      where: {
        userId,
        status: OrderStatus.pending,
        items: { some: { bookId: book.id, type: dto.type } },
      },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
    });

    if (existingPending) {
      return this.toOrderSummary(existingPending);
    }

    const unitPrice = this.resolveUnitPrice(dto.type, price);
    const pricing = await this.calculateLinePricing({
      userId,
      type: dto.type,
      listPrice: unitPrice,
      publisherCommissionRate: book.publisher.commissionRate
        ? Number(book.publisher.commissionRate)
        : null,
    });
    const currency = price.currency || (await this.platformConfig.getDefaultCurrency());

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId,
          orderNumber: generateOrderNumber(),
          totalAmount: pricing.unitPrice,
          currency,
          status: OrderStatus.pending,
          items: {
            create: {
              bookId: book.id,
              publisherId: book.publisherId,
              type: dto.type,
              listUnitPrice: pricing.listUnitPrice,
              unitPrice: pricing.unitPrice,
              memberDiscountAmount: pricing.memberDiscountAmount,
              commissionRate: pricing.commissionRate,
              platformCommission: pricing.platformCommission,
              publisherAmount: pricing.publisherAmount,
            },
          },
        },
        include: orderInclude,
      });

      await tx.payment.create({
        data: {
          orderId: created.id,
          amount: pricing.unitPrice,
          status: PaymentStatus.created,
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: created.id },
        include: orderInclude,
      });
    });

    return this.toOrderSummary(order);
  }

  async listOrdersForUser(userId: string, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(pageSize, 1), 50);
    const skip = (safePage - 1) * safePageSize;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safePageSize,
        include: orderInclude,
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return {
      data: orders.map((order) => this.toOrderSummary(order)),
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
    };
  }

  async getOrderForUser(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: orderInclude,
    });

    if (!order) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }

    return this.toOrderSummary(order);
  }

  async markOrderPaid(
    orderId: string,
    paymentUpdate: {
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      method?: string;
      rawResponse?: unknown;
    },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, payment: true },
    });

    if (!order) {
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Order not found' });
    }

    if (order.status === OrderStatus.paid) {
      return this.getOrderForUser(order.userId, orderId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.paid },
      });

      await tx.payment.update({
        where: { orderId },
        data: {
          status: PaymentStatus.captured,
          razorpayOrderId: paymentUpdate.razorpayOrderId ?? undefined,
          razorpayPaymentId: paymentUpdate.razorpayPaymentId ?? undefined,
          method: paymentUpdate.method ?? undefined,
          rawResponse: paymentUpdate.rawResponse as object | undefined,
        },
      });

      for (const item of order.items) {
        const existing = await tx.entitlement.findUnique({
          where: { orderItemId: item.id },
        });
        if (!existing) {
          await this.entitlements.grantFromOrderItem(tx, item, order.userId);
        }
      }
    });

    return this.getOrderForUser(order.userId, orderId);
  }

  async getPricingQuote(userId: string, bookSlug: string, type: OrderItemType) {
    const book = await this.prisma.book.findFirst({
      where: { slug: bookSlug, status: BookStatus.approved },
      include: {
        publisher: { select: { commissionRate: true } },
        prices: { orderBy: { effectiveFrom: 'desc' }, take: 1 },
      },
    });

    if (!book) {
      throw new NotFoundException({ code: 'BOOK_NOT_FOUND', message: 'Book not found' });
    }

    const price = book.prices[0];
    if (!price) {
      throw new BadRequestException({
        code: 'PRICE_NOT_SET',
        message: 'Pricing is not configured for this book',
      });
    }

    const listPrice = this.resolveUnitPrice(type, price);
    const pricing = await this.calculateLinePricing({
      userId,
      type,
      listPrice,
      publisherCommissionRate: book.publisher.commissionRate
        ? Number(book.publisher.commissionRate)
        : null,
    });

    return {
      bookId: book.id,
      bookSlug: book.slug,
      type,
      currency: price.currency,
      listPrice: pricing.listUnitPrice,
      chargedPrice: pricing.unitPrice,
      memberDiscountPercent: pricing.memberDiscountPercent,
      memberDiscountAmount: pricing.memberDiscountAmount,
      adFree: pricing.adFree,
      commissionRate: pricing.commissionRate,
    };
  }

  private async calculateLinePricing(params: {
    userId: string | null;
    type: OrderItemType;
    listPrice: number;
    publisherCommissionRate: number | null;
  }) {
    const settings = await this.platformConfig.getCommerceSettings();
    const commissionRate =
      params.publisherCommissionRate ??
      (params.type === OrderItemType.purchase
        ? settings.purchaseCommissionRate
        : settings.rentalCommissionRate);

    const adFree = params.userId
      ? await this.subscriptions.hasAdFreeAccess(params.userId)
      : false;
    const memberDiscountPercent =
      adFree && params.type === OrderItemType.purchase
        ? settings.subscriberPurchaseDiscountRate
        : 0;

    const listUnitPrice = roundMoney(params.listPrice);
    const memberDiscountAmount = roundMoney(listUnitPrice * memberDiscountPercent);
    const unitPrice = roundMoney(listUnitPrice - memberDiscountAmount);
    const platformCommission = roundMoney(listUnitPrice * commissionRate);
    const publisherAmount = roundMoney(listUnitPrice - platformCommission);

    return {
      listUnitPrice,
      unitPrice,
      memberDiscountAmount,
      memberDiscountPercent,
      commissionRate,
      platformCommission,
      publisherAmount,
      adFree,
    };
  }

  async markOrderPaidByRazorpayIds(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    rawResponse?: unknown,
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: { razorpayOrderId },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'No order found for this Razorpay payment',
      });
    }

    return this.markOrderPaid(payment.orderId, {
      razorpayOrderId,
      razorpayPaymentId,
      method: 'razorpay',
      rawResponse,
    });
  }

  private resolveUnitPrice(
    type: OrderItemType,
    price: {
      purchasePrice: { toNumber?: () => number } | number | string;
      rental15Price: { toNumber?: () => number } | number | string;
      rental30Price: { toNumber?: () => number } | number | string;
    },
  ) {
    const map = {
      [OrderItemType.purchase]: price.purchasePrice,
      [OrderItemType.rental_15]: price.rental15Price,
      [OrderItemType.rental_30]: price.rental30Price,
    };
    return roundMoney(toNumber(map[type]));
  }

  private toOrderSummary(
    order: {
      id: string;
      orderNumber: string;
      status: OrderStatus;
      totalAmount: { toNumber?: () => number } | number | string;
      currency: string;
      createdAt: Date;
      items: Array<{
        bookId: string;
        type: OrderItemType;
        listUnitPrice: { toNumber?: () => number } | number | string;
        unitPrice: { toNumber?: () => number } | number | string;
        memberDiscountAmount: { toNumber?: () => number } | number | string;
        book: { slug: string; title: string; coverImageUrl: string | null };
      }>;
      payment: {
        status: PaymentStatus;
        razorpayOrderId: string | null;
      } | null;
    },
  ) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: toNumber(order.totalAmount),
      currency: order.currency,
      items: order.items.map((item) => ({
        bookId: item.bookId,
        bookSlug: item.book.slug,
        bookTitle: item.book.title,
        bookCoverImageUrl: item.book.coverImageUrl,
        type: item.type,
        listUnitPrice: toNumber(item.listUnitPrice),
        unitPrice: toNumber(item.unitPrice),
        memberDiscountAmount: toNumber(item.memberDiscountAmount),
      })),
      payment: order.payment
        ? {
            status: order.payment.status,
            razorpayOrderId: order.payment.razorpayOrderId,
          }
        : null,
      createdAt: order.createdAt.toISOString(),
    };
  }
}

function generateOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `EB-${date}-${suffix}`;
}

function toNumber(value: { toNumber?: () => number } | number | string) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return value.toNumber?.() ?? Number(value);
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

const orderInclude = {
  items: { include: { book: { select: { slug: true, title: true, coverImageUrl: true } } } },
  payment: true,
} as const;

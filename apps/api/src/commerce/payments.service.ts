import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentStatus } from '@easybookshelf/database';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  isRazorpayConfigured() {
    return Boolean(this.getKeyId() && this.getKeySecret());
  }

  getPublicKeyId() {
    return this.getKeyId();
  }

  async prepareCheckout(userId: string, orderId: string) {
    const order = await this.orders.getOrderForUser(userId, orderId);

    if (order.status === OrderStatus.paid) {
      return { order, razorpayKeyId: this.getKeyId(), mockCheckout: !this.isRazorpayConfigured() };
    }

    if (!this.isRazorpayConfigured()) {
      return { order, razorpayKeyId: null, mockCheckout: true };
    }

    const razorpayOrder = await this.createRazorpayOrder(order);
    await this.prisma.payment.update({
      where: { orderId: order.id },
      data: { razorpayOrderId: razorpayOrder.id },
    });

    return {
      order: {
        ...order,
        payment: order.payment
          ? { ...order.payment, razorpayOrderId: razorpayOrder.id }
          : { status: 'created' as const, razorpayOrderId: razorpayOrder.id },
      },
      razorpayKeyId: this.getKeyId(),
      mockCheckout: false,
    };
  }

  async verifyPayment(userId: string, orderId: string, dto: VerifyPaymentDto) {
    if (!this.isRazorpayConfigured()) {
      throw new BadRequestException({
        code: 'RAZORPAY_NOT_CONFIGURED',
        message: 'Razorpay is not configured',
      });
    }

    const order = await this.orders.getOrderForUser(userId, orderId);
    if (order.status === OrderStatus.paid) {
      return order;
    }

    const valid = this.verifySignature(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );
    if (!valid) {
      throw new BadRequestException({
        code: 'INVALID_PAYMENT_SIGNATURE',
        message: 'Payment verification failed',
      });
    }

    return this.orders.markOrderPaid(orderId, {
      razorpayOrderId: dto.razorpayOrderId,
      razorpayPaymentId: dto.razorpayPaymentId,
      method: 'razorpay',
      rawResponse: dto,
    });
  }

  async mockPay(userId: string, orderId: string) {
    if (this.isRazorpayConfigured() && this.config.get('ALLOW_MOCK_PAYMENTS') !== 'true') {
      throw new ForbiddenException({
        code: 'MOCK_PAYMENTS_DISABLED',
        message: 'Mock payments are disabled when Razorpay is configured',
      });
    }

    const order = await this.orders.getOrderForUser(userId, orderId);
    if (order.status === OrderStatus.paid) {
      return order;
    }

    return this.orders.markOrderPaid(orderId, {
      method: 'mock',
      rawResponse: { mock: true, paidAt: new Date().toISOString() },
    });
  }

  async handleRazorpayWebhook(signature: string | undefined, rawBody: string) {
    const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (secret) {
      if (!signature || !this.verifyWebhookSignature(rawBody, signature, secret)) {
        throw new BadRequestException({
          code: 'INVALID_WEBHOOK_SIGNATURE',
          message: 'Webhook signature verification failed',
        });
      }
    }

    let payload: RazorpayWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
    } catch {
      throw new BadRequestException({
        code: 'INVALID_WEBHOOK_PAYLOAD',
        message: 'Could not parse webhook payload',
      });
    }

    if (payload.event !== 'payment.captured') {
      return { received: true, processed: false };
    }

    const payment = payload.payload?.payment?.entity;
    if (!payment?.order_id || !payment.id) {
      return { received: true, processed: false };
    }

    const order = await this.orders.markOrderPaidByRazorpayIds(
      payment.order_id,
      payment.id,
      payload,
    );

    return { received: true, processed: true, orderId: order.id };
  }

  private verifyWebhookSignature(rawBody: string, signature: string, secret: string) {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  private async createRazorpayOrder(order: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    currency: string;
  }) {
    const keyId = this.getKeyId();
    const keySecret = this.getKeySecret();
    if (!keyId || !keySecret) {
      throw new BadRequestException({
        code: 'RAZORPAY_NOT_CONFIGURED',
        message: 'Razorpay is not configured',
      });
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(order.totalAmount * 100),
        currency: order.currency,
        receipt: order.orderNumber,
        notes: { orderId: order.id },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new BadRequestException({
        code: 'RAZORPAY_ORDER_FAILED',
        message: `Could not create Razorpay order: ${body}`,
      });
    }

    return (await response.json()) as { id: string };
  }

  private verifySignature(orderId: string, paymentId: string, signature: string) {
    const secret = this.getKeySecret();
    if (!secret) return false;

    const expected = createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  private getKeyId() {
    return this.config.get<string>('RAZORPAY_KEY_ID') || null;
  }

  private getKeySecret() {
    return this.config.get<string>('RAZORPAY_KEY_SECRET') || null;
  }
}

interface RazorpayWebhookPayload {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id: string;
        order_id: string;
        status: string;
      };
    };
  };
}

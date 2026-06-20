import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionInterval, SubscriptionStatus } from '@easybookshelf/database';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { VerifySubscriptionDto } from './dto/verify-subscription.dto';

type PlanRow = {
  id: string;
  name: string;
  price: { toString(): string };
  currency: string;
  interval: SubscriptionInterval;
  active: boolean;
};

type SubscriptionRow = {
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  razorpaySubscriptionId: string | null;
  createdAt: Date;
  plan: PlanRow;
};

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isRazorpayConfigured() {
    return Boolean(this.getKeyId() && this.getKeySecret());
  }

  getPublicKeyId() {
    return this.getKeyId();
  }

  async listPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { active: true },
      orderBy: [{ interval: 'asc' }, { price: 'asc' }],
    });
    return plans.map((plan) => this.mapPlan(plan));
  }

  async getStatus(userId: string) {
    const subscription = await this.findAdFreeSubscription(userId);
    return {
      adFree: Boolean(subscription),
      subscription: subscription ? this.mapSubscription(subscription) : null,
    };
  }

  async hasAdFreeAccess(userId: string) {
    const subscription = await this.findAdFreeSubscription(userId);
    return Boolean(subscription);
  }

  async subscribe(userId: string, planId: string) {
    const plan = await this.requireActivePlan(planId);
    const existing = await this.findAdFreeSubscription(userId);
    if (existing) {
      throw new ConflictException({
        code: 'SUBSCRIPTION_ALREADY_ACTIVE',
        message: 'You already have an active ad-free subscription',
      });
    }

    if (!this.isRazorpayConfigured()) {
      const subscription = await this.activateSubscription(userId, plan);
      return {
        plan: this.mapPlan(plan),
        razorpayKeyId: null,
        razorpayOrderId: null,
        mockCheckout: true,
        subscription: this.mapSubscription(subscription),
      };
    }

    const razorpayOrder = await this.createRazorpayOrder(plan);
    return {
      plan: this.mapPlan(plan),
      razorpayKeyId: this.getKeyId(),
      razorpayOrderId: razorpayOrder.id,
      mockCheckout: false,
      subscription: null,
    };
  }

  async mockActivate(userId: string, planId: string) {
    if (this.isRazorpayConfigured() && this.config.get('ALLOW_MOCK_PAYMENTS') !== 'true') {
      throw new ForbiddenException({
        code: 'MOCK_PAYMENTS_DISABLED',
        message: 'Mock subscription activation is disabled when Razorpay is configured',
      });
    }

    const plan = await this.requireActivePlan(planId);
    const existing = await this.findAdFreeSubscription(userId);
    if (existing) {
      throw new ConflictException({
        code: 'SUBSCRIPTION_ALREADY_ACTIVE',
        message: 'You already have an active ad-free subscription',
      });
    }

    const subscription = await this.activateSubscription(userId, plan);
    return this.mapSubscription(subscription);
  }

  async verifyPayment(userId: string, dto: VerifySubscriptionDto) {
    if (!this.isRazorpayConfigured()) {
      throw new BadRequestException({
        code: 'RAZORPAY_NOT_CONFIGURED',
        message: 'Razorpay is not configured',
      });
    }

    const plan = await this.requireActivePlan(dto.planId);
    const existing = await this.findAdFreeSubscription(userId);
    if (existing) {
      return this.mapSubscription(existing);
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

    const subscription = await this.activateSubscription(userId, plan, {
      razorpaySubscriptionId: dto.razorpayPaymentId,
    });
    return this.mapSubscription(subscription);
  }

  async cancel(userId: string) {
    const subscription = await this.findAdFreeSubscription(userId);
    if (!subscription) {
      throw new NotFoundException({
        code: 'SUBSCRIPTION_NOT_FOUND',
        message: 'No active subscription to cancel',
      });
    }

    if (subscription.status === SubscriptionStatus.cancelled) {
      return this.mapSubscription(subscription);
    }

    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: SubscriptionStatus.cancelled },
      include: { plan: true },
    });

    return this.mapSubscription(updated);
  }

  private async activateSubscription(
    userId: string,
    plan: PlanRow,
    extra?: { razorpaySubscriptionId?: string },
  ) {
    const now = new Date();
    const periodEnd = this.addInterval(now, plan.interval);

    return this.prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        status: SubscriptionStatus.active,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        razorpaySubscriptionId: extra?.razorpaySubscriptionId ?? null,
      },
      include: { plan: true },
    });
  }

  private async findAdFreeSubscription(userId: string): Promise<SubscriptionRow | null> {
    const now = new Date();
    const row = await this.prisma.subscription.findFirst({
      where: {
        userId,
        currentPeriodEnd: { gt: now },
        status: { in: [SubscriptionStatus.active, SubscriptionStatus.cancelled] },
      },
      include: { plan: true },
      orderBy: { currentPeriodEnd: 'desc' },
    });
    return row;
  }

  private async requireActivePlan(planId: string) {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { id: planId, active: true },
    });
    if (!plan) {
      throw new NotFoundException({
        code: 'PLAN_NOT_FOUND',
        message: 'Subscription plan not found',
      });
    }
    return plan;
  }

  private addInterval(start: Date, interval: SubscriptionInterval) {
    const end = new Date(start);
    if (interval === SubscriptionInterval.monthly) {
      end.setMonth(end.getMonth() + 1);
    } else {
      end.setFullYear(end.getFullYear() + 1);
    }
    return end;
  }

  private mapPlan(plan: PlanRow) {
    return {
      id: plan.id,
      name: plan.name,
      price: Number(plan.price),
      currency: plan.currency,
      interval: plan.interval,
      active: plan.active,
    };
  }

  private mapSubscription(row: SubscriptionRow) {
    const now = new Date();
    const adFree =
      row.currentPeriodEnd > now &&
      (row.status === SubscriptionStatus.active ||
        row.status === SubscriptionStatus.cancelled);

    return {
      id: row.id,
      planId: row.planId,
      plan: this.mapPlan(row.plan),
      status: row.status,
      currentPeriodStart: row.currentPeriodStart.toISOString(),
      currentPeriodEnd: row.currentPeriodEnd.toISOString(),
      adFree,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async createRazorpayOrder(plan: PlanRow) {
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
        amount: Math.round(Number(plan.price) * 100),
        currency: plan.currency,
        receipt: `sub-${plan.id.slice(0, 8)}-${Date.now()}`,
        notes: { planId: plan.id, type: 'subscription' },
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

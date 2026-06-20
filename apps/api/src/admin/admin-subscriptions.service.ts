import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';

@Injectable()
export class AdminSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      orderBy: [{ interval: 'asc' }, { price: 'asc' }],
    });
    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: Number(plan.price),
      currency: plan.currency,
      interval: plan.interval,
      active: plan.active,
      razorpayPlanId: plan.razorpayPlanId,
      createdAt: plan.createdAt.toISOString(),
    }));
  }

  async updatePlan(id: string, dto: UpdateSubscriptionPlanDto) {
    const existing = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'Plan not found' });
    }

    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: dto.name,
        price: dto.price,
        active: dto.active,
      },
    });

    return {
      id: plan.id,
      name: plan.name,
      price: Number(plan.price),
      currency: plan.currency,
      interval: plan.interval,
      active: plan.active,
      razorpayPlanId: plan.razorpayPlanId,
      createdAt: plan.createdAt.toISOString(),
    };
  }
}

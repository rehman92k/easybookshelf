import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, RequestUser } from '../auth/decorators/auth.decorators';
import { SubscribeDto } from './dto/subscribe.dto';
import { VerifySubscriptionDto } from './dto/verify-subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@Controller({ path: 'subscriptions', version: '1' })
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('plans')
  @Public()
  @ApiOperation({ summary: 'List active ad-free subscription plans' })
  listPlans() {
    return this.subscriptions.listPlans();
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user subscription status' })
  getStatus(@CurrentUser() user: RequestUser) {
    return this.subscriptions.getStatus(user.userId);
  }

  @Post('subscribe')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Subscribe to an ad-free plan' })
  subscribe(@CurrentUser() user: RequestUser, @Body() dto: SubscribeDto) {
    return this.subscriptions.subscribe(user.userId, dto.planId);
  }

  @Post('mock-activate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Activate subscription without payment (local dev)' })
  mockActivate(@CurrentUser() user: RequestUser, @Body() dto: SubscribeDto) {
    return this.subscriptions.mockActivate(user.userId, dto.planId);
  }

  @Post('verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify Razorpay payment and activate subscription' })
  verify(@CurrentUser() user: RequestUser, @Body() dto: VerifySubscriptionDto) {
    return this.subscriptions.verifyPayment(user.userId, dto);
  }

  @Post('cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel subscription at end of billing period' })
  cancel(@CurrentUser() user: RequestUser) {
    return this.subscriptions.cancel(user.userId);
  }
}

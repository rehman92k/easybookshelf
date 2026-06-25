import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public, CurrentUser, RequestUser } from '../auth/decorators/auth.decorators';
import { CreateOrderDto } from './dto/create-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { EntitlementsService } from './entitlements.service';
import { OrdersService } from './orders.service';
import { PaymentsService } from './payments.service';
import { PlatformConfigService } from './platform-config.service';
import { parseOrderItemTypeFromQuery } from './rental-pricing';

@ApiTags('commerce')
@Controller({ path: 'commerce', version: '1' })
export class CommerceController {
  constructor(
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly entitlements: EntitlementsService,
    private readonly platformConfig: PlatformConfigService,
  ) {}

  @Get('config')
  @Public()
  @ApiOperation({ summary: 'Public commerce config (rental periods, currency)' })
  getCommerceConfig() {
    return this.platformConfig.getPublicCommerceConfig();
  }

  @Post('orders')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a purchase or rental order' })
  createOrder(@CurrentUser() user: RequestUser, @Body() dto: CreateOrderDto) {
    return this.orders.createOrder(user.userId, dto);
  }

  @Get('orders')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List orders for the current user' })
  listOrders(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.orders.listOrdersForUser(
      user.userId,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  @Get('orders/:orderId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order details for the current user' })
  getOrder(@CurrentUser() user: RequestUser, @Param('orderId') orderId: string) {
    return this.orders.getOrderForUser(user.userId, orderId);
  }

  @Get('orders/:orderId/checkout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Prepare checkout (Razorpay order or mock mode)' })
  prepareCheckout(@CurrentUser() user: RequestUser, @Param('orderId') orderId: string) {
    return this.payments.prepareCheckout(user.userId, orderId);
  }

  @Post('orders/:orderId/verify')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify Razorpay payment and grant access' })
  verifyPayment(
    @CurrentUser() user: RequestUser,
    @Param('orderId') orderId: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.payments.verifyPayment(user.userId, orderId, dto);
  }

  @Post('orders/:orderId/mock-pay')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete a test payment (local dev without Razorpay)' })
  mockPay(@CurrentUser() user: RequestUser, @Param('orderId') orderId: string) {
    return this.payments.mockPay(user.userId, orderId);
  }

  @Post('webhooks/razorpay')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: 'Razorpay payment webhook' })
  razorpayWebhook(
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const rawBody = req.rawBody?.toString('utf8') ?? '';
    return this.payments.handleRazorpayWebhook(signature, rawBody);
  }

  @Get('library')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List books the user owns or has rented' })
  listLibrary(@CurrentUser() user: RequestUser) {
    return this.entitlements.listLibrary(user.userId);
  }

  @Get('books/by-slug/:slug/quote')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get purchase/rental quote with member discount if applicable' })
  getQuote(
    @CurrentUser() user: RequestUser,
    @Param('slug') slug: string,
    @Query('type') type?: string,
    @Query('days') days?: string,
  ) {
    const parsed = parseOrderItemTypeFromQuery(type, days);
    return this.orders.getPricingQuote(user.userId, slug, parsed.type, parsed.rentalDays);
  }
}

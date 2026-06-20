import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CommerceController } from './commerce.controller';
import { EntitlementsService } from './entitlements.service';
import { OrdersService } from './orders.service';
import { PaymentsService } from './payments.service';
import { PlatformConfigService } from './platform-config.service';

@Module({
  imports: [SubscriptionsModule],
  controllers: [CommerceController],
  providers: [PlatformConfigService, EntitlementsService, OrdersService, PaymentsService],
  exports: [EntitlementsService, OrdersService, PlatformConfigService],
})
export class CommerceModule {}

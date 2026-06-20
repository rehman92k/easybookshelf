import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { SettlementsModule } from '../settlements/settlements.module';
import { AuthModule } from '../auth/auth.module';
import { AdminBooksController } from './admin-books.controller';
import { AdminBooksService } from './admin-books.service';
import { AdminSettlementsController } from './admin-settlements.controller';
import { AdminCommerceSettingsController } from './admin-commerce-settings.controller';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { AdminSubscriptionsService } from './admin-subscriptions.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [AuthModule, CommerceModule, SettlementsModule],
  controllers: [
    AdminUsersController,
    AdminBooksController,
    AdminSubscriptionsController,
    AdminCommerceSettingsController,
    AdminSettlementsController,
  ],
  providers: [AdminUsersService, AdminBooksService, AdminSubscriptionsService],
})
export class AdminModule {}

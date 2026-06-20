import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BooksModule } from './books/books.module';
import { CommerceModule } from './commerce/commerce.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { HealthModule } from './health/health.module';
import { PublisherModule } from './publisher/publisher.module';
import { ReadingModule } from './reading/reading.module';
import { StorageModule } from './storage/storage.module';
import { PrismaModule } from './prisma/prisma.module';
import { RootController } from './root.controller';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    UsersModule,
    AdminModule,
    BooksModule,
    PublisherModule,
    ReadingModule,
    CommerceModule,
    WishlistModule,
    SubscriptionsModule,
    HealthModule,
  ],
  controllers: [RootController, AppController],
  providers: [AppService],
})
export class AppModule {}

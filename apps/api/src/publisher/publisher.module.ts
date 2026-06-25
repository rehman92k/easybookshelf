import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { SettlementsModule } from '../settlements/settlements.module';
import { AuthModule } from '../auth/auth.module';
import { PublisherSettlementsController } from './publisher-settlements.controller';
import { PublisherBooksController } from './publisher-books.controller';
import { PublisherBooksService } from './publisher-books.service';
import { PublisherController } from './publisher.controller';
import { PublisherService } from './publisher.service';

@Module({
  imports: [AuthModule, SettlementsModule, CommerceModule],
  controllers: [PublisherController, PublisherBooksController, PublisherSettlementsController],
  providers: [PublisherService, PublisherBooksService],
  exports: [PublisherService, PublisherBooksService],
})
export class PublisherModule {}

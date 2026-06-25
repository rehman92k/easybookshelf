import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [CommerceModule],
  controllers: [WishlistController],
  providers: [WishlistService],
})
export class WishlistModule {}

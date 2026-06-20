import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequestUser } from '../auth/decorators/auth.decorators';
import { WishlistBookDto } from './dto/wishlist-book.dto';
import { WishlistService } from './wishlist.service';

@ApiTags('wishlist')
@ApiBearerAuth()
@Controller({ path: 'wishlist', version: '1' })
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'List wishlist books for the current user' })
  list(@CurrentUser() user: RequestUser) {
    return this.wishlist.list(user.userId);
  }

  @Get('check/:bookSlug')
  @ApiOperation({ summary: 'Check if a book is in the wishlist' })
  check(@CurrentUser() user: RequestUser, @Param('bookSlug') bookSlug: string) {
    return this.wishlist.check(user.userId, bookSlug);
  }

  @Post()
  @ApiOperation({ summary: 'Add a book to the wishlist' })
  add(@CurrentUser() user: RequestUser, @Body() dto: WishlistBookDto) {
    return this.wishlist.add(user.userId, dto.bookSlug);
  }

  @Delete(':bookSlug')
  @ApiOperation({ summary: 'Remove a book from the wishlist' })
  remove(@CurrentUser() user: RequestUser, @Param('bookSlug') bookSlug: string) {
    return this.wishlist.remove(user.userId, bookSlug);
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/auth.decorators';
import { BooksService } from './books.service';

@ApiTags('search')
@Public()
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private readonly booksService: BooksService) {}

  @Get('books')
  @ApiOperation({ summary: 'Search approved books (public)' })
  searchBooks(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') category?: string,
    @Query('language') language?: string,
  ) {
    return this.booksService.listBooks({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      search: q || undefined,
      category: category || undefined,
      language: language || undefined,
    });
  }
}


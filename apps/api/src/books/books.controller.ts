import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/auth.decorators';
import { BooksService } from './books.service';

@ApiTags('books')
@Public()
@Controller({ path: 'books', version: '1' })
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  @ApiOperation({ summary: 'List approved books (public catalog)' })
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('language') language?: string,
    @Query('featured') featured?: string,
  ) {
    return this.booksService.listBooks({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      search: search || undefined,
      category: category || undefined,
      language: language || undefined,
      featured: featured === 'true' ? true : undefined,
    });
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get book by slug (public catalog)' })
  get(@Param('slug') slug: string) {
    return this.booksService.getBookBySlug(slug);
  }
}

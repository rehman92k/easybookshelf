import { Module } from '@nestjs/common';
import { CommerceModule } from '../commerce/commerce.module';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { SearchController } from './search.controller';

@Module({
  imports: [CommerceModule],
  controllers: [BooksController, CatalogController, SearchController],
  providers: [BooksService, CatalogService],
  exports: [BooksService],
})
export class BooksModule {}

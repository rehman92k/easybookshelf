import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/auth.decorators';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Public()
@Controller({ path: 'catalog', version: '1' })
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('categories')
  @ApiOperation({ summary: 'List book categories' })
  listCategories() {
    return this.catalogService.listCategories();
  }

  @Get('languages')
  @ApiOperation({ summary: 'List supported languages' })
  listLanguages() {
    return this.catalogService.listLanguages();
  }
}

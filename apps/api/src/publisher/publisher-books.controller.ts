import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BookFileFormat, UserRoleType } from '@easybookshelf/database';
import { memoryStorage } from 'multer';
import { CurrentUser, RequestUser, Roles } from '../auth/decorators/auth.decorators';
import { CreatePublisherBookDto } from './dto/create-publisher-book.dto';
import { UpdatePublisherBookDto } from './dto/update-publisher-book.dto';
import { PublisherBooksService } from './publisher-books.service';

@ApiTags('publisher')
@ApiBearerAuth()
@Roles(
  UserRoleType.author,
  UserRoleType.publisher,
  UserRoleType.publisher_staff,
  UserRoleType.super_admin,
)
@Controller({ path: 'publisher/books', version: '1' })
export class PublisherBooksController {
  constructor(private readonly publisherBooksService: PublisherBooksService) {}

  @Get()
  @ApiOperation({ summary: 'List books for current publisher' })
  list(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.publisherBooksService.listBooks(
      user.userId,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get publisher book by ID' })
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.publisherBooksService.getBook(user.userId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create draft book' })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreatePublisherBookDto) {
    return this.publisherBooksService.createBook(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a draft or rejected book' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdatePublisherBookDto,
  ) {
    return this.publisherBooksService.updateBook(user.userId, id, dto);
  }

  @Post(':id/files')
  @ApiOperation({ summary: 'Upload EPUB or PDF file for a draft book' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'format'],
      properties: {
        file: { type: 'string', format: 'binary' },
        format: { type: 'string', enum: Object.values(BookFileFormat) },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 150 * 1024 * 1024 },
    }),
  )
  uploadFile(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('format') format: BookFileFormat,
  ) {
    return this.publisherBooksService.uploadFile(user.userId, id, file, format);
  }

  @Post(':id/cover')
  @ApiOperation({ summary: 'Upload cover image for a draft book' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadCover(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.publisherBooksService.uploadCover(user.userId, id, file);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit book for admin review' })
  submit(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.publisherBooksService.submitForReview(user.userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a draft or rejected book' })
  delete(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.publisherBooksService.deleteBook(user.userId, id);
  }
}

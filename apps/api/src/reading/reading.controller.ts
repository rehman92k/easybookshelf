import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseEnumPipe,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BookFileFormat } from '@easybookshelf/database';
import type { Response } from 'express';
import { Public, CurrentUser, RequestUser } from '../auth/decorators/auth.decorators';
import { AuthService } from '../auth/auth.service';
import { UpsertReadingProgressDto } from './dto/upsert-reading-progress.dto';
import { ReadingService } from './reading.service';

@ApiTags('reading')
@Controller({ path: 'reading', version: '1' })
export class ReadingController {
  constructor(
    private readonly readingService: ReadingService,
    private readonly authService: AuthService,
  ) {}

  @Get('books/by-slug/:slug/access')
  @Public()
  @ApiOperation({ summary: 'Get reading access for a book by slug' })
  async getAccessBySlug(
    @Param('slug') slug: string,
    @Headers('authorization') authorization?: string,
  ) {
    const userId = await this.authService.tryGetUserIdFromBearer(authorization);
    return this.readingService.getAccessBySlug(slug, userId);
  }

  @Get('books/:bookId/access')
  @Public()
  @ApiOperation({ summary: 'Get reading access for a book' })
  async getAccessById(
    @Param('bookId') bookId: string,
    @Headers('authorization') authorization?: string,
  ) {
    const userId = await this.authService.tryGetUserIdFromBearer(authorization);
    return this.readingService.getAccessById(bookId, userId);
  }

  @Get('books/:bookId/files/:format')
  @Public()
  @ApiOperation({ summary: 'Stream a book file for reading' })
  async streamFile(
    @Param('bookId') bookId: string,
    @Param('format', new ParseEnumPipe(BookFileFormat)) format: BookFileFormat,
    @Query('mode') mode: 'preview' | 'full' = 'preview',
    @Headers('authorization') authorization: string | undefined,
    @Res() res: Response,
  ) {
    const userId = await this.authService.tryGetUserIdFromBearer(authorization);
    const file = await this.readingService.getBookFile(bookId, format, mode, userId);

    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
    res.setHeader('Content-Length', file.buffer.length);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(file.buffer);
  }

  @Get('history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List reading history for the current user' })
  listHistory(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.readingService.listHistory(
      user.userId,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  @Get('books/:bookId/progress')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get reading progress for the current user' })
  getProgress(@Param('bookId') bookId: string, @CurrentUser() user: RequestUser) {
    return this.readingService.getProgress(user.userId, bookId);
  }

  @Put('books/:bookId/progress')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save reading progress for the current user' })
  upsertProgress(
    @Param('bookId') bookId: string,
    @Body() dto: UpsertReadingProgressDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.readingService.upsertProgress(user.userId, bookId, dto);
  }
}

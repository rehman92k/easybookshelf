import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BookStatus, UserRoleType } from '@easybookshelf/database';
import type { Request } from 'express';
import { Roles, CurrentUser, RequestUser } from '../auth/decorators/auth.decorators';
import { AdminBooksService } from './admin-books.service';
import { RejectBookDto } from './dto/reject-book.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRoleType.super_admin, UserRoleType.admin_content)
@Controller({ path: 'admin/books', version: '1' })
export class AdminBooksController {
  constructor(private readonly adminBooksService: AdminBooksService) {}

  @Get()
  @ApiOperation({ summary: 'List books for admin review' })
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: BookStatus,
    @Query('search') search?: string,
  ) {
    return this.adminBooksService.listBooks(
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
      status ?? BookStatus.pending_review,
      search,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get book details (admin)' })
  get(@Param('id') id: string) {
    return this.adminBooksService.getBook(id);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a book pending review' })
  approve(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
    @Req() req: Request,
  ) {
    return this.adminBooksService.approveBook(id, actor.userId, req.ip);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a book pending review' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectBookDto,
    @CurrentUser() actor: RequestUser,
    @Req() req: Request,
  ) {
    return this.adminBooksService.rejectBook(id, dto.rejectionReason, actor.userId, req.ip);
  }
}

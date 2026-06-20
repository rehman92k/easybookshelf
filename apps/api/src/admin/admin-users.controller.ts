import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleType } from '@easybookshelf/database';
import type { Request } from 'express';
import { Roles, CurrentUser, RequestUser } from '../auth/decorators/auth.decorators';
import { AdminUsersService } from './admin-users.service';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRoleType.super_admin, UserRoleType.admin_content)
@Controller({ path: 'admin/users', version: '1' })
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users (admin)' })
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.adminUsersService.listUsers(
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
      search,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (admin)' })
  get(@Param('id') id: string) {
    return this.adminUsersService.getUser(id);
  }

  @Patch(':id')
  @Roles(UserRoleType.super_admin)
  @ApiOperation({ summary: 'Update user status or roles (super admin only)' })
  update(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() actor: RequestUser,
    @Req() req: Request,
  ) {
    return this.adminUsersService.updateUser(id, dto, actor.userId, req.ip);
  }
}

import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleType } from '@easybookshelf/database';
import { Roles } from '../auth/decorators/auth.decorators';
import { AdminSubscriptionsService } from './admin-subscriptions.service';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRoleType.super_admin, UserRoleType.admin_finance, UserRoleType.admin_content)
@Controller({ path: 'admin/subscription-plans', version: '1' })
export class AdminSubscriptionsController {
  constructor(private readonly subscriptions: AdminSubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: 'List subscription plans' })
  list() {
    return this.subscriptions.listPlans();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update subscription plan pricing or availability' })
  update(@Param('id') id: string, @Body() dto: UpdateSubscriptionPlanDto) {
    return this.subscriptions.updatePlan(id, dto);
  }
}

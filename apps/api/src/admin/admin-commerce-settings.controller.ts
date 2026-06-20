import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleType } from '@easybookshelf/database';
import { Roles } from '../auth/decorators/auth.decorators';
import { PlatformConfigService } from '../commerce/platform-config.service';
import { UpdateCommerceSettingsDto } from './dto/update-commerce-settings.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRoleType.super_admin, UserRoleType.admin_finance, UserRoleType.admin_content)
@Controller({ path: 'admin/commerce-settings', version: '1' })
export class AdminCommerceSettingsController {
  constructor(private readonly platformConfig: PlatformConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Get platform commerce settings (commission, member discount)' })
  get() {
    return this.platformConfig.getCommerceSettings();
  }

  @Patch()
  @ApiOperation({ summary: 'Update platform commerce settings' })
  update(@Body() dto: UpdateCommerceSettingsDto) {
    return this.platformConfig.updateCommerceSettings(dto);
  }
}

import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleType } from '@easybookshelf/database';
import { CurrentUser, RequestUser, Roles } from '../auth/decorators/auth.decorators';
import { OnboardPublisherDto } from './dto/onboard-publisher.dto';
import { UpdatePublisherProfileDto } from './dto/update-publisher-profile.dto';
import { PublisherService } from './publisher.service';

@ApiTags('publisher')
@ApiBearerAuth()
@Roles(UserRoleType.reader, UserRoleType.author, UserRoleType.publisher, UserRoleType.publisher_staff)
@Controller({ path: 'publisher', version: '1' })
export class PublisherController {
  constructor(private readonly publisherService: PublisherService) {}

  @Post('onboard')
  @ApiOperation({ summary: 'Create publisher/author profile' })
  onboard(@CurrentUser() user: RequestUser, @Body() dto: OnboardPublisherDto) {
    return this.publisherService.onboard(user.userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get publisher profile for current user' })
  getMe(@CurrentUser() user: RequestUser) {
    return this.publisherService.getProfile(user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update publisher profile for current user' })
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdatePublisherProfileDto) {
    return this.publisherService.updateProfile(user.userId, dto);
  }
}

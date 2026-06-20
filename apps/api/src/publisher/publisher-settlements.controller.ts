import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleType } from '@easybookshelf/database';
import { CurrentUser, RequestUser, Roles } from '../auth/decorators/auth.decorators';
import { PublisherService } from '../publisher/publisher.service';
import { SettlementsService } from '../settlements/settlements.service';

@ApiTags('publisher')
@ApiBearerAuth()
@Roles(
  UserRoleType.author,
  UserRoleType.publisher,
  UserRoleType.publisher_staff,
  UserRoleType.super_admin,
)
@Controller({ path: 'publisher/settlements', version: '1' })
export class PublisherSettlementsController {
  constructor(
    private readonly publisher: PublisherService,
    private readonly settlements: SettlementsService,
  ) {}

  @Get('earnings')
  @ApiOperation({ summary: 'Publisher earnings summary' })
  async earnings(@CurrentUser() user: RequestUser) {
    const profile = await this.publisher.requirePublisher(user.userId);
    return this.settlements.getPublisherEarnings(profile.id);
  }

  @Get()
  @ApiOperation({ summary: 'List settlements for the current publisher' })
  async list(@CurrentUser() user: RequestUser) {
    const profile = await this.publisher.requirePublisher(user.userId);
    return this.settlements.listPublisherSettlements(profile.id);
  }
}

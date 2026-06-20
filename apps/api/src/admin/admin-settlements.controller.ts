import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettlementStatus, UserRoleType } from '@easybookshelf/database';
import { Roles } from '../auth/decorators/auth.decorators';
import { GenerateSettlementsDto } from '../settlements/dto/generate-settlements.dto';
import { SettlementsService } from '../settlements/settlements.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRoleType.super_admin, UserRoleType.admin_finance)
@Controller({ path: 'admin/settlements', version: '1' })
export class AdminSettlementsController {
  constructor(private readonly settlements: SettlementsService) {}

  @Get()
  @ApiOperation({ summary: 'List publisher settlements' })
  list(
    @Query('publisherId') publisherId?: string,
    @Query('status') status?: SettlementStatus,
  ) {
    return this.settlements.listSettlements({ publisherId, status });
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate settlements for paid orders in a period' })
  generate(@Body() dto: GenerateSettlementsDto) {
    return this.settlements.generate(dto);
  }

  @Post(':id/mark-paid')
  @ApiOperation({ summary: 'Mark a settlement as paid' })
  markPaid(@Param('id') id: string) {
    return this.settlements.markPaid(id);
  }
}

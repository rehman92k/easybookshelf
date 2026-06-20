import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class GenerateSettlementsDto {
  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  periodStart!: string;

  @ApiProperty({ example: '2026-06-30' })
  @IsDateString()
  periodEnd!: string;

  @ApiPropertyOptional({ description: 'Limit to one publisher; omit for all publishers' })
  @IsOptional()
  @IsUUID()
  publisherId?: string;
}

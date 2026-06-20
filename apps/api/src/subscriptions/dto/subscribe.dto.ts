import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SubscribeDto {
  @ApiProperty()
  @IsUUID()
  planId!: string;
}

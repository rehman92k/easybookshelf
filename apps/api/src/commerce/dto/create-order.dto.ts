import { ApiProperty } from '@nestjs/swagger';
import { OrderItemType } from '@easybookshelf/database';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ enum: OrderItemType })
  @IsEnum(OrderItemType)
  type!: OrderItemType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  bookId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bookSlug?: string;
}

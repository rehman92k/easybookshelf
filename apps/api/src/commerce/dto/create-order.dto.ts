import { ApiProperty } from '@nestjs/swagger';
import { OrderItemType } from '@easybookshelf/database';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ enum: OrderItemType })
  @IsEnum(OrderItemType)
  type!: OrderItemType;

  @ApiProperty({ required: false, description: 'Required when type is rental' })
  @IsOptional()
  @IsInt()
  @Min(1)
  rentalDays?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  bookId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bookSlug?: string;
}

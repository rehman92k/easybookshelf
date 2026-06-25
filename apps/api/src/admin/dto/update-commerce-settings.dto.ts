import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, Max, Min, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class UpdateCommerceSettingsDto {
  @ApiPropertyOptional({ description: 'Platform commission on book purchases (0–1)', example: 0.15 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  purchaseCommissionRate?: number;

  @ApiPropertyOptional({ description: 'Platform commission on rentals (0–1)', example: 0.1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  rentalCommissionRate?: number;

  @ApiPropertyOptional({
    description: 'Member discount on purchases for ad-free subscribers (0–1)',
    example: 0.1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  subscriberPurchaseDiscountRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minBookPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxBookPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  minRentalPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxRentalPrice?: number;

  @ApiPropertyOptional({
    description: 'Two rental period lengths in days (shorter first)',
    example: [15, 30],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsNumber({}, { each: true })
  @Min(1, { each: true })
  @Max(365, { each: true })
  rentalPeriodDays?: [number, number];
}

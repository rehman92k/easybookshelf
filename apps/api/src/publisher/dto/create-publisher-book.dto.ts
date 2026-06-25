import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookFormat } from '@easybookshelf/database';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class RentalPriceDto {
  @ApiProperty({ example: 15 })
  @IsInt()
  @Min(1)
  @Max(365)
  days!: number;

  @ApiProperty({ example: 49 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(9)
  @Max(999)
  price!: number;
}

class BookPricesDto {
  @ApiProperty({ example: 299 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(9)
  @Max(9999)
  purchase!: number;

  @ApiProperty({
    type: [RentalPriceDto],
    example: [
      { days: 15, price: 49 },
      { days: 30, price: 79 },
    ],
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => RentalPriceDto)
  rentals!: RentalPriceDto[];
}

export class CreatePublisherBookDto {
  @ApiProperty({ example: 'My First Book' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subtitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({ example: 'Priya Sharma' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  authorName!: string;

  @ApiPropertyOptional({ example: '9780141036144' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  isbn?: string;

  @ApiProperty({ enum: BookFormat, example: BookFormat.epub })
  @IsEnum(BookFormat)
  format!: BookFormat;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  previewPageCount?: number;

  @ApiProperty({ type: [String], example: ['uuid-category-id'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  categoryIds!: string[];

  @ApiProperty({ type: [String], example: ['uuid-language-id'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  languageIds!: string[];

  @ApiProperty({ type: BookPricesDto })
  @ValidateNested()
  @Type(() => BookPricesDto)
  prices!: BookPricesDto;
}

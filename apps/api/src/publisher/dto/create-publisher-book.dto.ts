import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookFormat } from '@easybookshelf/database';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
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

class BookPricesDto {
  @ApiProperty({ example: 299 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(9)
  @Max(9999)
  purchase!: number;

  @ApiProperty({ example: 49 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(9)
  @Max(999)
  rental15!: number;

  @ApiProperty({ example: 79 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(9)
  @Max(999)
  rental30!: number;
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

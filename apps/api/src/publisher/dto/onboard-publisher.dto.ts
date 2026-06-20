import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PublisherType } from '@easybookshelf/database';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class OnboardPublisherDto {
  @ApiProperty({ example: 'Priya Sharma Publishing' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: PublisherType, example: PublisherType.author })
  @IsEnum(PublisherType)
  type!: PublisherType;

  @ApiPropertyOptional({ example: 'priya-sharma' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters, numbers, and hyphens',
  })
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

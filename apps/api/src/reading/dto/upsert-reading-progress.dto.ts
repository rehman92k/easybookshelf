import { IsEnum, IsNumber, IsObject, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BookFileFormat } from '@easybookshelf/database';

export class UpsertReadingProgressDto {
  @ApiProperty({ enum: BookFileFormat })
  @IsEnum(BookFileFormat)
  format!: BookFileFormat;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  position!: Record<string, unknown>;

  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercent!: number;
}

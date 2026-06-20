import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class WishlistBookDto {
  @ApiProperty()
  @IsString()
  bookSlug!: string;
}

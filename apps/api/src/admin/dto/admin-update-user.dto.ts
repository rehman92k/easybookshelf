import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRoleType, UserStatus } from '@easybookshelf/database';
import { IsArray, IsEnum, IsOptional } from 'class-validator';

export class AdminUpdateUserDto {
  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    enum: UserRoleType,
    isArray: true,
    description: 'Replaces global roles for the user',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(UserRoleType, { each: true })
  roles?: UserRoleType[];
}

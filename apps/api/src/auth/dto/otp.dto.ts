import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';

export enum OtpChannelDto {
  phone = 'phone',
  email = 'email',
}

export class VerifyOtpDto {
  @ApiProperty({ description: 'Firebase ID token for the signed-in user' })
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit verification code' })
  code!: string;
}

export class SendOtpDto {
  @ApiProperty({ description: 'Firebase ID token for the signed-in user' })
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @ApiProperty({ enum: OtpChannelDto, example: OtpChannelDto.phone })
  @IsEnum(OtpChannelDto)
  channel!: OtpChannelDto;
}

/** @deprecated Use SendOtpDto */
export class SendPhoneOtpDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}

/** @deprecated Use VerifyOtpDto */
export class VerifyPhoneOtpDto extends VerifyOtpDto {}

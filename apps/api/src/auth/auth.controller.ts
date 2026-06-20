import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { OtpChannel } from '@easybookshelf/database';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { LoginDto } from './dto/login.dto';
import { SendOtpDto, SendPhoneOtpDto, VerifyOtpDto, VerifyPhoneOtpDto } from './dto/otp.dto';
import { CurrentUser, Public, RequestUser } from './decorators/auth.decorators';

const REFRESH_COOKIE = 'refresh_token';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessions: SessionService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Exchange Firebase ID token for API access token' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.loginWithFirebaseToken(
      dto.idToken,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
      {
        phone: dto.phone,
        displayName: dto.displayName,
      },
    );

    this.setRefreshCookie(res, result.sessionId);

    return {
      user: result.user,
      tokens: result.tokens,
    };
  }

  @Public()
  @Post('otp/send')
  @ApiOperation({ summary: 'Send verification OTP to email or mobile' })
  sendOtp(@Body() dto: SendOtpDto) {
    const channel = dto.channel === 'phone' ? OtpChannel.phone : OtpChannel.email;
    return this.authService.sendOtp(dto.idToken, channel);
  }

  @Public()
  @Post('otp/verify')
  @ApiOperation({ summary: 'Verify OTP and complete sign-in' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyOtp(
      dto.idToken,
      dto.code,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    );

    this.setRefreshCookie(res, result.sessionId);

    return {
      user: result.user,
      tokens: result.tokens,
    };
  }

  @Public()
  @Post('phone/send-otp')
  @ApiOperation({ summary: 'Send mobile verification OTP (legacy)' })
  sendPhoneOtp(@Body() dto: SendPhoneOtpDto) {
    return this.authService.sendPhoneOtp(dto.idToken);
  }

  @Public()
  @Post('phone/verify')
  @ApiOperation({ summary: 'Verify mobile OTP and complete sign-in (legacy)' })
  async verifyPhoneOtp(
    @Body() dto: VerifyPhoneOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyPhoneOtp(
      dto.idToken,
      dto.code,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    );

    this.setRefreshCookie(res, result.sessionId);

    return {
      user: result.user,
      tokens: result.tokens,
    };
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using HttpOnly cookie' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionId = req.cookies?.[REFRESH_COOKIE] as string | undefined;

    if (!sessionId) {
      throw new UnauthorizedException({
        code: 'NO_REFRESH_TOKEN',
        message: 'Refresh token missing. Please sign in again.',
      });
    }

    const tokens = await this.authService.refreshAccessToken(sessionId);
    this.setRefreshCookie(res, sessionId);

    return { tokens };
  }

  @Post('token/refresh')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Re-issue access token with latest roles (Bearer auth)' })
  async refreshToken(@CurrentUser() user: RequestUser) {
    const tokens = await this.authService.reissueAccessToken(user.userId, user.sessionId);
    return { tokens };
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke current session' })
  async logout(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionId = (req.cookies?.[REFRESH_COOKIE] as string) ?? user.sessionId;
    await this.authService.logout(sessionId, user.userId);
    this.clearRefreshCookie(res);
    return { success: true };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  me(@CurrentUser() user: RequestUser) {
    return user.user;
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active sessions (devices)' })
  async listSessions(@CurrentUser() user: RequestUser) {
    const sessions = await this.sessions.listActiveSessions(user.userId);
    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        deviceFingerprint: s.deviceFingerprint,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        current: s.id === user.sessionId,
      })),
    };
  }

  @Delete('sessions/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session' })
  async revokeSession(@CurrentUser() user: RequestUser, @Param('id') sessionId: string) {
    const revoked = await this.sessions.revokeSession(sessionId, user.userId);
    return { success: revoked };
  }

  private setRefreshCookie(res: Response, sessionId: string) {
    const days = Number(this.config.get('JWT_REFRESH_EXPIRES_DAYS') ?? 30);
    const isProduction = this.config.get('NODE_ENV') === 'production';

    res.cookie(REFRESH_COOKIE, sessionId, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: days * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
  }
}

import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpChannel } from '@easybookshelf/database';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';

const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 30;

@Injectable()
export class OtpVerificationService {
  private readonly logger = new Logger(OtpVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 4) return digits;
    return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
  }

  maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return email;
    if (local.length <= 2) return `**@${domain}`;
    return `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
  }

  async sendOtp(userId: string, channel: OtpChannel, destination: string): Promise<void> {
    const recent = await this.prisma.otpChallenge.findFirst({
      where: { userId, channel },
      orderBy: { createdAt: 'desc' },
    });

    if (recent) {
      const secondsSince = (Date.now() - recent.createdAt.getTime()) / 1000;
      if (secondsSince < RESEND_COOLDOWN_SECONDS) {
        throw new HttpException(
          {
            code: 'OTP_RESEND_COOLDOWN',
            message: `Wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSince)} seconds before requesting another code`,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    await this.prisma.otpChallenge.deleteMany({ where: { userId } });

    const code = String(randomInt(100000, 999999));
    const expiresMinutes = Number(this.config.get('PHONE_OTP_EXPIRES_MINUTES') ?? 10);

    await this.prisma.otpChallenge.create({
      data: {
        userId,
        channel,
        destination,
        codeHash: this.hashCode(code),
        expiresAt: new Date(Date.now() + expiresMinutes * 60 * 1000),
      },
    });

    if (channel === OtpChannel.phone) {
      await this.sms.sendOtp(destination, code);
    } else {
      await this.email.sendOtp(destination, code);
    }

    const devCode = this.getDevOtpCode();
    if (devCode) {
      this.logger.log(`[DEV] Or enter fixed code: ${devCode}`);
    }
  }

  private getDevOtpCode(): string | null {
    if (this.config.get<string>('PHONE_OTP_DEV_MODE') === 'false') {
      return null;
    }
    const devCode = this.config.get<string>('PHONE_OTP_DEV_CODE')?.trim();
    if (!devCode || !/^\d{6}$/.test(devCode)) {
      return null;
    }
    return devCode;
  }

  async verifyOtp(userId: string, code: string): Promise<void> {
    const devCode = this.getDevOtpCode();
    if (devCode && code === devCode) {
      await this.prisma.otpChallenge.deleteMany({ where: { userId } });
      return;
    }

    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge) {
      throw new BadRequestException({
        code: 'OTP_NOT_FOUND',
        message: 'No verification code found. Request a new code.',
      });
    }

    if (challenge.expiresAt.getTime() < Date.now()) {
      await this.prisma.otpChallenge.delete({ where: { id: challenge.id } });
      throw new BadRequestException({
        code: 'OTP_EXPIRED',
        message: 'Verification code expired. Request a new code.',
      });
    }

    if (challenge.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException({
        code: 'OTP_MAX_ATTEMPTS',
        message: 'Too many failed attempts. Request a new code.',
      });
    }

    const valid = this.verifyHash(code, challenge.codeHash);
    if (!valid) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException({
        code: 'OTP_INVALID',
        message: 'Invalid verification code',
      });
    }

    await this.prisma.otpChallenge.deleteMany({ where: { userId } });
  }

  private hashCode(code: string): string {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    return createHmac('sha256', secret).update(code).digest('hex');
  }

  private verifyHash(code: string, hash: string): boolean {
    const next = Buffer.from(this.hashCode(code));
    const expected = Buffer.from(hash);
    if (next.length !== expected.length) return false;
    return timingSafeEqual(next, expected);
  }
}

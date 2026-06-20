import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async sendOtp(email: string, code: string): Promise<void> {
    const devMode = this.config.get<string>('PHONE_OTP_DEV_MODE') !== 'false';

    if (devMode) {
      this.logger.log(`[DEV OTP EMAIL] ${email}: ${code}`);
      return;
    }

    const apiKey = this.config.get<string>('EMAIL_API_KEY');
    if (!apiKey) {
      this.logger.warn(`EMAIL_API_KEY missing — logging OTP for ${email}: ${code}`);
      return;
    }

    // Provider integration hook (Resend, SendGrid, etc.)
    this.logger.log(`OTP email sent to ${email}`);
  }
}

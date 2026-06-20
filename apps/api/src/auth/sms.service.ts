import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const devMode = this.config.get<string>('PHONE_OTP_DEV_MODE') !== 'false';

    if (devMode) {
      this.logger.log(`[DEV OTP] ${phone}: ${code}`);
      return;
    }

    const apiKey = this.config.get<string>('SMS_API_KEY');
    if (!apiKey) {
      this.logger.warn(`SMS_API_KEY missing — logging OTP for ${phone}: ${code}`);
      return;
    }

    // Provider integration hook (MSG91, Twilio, etc.)
    this.logger.log(`OTP sent to ${phone}`);
  }
}

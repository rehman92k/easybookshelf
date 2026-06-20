import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@easybookshelf/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  connected = false;

  async onModuleInit() {
    try {
      await this.$connect();
      this.connected = true;
      this.logger.log('Database connected');
    } catch {
      this.connected = false;
      this.logger.warn(
        'Database not available — API runs in degraded mode. Start PostgreSQL: pnpm docker:up',
      );
    }
  }

  async onModuleDestroy() {
    if (this.connected) {
      await this.$disconnect();
    }
  }

  async ping(): Promise<boolean> {
    try {
      if (!this.connected) {
        await this.$connect();
        this.connected = true;
      }
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      this.connected = false;
      return false;
    }
  }
}

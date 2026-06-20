import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Public()
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const database = (await this.prisma.ping()) ? 'ok' : 'error';
    const status = database === 'ok' ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      services: {
        database,
      },
      ...(database === 'error' && {
        hint: 'Start PostgreSQL: pnpm docker:up (requires Docker Desktop)',
      }),
    };
  }
}

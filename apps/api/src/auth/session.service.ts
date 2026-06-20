import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const MAX_SESSIONS_PER_USER = 5;

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private getRefreshExpiresDays(): number {
    return Number(this.config.get('JWT_REFRESH_EXPIRES_DAYS') ?? 30);
  }

  async createSession(params: {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
  }) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.getRefreshExpiresDays());

    const session = await this.prisma.session.create({
      data: {
        userId: params.userId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        deviceFingerprint: params.deviceFingerprint,
        expiresAt,
      },
    });

    await this.enforceSessionLimit(params.userId);

    return session;
  }

  async findValidSession(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      return null;
    }

    return session;
  }

  async revokeSession(sessionId: string, userId?: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) return false;
    if (userId && session.userId !== userId) return false;

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    return true;
  }

  async revokeAllSessions(userId: string, exceptSessionId?: string) {
    await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }

  async listActiveSessions(userId: string) {
    return this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        deviceFingerprint: true,
        createdAt: true,
        expiresAt: true,
      },
    });
  }

  private async enforceSessionLimit(userId: string) {
    const active = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (active.length <= MAX_SESSIONS_PER_USER) return;

    const toRevoke = active.slice(0, active.length - MAX_SESSIONS_PER_USER);
    await this.prisma.session.updateMany({
      where: { id: { in: toRevoke.map((s) => s.id) } },
      data: { revokedAt: new Date() },
    });
  }
}

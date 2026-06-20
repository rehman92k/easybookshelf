import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRoleType, UserStatus } from '@easybookshelf/database';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async listUsers(page = 1, pageSize = 20, search?: string) {
    const skip = (page - 1) * pageSize;
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { displayName: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { roles: true },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => this.toAdminUser(u)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    return this.toAdminUser(user);
  }

  async updateUser(
    userId: string,
    dto: AdminUpdateUserDto,
    actorId: string,
    ipAddress?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.status !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: { status: dto.status },
        });
      }

      if (dto.roles !== undefined) {
        await tx.userRole.deleteMany({
          where: { userId, scopeType: 'global' },
        });

        if (dto.roles.length > 0) {
          await tx.userRole.createMany({
            data: dto.roles.map((role) => ({
              userId,
              role,
              scopeType: 'global' as const,
            })),
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId,
          action: 'admin.user.update',
          resourceType: 'user',
          resourceId: userId,
          metadata: {
            changes: {
              ...(dto.status !== undefined ? { status: dto.status } : {}),
              ...(dto.roles !== undefined ? { roles: dto.roles } : {}),
            },
          },
          ipAddress,
        },
      });
    });

    return this.getUser(userId);
  }

  private toAdminUser(user: {
    id: string;
    email: string | null;
    phone: string | null;
    displayName: string;
    avatarUrl: string | null;
    status: UserStatus;
    createdAt: Date;
    roles: { role: UserRoleType }[];
  }) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      status: user.status,
      roles: user.roles.map((r) => r.role),
      createdAt: user.createdAt.toISOString(),
    };
  }
}

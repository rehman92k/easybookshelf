import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async getProfile(userId: string) {
    return this.authService.getUserById(userId);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    if (dto.phone !== undefined && !dto.phone.trim()) {
      throw new BadRequestException({
        code: 'PHONE_REQUIRED',
        message: 'Mobile number is required',
      });
    }

    if (dto.phone && dto.phone !== user.phone) {
      const phoneTaken = await this.prisma.user.findFirst({
        where: { phone: dto.phone, NOT: { id: userId } },
      });
      if (phoneTaken) {
        throw new ConflictException({
          code: 'PHONE_IN_USE',
          message: 'This mobile number is already registered',
        });
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.phone !== undefined
          ? {
              phone: dto.phone,
              ...(dto.phone !== user.phone ? { phoneVerifiedAt: null } : {}),
            }
          : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
      include: { roles: true },
    });

    return this.authService.getUserById(updated.id);
  }
}

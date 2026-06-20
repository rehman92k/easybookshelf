import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PublisherStatus, PublisherType, UserRoleType } from '@easybookshelf/database';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardPublisherDto } from './dto/onboard-publisher.dto';
import { UpdatePublisherProfileDto } from './dto/update-publisher-profile.dto';

@Injectable()
export class PublisherService {
  constructor(private readonly prisma: PrismaService) {}

  async onboard(userId: string, dto: OnboardPublisherDto) {
    const existing = await this.prisma.publisher.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException({
        code: 'PUBLISHER_EXISTS',
        message: 'Publisher profile already exists',
      });
    }

    const slug = dto.slug ?? this.slugify(dto.name);
    const slugTaken = await this.prisma.publisher.findUnique({ where: { slug } });
    if (slugTaken) {
      throw new ConflictException({ code: 'SLUG_TAKEN', message: 'Publisher slug is taken' });
    }

    const role =
      dto.type === PublisherType.author ? UserRoleType.author : UserRoleType.publisher;

    const publisher = await this.prisma.$transaction(async (tx) => {
      const hasRole = await tx.userRole.findFirst({
        where: { userId, role, scopeType: 'global' },
      });

      if (!hasRole) {
        await tx.userRole.create({
          data: { userId, role, scopeType: 'global' },
        });
      }

      return tx.publisher.create({
        data: {
          userId,
          type: dto.type,
          name: dto.name,
          slug,
          description: dto.description,
          status: PublisherStatus.pending,
        },
      });
    });

    return this.toProfile(publisher);
  }

  async getProfile(userId: string) {
    const publisher = await this.prisma.publisher.findUnique({ where: { userId } });
    if (!publisher) {
      throw new NotFoundException({
        code: 'PUBLISHER_NOT_FOUND',
        message: 'Publisher profile not found. Complete onboarding first.',
      });
    }

    return this.toProfile(publisher);
  }

  async updateProfile(userId: string, dto: UpdatePublisherProfileDto) {
    const publisher = await this.prisma.publisher.findUnique({ where: { userId } });
    if (!publisher) {
      throw new NotFoundException({
        code: 'PUBLISHER_NOT_FOUND',
        message: 'Publisher profile not found. Complete onboarding first.',
      });
    }

    const name = dto.name !== undefined ? dto.name.trim() : publisher.name;
    const addressLine =
      dto.addressLine !== undefined ? dto.addressLine.trim() : (publisher.addressLine ?? '');
    const state = dto.state !== undefined ? dto.state.trim() : (publisher.state ?? '');
    const country = dto.country !== undefined ? dto.country.trim() : (publisher.country ?? '');
    const pincode = dto.pincode !== undefined ? dto.pincode.trim() : (publisher.pincode ?? '');

    this.assertPublisherContactFields({ name, addressLine, state, country, pincode });

    const updated = await this.prisma.publisher.update({
      where: { id: publisher.id },
      data: {
        ...(dto.name !== undefined ? { name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.addressLine !== undefined ? { addressLine: addressLine || null } : {}),
        ...(dto.state !== undefined ? { state: state || null } : {}),
        ...(dto.country !== undefined ? { country: country || null } : {}),
        ...(dto.pincode !== undefined ? { pincode: pincode || null } : {}),
      },
    });

    return this.toProfile(updated);
  }

  private assertPublisherContactFields(fields: {
    name: string;
    addressLine: string;
    state: string;
    country: string;
    pincode: string;
  }) {
    if (!fields.name) {
      throw new BadRequestException({
        code: 'PUBLISHER_NAME_REQUIRED',
        message: 'Publishing brand name is required',
      });
    }
    if (!fields.addressLine) {
      throw new BadRequestException({
        code: 'PUBLISHER_ADDRESS_REQUIRED',
        message: 'Address is required',
      });
    }
    if (!fields.state) {
      throw new BadRequestException({
        code: 'PUBLISHER_STATE_REQUIRED',
        message: 'State is required',
      });
    }
    if (!fields.country) {
      throw new BadRequestException({
        code: 'PUBLISHER_COUNTRY_REQUIRED',
        message: 'Country is required',
      });
    }
    if (!fields.pincode) {
      throw new BadRequestException({
        code: 'PUBLISHER_PINCODE_REQUIRED',
        message: 'Postal code is required',
      });
    }
    if (!this.isValidPostalCode(fields.country, fields.pincode)) {
      throw new BadRequestException({
        code: 'PUBLISHER_PINCODE_INVALID',
        message:
          fields.country === 'India'
            ? 'Enter a valid 6-digit PIN code'
            : 'Enter a valid postal code',
      });
    }
  }

  private isValidPostalCode(country: string, pincode: string): boolean {
    const code = pincode.trim();
    if (!code) return false;
    if (country === 'India') return /^\d{6}$/.test(code);
    if (country === 'United States') return /^\d{5}(-\d{4})?$/.test(code);
    if (country === 'United Kingdom') return /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(code);
    if (country === 'Canada') return /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(code);
    return /^[A-Za-z0-9\s-]{3,12}$/.test(code);
  }

  async requirePublisher(userId: string): Promise<{
    id: string;
    userId: string;
    name: string;
    slug: string;
    type: PublisherType;
    status: PublisherStatus;
  }> {
    const publisher = await this.prisma.publisher.findUnique({ where: { userId } });
    if (!publisher) {
      throw new ForbiddenException({
        code: 'PUBLISHER_REQUIRED',
        message: 'Publisher profile required. Complete onboarding first.',
      });
    }

    if (publisher.status === PublisherStatus.suspended) {
      throw new ForbiddenException({
        code: 'PUBLISHER_SUSPENDED',
        message: 'Publisher account is suspended',
      });
    }

    return publisher;
  }

  private toProfile(publisher: {
    id: string;
    name: string;
    slug: string;
    type: PublisherType;
    status: PublisherStatus;
    description: string | null;
    addressLine: string | null;
    state: string | null;
    country: string | null;
    pincode: string | null;
    createdAt: Date;
  }) {
    return {
      id: publisher.id,
      name: publisher.name,
      slug: publisher.slug,
      type: publisher.type,
      status: publisher.status,
      description: publisher.description,
      addressLine: publisher.addressLine,
      state: publisher.state,
      country: publisher.country,
      pincode: publisher.pincode,
      createdAt: publisher.createdAt.toISOString(),
    };
  }

  private slugify(value: string) {
    const base = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);

    return `${base}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

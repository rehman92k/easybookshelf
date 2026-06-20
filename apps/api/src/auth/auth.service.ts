import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRoleType, UserStatus } from '@easybookshelf/database';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from './firebase.service';
import { OtpChannel } from '@easybookshelf/database';
import { OtpVerificationService } from './otp-verification.service';
import { SessionService } from './session.service';
import { AuthUserResponse, JwtPayload, LoginResponse } from './auth.types';

type FirebaseIdentity = {
  uid: string;
  email?: string;
  phone_number?: string;
  name?: string;
  picture?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
    private readonly otpVerification: OtpVerificationService,
    private readonly sessions: SessionService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private getAccessExpiresSeconds(): number {
    return Number(this.config.get('JWT_ACCESS_EXPIRES_SECONDS') ?? 900);
  }

  async loginWithFirebaseToken(
    idToken: string,
    meta: { ipAddress?: string; userAgent?: string; deviceFingerprint?: string },
    options?: { phone?: string; displayName?: string },
  ): Promise<LoginResponse & { sessionId: string }> {
    const decoded = await this.decodeFirebaseToken(idToken);

    let user = await this.upsertUserFromFirebase(decoded);
    if (options?.displayName?.trim() || options?.phone) {
      user = await this.applyRegistrationProfile(user.id, options);
    }

    if (user.status === UserStatus.suspended) {
      throw new ForbiddenException({
        code: 'ACCOUNT_SUSPENDED',
        message: 'Your account has been suspended',
      });
    }

    await this.ensureAccountVerified(user);

    return this.createAuthenticatedSession(user, meta);
  }

  async sendOtp(
    idToken: string,
    channel: OtpChannel,
  ): Promise<{ channel: OtpChannel; destinationMasked: string }> {
    const user = await this.getUserFromFirebaseToken(idToken);

    if (user.phoneVerifiedAt) {
      throw new BadRequestException({
        code: 'ALREADY_VERIFIED',
        message: 'Account is already verified',
      });
    }

    const destination = channel === OtpChannel.phone ? user.phone : user.email;
    if (!destination) {
      throw new BadRequestException({
        code: channel === OtpChannel.phone ? 'PHONE_REQUIRED' : 'EMAIL_REQUIRED',
        message:
          channel === OtpChannel.phone
            ? 'Add a mobile number before requesting a verification code'
            : 'Add an email address before requesting a verification code',
      });
    }

    await this.otpVerification.sendOtp(user.id, channel, destination);

    return {
      channel,
      destinationMasked:
        channel === OtpChannel.phone
          ? this.otpVerification.maskPhone(destination)
          : this.otpVerification.maskEmail(destination),
    };
  }

  /** @deprecated Use sendOtp with channel phone */
  async sendPhoneOtp(idToken: string): Promise<{ phoneMasked: string }> {
    const result = await this.sendOtp(idToken, OtpChannel.phone);
    return { phoneMasked: result.destinationMasked };
  }

  async verifyOtp(
    idToken: string,
    code: string,
    meta: { ipAddress?: string; userAgent?: string; deviceFingerprint?: string },
  ): Promise<LoginResponse & { sessionId: string }> {
    const user = await this.getUserFromFirebaseToken(idToken);

    if (user.phoneVerifiedAt) {
      return this.createAuthenticatedSession(user, meta);
    }

    await this.otpVerification.verifyOtp(user.id, code);

    const verified = await this.prisma.user.update({
      where: { id: user.id },
      data: { phoneVerifiedAt: new Date() },
      include: { roles: true },
    });

    return this.createAuthenticatedSession(verified, meta);
  }

  /** @deprecated Use verifyOtp */
  async verifyPhoneOtp(
    idToken: string,
    code: string,
    meta: { ipAddress?: string; userAgent?: string; deviceFingerprint?: string },
  ): Promise<LoginResponse & { sessionId: string }> {
    return this.verifyOtp(idToken, code, meta);
  }

  async refreshAccessToken(sessionId: string): Promise<LoginResponse['tokens']> {
    const session = await this.sessions.findValidSession(sessionId);
    if (!session) {
      throw new UnauthorizedException({
        code: 'INVALID_SESSION',
        message: 'Session expired or revoked. Please sign in again.',
      });
    }

    return this.issueAccessTokenForSession(session.userId, sessionId);
  }

  async reissueAccessToken(userId: string, sessionId: string): Promise<LoginResponse['tokens']> {
    const session = await this.sessions.findValidSession(sessionId);
    if (!session || session.userId !== userId) {
      throw new UnauthorizedException({
        code: 'INVALID_SESSION',
        message: 'Session expired or revoked. Please sign in again.',
      });
    }

    return this.issueAccessTokenForSession(userId, sessionId);
  }

  async logout(sessionId: string, userId?: string) {
    await this.sessions.revokeSession(sessionId, userId);
  }

  async getUserById(userId: string): Promise<AuthUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    if (!user) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    return this.toAuthUser(user);
  }

  async validateJwtPayload(payload: JwtPayload) {
    const session = await this.sessions.findValidSession(payload.sessionId);
    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: true },
    });

    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException();
    }

    if (this.needsAccountVerification(user)) {
      throw new UnauthorizedException({
        code: 'VERIFICATION_REQUIRED',
        message: 'Verify your account to continue',
      });
    }

    return {
      userId: user.id,
      sessionId: payload.sessionId,
      roles: user.roles.map((r) => r.role),
      user: this.toAuthUser(user),
    };
  }

  async tryGetUserIdFromBearer(authorization?: string): Promise<string | null> {
    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }

    try {
      const token = authorization.slice('Bearer '.length);
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      const validated = await this.validateJwtPayload(payload);
      return validated.userId;
    } catch {
      return null;
    }
  }

  private async decodeFirebaseToken(idToken: string): Promise<FirebaseIdentity> {
    if (!this.firebase.isConfigured()) {
      throw new ForbiddenException({
        code: 'FIREBASE_NOT_CONFIGURED',
        message:
          'Server Firebase credentials are missing. Add firebase-service-account.json to apps/api/ and set FIREBASE_SERVICE_ACCOUNT_PATH in .env, then restart the API.',
      });
    }

    return this.firebase.verifyIdToken(idToken).catch(() => {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired Firebase token',
      });
    });
  }

  private async getUserFromFirebaseToken(idToken: string) {
    const decoded = await this.decodeFirebaseToken(idToken);
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      include: { roles: true },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'Account not found. Complete registration first.',
      });
    }

    return user;
  }

  private async applyRegistrationProfile(
    userId: string,
    options?: { phone?: string; displayName?: string },
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: true },
    });

    const data: {
      displayName?: string;
      phone?: string;
      phoneVerifiedAt?: null;
    } = {};

    if (options?.displayName?.trim()) {
      data.displayName = options.displayName.trim();
    }

    if (options?.phone) {
      if (options.phone !== user.phone) {
        const phoneTaken = await this.prisma.user.findFirst({
          where: { phone: options.phone, NOT: { id: user.id } },
        });
        if (phoneTaken) {
          throw new ConflictException({
            code: 'PHONE_IN_USE',
            message: 'This mobile number is already registered',
          });
        }
        data.phone = options.phone;
        data.phoneVerifiedAt = null;
      }
    }

    if (Object.keys(data).length === 0) {
      return user;
    }

    return this.prisma.user.update({
      where: { id: user.id },
      data,
      include: { roles: true },
    });
  }

  private needsAccountVerification(user: {
    phone: string | null;
    email: string | null;
    phoneVerifiedAt: Date | null;
  }) {
    return !user.phoneVerifiedAt && Boolean(user.phone || user.email);
  }

  private buildVerificationPayload(user: { phone: string | null; email: string | null }) {
    return {
      code: 'VERIFICATION_REQUIRED' as const,
      message: 'Verify your account to continue',
      phoneMasked: user.phone ? this.otpVerification.maskPhone(user.phone) : undefined,
      emailMasked: user.email ? this.otpVerification.maskEmail(user.email) : undefined,
    };
  }

  private async ensureAccountVerified(user: {
    phone: string | null;
    email: string | null;
    phoneVerifiedAt: Date | null;
  }) {
    if (!this.needsAccountVerification(user)) {
      return;
    }

    throw new ForbiddenException(this.buildVerificationPayload(user));
  }

  private async createAuthenticatedSession(
    user: {
      id: string;
      email: string | null;
      phone: string | null;
      displayName: string;
      avatarUrl: string | null;
      status: UserStatus;
      phoneVerifiedAt: Date | null;
      createdAt: Date;
      roles: { role: UserRoleType }[];
    },
    meta: { ipAddress?: string; userAgent?: string; deviceFingerprint?: string },
  ) {
    const session = await this.sessions.createSession({
      userId: user.id,
      ...meta,
    });

    const roles = user.roles.map((r) => r.role);
    const accessToken = await this.signAccessToken(user.id, session.id, roles);

    return {
      user: this.toAuthUser(user),
      tokens: {
        accessToken,
        expiresIn: this.getAccessExpiresSeconds(),
        tokenType: 'Bearer' as const,
      },
      sessionId: session.id,
    };
  }

  private async issueAccessTokenForSession(userId: string, sessionId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });

    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException({
        code: 'INVALID_SESSION',
        message: 'Session expired or revoked. Please sign in again.',
      });
    }

    if (this.needsAccountVerification(user)) {
      throw new UnauthorizedException({
        code: 'VERIFICATION_REQUIRED',
        message: 'Verify your account to continue',
      });
    }

    const roles = user.roles.map((r) => r.role);
    const accessToken = await this.signAccessToken(user.id, sessionId, roles);

    return {
      accessToken,
      expiresIn: this.getAccessExpiresSeconds(),
      tokenType: 'Bearer' as const,
    };
  }

  private async signAccessToken(userId: string, sessionId: string, roles: UserRoleType[]) {
    const payload: JwtPayload = { sub: userId, sessionId, roles };
    return this.jwt.signAsync(payload, {
      expiresIn: this.getAccessExpiresSeconds(),
    });
  }

  private async upsertUserFromFirebase(decoded: FirebaseIdentity) {
    const existing = await this.prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      include: { roles: true },
    });

    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          email: decoded.email ?? existing.email,
          displayName: decoded.name ?? existing.displayName,
          avatarUrl: decoded.picture ?? existing.avatarUrl,
        },
        include: { roles: true },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firebaseUid: decoded.uid,
          email: decoded.email ?? null,
          phone: decoded.phone_number ?? null,
          displayName: decoded.name ?? decoded.email?.split('@')[0] ?? 'Reader',
          avatarUrl: decoded.picture ?? null,
          status: UserStatus.active,
        },
      });

      await tx.userRole.create({
        data: {
          userId: user.id,
          role: UserRoleType.reader,
        },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { roles: true },
      });
    });
  }

  private toAuthUser(user: {
    id: string;
    email: string | null;
    phone: string | null;
    displayName: string;
    avatarUrl: string | null;
    status: UserStatus;
    phoneVerifiedAt: Date | null;
    createdAt: Date;
    roles: { role: UserRoleType }[];
  }): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      phoneVerified: Boolean(user.phoneVerifiedAt),
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      roles: user.roles.map((r) => r.role),
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

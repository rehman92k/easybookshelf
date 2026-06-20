import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { UserRoleType } from '@easybookshelf/database';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRoleType[]) => SetMetadata(ROLES_KEY, roles);

export interface RequestUser {
  userId: string;
  sessionId: string;
  roles: UserRoleType[];
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    displayName: string;
    avatarUrl: string | null;
    roles: string[];
    status: string;
    createdAt: string;
  };
}

export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
    return data ? request.user?.[data] : request.user;
  },
);

export const Public = () => SetMetadata('isPublic', true);

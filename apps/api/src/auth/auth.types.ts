import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  sub: string;
  sessionId: string;
  roles: string[];
}

export interface AuthUserResponse {
  id: string;
  email: string | null;
  phone: string | null;
  phoneVerified: boolean;
  displayName: string;
  avatarUrl: string | null;
  roles: string[];
  status: string;
  createdAt: string;
}

export interface AuthTokensResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface LoginResponse {
  user: AuthUserResponse;
  tokens: AuthTokensResponse;
}

export type { LoginDto };

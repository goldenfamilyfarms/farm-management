// Authentication and authorization types

export type UserRole = 'owner' | 'manager' | 'worker' | 'viewer';

export interface UserProfile {
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  farmId: string;
  profile: UserProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenPayload {
  userId: string;
  farmId: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

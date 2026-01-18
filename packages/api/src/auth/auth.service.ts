import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { UserRole } from '@prisma/client';

export interface TokenPayload {
  userId: string;
  farmId: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly accessTokenExpiresIn: number;
  private readonly refreshTokenExpiresIn: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessTokenExpiresIn = parseInt(
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '3600'),
      10,
    );
    this.refreshTokenExpiresIn = parseInt(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '604800'),
      10,
    );
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens({
      userId: user.id,
      farmId: user.farmId,
      role: user.role,
    });
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify<TokenPayload & { type: string }>(
        refreshToken,
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        },
      );

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return this.generateTokens({
        userId: user.id,
        farmId: user.farmId,
        role: user.role,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateToken(token: string): Promise<TokenPayload> {
    try {
      const payload = this.jwtService.verify<TokenPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      return {
        userId: payload.userId,
        farmId: payload.farmId,
        role: payload.role,
      };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  generateTokens(payload: TokenPayload): AuthTokens {
    const accessToken = this.jwtService.sign(
      { ...payload, type: 'access' },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.accessTokenExpiresIn,
      },
    );

    const refreshToken = this.jwtService.sign(
      { ...payload, type: 'refresh' },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.refreshTokenExpiresIn,
      },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTokenExpiresIn,
    };
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async comparePasswords(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}

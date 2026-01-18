import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, TokenPayload } from './auth.service';

// Define UserRole type locally to avoid Prisma client generation dependency
type UserRole = 'owner' | 'manager' | 'worker' | 'viewer';

/**
 * Property 33: JWT token contains required claims
 * *For any* successful login, the issued JWT SHALL contain:
 * userId, farmId, role, issued-at timestamp, and expiration timestamp.
 * **Validates: Requirements 9.1**
 */

// Arbitrary for valid token payload
const tokenPayloadArb = fc.record({
  userId: fc.uuid(),
  farmId: fc.uuid(),
  role: fc.constantFrom<UserRole>('owner', 'manager', 'worker', 'viewer'),
});

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: JwtService;

  const mockConfigService = {
    get: (key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        JWT_SECRET: 'test-secret-key-for-testing-purposes',
        JWT_REFRESH_SECRET: 'test-refresh-secret-key-for-testing',
        JWT_ACCESS_EXPIRES_IN: '3600',
        JWT_REFRESH_EXPIRES_IN: '604800',
      };
      return config[key] ?? defaultValue;
    },
  } as ConfigService;

  const mockPrismaService = {
    user: {
      findUnique: async () => null,
    },
  };

  beforeEach(() => {
    jwtService = new JwtService({
      secret: 'test-secret-key-for-testing-purposes',
    });

    authService = new AuthService(
      mockPrismaService as any,
      jwtService,
      mockConfigService,
    );
  });

  describe('Property 33: JWT token contains required claims', () => {
    it('should generate tokens with all required claims for any valid payload', () => {
      // Feature: farm-management-platform, Property 33: JWT token contains required claims
      fc.assert(
        fc.property(tokenPayloadArb, (payload: TokenPayload) => {
          const tokens = authService.generateTokens(payload);

          // Verify access token exists
          expect(tokens.accessToken).toBeDefined();
          expect(typeof tokens.accessToken).toBe('string');
          expect(tokens.accessToken.length).toBeGreaterThan(0);

          // Verify refresh token exists
          expect(tokens.refreshToken).toBeDefined();
          expect(typeof tokens.refreshToken).toBe('string');
          expect(tokens.refreshToken.length).toBeGreaterThan(0);

          // Verify expiresIn is set
          expect(tokens.expiresIn).toBeDefined();
          expect(typeof tokens.expiresIn).toBe('number');
          expect(tokens.expiresIn).toBeGreaterThan(0);

          // Decode and verify access token claims
          const decodedAccess = jwtService.decode(tokens.accessToken) as Record<string, unknown>;
          
          // Required claims: userId, farmId, role
          expect(decodedAccess.userId).toBe(payload.userId);
          expect(decodedAccess.farmId).toBe(payload.farmId);
          expect(decodedAccess.role).toBe(payload.role);
          
          // Required timestamps: iat (issued-at) and exp (expiration)
          expect(decodedAccess.iat).toBeDefined();
          expect(typeof decodedAccess.iat).toBe('number');
          expect(decodedAccess.exp).toBeDefined();
          expect(typeof decodedAccess.exp).toBe('number');
          
          // Expiration should be after issued-at
          expect(decodedAccess.exp).toBeGreaterThan(decodedAccess.iat as number);

          // Decode and verify refresh token claims
          const decodedRefresh = jwtService.decode(tokens.refreshToken) as Record<string, unknown>;
          
          expect(decodedRefresh.userId).toBe(payload.userId);
          expect(decodedRefresh.farmId).toBe(payload.farmId);
          expect(decodedRefresh.role).toBe(payload.role);
          expect(decodedRefresh.iat).toBeDefined();
          expect(decodedRefresh.exp).toBeDefined();
          expect(decodedRefresh.type).toBe('refresh');
        }),
        { numRuns: 100, verbose: true },
      );
    });
  });
});

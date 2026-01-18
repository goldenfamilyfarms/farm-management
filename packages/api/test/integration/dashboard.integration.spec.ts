import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

/**
 * Integration tests for Dashboard endpoint
 * Tests: GET /dashboard
 * Requirements: Integration testing
 */
describe('Dashboard Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let testFarmId: string;
  let testUserId: string;

  const testUser = {
    email: 'test-dashboard@example.com',
    password: 'TestPassword123!',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    if (testFarmId) {
      await prisma.farm.delete({ where: { id: testFarmId } }).catch(() => {});
    }
    await app.close();
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await prisma.user.deleteMany({ where: { email: testUser.email } }).catch(() => {});

    // Create test farm
    const farm = await prisma.farm.create({
      data: {
        name: 'Test Farm for Dashboard',
        timezone: 'UTC',
      },
    });
    testFarmId = farm.id;

    // Create test user
    const hashedPassword = await bcrypt.hash(testUser.password, 10);
    const user = await prisma.user.create({
      data: {
        email: testUser.email,
        passwordHash: hashedPassword,
        role: 'owner',
        farmId: testFarmId,
        profile: {},
      },
    });
    testUserId = user.id;

    // Login to get access token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });
    accessToken = loginResponse.body.accessToken;
  });

  describe('GET /dashboard', () => {
    it('should return dashboard data for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Dashboard should return overview data
      expect(response.body).toBeDefined();
      expect(typeof response.body).toBe('object');
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/dashboard')
        .expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});

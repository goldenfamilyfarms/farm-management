import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

/**
 * Integration tests for Time Card endpoints
 * Tests: Clock in/out operations for /time-cards
 * Requirements: Integration testing, Requirements 7.1, 7.2, 7.3
 */
describe('Time Cards Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let testFarmId: string;
  let testUserId: string;
  let testWorkerId: string;

  const testUser = {
    email: 'test-timecards@example.com',
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
    // Clean up test data in correct order
    if (testWorkerId) {
      await prisma.timeCard.deleteMany({ where: { workerId: testWorkerId } }).catch(() => {});
      await prisma.worker.delete({ where: { id: testWorkerId } }).catch(() => {});
    }
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
        name: 'Test Farm for Time Cards',
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

    // Create test worker
    const worker = await prisma.worker.create({
      data: {
        userId: testUserId,
        farmId: testFarmId,
        hourlyRate: 15.0,
        employmentType: 'full_time',
        startDate: new Date(),
      },
    });
    testWorkerId = worker.id;

    // Clean up any existing time cards for this worker
    await prisma.timeCard.deleteMany({ where: { workerId: testWorkerId } }).catch(() => {});

    // Login to get access token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });
    accessToken = loginResponse.body.accessToken;
  });

  describe('POST /time-cards/clock-in', () => {
    it('should clock in a worker', async () => {
      const response = await request(app.getHttpServer())
        .post('/time-cards/clock-in')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          workerId: testWorkerId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.workerId).toBe(testWorkerId);
      expect(response.body.clockIn).toBeDefined();
      expect(response.body.status).toBe('active');
    });

    it('should clock in with GPS location', async () => {
      const response = await request(app.getHttpServer())
        .post('/time-cards/clock-in')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          workerId: testWorkerId,
          clockInLocation: {
            latitude: 40.7128,
            longitude: -74.006,
          },
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.clockInLocation).toBeDefined();
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/time-cards/clock-in')
        .send({
          workerId: testWorkerId,
        })
        .expect(401);
    });

    it('should prevent duplicate clock-in', async () => {
      // First clock-in
      await request(app.getHttpServer())
        .post('/time-cards/clock-in')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          workerId: testWorkerId,
        })
        .expect(201);

      // Second clock-in should fail
      await request(app.getHttpServer())
        .post('/time-cards/clock-in')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          workerId: testWorkerId,
        })
        .expect(400);
    });
  });

  describe('POST /time-cards/:id/clock-out', () => {
    it('should clock out a worker and calculate hours', async () => {
      // First clock in
      const clockInResponse = await request(app.getHttpServer())
        .post('/time-cards/clock-in')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          workerId: testWorkerId,
        })
        .expect(201);

      // Wait a moment to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Then clock out
      const response = await request(app.getHttpServer())
        .post(`/time-cards/${clockInResponse.body.id}/clock-out`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(200);

      expect(response.body.clockOut).toBeDefined();
      expect(response.body.totalHours).toBeDefined();
      expect(response.body.status).not.toBe('active');
    });

    it('should clock out with GPS location', async () => {
      // First clock in
      const clockInResponse = await request(app.getHttpServer())
        .post('/time-cards/clock-in')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          workerId: testWorkerId,
        })
        .expect(201);

      // Then clock out with location
      const response = await request(app.getHttpServer())
        .post(`/time-cards/${clockInResponse.body.id}/clock-out`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          clockOutLocation: {
            latitude: 40.7128,
            longitude: -74.006,
          },
        })
        .expect(200);

      expect(response.body.clockOutLocation).toBeDefined();
    });
  });

  describe('GET /time-cards', () => {
    it('should return list of time cards', async () => {
      // Create a time card
      await prisma.timeCard.create({
        data: {
          farmId: testFarmId,
          workerId: testWorkerId,
          clockIn: new Date(),
          status: 'active',
        },
      });

      const response = await request(app.getHttpServer())
        .get('/time-cards')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /time-cards/active/:workerId', () => {
    it('should return active time card for worker', async () => {
      // Create an active time card
      await prisma.timeCard.create({
        data: {
          farmId: testFarmId,
          workerId: testWorkerId,
          clockIn: new Date(),
          status: 'active',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/time-cards/active/${testWorkerId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.workerId).toBe(testWorkerId);
      expect(response.body.status).toBe('active');
    });

    it('should return null when no active time card', async () => {
      const response = await request(app.getHttpServer())
        .get(`/time-cards/active/${testWorkerId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toBeNull();
    });
  });

  describe('GET /time-cards/:id', () => {
    it('should return time card by id', async () => {
      const timeCard = await prisma.timeCard.create({
        data: {
          farmId: testFarmId,
          workerId: testWorkerId,
          clockIn: new Date(),
          status: 'active',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/time-cards/${timeCard.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(timeCard.id);
    });

    it('should return 404 for non-existent time card', async () => {
      await request(app.getHttpServer())
        .get('/time-cards/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('GET /time-cards/worker/:workerId', () => {
    it('should return all time cards for a worker', async () => {
      // Create multiple time cards
      await prisma.timeCard.createMany({
        data: [
          {
            farmId: testFarmId,
            workerId: testWorkerId,
            clockIn: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            clockOut: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 8 * 60 * 60 * 1000),
            totalHours: 8,
            status: 'approved',
          },
          {
            farmId: testFarmId,
            workerId: testWorkerId,
            clockIn: new Date(Date.now() - 24 * 60 * 60 * 1000),
            clockOut: new Date(Date.now() - 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
            totalHours: 6,
            status: 'approved',
          },
        ],
      });

      const response = await request(app.getHttpServer())
        .get(`/time-cards/worker/${testWorkerId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('DELETE /time-cards/:id', () => {
    it('should delete time card', async () => {
      const timeCard = await prisma.timeCard.create({
        data: {
          farmId: testFarmId,
          workerId: testWorkerId,
          clockIn: new Date(),
          status: 'active',
        },
      });

      await request(app.getHttpServer())
        .delete(`/time-cards/${timeCard.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Verify deletion
      const deleted = await prisma.timeCard.findUnique({
        where: { id: timeCard.id },
      });
      expect(deleted).toBeNull();
    });
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

/**
 * Integration tests for Telemetry endpoints
 * Tests: Telemetry ingestion and retrieval
 * Requirements: Integration testing, Requirements 1.1, 1.2
 */
describe('Telemetry Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let testFarmId: string;
  let testUserId: string;
  let testEquipmentId: string;

  const testUser = {
    email: 'test-telemetry@example.com',
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
      await prisma.equipment.deleteMany({ where: { farmId: testFarmId } }).catch(() => {});
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
        name: 'Test Farm for Telemetry',
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

    // Create test equipment
    const equipment = await prisma.equipment.create({
      data: {
        farmId: testFarmId,
        name: 'Test Tractor',
        type: 'tractor',
        deviceId: `device-${Date.now()}`,
        status: 'active',
      },
    });
    testEquipmentId = equipment.id;

    // Login to get access token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });
    accessToken = loginResponse.body.accessToken;
  });

  describe('POST /telemetry/ingest', () => {
    it('should accept valid telemetry payload', async () => {
      const equipment = await prisma.equipment.findUnique({
        where: { id: testEquipmentId },
      });

      const telemetryPayload = {
        deviceId: equipment?.deviceId,
        timestamp: new Date().toISOString(),
        readings: {
          operatingHours: 1234.5,
          fuelLevel: 75.5,
          speed: 15.2,
          engineRpm: 2100,
          latitude: 40.7128,
          longitude: -74.006,
        },
      };

      const response = await request(app.getHttpServer())
        .post('/telemetry/ingest')
        .send(telemetryPayload)
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });

    it('should reject invalid telemetry payload', async () => {
      const invalidPayload = {
        // Missing required deviceId
        timestamp: new Date().toISOString(),
        readings: {},
      };

      await request(app.getHttpServer())
        .post('/telemetry/ingest')
        .send(invalidPayload)
        .expect(400);
    });

    it('should handle telemetry with fault codes', async () => {
      const equipment = await prisma.equipment.findUnique({
        where: { id: testEquipmentId },
      });

      const telemetryPayload = {
        deviceId: equipment?.deviceId,
        timestamp: new Date().toISOString(),
        readings: {
          operatingHours: 1234.5,
          faultCodes: ['E001', 'E002'],
        },
      };

      const response = await request(app.getHttpServer())
        .post('/telemetry/ingest')
        .send(telemetryPayload)
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });
  });

  describe('GET /telemetry/equipment/:equipmentId', () => {
    it('should return telemetry readings for equipment', async () => {
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      const response = await request(app.getHttpServer())
        .get(`/telemetry/equipment/${testEquipmentId}`)
        .query({ startTime, endTime })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endTime = new Date().toISOString();

      await request(app.getHttpServer())
        .get(`/telemetry/equipment/${testEquipmentId}`)
        .query({ startTime, endTime })
        .expect(401);
    });
  });

  describe('GET /telemetry/equipment/:equipmentId/latest', () => {
    it('should return latest telemetry reading', async () => {
      const response = await request(app.getHttpServer())
        .get(`/telemetry/equipment/${testEquipmentId}/latest`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Response could be null if no readings exist
      expect(response.body === null || typeof response.body === 'object').toBe(true);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get(`/telemetry/equipment/${testEquipmentId}/latest`)
        .expect(401);
    });
  });
});

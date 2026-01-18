import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

/**
 * Integration tests for Equipment endpoints
 * Tests: CRUD operations for /equipment
 * Requirements: Integration testing, Requirements 1.3, 10.1
 */
describe('Equipment Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let testFarmId: string;
  let testUserId: string;

  const testUser = {
    email: 'test-equipment@example.com',
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
        name: 'Test Farm for Equipment',
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

  describe('POST /equipment', () => {
    it('should create equipment with valid data', async () => {
      const equipmentData = {
        name: 'Test Tractor',
        type: 'tractor',
        make: 'John Deere',
        model: '8R 410',
        serialNumber: 'JD-2024-001',
        deviceId: 'device-001',
      };

      const response = await request(app.getHttpServer())
        .post('/equipment')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(equipmentData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(equipmentData.name);
      expect(response.body.type).toBe(equipmentData.type);
      expect(response.body.make).toBe(equipmentData.make);
      expect(response.body.model).toBe(equipmentData.model);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/equipment')
        .send({
          name: 'Test Tractor',
          type: 'tractor',
        })
        .expect(401);
    });

    it('should return 400 for missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/equipment')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /equipment', () => {
    it('should return list of equipment', async () => {
      // Create test equipment first
      await prisma.equipment.create({
        data: {
          farmId: testFarmId,
          name: 'Test Equipment',
          type: 'tractor',
          status: 'active',
        },
      });

      const response = await request(app.getHttpServer())
        .get('/equipment')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/equipment')
        .expect(401);
    });
  });

  describe('GET /equipment/:id', () => {
    it('should return equipment by id', async () => {
      const equipment = await prisma.equipment.create({
        data: {
          farmId: testFarmId,
          name: 'Test Equipment Get',
          type: 'harvester',
          status: 'active',
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/equipment/${equipment.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(equipment.id);
      expect(response.body.name).toBe('Test Equipment Get');
    });

    it('should return 404 for non-existent equipment', async () => {
      await request(app.getHttpServer())
        .get('/equipment/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PUT /equipment/:id', () => {
    it('should update equipment', async () => {
      const equipment = await prisma.equipment.create({
        data: {
          farmId: testFarmId,
          name: 'Original Name',
          type: 'tractor',
          status: 'active',
        },
      });

      const response = await request(app.getHttpServer())
        .put(`/equipment/${equipment.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
    });
  });

  describe('DELETE /equipment/:id', () => {
    it('should delete equipment', async () => {
      const equipment = await prisma.equipment.create({
        data: {
          farmId: testFarmId,
          name: 'To Delete',
          type: 'tractor',
          status: 'active',
        },
      });

      await request(app.getHttpServer())
        .delete(`/equipment/${equipment.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Verify deletion
      const deleted = await prisma.equipment.findUnique({
        where: { id: equipment.id },
      });
      expect(deleted).toBeNull();
    });
  });
});

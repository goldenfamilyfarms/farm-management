import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

/**
 * Integration tests for Field endpoints
 * Tests: CRUD operations for /fields
 * Requirements: Integration testing, Requirements 3.1, 3.2
 */
describe('Fields Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let testFarmId: string;
  let testUserId: string;

  const testUser = {
    email: 'test-fields@example.com',
    password: 'TestPassword123!',
  };

  const validPolygon = {
    type: 'Polygon',
    coordinates: [[
      [-95.0, 40.0],
      [-95.0, 41.0],
      [-94.0, 41.0],
      [-94.0, 40.0],
      [-95.0, 40.0],
    ]],
  };

  // Helper function to create a field using raw SQL (due to PostGIS geography type)
  async function createTestField(name: string, acreage: number = 100): Promise<string> {
    const result = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO fields (id, farm_id, name, boundary, acreage, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${testFarmId}::uuid,
        ${name},
        ST_GeogFromText('POLYGON((-95.0 40.0, -95.0 41.0, -94.0 41.0, -94.0 40.0, -95.0 40.0))'),
        ${acreage},
        NOW(),
        NOW()
      )
      RETURNING id
    `;
    return result[0].id;
  }

  // Helper function to create a zone using raw SQL
  async function createTestZone(fieldId: string, name: string, acreage: number = 25): Promise<string> {
    const result = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO zones (id, field_id, name, boundary, acreage, soil_quality, created_at, updated_at)
      VALUES (
        gen_random_uuid(),
        ${fieldId}::uuid,
        ${name},
        ST_GeogFromText('POLYGON((-94.8 40.2, -94.8 40.8, -94.2 40.8, -94.2 40.2, -94.8 40.2))'),
        ${acreage},
        '{}',
        NOW(),
        NOW()
      )
      RETURNING id
    `;
    return result[0].id;
  }

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
    // Clean up test data using raw SQL
    if (testFarmId) {
      await prisma.$executeRaw`DELETE FROM zones WHERE field_id IN (SELECT id FROM fields WHERE farm_id = ${testFarmId}::uuid)`.catch(() => {});
      await prisma.$executeRaw`DELETE FROM fields WHERE farm_id = ${testFarmId}::uuid`.catch(() => {});
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
        name: 'Test Farm for Fields',
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

  describe('POST /fields', () => {
    it('should create field with valid polygon', async () => {
      const fieldData = {
        name: 'North Field',
        boundary: validPolygon,
        soilType: 'loam',
        irrigationType: 'drip',
      };

      const response = await request(app.getHttpServer())
        .post('/fields')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(fieldData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(fieldData.name);
      expect(response.body.soilType).toBe(fieldData.soilType);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/fields')
        .send({
          name: 'Test Field',
          boundary: validPolygon,
        })
        .expect(401);
    });

    it('should return 400 for missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/fields')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Test Field' })
        .expect(400);
    });
  });

  describe('GET /fields', () => {
    it('should return list of fields', async () => {
      // Create test field using raw SQL
      await createTestField('Test Field');

      const response = await request(app.getHttpServer())
        .get('/fields')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .get('/fields')
        .expect(401);
    });
  });

  describe('GET /fields/:id', () => {
    it('should return field by id', async () => {
      const fieldId = await createTestField('Test Field Get', 50);

      const response = await request(app.getHttpServer())
        .get(`/fields/${fieldId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(fieldId);
      expect(response.body.name).toBe('Test Field Get');
    });

    it('should return 404 for non-existent field', async () => {
      await request(app.getHttpServer())
        .get('/fields/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PUT /fields/:id', () => {
    it('should update field', async () => {
      const fieldId = await createTestField('Original Field Name');

      const response = await request(app.getHttpServer())
        .put(`/fields/${fieldId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Field Name' })
        .expect(200);

      expect(response.body.name).toBe('Updated Field Name');
    });
  });

  describe('DELETE /fields/:id', () => {
    it('should delete field', async () => {
      const fieldId = await createTestField('Field To Delete', 25);

      await request(app.getHttpServer())
        .delete(`/fields/${fieldId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Verify deletion using raw SQL
      const result = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM fields WHERE id = ${fieldId}::uuid
      `;
      expect(Number(result[0].count)).toBe(0);
    });
  });

  describe('GET /fields/:id/with-zones', () => {
    it('should return field with zones', async () => {
      const fieldId = await createTestField('Field With Zones');
      await createTestZone(fieldId, 'Zone A');

      const response = await request(app.getHttpServer())
        .get(`/fields/${fieldId}/with-zones`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(fieldId);
      expect(response.body).toHaveProperty('zones');
      expect(Array.isArray(response.body.zones)).toBe(true);
    });
  });
});

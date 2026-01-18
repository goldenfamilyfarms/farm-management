import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

/**
 * Integration tests for Task endpoints
 * Tests: CRUD operations for /tasks
 * Requirements: Integration testing, Requirements 8.1, 8.2
 */
describe('Tasks Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let testFarmId: string;
  let testUserId: string;
  let testWorkerId: string;

  const testUser = {
    email: 'test-tasks@example.com',
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
      await prisma.worker.delete({ where: { id: testWorkerId } }).catch(() => {});
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    if (testFarmId) {
      await prisma.task.deleteMany({ where: { farmId: testFarmId } }).catch(() => {});
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
        name: 'Test Farm for Tasks',
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

    // Login to get access token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });
    accessToken = loginResponse.body.accessToken;
  });

  describe('POST /tasks', () => {
    it('should create task with valid data', async () => {
      const taskData = {
        title: 'Harvest corn field',
        description: 'Complete harvest of north corn field',
        priority: 'high',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        assignedTo: [testWorkerId],
      };

      const response = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(taskData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(taskData.title);
      expect(response.body.description).toBe(taskData.description);
      expect(response.body.priority).toBe(taskData.priority);
      expect(response.body.status).toBe('pending');
    });

    it('should return 401 without authentication', async () => {
      await request(app.getHttpServer())
        .post('/tasks')
        .send({
          title: 'Test Task',
          description: 'Test description',
        })
        .expect(401);
    });

    it('should return 400 for missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /tasks', () => {
    it('should return list of tasks', async () => {
      // Create test task first
      await prisma.task.create({
        data: {
          farmId: testFarmId,
          title: 'Test Task',
          description: 'Test description',
          priority: 'medium',
          status: 'pending',
          createdBy: testUserId,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should filter tasks by status', async () => {
      // Create tasks with different statuses
      await prisma.task.create({
        data: {
          farmId: testFarmId,
          title: 'Pending Task',
          priority: 'medium',
          status: 'pending',
          createdBy: testUserId,
        },
      });

      await prisma.task.create({
        data: {
          farmId: testFarmId,
          title: 'Completed Task',
          priority: 'medium',
          status: 'completed',
          createdBy: testUserId,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/tasks?status=pending')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach((task: { status: string }) => {
        expect(task.status).toBe('pending');
      });
    });
  });

  describe('GET /tasks/:id', () => {
    it('should return task by id', async () => {
      const task = await prisma.task.create({
        data: {
          farmId: testFarmId,
          title: 'Test Task Get',
          description: 'Test description',
          priority: 'high',
          status: 'pending',
          createdBy: testUserId,
        },
      });

      const response = await request(app.getHttpServer())
        .get(`/tasks/${task.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(task.id);
      expect(response.body.title).toBe('Test Task Get');
    });

    it('should return 404 for non-existent task', async () => {
      await request(app.getHttpServer())
        .get('/tasks/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PUT /tasks/:id', () => {
    it('should update task', async () => {
      const task = await prisma.task.create({
        data: {
          farmId: testFarmId,
          title: 'Original Title',
          priority: 'medium',
          status: 'pending',
          createdBy: testUserId,
        },
      });

      const response = await request(app.getHttpServer())
        .put(`/tasks/${task.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Updated Title', priority: 'high' })
        .expect(200);

      expect(response.body.title).toBe('Updated Title');
      expect(response.body.priority).toBe('high');
    });
  });

  describe('PATCH /tasks/:id/complete', () => {
    it('should mark task as complete', async () => {
      const task = await prisma.task.create({
        data: {
          farmId: testFarmId,
          title: 'Task to Complete',
          priority: 'medium',
          status: 'in_progress',
          createdBy: testUserId,
        },
      });

      const response = await request(app.getHttpServer())
        .patch(`/tasks/${task.id}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          completedBy: testUserId,
          completionNotes: 'Task completed successfully',
        })
        .expect(200);

      expect(response.body.status).toBe('completed');
      expect(response.body.completionNotes).toBe('Task completed successfully');
      expect(response.body.completedAt).toBeDefined();
    });
  });

  describe('PATCH /tasks/:id/status', () => {
    it('should update task status', async () => {
      const task = await prisma.task.create({
        data: {
          farmId: testFarmId,
          title: 'Task Status Update',
          priority: 'medium',
          status: 'pending',
          createdBy: testUserId,
        },
      });

      const response = await request(app.getHttpServer())
        .patch(`/tasks/${task.id}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'in_progress' })
        .expect(200);

      expect(response.body.status).toBe('in_progress');
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('should delete task', async () => {
      const task = await prisma.task.create({
        data: {
          farmId: testFarmId,
          title: 'Task to Delete',
          priority: 'low',
          status: 'pending',
          createdBy: testUserId,
        },
      });

      await request(app.getHttpServer())
        .delete(`/tasks/${task.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify deletion
      const deleted = await prisma.task.findUnique({
        where: { id: task.id },
      });
      expect(deleted).toBeNull();
    });
  });

  describe('GET /tasks/overdue', () => {
    it('should return overdue tasks', async () => {
      // Create an overdue task
      await prisma.task.create({
        data: {
          farmId: testFarmId,
          title: 'Overdue Task',
          priority: 'high',
          status: 'pending',
          dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
          createdBy: testUserId,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/tasks/overdue')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});

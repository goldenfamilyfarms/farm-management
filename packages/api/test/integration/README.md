# API Integration Tests

This directory contains integration tests for the Farm Management Platform API.

## Prerequisites

Before running integration tests, ensure:

1. PostgreSQL database is running with PostGIS and TimescaleDB extensions
2. Environment variables are configured (copy `.env.example` to `.env`)
3. Database migrations have been applied: `npx prisma migrate deploy`

## Running Tests

```bash
# Run all integration tests
pnpm test

# Run specific integration test file
pnpm test test/integration/auth.integration.spec.ts

# Run with coverage
pnpm test:cov
```

## Test Coverage

The integration tests cover the following endpoints:

### Authentication (`auth.integration.spec.ts`)
- POST /auth/login - User login with credentials
- POST /auth/refresh - Token refresh

### Equipment (`equipment.integration.spec.ts`)
- POST /equipment - Create equipment
- GET /equipment - List all equipment
- GET /equipment/:id - Get equipment by ID
- PUT /equipment/:id - Update equipment
- DELETE /equipment/:id - Delete equipment

### Fields (`fields.integration.spec.ts`)
- POST /fields - Create field with polygon boundary
- GET /fields - List all fields
- GET /fields/:id - Get field by ID
- GET /fields/:id/with-zones - Get field with zones
- PUT /fields/:id - Update field
- DELETE /fields/:id - Delete field

### Tasks (`tasks.integration.spec.ts`)
- POST /tasks - Create task
- GET /tasks - List tasks with filters
- GET /tasks/:id - Get task by ID
- GET /tasks/overdue - Get overdue tasks
- PUT /tasks/:id - Update task
- PATCH /tasks/:id/complete - Mark task complete
- PATCH /tasks/:id/status - Update task status
- DELETE /tasks/:id - Delete task

### Time Cards (`time-cards.integration.spec.ts`)
- POST /time-cards/clock-in - Clock in worker
- POST /time-cards/:id/clock-out - Clock out worker
- GET /time-cards - List time cards
- GET /time-cards/:id - Get time card by ID
- GET /time-cards/active/:workerId - Get active time card
- GET /time-cards/worker/:workerId - Get worker's time cards
- DELETE /time-cards/:id - Delete time card

### Telemetry (`telemetry.integration.spec.ts`)
- POST /telemetry/ingest - Ingest telemetry data (public endpoint)
- GET /telemetry/equipment/:equipmentId - Get equipment readings
- GET /telemetry/equipment/:equipmentId/latest - Get latest reading

### Dashboard (`dashboard.integration.spec.ts`)
- GET /dashboard - Get dashboard data

## Test Structure

Each test file follows this pattern:

1. **Setup**: Creates test farm, user, and required entities
2. **Authentication**: Logs in to get access token
3. **Tests**: Runs endpoint tests with various scenarios
4. **Cleanup**: Removes test data after tests complete

## Notes

- Tests use real database connections (not mocks)
- Each test file creates isolated test data
- Tests clean up after themselves
- Authentication is tested for all protected endpoints

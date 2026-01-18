# Implementation Plan: Farm Management Platform

## Overview

This implementation plan builds the Golden Family Farms platform incrementally, starting with core infrastructure and authentication, then adding domain modules. Each phase builds on the previous, ensuring no orphaned code. Property-based tests validate correctness properties from the design.

## Tasks

- [x] 1. Project Setup and Infrastructure Foundation
  - [x] 1.1 Initialize monorepo structure with pnpm workspaces
    - Create `packages/api` (NestJS backend)
    - Create `packages/web` (React frontend)
    - Create `packages/shared` (shared types and utilities)
    - Configure TypeScript, ESLint, Prettier
    - _Requirements: Project foundation_

  - [x] 1.2 Set up database schema and migrations
    - Configure Prisma with PostgreSQL
    - Create initial migration with core tables (farms, users)
    - Add PostGIS extension setup
    - Add TimescaleDB hypertable configuration
    - _Requirements: Data layer foundation_

  - [x] 1.3 Configure Docker development environment
    - Create docker-compose.yml with PostgreSQL, Redis, TimescaleDB
    - Add development scripts for local setup
    - _Requirements: Development environment_

- [x] 2. Core Module - Authentication and Multi-tenancy
  - [x] 2.1 Implement User and Farm entities with Prisma
    - Create User model with role enum
    - Create Farm model with settings JSON
    - Add farm-user relationship
    - _Requirements: 9.1, 9.4_

  - [x] 2.2 Implement AuthService with JWT authentication
    - Login with email/password validation
    - JWT token generation with userId, farmId, role claims
    - Token refresh mechanism
    - Password hashing with bcrypt
    - _Requirements: 9.1, 9.5_

  - [x] 2.3 Write property test for JWT token claims
    - **Property 33: JWT token contains required claims**
    - **Validates: Requirements 9.1**

  - [x] 2.4 Implement role-based authorization guards
    - Create RolesGuard for NestJS
    - Define permission matrix (owner, manager, worker, viewer)
    - Add @Roles() decorator for endpoints
    - _Requirements: 9.2, 9.3_

  - [ ]* 2.5 Write property test for authorization enforcement
    - **Property 34: Role-based authorization enforcement**
    - **Validates: Requirements 9.2, 9.3**

  - [x] 2.6 Implement tenant isolation middleware
    - Add farmId filter to all queries
    - Create TenantContext for request scoping
    - _Requirements: 9.4_

  - [ ]* 2.7 Write property test for tenant data isolation
    - **Property 35: Tenant data isolation**
    - **Validates: Requirements 9.4**

  - [ ]* 2.8 Write property test for expired token rejection
    - **Property 36: Expired token rejection**
    - **Validates: Requirements 9.5**

- [x] 3. Checkpoint - Core Authentication
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Telemetry Module - Equipment and Data Ingestion
  - [x] 4.1 Implement Equipment entity and CRUD operations
    - Create Equipment model with device_id, type, status
    - Create EquipmentService with CRUD methods
    - Add equipment endpoints
    - _Requirements: 1.3, 10.1_

  - [x] 4.2 Implement TelemetryReading entity with TimescaleDB
    - Create telemetry_readings hypertable
    - Define TelemetryPayload validation schema (Zod)
    - _Requirements: 1.1, 1.2_

  - [x] 4.3 Implement TelemetryService for data ingestion
    - Validate incoming telemetry payload schema
    - Store valid readings to TimescaleDB
    - Return appropriate errors for invalid payloads
    - _Requirements: 1.1, 1.2_

  - [ ]* 4.4 Write property test for valid telemetry storage
    - **Property 1: Valid telemetry messages are stored**
    - **Validates: Requirements 1.1**

  - [ ]* 4.5 Write property test for invalid telemetry rejection
    - **Property 2: Invalid telemetry messages are rejected without crashing**
    - **Validates: Requirements 1.2**

  - [x] 4.6 Implement telemetry deduplication logic
    - Check for existing reading with same deviceId within 5-second window
    - Skip storage if duplicate found
    - _Requirements: 1.6_

  - [ ]* 4.7 Write property test for deduplication
    - **Property 4: Telemetry deduplication within time window**
    - **Validates: Requirements 1.6**

  - [x] 4.8 Implement fault code detection and maintenance alerts
    - Check telemetry for fault codes
    - Create MaintenanceAlert when fault codes present
    - _Requirements: 1.4, 10.4_

  - [ ]* 4.9 Write property test for fault code alerts
    - **Property 3: Fault codes trigger maintenance alerts**
    - **Validates: Requirements 1.4, 10.4**

- [x] 5. Checkpoint - Telemetry Ingestion
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Resource Tracking Module
  - [x] 6.1 Implement ResourceApplication entity and service
    - Create ResourceApplicationService with CRUD methods
    - Add validation for required associations (field, date, quantity, resource type)
    - Add resource application endpoints
    - _Requirements: 2.1_

  - [ ]* 6.2 Write property test for resource application associations
    - **Property 5: Resource applications have required associations**
    - **Validates: Requirements 2.1**

  - [x] 6.3 Implement automatic resource record creation from telemetry
    - Detect resource dispensing in telemetry payload
    - Create ResourceApplication record automatically in TelemetryService
    - _Requirements: 2.2_

  - [ ]* 6.4 Write property test for telemetry-to-resource creation
    - **Property 6: Telemetry dispensing creates resource records**
    - **Validates: Requirements 2.2**

  - [x] 6.5 Implement resource usage aggregation queries
    - Sum by field, zone, crop type for date range
    - Create ResourceUsageService with aggregation methods
    - _Requirements: 2.3_

  - [ ]* 6.6 Write property test for resource aggregation
    - **Property 7: Resource usage aggregation correctness**
    - **Validates: Requirements 2.3**

  - [x] 6.7 Implement threshold-based warning notifications
    - Configure thresholds per resource type
    - Generate warning when application exceeds threshold
    - _Requirements: 2.5_

  - [ ]* 6.8 Write property test for threshold warnings
    - **Property 8: Threshold violations generate warnings**
    - **Validates: Requirements 2.5**

- [x] 7. Checkpoint - Resource Tracking
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Geospatial Module - Fields and Zones
  - [x] 8.1 Implement Field entity with PostGIS
    - Create FieldService with CRUD methods
    - Add acreage calculation from geometry using ST_Area
    - Add field endpoints
    - _Requirements: 3.1_

  - [x] 8.2 Implement polygon validation service
    - Check for self-intersection using PostGIS ST_IsValid
    - Return validation errors with details
    - _Requirements: 3.1_

  - [ ]* 8.3 Write property test for self-intersecting polygon rejection
    - **Property 9: Self-intersecting polygons are rejected**
    - **Validates: Requirements 3.1**

  - [x] 8.4 Implement Zone entity with containment validation
    - Create ZoneService with CRUD methods
    - Validate zone is contained within parent field using ST_Contains
    - Add zone endpoints
    - _Requirements: 3.2_

  - [x] 8.5 Write property test for zone containment
    - **Property 10: Zone containment validation**
    - **Validates: Requirements 3.2**

  - [x] 8.6 Implement GeoJSON and KML import/export
    - Parse GeoJSON FeatureCollection to Field entities
    - Parse KML to Field entities
    - Export fields to GeoJSON format
    - _Requirements: 3.5_

  - [ ]* 8.7 Write property test for GeoJSON round-trip
    - **Property 11: GeoJSON/KML import round-trip**
    - **Validates: Requirements 3.5**

  - [x] 8.8 Implement soil quality data import for zones
    - Update zone soil_quality from imported data
    - _Requirements: 3.4_

- [x] 9. Checkpoint - Geospatial Module
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Financial Module - Expenses and Revenue
  - [x] 10.1 Implement Expense entity and service
    - Create ExpenseService with CRUD methods
    - Validate category enum and required fields
    - Add expense endpoints
    - _Requirements: 5.1_

  - [ ]* 10.2 Write property test for expense categorization
    - **Property 15: Expense categorization and association**
    - **Validates: Requirements 5.1**

  - [x] 10.3 Implement cost per acre calculation
    - Aggregate expenses by field
    - Divide by field acreage
    - Handle zero acreage edge case
    - _Requirements: 5.2_

  - [ ]* 10.4 Write property test for cost per acre
    - **Property 16: Cost per acre calculation**
    - **Validates: Requirements 5.2**

  - [x] 10.5 Implement equipment cost allocation
    - Calculate hourly depreciation rate
    - Allocate based on operating hours in field
    - _Requirements: 5.3_

  - [ ]* 10.6 Write property test for equipment cost allocation
    - **Property 17: Equipment cost allocation**
    - **Validates: Requirements 5.3**

  - [x] 10.7 Implement Harvest and Revenue entities
    - Create HarvestService and RevenueService with CRUD methods
    - Add harvest and revenue endpoints
    - _Requirements: 6.1_

  - [ ]* 10.8 Write property test for revenue record completeness
    - **Property 20: Revenue record completeness**
    - **Validates: Requirements 6.1**

  - [x] 10.9 Implement revenue per acre calculation
    - Aggregate revenue by field
    - Divide by field acreage
    - _Requirements: 6.2_

  - [ ]* 10.10 Write property test for revenue per acre
    - **Property 21: Revenue per acre calculation**
    - **Validates: Requirements 6.2**

  - [x] 10.11 Implement profit/loss calculation
    - Subtract allocated costs from revenue
    - Calculate by crop and by field
    - _Requirements: 6.3_

  - [ ]* 10.12 Write property test for profit/loss calculation
    - **Property 22: Profit/loss calculation**
    - **Validates: Requirements 6.3**

  - [x] 10.13 Implement profitability analysis service
    - Calculate ROI by zone
    - Generate season-over-season comparisons
    - Calculate break-even price
    - _Requirements: 6.4_

  - [ ]* 10.14 Write property test for profitability analysis
    - **Property 23: Profitability analysis completeness**
    - **Validates: Requirements 6.4**

  - [x] 10.15 Implement cost report generation
    - Generate itemized breakdowns by category, field, time period
    - _Requirements: 5.5_

  - [ ]* 10.16 Write property test for cost report completeness
    - **Property 19: Cost report completeness**
    - **Validates: Requirements 5.5**

  - [x] 10.17 Implement CSV and Excel export
    - Export financial reports to CSV format
    - Export financial reports to Excel format
    - _Requirements: 6.5_

  - [ ]* 10.18 Write property test for export round-trip
    - **Property 24: Financial export round-trip**
    - **Validates: Requirements 6.5**

- [x] 11. Checkpoint - Financial Module
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Workforce Module - Time Tracking
  - [x] 12.1 Implement Worker entity and service
    - Create WorkerService with CRUD methods
    - Link to User entity
    - Add worker endpoints
    - _Requirements: 7.1_

  - [x] 12.2 Implement TimeCard entity and clock-in service
    - Create TimeCardService with clock-in method
    - Record timestamp, worker_id, and status
    - Add time card endpoints
    - _Requirements: 7.1_

  - [ ]* 12.3 Write property test for clock-in completeness
    - **Property 25: Clock-in record completeness**
    - **Validates: Requirements 7.1**

  - [x] 12.4 Implement clock-out with hours calculation
    - Calculate total_hours as (clock_out - clock_in)
    - Update time card status
    - _Requirements: 7.2_

  - [ ]* 12.5 Write property test for hours calculation
    - **Property 26: Hours calculation on clock-out**
    - **Validates: Requirements 7.2**

  - [x] 12.6 Implement duplicate clock-in prevention
    - Check for active time card before allowing clock-in
    - Return error if active card exists
    - _Requirements: 7.3_

  - [ ]* 12.7 Write property test for duplicate prevention
    - **Property 27: Duplicate clock-in prevention**
    - **Validates: Requirements 7.3**

  - [x] 12.8 Implement off-schedule clock-in flagging
    - Compare clock-in time to worker schedule
    - Flag time card for review if outside schedule
    - _Requirements: 7.5_

  - [ ]* 12.9 Write property test for off-schedule flagging
    - **Property 28: Off-schedule clock-in flagging**
    - **Validates: Requirements 7.5**

  - [x] 12.10 Implement payroll hours aggregation
    - Sum approved time card hours by worker and pay period
    - Calculate total pay based on hourly rate
    - _Requirements: 7.6_

  - [ ]* 12.11 Write property test for payroll aggregation
    - **Property 29: Payroll hours aggregation**
    - **Validates: Requirements 7.6**

  - [x] 12.12 Implement labor cost aggregation for financial module
    - Link time cards to tasks and fields
    - Calculate labor costs for cost allocation
    - _Requirements: 5.4_

  - [ ]* 12.13 Write property test for labor cost aggregation
    - **Property 18: Labor cost aggregation from time cards**
    - **Validates: Requirements 5.4**

- [ ] 13. Checkpoint - Time Tracking
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Workforce Module - Task Management
  - [x] 14.1 Implement Task entity and service
    - Create TaskService with CRUD methods
    - Add field/zone associations
    - Add task endpoints
    - _Requirements: 8.1_

  - [ ]* 14.2 Write property test for task creation completeness
    - **Property 30: Task creation completeness**
    - **Validates: Requirements 8.1**

  - [x] 14.3 Implement task completion workflow
    - Update status to completed
    - Record completion timestamp and completed_by
    - Allow completion notes
    - _Requirements: 8.2_

  - [ ]* 14.4 Write property test for task completion recording
    - **Property 31: Task completion recording**
    - **Validates: Requirements 8.2**

  - [x] 14.5 Implement task hours linking to time cards
    - Associate task actual_hours with time card entries
    - Enable traceability for labor cost allocation
    - _Requirements: 8.5_

  - [ ]* 14.6 Write property test for task hours linking
    - **Property 32: Task hours linked to time cards**
    - **Validates: Requirements 8.5**

  - [x] 14.7 Implement overdue task detection and notifications
    - Query tasks past due_date with status != completed
    - Generate notifications for assigned workers and managers
    - _Requirements: 8.4_

  - [x] 14.8 Implement Schedule entity for shift management
    - Create ScheduleService with CRUD methods
    - Add conflict detection for overlapping schedules
    - Add schedule endpoints
    - _Requirements: 7.5_

- [ ] 15. Checkpoint - Task Management
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Maintenance Module
  - [x] 16.1 Implement MaintenanceRecord entity and service
    - Create MaintenanceRecordService with CRUD methods
    - Link to Equipment entity
    - Add maintenance record endpoints
    - _Requirements: 10.2_

  - [ ]* 16.2 Write property test for maintenance record completeness
    - **Property 38: Maintenance record completeness**
    - **Validates: Requirements 10.2**

  - [x] 16.3 Implement service interval reminder generation
    - Compare equipment operating_hours to next_service_hours
    - Generate reminder when threshold reached
    - _Requirements: 10.1_

  - [ ]* 16.4 Write property test for service interval reminders
    - **Property 37: Service interval reminders**
    - **Validates: Requirements 10.1**

  - [x] 16.5 Implement downtime and cost calculations
    - Sum maintenance durations for downtime
    - Sum maintenance costs for total cost
    - _Requirements: 10.5_

  - [ ]* 16.6 Write property test for downtime and cost calculation
    - **Property 39: Downtime and cost calculation**
    - **Validates: Requirements 10.5**

- [ ] 17. Checkpoint - Maintenance Module
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Recommendation Module - AI Crop Planning
  - [x] 18.1 Implement data aggregation service for recommendations
    - Gather soil quality from zone
    - Fetch historical weather data
    - Query market prices
    - Retrieve historical yields
    - _Requirements: 4.1_

  - [x] 18.2 Implement LLM integration service
    - Configure Anthropic Claude API client
    - Build structured prompt with aggregated data
    - Parse LLM response into CropRecommendation structure
    - _Requirements: 4.2, 4.3_

  - [ ] 18.3 Write property test for recommendation output completeness

    - **Property 12: Recommendation output completeness**
    - **Validates: Requirements 4.2, 4.3**

  - [x] 18.4 Implement recommendation caching
    - Cache recommendations by zone_id
    - Invalidate cache when input data changes
    - _Requirements: 4.4_

  - [ ]* 18.5 Write property test for caching behavior
    - **Property 13: Recommendation caching behavior**
    - **Validates: Requirements 4.4**

  - [x] 18.6 Implement insufficient data error handling
    - Detect missing required inputs
    - Return error listing all missing input types
    - _Requirements: 4.5_

  - [ ]* 18.7 Write property test for insufficient data errors
    - **Property 14: Insufficient data error messages**
    - **Validates: Requirements 4.5**

- [ ] 19. Checkpoint - Recommendation Module
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 20. Weather Integration
  - [x] 20.1 Implement weather data fetching service
    - Integrate with weather API (NOAA or Weather.com)
    - Store historical weather data in TimescaleDB
    - _Requirements: 11.1_

  - [x] 20.2 Implement weather data caching and fallback
    - Cache weather data in Redis
    - Use cached data when API unavailable
    - Add staleness indicator
    - _Requirements: 11.5_

- [ ] 21. Checkpoint - Weather Integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 22. Frontend Foundation
  - [x] 22.1 Set up React application with Vite
    - Configure TypeScript, Tailwind CSS, shadcn/ui
    - Set up TanStack Query for server state
    - Configure Zustand for global state
    - _Requirements: Frontend foundation_

  - [x] 22.2 Implement authentication UI
    - Login page with email/password form
    - Token storage and refresh handling
    - Protected route wrapper
    - _Requirements: 9.1_

  - [x] 22.3 Implement main layout and navigation
    - Sidebar with module navigation
    - Header with user info and farm selector
    - Responsive design for mobile
    - _Requirements: UI foundation_

- [ ] 23. Frontend - Dashboard and Map
  - [x] 23.1 Implement farm dashboard
    - Overview cards for key metrics
    - Recent activity feed
    - Quick action buttons
    - _Requirements: Overview UI_

  - [x] 23.2 Implement interactive map with Mapbox GL JS
    - Display field boundaries
    - Display zone overlays with soil quality colors
    - Equipment position markers
    - Layer toggle controls
    - _Requirements: 3.3_

  - [x] 23.3 Implement field/zone drawing tools
    - Polygon drawing for new fields
    - Zone creation within fields
    - Edit existing boundaries
    - _Requirements: 3.1, 3.2_

- [ ] 24. Frontend - Workforce UI
  - [x] 24.1 Implement time clock widget
    - Clock in/out buttons
    - Current shift display
    - Recent time cards list
    - _Requirements: 7.1, 7.2_

  - [x] 24.2 Implement task board (Kanban style)
    - Columns for pending, in-progress, completed
    - Drag-and-drop task movement
    - Task detail modal
    - _Requirements: 8.3_

  - [x] 24.3 Implement schedule calendar
    - Week/month views
    - Shift creation and editing
    - Worker availability display
    - _Requirements: 7.5_

- [ ] 25. Frontend - Financial UI
  - [x] 25.1 Implement expense tracking interface
    - Expense entry form
    - Expense list with filters
    - Category breakdown charts
    - _Requirements: 5.1, 5.5_

  - [x] 25.2 Implement revenue and profitability dashboard
    - Revenue by crop/field charts
    - Profit/loss summary
    - ROI by zone visualization
    - _Requirements: 6.3, 6.4_

  - [x] 25.3 Implement report export functionality
    - Export buttons for CSV/Excel
    - Report configuration options
    - _Requirements: 6.5_

- [ ] 26. Checkpoint - Frontend Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 27. AWS Infrastructure Setup
  - [x] 27.1 Create CDK infrastructure project
    - Initialize AWS CDK with TypeScript
    - Define VPC with public/private subnets
    - Configure security groups
    - _Requirements: Infrastructure foundation_

  - [x] 27.2 Set up RDS PostgreSQL with extensions
    - Create RDS instance with PostGIS and TimescaleDB
    - Configure parameter groups
    - Set up automated backups
    - _Requirements: Database infrastructure_

  - [x] 27.3 Set up ECS Fargate for application
    - Create ECS cluster
    - Define task definitions for API and web
    - Configure auto-scaling policies
    - _Requirements: Compute infrastructure_

  - [x] 27.4 Configure networking and load balancing
    - Set up Application Load Balancer
    - Configure Route 53 for goldenfamilyfarms.org
    - Set up CloudFront distribution
    - Configure ACM SSL certificates
    - _Requirements: Networking_

  - [x] 27.5 Set up IoT Core for telemetry
    - Create IoT thing types and policies
    - Configure MQTT topics
    - Set up IoT rules for Lambda processing
    - _Requirements: 1.1, IoT infrastructure_

  - [x] 27.6 Configure supporting services
    - Set up ElastiCache Redis
    - Configure S3 buckets for storage
    - Set up Secrets Manager for credentials
    - _Requirements: Supporting infrastructure_

  - [x] 27.7 Set up CI/CD pipeline
    - Configure CodePipeline
    - Set up CodeBuild for container builds
    - Configure ECR for Docker images
    - Set up deployment stages (dev, staging, prod)
    - _Requirements: Deployment automation_

- [x] 28. Checkpoint - Infrastructure Complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 29. Integration and E2E Testing
  - [x] 29.1 Write API integration tests
    - Test all REST endpoints
    - Test WebSocket connections
    - Test authentication flows
    - _Requirements: Integration testing_

  - [x] 29.2 Write E2E tests with Playwright
    - Test login flow
    - Test clock in/out flow
    - Test task creation and completion
    - Test map interactions
    - _Requirements: E2E testing_

- [x] 30. Final Checkpoint - All Tests Pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the 39 correctness properties from the design
- Unit tests validate specific examples and edge cases
- The implementation follows a modular approach allowing parallel development of frontend and backend after core setup

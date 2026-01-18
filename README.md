# Farm Management Platform

Comprehensive agricultural technology platform for Golden Family Farms. Integrates IoT telemetry, predictive analytics, financial tracking, and workforce management to optimize farm operations and profitability.

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, TanStack Query, Zustand
- **Backend**: NestJS, TypeScript, Prisma ORM
- **Database**: PostgreSQL with PostGIS (geospatial) and TimescaleDB (time-series)
- **Cache**: Redis
- **Testing**: Vitest, fast-check (property-based testing)

## Project Structure

```
farm-management-platform/
├── packages/
│   ├── api/          # NestJS backend
│   ├── web/          # React frontend
│   └── shared/       # Shared types and utilities
├── scripts/          # Development scripts
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## Prerequisites

- Node.js 18+
- pnpm 8+
- Docker and Docker Compose

## Quick Start

### 1. Clone and Install

```bash
pnpm install
```

### 2. Start Development Environment

**Windows (PowerShell):**
```powershell
.\scripts\dev-setup.ps1
```

**Unix/Linux/macOS:**
```bash
chmod +x scripts/dev-setup.sh
./scripts/dev-setup.sh
```

Or manually:

```bash
# Start Docker containers
docker-compose up -d

# Copy environment file
cp packages/api/.env.example packages/api/.env

# Generate Prisma client
cd packages/api && npx prisma generate && cd ../..

# Run database migrations
pnpm db:migrate
```

### 3. Start Development Servers

```bash
# Start both API and web
pnpm dev

# Or start individually
pnpm dev:api  # API on http://localhost:3000
pnpm dev:web  # Web on http://localhost:5173
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start all development servers |
| `pnpm dev:api` | Start API server only |
| `pnpm dev:web` | Start web app only |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all packages |
| `pnpm format` | Format code with Prettier |
| `pnpm docker:up` | Start Docker containers |
| `pnpm docker:down` | Stop Docker containers |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:studio` | Open Prisma Studio |

## Environment Variables

Copy `packages/api/.env.example` to `packages/api/.env` and configure:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/farm_management"
JWT_SECRET="your-secret-key"
REDIS_HOST="localhost"
REDIS_PORT="6379"
```

## Database

The platform uses PostgreSQL with extensions:
- **PostGIS**: Geospatial data for field boundaries and equipment tracking
- **TimescaleDB**: Time-series data for telemetry readings and weather data

### Prisma Commands

```bash
# Generate client after schema changes
pnpm db:generate

# Create and apply migrations
pnpm db:migrate

# Open database GUI
pnpm db:studio
```

## License

Private - Golden Family Farms

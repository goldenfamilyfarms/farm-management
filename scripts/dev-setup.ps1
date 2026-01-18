# Development Setup Script for Windows PowerShell
# This script sets up the local development environment

Write-Host "🚜 Farm Management Platform - Development Setup" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green

# Check if Docker is running
Write-Host "`n📦 Checking Docker..." -ForegroundColor Cyan
$dockerRunning = docker info 2>$null
if (-not $?) {
    Write-Host "❌ Docker is not running. Please start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Docker is running" -ForegroundColor Green

# Start Docker containers
Write-Host "`n🐳 Starting Docker containers..." -ForegroundColor Cyan
docker-compose up -d

# Wait for PostgreSQL to be ready
Write-Host "`n⏳ Waiting for PostgreSQL to be ready..." -ForegroundColor Cyan
$maxAttempts = 30
$attempt = 0
do {
    $attempt++
    $result = docker exec farm-postgres pg_isready -U postgres 2>$null
    if ($?) {
        Write-Host "✅ PostgreSQL is ready" -ForegroundColor Green
        break
    }
    Write-Host "   Attempt $attempt/$maxAttempts - waiting..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
} while ($attempt -lt $maxAttempts)

if ($attempt -eq $maxAttempts) {
    Write-Host "❌ PostgreSQL failed to start" -ForegroundColor Red
    exit 1
}

# Wait for Redis to be ready
Write-Host "`n⏳ Waiting for Redis to be ready..." -ForegroundColor Cyan
$attempt = 0
do {
    $attempt++
    $result = docker exec farm-redis redis-cli ping 2>$null
    if ($result -eq "PONG") {
        Write-Host "✅ Redis is ready" -ForegroundColor Green
        break
    }
    Write-Host "   Attempt $attempt/$maxAttempts - waiting..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
} while ($attempt -lt $maxAttempts)

if ($attempt -eq $maxAttempts) {
    Write-Host "❌ Redis failed to start" -ForegroundColor Red
    exit 1
}

# Install dependencies
Write-Host "`n📥 Installing dependencies..." -ForegroundColor Cyan
pnpm install

# Copy environment file if it doesn't exist
Write-Host "`n📝 Setting up environment files..." -ForegroundColor Cyan
if (-not (Test-Path "packages/api/.env")) {
    Copy-Item "packages/api/.env.example" "packages/api/.env"
    Write-Host "✅ Created packages/api/.env from .env.example" -ForegroundColor Green
} else {
    Write-Host "ℹ️  packages/api/.env already exists" -ForegroundColor Yellow
}

# Generate Prisma client
Write-Host "`n🔧 Generating Prisma client..." -ForegroundColor Cyan
Set-Location packages/api
npx prisma generate
Set-Location ../..

Write-Host "`n✅ Development environment is ready!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. Run database migrations: cd packages/api && npx prisma migrate dev" -ForegroundColor White
Write-Host "  2. Start the API: pnpm --filter @farm/api dev" -ForegroundColor White
Write-Host "  3. Start the web app: pnpm --filter @farm/web dev" -ForegroundColor White
Write-Host "  4. Or start both: pnpm dev" -ForegroundColor White

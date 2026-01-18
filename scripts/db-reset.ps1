# Database Reset Script for Windows PowerShell
# WARNING: This will delete all data in the database!

Write-Host "⚠️  WARNING: This will delete all data in the database!" -ForegroundColor Red
$confirm = Read-Host "Are you sure you want to continue? (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "❌ Aborted" -ForegroundColor Yellow
    exit 0
}

Write-Host "`n🗑️  Resetting database..." -ForegroundColor Cyan

# Stop containers and remove volumes
docker-compose down -v

# Start containers fresh
docker-compose up -d

# Wait for PostgreSQL
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
    Start-Sleep -Seconds 2
} while ($attempt -lt $maxAttempts)

# Run migrations
Write-Host "`n🔧 Running migrations..." -ForegroundColor Cyan
Set-Location packages/api
npx prisma migrate dev
Set-Location ../..

Write-Host "`n✅ Database reset complete!" -ForegroundColor Green

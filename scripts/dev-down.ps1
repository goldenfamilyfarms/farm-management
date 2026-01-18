# Stop Development Environment Script for Windows PowerShell

Write-Host "🛑 Stopping Farm Management Platform development environment..." -ForegroundColor Yellow

docker-compose down

Write-Host "✅ Development environment stopped" -ForegroundColor Green

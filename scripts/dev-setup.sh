#!/bin/bash
# Development Setup Script for Unix/Linux/macOS
# This script sets up the local development environment

set -e

echo "🚜 Farm Management Platform - Development Setup"
echo "================================================"

# Check if Docker is running
echo ""
echo "📦 Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi
echo "✅ Docker is running"

# Start Docker containers
echo ""
echo "🐳 Starting Docker containers..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
max_attempts=30
attempt=0
until docker exec farm-postgres pg_isready -U postgres > /dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
        echo "❌ PostgreSQL failed to start"
        exit 1
    fi
    echo "   Attempt $attempt/$max_attempts - waiting..."
    sleep 2
done
echo "✅ PostgreSQL is ready"

# Wait for Redis to be ready
echo ""
echo "⏳ Waiting for Redis to be ready..."
attempt=0
until [ "$(docker exec farm-redis redis-cli ping 2>/dev/null)" = "PONG" ]; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
        echo "❌ Redis failed to start"
        exit 1
    fi
    echo "   Attempt $attempt/$max_attempts - waiting..."
    sleep 2
done
echo "✅ Redis is ready"

# Install dependencies
echo ""
echo "📥 Installing dependencies..."
pnpm install

# Copy environment file if it doesn't exist
echo ""
echo "📝 Setting up environment files..."
if [ ! -f "packages/api/.env" ]; then
    cp packages/api/.env.example packages/api/.env
    echo "✅ Created packages/api/.env from .env.example"
else
    echo "ℹ️  packages/api/.env already exists"
fi

# Generate Prisma client
echo ""
echo "🔧 Generating Prisma client..."
cd packages/api
npx prisma generate
cd ../..

echo ""
echo "✅ Development environment is ready!"
echo ""
echo "Next steps:"
echo "  1. Run database migrations: cd packages/api && npx prisma migrate dev"
echo "  2. Start the API: pnpm --filter @farm/api dev"
echo "  3. Start the web app: pnpm --filter @farm/web dev"
echo "  4. Or start both: pnpm dev"

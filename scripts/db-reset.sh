#!/bin/bash
# Database Reset Script for Unix/Linux/macOS
# WARNING: This will delete all data in the database!

set -e

echo "⚠️  WARNING: This will delete all data in the database!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Aborted"
    exit 0
fi

echo ""
echo "🗑️  Resetting database..."

# Stop containers and remove volumes
docker-compose down -v

# Start containers fresh
docker-compose up -d

# Wait for PostgreSQL
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
    sleep 2
done
echo "✅ PostgreSQL is ready"

# Run migrations
echo ""
echo "🔧 Running migrations..."
cd packages/api
npx prisma migrate dev
cd ../..

echo ""
echo "✅ Database reset complete!"

#!/usr/bin/env bash
set -euo pipefail

echo "=== DecoMe Dev Environment: Starting ==="

# Stop any existing containers and remove orphans
echo "Stopping existing containers..."
docker compose down --remove-orphans 2>/dev/null || true

# Build and start all services
echo "Building and starting services..."
docker compose up --build -d

echo ""
echo "Waiting for services to become healthy..."
echo "(This may take up to 60 seconds on first run while images build)"

# Wait for API to be ready
MAX_WAIT=90
WAITED=0
until docker compose exec api curl -sf http://localhost:8000/api/health > /dev/null 2>&1; do
  sleep 2
  WAITED=$((WAITED + 2))
  if [ $WAITED -ge $MAX_WAIT ]; then
    echo "API did not become healthy in time. Check logs with: make logs"
    exit 1
  fi
  echo "  Waiting for API... (${WAITED}s)"
done

echo ""
echo "==================================="
echo "  DecoMe is running!"
echo "==================================="
echo "  Web:      http://localhost:3000"
echo "  API:      http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo "  DB:       localhost:5432 (decome / decome_dev_pass)"
echo "  Redis:    localhost:6379"
echo ""
echo "  Default admin: admin@decome.app / Admin123!"
echo "==================================="
echo ""
echo "  make logs     - tail all logs"
echo "  make down     - stop all services"
echo "  make test     - run all tests"
echo "==================================="

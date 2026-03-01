#!/usr/bin/env bash
set -euo pipefail

echo "=== DecoMe Dev Environment: Stopping ==="

docker compose down --remove-orphans

echo ""
echo "All services stopped."
echo "Note: Data volumes (pgdata, api_uploads) are preserved."
echo "To also remove volumes, run: docker compose down -v"

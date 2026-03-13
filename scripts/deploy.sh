#!/usr/bin/env bash
set -euo pipefail

# Urban Vibes Dynamics — Production deployment script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "==> Pulling latest code..."
git pull --ff-only

echo "==> Building Docker images (production)..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

echo "==> Starting services..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

echo "==> Running database migrations..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend alembic upgrade head

echo "==> Restarting services..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart

echo "==> Deployment complete."
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

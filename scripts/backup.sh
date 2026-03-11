#!/usr/bin/env bash
# Urban ERP — Database Backup Script
# Creates a pg_dump backup and uploads to MinIO via the backup API.
#
# Usage:
#   ./scripts/backup.sh                    # Run inside Docker network
#   BACKUP_API_URL=http://localhost:8010 ./scripts/backup.sh  # Run from host

set -euo pipefail

BACKUP_API_URL="${BACKUP_API_URL:-http://backend:8000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@youthandurbanism.org}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"

echo "=== Urban ERP Database Backup ==="
echo "API: ${BACKUP_API_URL}"
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Authenticate and get JWT token
echo "Authenticating..."
TOKEN=$(curl -sf -X POST "${BACKUP_API_URL}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${ADMIN_EMAIL}\", \"password\": \"${ADMIN_PASSWORD}\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

if [ -z "$TOKEN" ]; then
  echo "ERROR: Authentication failed"
  exit 1
fi

echo "Authenticated. Creating backup..."

# Trigger backup via API
RESULT=$(curl -sf -X POST "${BACKUP_API_URL}/api/v1/backups/create" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json")

echo "Backup result:"
echo "$RESULT" | python3 -m json.tool

echo "=== Backup complete ==="

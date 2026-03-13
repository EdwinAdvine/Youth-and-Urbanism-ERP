#!/usr/bin/env bash
# Urban Vibes Dynamics — Database Restore Script
# Downloads a backup from MinIO and restores it into PostgreSQL.
#
# Usage:
#   ./scripts/restore.sh <backup_filename>
#   BACKUP_API_URL=http://localhost:8010 ./scripts/restore.sh urban_erp_20260310_020000.sql.gz

set -euo pipefail

BACKUP_FILENAME="${1:-}"
BACKUP_API_URL="${BACKUP_API_URL:-http://backend:8000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@youthandurbanism.org}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}"

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-urban}"
DB_NAME="${DB_NAME:-urban_erp}"

if [ -z "$BACKUP_FILENAME" ]; then
  echo "Usage: $0 <backup_filename>"
  echo ""
  echo "Available backups:"
  # List backups via API
  TOKEN=$(curl -sf -X POST "${BACKUP_API_URL}/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"${ADMIN_EMAIL}\", \"password\": \"${ADMIN_PASSWORD}\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
  curl -sf "${BACKUP_API_URL}/api/v1/backups/" \
    -H "Authorization: Bearer ${TOKEN}" \
    | python3 -c "import sys,json; [print(f\"  {b['filename']} ({b['size_bytes']} bytes, {b['last_modified']}\") for b in json.load(sys.stdin)]"
  exit 1
fi

echo "=== Urban Vibes Dynamics Database Restore ==="
echo "Backup: ${BACKUP_FILENAME}"
echo "Target: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""
echo "WARNING: This will overwrite the current database!"
read -p "Continue? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# Download backup from MinIO using mc or boto
TMPFILE=$(mktemp /tmp/urban_erp_restore_XXXXXX.sql.gz)
trap "rm -f ${TMPFILE}" EXIT

echo "Downloading backup from MinIO..."
# Use the mc (MinIO Client) if available, otherwise use Python
if command -v mc &>/dev/null; then
  mc cp "urban/urban-vibes-dynamics-backups/${BACKUP_FILENAME}" "${TMPFILE}"
else
  python3 -c "
import boto3, os
from botocore.config import Config
s3 = boto3.client('s3',
    endpoint_url=os.environ.get('MINIO_URL', 'http://minio:9000'),
    aws_access_key_id=os.environ.get('MINIO_ACCESS_KEY', 'urban_minio'),
    aws_secret_access_key=os.environ.get('MINIO_SECRET_KEY', 'urban_minio_secret'),
    config=Config(signature_version='s3v4'),
    region_name='us-east-1')
s3.download_file('urban-vibes-dynamics-backups', '${BACKUP_FILENAME}', '${TMPFILE}')
print('Downloaded.')
"
fi

echo "Restoring database..."
gunzip -c "${TMPFILE}" | PGPASSWORD="${PGPASSWORD:-urban_pass}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --single-transaction \
  -q

echo "=== Restore complete ==="
echo "Database has been restored from: ${BACKUP_FILENAME}"

---
title: "Backup & Restore"
slug: "backup-restore"
category: "deployment"
article_type: "guide"
tags: [deployment, backup, restore, disaster-recovery]
sort_order: 2
is_pinned: false
excerpt: "Back up Urban Vibes Dynamics data (PostgreSQL + MinIO files) and restore from backup."
---

# Backup & Restore

Urban Vibes Dynamics has two data stores that must be backed up: **PostgreSQL** (all business data) and **MinIO** (uploaded files, drive storage).

## Backup Strategy

| Data | Frequency | Method |
|------|-----------|--------|
| PostgreSQL database | Daily | `pg_dump` |
| MinIO files | Weekly (or daily for active file stores) | `mc mirror` |
| `.env` file | On every change | Copy to secure location |

## Backing Up PostgreSQL

```bash
# Create a timestamped dump
docker compose exec postgres pg_dump \
  -U postgres urban_erp \
  > backup-$(date +%Y%m%d-%H%M%S).sql
```

For a compressed backup:
```bash
docker compose exec postgres pg_dump \
  -U postgres -Fc urban_erp \
  > backup-$(date +%Y%m%d).dump
```

## Backing Up MinIO Files

Install the MinIO client (`mc`) on your server:

```bash
# Configure mc to point to your MinIO instance
mc alias set local http://localhost:9010 your_access_key your_secret_key

# Mirror the entire bucket to a local directory
mc mirror local/urban-vibes-dynamics-files ./backup/files/
```

## Automated Daily Backups with Cron

```bash
sudo nano /etc/cron.d/urban-vibes-dynamics-backup
```

```cron
# PostgreSQL backup daily at 2am
0 2 * * * root cd /path/to/urban-vibes-dynamics && docker compose exec -T postgres pg_dump -U postgres urban_erp > /backups/db-$(date +\%Y\%m\%d).sql 2>&1

# MinIO mirror weekly on Sunday at 3am
0 3 * * 0 root mc mirror local/urban-vibes-dynamics-files /backups/files/ 2>&1
```

Keep at least 30 days of database backups and 4 weeks of file backups.

## Restoring from Backup

### Restore PostgreSQL

```bash
# Stop dependent services
docker compose stop backend celery-worker celery-beat

# Drop and recreate the database
docker compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS urban_erp;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE urban_erp;"

# Restore from plain SQL dump
cat backup-20260313.sql | docker compose exec -T postgres psql -U postgres urban_erp

# Or restore from compressed dump
docker compose exec -T postgres pg_restore \
  -U postgres -d urban_erp < backup-20260313.dump

# Restart services
docker compose start backend celery-worker celery-beat

# Apply any new migrations
docker compose exec backend alembic upgrade head
```

### Restore MinIO Files

```bash
mc mirror /backups/files/ local/urban-vibes-dynamics-files
```

## Testing Your Backups

**Test restores regularly** — a backup you have never tested is not a backup.

Monthly checklist:
1. Restore the database to a staging server
2. Start the stack against the restored DB
3. Log in and verify data looks correct
4. Restore a sample of MinIO files and confirm they open

## Cloud Backup (Optional)

For off-site backups, sync to S3-compatible storage (Backblaze B2, AWS S3, Wasabi):

```bash
# Sync database backups to S3
aws s3 sync /backups/db/ s3://your-bucket/urban-vibes-dynamics/db/

# Or use mc for MinIO → another S3
mc mirror local/urban-vibes-dynamics-files remote-s3/your-bucket/files/
```

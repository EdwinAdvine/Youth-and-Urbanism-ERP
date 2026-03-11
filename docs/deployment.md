# Deployment Guide

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- Minimum 8 GB RAM (16 GB recommended for all services)
- 50 GB disk space (SSD recommended)
- Domain name (for production SSL)

---

## Development Setup

### 1. Clone and Configure

```bash
cd urban-erp
cp .env.example .env
```

Edit `.env` with your local settings. Key variables:

```env
# Database
DATABASE_URL=postgresql+asyncpg://urban:urban_secret@postgres:5432/urban_erp

# Redis
REDIS_URL=redis://redis:6379/0

# JWT
JWT_SECRET_KEY=your-secret-key-change-in-production
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# AI Provider (ollama = local, openai/grok/anthropic = cloud)
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://ollama:11434

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# First Super Admin (seeded on first run)
FIRST_SUPERADMIN_EMAIL=admin@urban.local
FIRST_SUPERADMIN_PASSWORD=changeme
```

### 2. Start Services

```bash
docker compose up -d --build
```

### 3. Run Migrations

```bash
docker compose exec backend alembic upgrade head
```

### 4. Verify

- Frontend: http://localhost:3010
- Backend API docs: http://localhost:8010/docs
- Health check: http://localhost:8010/health

---

## Production Deployment

### Using docker-compose.prod.yml

The production compose file includes:
- Nginx reverse proxy with SSL termination
- Resource limits on all containers
- Restart policies
- Volume management for persistent data
- No development tools (pgAdmin, MailHog)

### 1. SSL Certificates

```bash
# Initialize Let's Encrypt certificates
./scripts/init-ssl.sh yourdomain.com
```

Or place existing certificates in:
```
nginx/certs/fullchain.pem
nginx/certs/privkey.pem
```

### 2. Production Environment

Create `.env.prod` with production values:

```env
# CRITICAL: Change these
JWT_SECRET_KEY=<generate-a-64-char-random-string>
FIRST_SUPERADMIN_PASSWORD=<strong-password>
POSTGRES_PASSWORD=<strong-password>
MINIO_SECRET_KEY=<strong-password>

# Domain
DOMAIN=erp.yourdomain.com
CORS_ORIGINS=https://erp.yourdomain.com

# Database
DATABASE_URL=postgresql+asyncpg://urban:<db-password>@postgres:5432/urban_erp

# AI (production)
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://ollama:11434

# Disable debug mode
DEBUG=false
```

### 3. Deploy

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

Or use the deployment script:
```bash
./scripts/deploy.sh
```

---

## Database Management

### Migrations

```bash
# Check current migration version
docker compose exec backend alembic current

# Apply all pending migrations
docker compose exec backend alembic upgrade head

# Rollback one migration
docker compose exec backend alembic downgrade -1

# View migration history
docker compose exec backend alembic history
```

### Migration History

| Revision | Description |
|----------|-------------|
| `13f96502759d` | Initial schema (Phase 0 — auth, RBAC) |
| `334f9af6510a` | Finance, HR, CRM models |
| `df71e245a992` | Forms, Projects models |
| `598456d10bbe` | Phase 2 — Notes, Sharing, Calendar, Activity |
| `0aef716d191a` | Phase 3 — Inventory, Settings, Notifications, Payroll |
| `9b8c87451538` | Projects Members JSON→JSONB fix |
| `a1b2c3d4e5f6` | POS module |
| `b2c3d4e5f6a7` | Phase 4 — Supply Chain, Manufacturing, Support, Embeddings |
| `c3d4e5f6a7b8` | E-Commerce, License, SSO, Finance/Payroll Extensions |
| `d4e5f6a7b8c9` | Enhanced Sharing — Team Folders, Audit Logs |

---

## Backup & Restore

### Automated Backups

```bash
# Create backup
./scripts/backup.sh

# Backups stored in ./backups/ with timestamps
```

### Manual Backup

```bash
docker compose exec postgres pg_dump -U urban urban_erp > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore

```bash
# From a backup file
./scripts/restore.sh backups/backup_20260301_120000.sql

# Or manually
docker compose exec -T postgres psql -U urban urban_erp < backup_file.sql
```

### API-Based Backup (Super Admin)

```bash
# Create backup via API
curl -X POST http://localhost:8010/api/v1/backups/ \
  -H "Authorization: Bearer <token>"

# List backups
curl http://localhost:8010/api/v1/backups/ \
  -H "Authorization: Bearer <token>"

# Restore
curl -X POST http://localhost:8010/api/v1/backups/{backup_id}/restore \
  -H "Authorization: Bearer <token>"
```

---

## Service Configuration

### Docker Services & Ports

| Service | Internal Port | Host Port | Purpose |
|---------|---------------|-----------|---------|
| postgres | 5432 | 5433 | PostgreSQL + pgvector |
| redis | 6379 | 6380 | Cache + message broker |
| minio | 9000/9001 | 9010/9011 | Object storage |
| ollama | 11434 | 11435 | Local LLM |
| backend | 8000 | 8010 | FastAPI API |
| frontend | 3000 | 3010 | React app |
| stalwart | 25/143/587/993 | same | Mail server |
| onlyoffice | 80 | 8083 | Document server |
| jitsi-web | 80/443 | 8080/8443 | Video conferencing |
| nextcloud-web | 80 | 8085 | File sharing |
| superset | 8088 | 8088 | Analytics |
| pgadmin | 80 | 5051 | DB admin (dev only) |
| mailhog | 8025/1025 | 8026/1026 | Email testing (dev only) |

### Scaling Celery Workers

```bash
docker compose up -d --scale celery-worker=3
```

### Ollama Model Management

```bash
# Pull a model
docker compose exec ollama ollama pull llama3.1

# List models
docker compose exec ollama ollama list
```

---

## Monitoring

### Health Check

```bash
curl http://localhost:8010/health
```

Returns status of: PostgreSQL, Redis, MinIO, Ollama, Stalwart, Nextcloud

### Prometheus Metrics

Available at `http://localhost:8010/metrics` — scrape with Prometheus or view in Grafana.

Key metrics:
- `http_requests_total` — request count by endpoint
- `http_request_duration_seconds` — latency histograms
- `http_request_size_bytes` — request/response sizes

### Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend

# Backend JSON logs (structured with structlog)
docker compose logs backend | jq .
```

---

## Troubleshooting

### Common Issues

**Database connection refused:**
```bash
# Check postgres is running
docker compose ps postgres
# Check logs
docker compose logs postgres
```

**Migration conflicts:**
```bash
# Check current state
docker compose exec backend alembic current
# Show heads
docker compose exec backend alembic heads
```

**MinIO access denied:**
```bash
# Verify credentials match .env
docker compose exec minio mc admin info local
```

**Ollama model not found:**
```bash
# Pull the model first
docker compose exec ollama ollama pull llama3.1
```

**Frontend can't reach backend:**
- Verify `VITE_API_URL` in frontend config points to backend
- Check CORS_ORIGINS in `.env` includes frontend URL

### Reset Everything

```bash
# Stop all services and remove volumes (DATA LOSS)
docker compose down -v

# Rebuild from scratch
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

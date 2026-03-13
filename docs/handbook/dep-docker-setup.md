---
title: "Docker Compose Setup"
slug: "docker-compose-setup"
category: "deployment"
article_type: "guide"
tags: [deployment, docker, setup, installation]
sort_order: 0
is_pinned: true
excerpt: "Install Urban Vibes Dynamics on your server using Docker Compose — step-by-step production setup."
---

# Docker Compose Setup

Urban Vibes Dynamics runs as a single Docker Compose stack. This guide walks through a production installation.

## Prerequisites

- **Docker** 24.0+ and **Docker Compose** v2.20+
- Server: 4 GB RAM minimum (8 GB recommended), 2 vCPU, 40 GB disk
- **Ubuntu 22.04 LTS** or any Linux distro with Docker support
- A domain name (optional but recommended for SSL)

## Installation Steps

### 1. Clone the repository

```bash
git clone https://github.com/your-org/urban-vibes-dynamics.git
cd urban-vibes-dynamics
```

### 2. Configure environment

```bash
cp .env.example .env
nano .env   # or use your preferred editor
```

**Required variables to set:**

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Random 64-char string — run: `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | Strong database password |
| `SUPER_ADMIN_EMAIL` | Your admin login email |
| `SUPER_ADMIN_PASSWORD` | Your admin login password |
| `MINIO_ROOT_PASSWORD` | MinIO storage password |

### 3. Start all services

```bash
docker compose up -d --build
```

This starts 13 containers: PostgreSQL, Redis, MinIO, Backend, Frontend, Celery Worker, Celery Beat, Stalwart Mail, ONLYOFFICE, and the 4 Jitsi services.

### 4. Apply database migrations

```bash
docker compose exec backend alembic upgrade head
```

### 5. Verify everything is running

```bash
docker compose ps
```

All containers should show `Up`. Access Urban Vibes Dynamics at:
- **App:** `http://your-server-ip:3010`
- **API docs:** `http://your-server-ip:8010/docs`
- **MinIO console:** `http://your-server-ip:9011`

### 6. First login

Open the app in your browser. Log in with your `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`.

Go to **Admin → Users** to create App Admins and regular users.

## Updating Urban Vibes Dynamics

```bash
git pull
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

## Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
```

## Service Ports

| Service | Port |
|---------|------|
| Frontend | 3010 |
| Backend API | 8010 |
| PostgreSQL | 5433 |
| Redis | 6380 |
| MinIO API | 9010 |
| MinIO Console | 9011 |
| ONLYOFFICE | 8083 |

For production, put Nginx in front and only expose ports 80/443.

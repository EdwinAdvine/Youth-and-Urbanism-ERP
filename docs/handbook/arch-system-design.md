---
title: System Architecture Overview
slug: system-architecture-overview
category: architecture
article_type: guide
tags: [architecture, docker, infrastructure, tech-stack, services]
sort_order: 0
is_pinned: true
excerpt: Technical architecture of Urban Vibes Dynamics: services, containers, data flow, and design principles.
---

# System Architecture Overview

Urban Vibes Dynamics is a fully self-hosted platform running as a single Docker Compose stack. There are no mandatory external API calls — every feature works inside your own infrastructure. This document explains what each container does, how data flows between them, and why each component was chosen.

---

## The 14-Container Stack

All containers are prefixed `urban-vibes-dynamics-*` and communicate over the internal Docker network `urban-vibes-dynamics-net`. Only the ports listed below are exposed to the host.

### Data Layer

| Container | Host Port | Role |
|---|---|---|
| `urban-vibes-dynamics-postgres` | 5433 | Primary database — PostgreSQL 16 with the `pgvector` extension for AI embedding storage |
| `urban-vibes-dynamics-redis` | 6380 | In-memory store — session cache, Celery task queue, and the pub/sub event bus |
| `urban-vibes-dynamics-minio` | 9010 (API) / 9011 (console) | S3-compatible object storage — all user-uploaded files, document attachments, and export artifacts go here in the `urban-vibes-dynamics-files` bucket |

### Application Layer

| Container | Host Port | Role |
|---|---|---|
| `urban-vibes-dynamics-backend` | 8010 | FastAPI application server — all REST and WebSocket endpoints, business logic, ORM, async I/O |
| `urban-vibes-dynamics-frontend` | 3010 | React 18 + Vite SPA — served by a lightweight static file server |
| `urban-vibes-dynamics-celery-worker` | — | Async task worker — email sending, report generation, data exports, scheduled jobs |
| `urban-vibes-dynamics-celery-beat` | — | Scheduler — fires recurring Celery tasks (nightly payroll accruals, daily analytics rollup, reminder emails) |
| `urban-vibes-dynamics-ollama` | 11435 | Local LLM server — runs open-weight models (Llama 3, Mistral, etc.) for AI features with zero data leaving your server |

### Communication & Document Layer

| Container | Host Port | Role |
|---|---|---|
| `urban-vibes-dynamics-stalwart` | 8082 | SMTP/IMAP mail server — the Mail module backend; also accepts outbound mail relay for system notifications |
| `urban-vibes-dynamics-onlyoffice` | 8083 | Document editing engine — handles `.docx`, `.xlsx`, `.pptx` collaborative editing; Urban Vibes Dynamics wraps its API with our own UI |
| `urban-vibes-dynamics-jitsi-web` | — | Jitsi Meet web component for in-app video conferencing |
| `urban-vibes-dynamics-jitsi-prosody` | — | XMPP signalling server for Jitsi |
| `urban-vibes-dynamics-jitsi-jicofo` | — | Jitsi conference focus component |
| `urban-vibes-dynamics-jitsi-jvb` | — | Jitsi video bridge — handles the actual media streams |

---

## Data Flow

A typical user request travels this path:

```
Browser (React) → urban-vibes-dynamics-frontend (static)
                → urban-vibes-dynamics-backend (API, port 8010)
                     → urban-vibes-dynamics-postgres (read/write)
                     → urban-vibes-dynamics-redis (cache / events)
                     → urban-vibes-dynamics-minio (file I/O)
                     → urban-vibes-dynamics-celery-worker (async offload via Redis)
                     → urban-vibes-dynamics-ollama (AI inference)
```

WebSocket connections (AI chat, real-time notifications, live collaboration) maintain a persistent connection to `urban-vibes-dynamics-backend`. The backend publishes events to Redis pub/sub channels; subscribed handlers in the same process (and in Celery workers) consume them to trigger cross-module side effects.

---

## Tech Stack Choices

**FastAPI (Python):** Async-first, excellent SQLAlchemy 2.0 integration, auto-generates OpenAPI docs, and the Python ecosystem gives us first-class access to data science and AI libraries without a separate service.

**React 18 + TanStack Query + Zustand:** TanStack Query handles all server state (caching, background refetch, optimistic updates) so components stay simple. Zustand manages the small amount of global UI state. Vite gives fast HMR during development and optimised production builds.

**PostgreSQL 16 + pgvector:** A single, proven relational database covering all 18 modules. The `pgvector` extension lets us store and query AI embeddings in the same DB, avoiding a separate vector store service.

**Celery + Redis:** Reliable async task processing without a heavyweight message broker. Redis doubles as the event bus, eliminating a second queue service.

**Ollama (local LLM):** All AI inference runs on your hardware. The Super Admin can optionally configure OpenAI, Anthropic, or Grok as fallback providers in **Admin → System Settings → AI**, but this is never required.

**MinIO (S3-compatible):** All file storage uses the standard S3 API. If you ever need to migrate to AWS S3 or another provider, only the endpoint and credentials change — no application code changes.

**ONLYOFFICE + Jitsi (engines kept forever):** Rather than reimplementing document editing or video conferencing — both extraordinarily complex problems — Urban Vibes Dynamics wraps two best-in-class open-source engines with our own UI. Users get a seamless integrated experience; we maintain a thin integration layer.

---

## Zero External API Dependency Principle

Every core feature works without calling any external API. Email goes through Stalwart (or your own SMTP server). AI runs through Ollama. Files stay in MinIO. Docs and video use ONLYOFFICE and Jitsi — all self-hosted. This means Urban Vibes Dynamics works in air-gapped environments and you never face unexpected downtime or pricing changes from third-party services.

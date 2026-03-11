# Architecture Overview

## System Design Principles

1. **Total Independence** — All services run inside Docker containers on private infrastructure. No SaaS dependencies, no "call home" risks.
2. **Single Orchestrator** — FastAPI is the sole entry point. No direct app-to-app calls. All communication flows through the central backend.
3. **Shared Database** — Single PostgreSQL 16 instance with pgvector. All modules share one schema with proper isolation via RBAC.
4. **Event-Driven** — Redis pub/sub event bus enables loose coupling between modules. Cross-module side effects happen via event handlers.
5. **Async First** — SQLAlchemy 2.0 async with asyncpg, async FastAPI endpoints, async service methods.

## Service Topology

```
                                    ┌─────────────────┐
                                    │   Nginx Proxy    │
                                    │   (SSL/Routing)  │
                                    └────────┬─────────┘
                          ┌──────────────────┼──────────────────┐
                          │                  │                  │
                   ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐
                   │   Frontend  │   │   Backend   │   │  Nextcloud  │
                   │  React/Vite │   │   FastAPI   │   │  Web (8085) │
                   │   (:3010)   │   │   (:8010)   │   └─────────────┘
                   └─────────────┘   └──────┬──────┘
                                            │
              ┌─────────┬──────────┬────────┼────────┬──────────┬─────────┐
              │         │          │        │        │          │         │
        ┌─────▼───┐ ┌───▼────┐ ┌──▼───┐ ┌──▼──┐ ┌──▼────┐ ┌──▼───┐ ┌──▼────────┐
        │Postgres │ │ Redis  │ │MinIO │ │Ollama│ │Stalwart│ │Jitsi │ │ONLYOFFICE │
        │ (:5433) │ │(:6380) │ │(:9010)│ │(:11435)│(:8082)│ │(:8443)│ │  (:8083)  │
        └─────────┘ └────────┘ └──────┘ └──────┘ └───────┘ └──────┘ └───────────┘
                                                                │
                                                    ┌───────────┴────────┐
                                                    │  Celery Worker(s)  │
                                                    │  + Celery Beat     │
                                                    └────────────────────┘
```

## Backend Architecture

### Layer Structure

```
API Layer (Routers)          → Request validation, auth checks, response formatting
  ↓
Service Layer                → Business logic, cross-module coordination
  ↓
Model Layer (SQLAlchemy)     → Database entities, relationships
  ↓
Core Layer                   → Config, DB sessions, security, events, RBAC
```

### Key Architectural Components

#### Event Bus (`core/events.py`)

Redis pub/sub-based event system for cross-module reactivity:

```python
# Publishing an event
await event_bus.emit("meeting.created", {
    "meeting_id": meeting.id,
    "title": meeting.title,
    "start_time": meeting.start_time
})

# Handler in main.py lifespan
@event_bus.on("meeting.created")
async def handle_meeting_created(data):
    # Auto-create calendar event
    ...
```

**Registered event handlers:**
| Event | Action |
|-------|--------|
| `meeting.created` | Auto-create calendar event |
| `calendar.event.created` | Push to Stalwart CalDAV |
| `file.uploaded` | Log activity, notify relevant users |
| `file.shared` | Create notification for recipient |
| `invoice.sent` | Notify finance admins |
| `leave.approved` | Create calendar event for leave period |
| `stock.low` | Trigger reorder alert notifications |
| `po.received` | Update inventory stock levels |
| `payslip.approved` | Create payslip notification |

#### RBAC System (`core/rbac.py`, `core/deps.py`)

Three-tier access control:

```
SuperAdmin ─── full system access, all modules
  └── AppAdmin ─── scoped to specific module (e.g., Finance Admin)
        └── User ─── permission-based access via role assignments
```

- Roles stored in `roles` table with JSON permission sets
- `CurrentUser` dependency auto-extracts user from JWT
- `SuperAdminUser` dependency enforces super-admin only
- App admin middleware validates module scope

#### AI Service (`services/ai.py`)

Multi-provider AI with RAG:

```
User Message → Context Enrichment (RAG/pgvector) → Provider Selection → Streaming Response
                                                         │
                              ┌───────────────────────────┼────────────┐
                              │                           │            │
                         Ollama (local)            OpenAI/Grok    Anthropic
                         (default)                 (fallback)    (fallback)
```

- **34 AI tools** in `services/ai_tools.py` for cross-module actions
- **RAG pipeline**: Document → Embedding (pgvector) → Similarity Search → Context Injection
- **Audit logging**: Every AI interaction recorded with provider, tokens, user, timestamp

#### Database Design

**Core tables:** User, Role, Permission (RBAC foundation)

**Module tables organized by domain:**
- Communication: MailMessage, CalendarEvent, Note
- Files: File, Folder, FileShare, TeamFolder, ShareAuditLog
- CRM: Contact, Lead, Deal, Pipeline
- Finance: Account, Invoice, Payment, JournalEntry, Currency, TaxRate, BankAccount
- HR: Department, Employee, Leave, Attendance, Payslip, PayRun
- Inventory: Item, Warehouse, StockMovement, PurchaseOrder, ReorderAlert
- Projects: Project, Task, Subtask, TimeLog
- Forms: Form, FormField, FormResponse
- E-Commerce: Store, Product, Order, Customer
- AI: AIChat, AIMessage, Embedding
- System: Notification, CompanySettings, UserSettings, License, SSOProvider

**Key relationships:**
- All models link to `User` via `created_by` / `owner_id`
- Cross-module links: Invoice → Contact (CRM), Task → CalendarEvent, File → any module via `DocLink`
- Activity feed tracks changes across all modules

### Middleware Stack

Request processing order:

1. **CORS** — Configurable origins (Starlette middleware)
2. **Security Headers** — HSTS, X-Frame-Options, CSP, X-Content-Type-Options
3. **Request ID** — UUID injection for distributed tracing
4. **Structured Logging** — JSON logs with request context (structlog)
5. **Rate Limiting** — Redis-backed per-endpoint limits (slowapi)
6. **Prometheus Metrics** — Request count, latency, status code histograms
7. **License Check** — Validate active license for premium features
8. **Authentication** — JWT token validation → `CurrentUser` injection

### Background Tasks (Celery)

**Worker tasks:**
- Email sending and parsing
- Document embedding generation (RAG)
- Backup orchestration
- Report generation

**Beat schedule (periodic):**
- Overdue invoice reminders
- Attendance auto-checkout
- CalDAV sync with Stalwart
- Stock level monitoring

## Frontend Architecture

### Routing & Code Splitting

All feature pages are lazy-loaded via `React.lazy()` with route-level code splitting:

```
App.tsx
  ├── RequireGuest → /login, /register
  ├── RequireAuth → Protected routes
  │   ├── / → HomePage (Urban Board)
  │   ├── /finance/* → Finance module (11 pages)
  │   ├── /hr/* → HR module (8 pages)
  │   ├── /crm/* → CRM module (5 pages)
  │   ├── /inventory/* → Inventory module (7 pages)
  │   ├── /projects/* → Projects (Kanban + time logs)
  │   ├── /admin/* → Admin (14 pages, SuperAdmin only)
  │   └── ... (26 total feature modules)
  └── RequireSuperAdmin → /admin/*
```

### State Management

| Tool | Purpose |
|------|---------|
| **TanStack Query** | Server state — API data fetching, caching, auto-refetch |
| **Zustand** | Client state — auth, UI preferences, notification count |
| **React Hook Form + Zod** | Form state — validation, submission |

### API Layer

Centralized Axios instance in `api/client.ts`:
- Base URL configuration
- JWT token injection via interceptor
- 401 auto-redirect to login
- Response error normalization

Each module has its own API client file (e.g., `api/finance.ts`) exporting typed functions.

### Component Architecture

```
Layout (AppShell)
  ├── Header — Search (Cmd+K), Notifications bell, User menu
  ├── Sidebar — Module navigation, collapsible
  └── Main Content
       ├── Feature Pages — Module-specific views
       ├── AI ChatWidget — Floating assistant (bottom-right)
       └── Modals — ShareDialog, SearchModal, etc.
```

## Security

- **Authentication**: JWT access + refresh tokens, bcrypt password hashing
- **Authorization**: RBAC with role inheritance, per-endpoint permission checks
- **Transport**: TLS/SSL termination at Nginx (production)
- **Headers**: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- **Rate Limiting**: Redis-backed per-endpoint throttling
- **Input Sanitization**: SQL LIKE escaping, XSS prevention via DOMPurify (frontend)
- **Audit Trail**: All sensitive operations logged with user, timestamp, details
- **Secrets**: Environment-based configuration, no hardcoded credentials

## Monitoring & Observability

- **Prometheus** — FastAPI request metrics at `/metrics`
- **Grafana** — Pre-configured dashboards in `monitoring/grafana/`
- **Structured Logging** — JSON logs via structlog with request IDs
- **Health Checks** — `/health` endpoint checking all dependent services
- **Audit Logs** — Business-level event logging in database

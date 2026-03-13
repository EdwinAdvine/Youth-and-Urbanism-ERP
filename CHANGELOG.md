# Changelog

All notable changes to Urban Vibes Dynamics will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-03-13

Urban Vibes Dynamics reaches full maturity — a complete, self-hosted ERP platform with 25+ modules,
400+ API endpoints, 100+ frontend pages, and 55 AI tools.

### Added

#### Platform Foundation
- Full-stack ERP platform with React 18 + FastAPI + PostgreSQL 16 + Redis 7
- Three-tier RBAC: Super Admin → App Admin → User with per-module scoping
- Redis pub/sub event bus for decoupled cross-module communication (19 event channels)
- Celery + Redis background job system with beat scheduling
- MinIO (S3-compatible) file storage with presigned URL support
- SSO via OAuth2/OIDC (Google, Microsoft, custom providers)
- System-wide audit logging and activity feed
- Bulk CSV user import with validation
- License and subscription management

#### Finance Module
- Chart of Accounts, Journal Entries (double-entry), Invoicing, Payments
- Multi-currency support, tax management (Kenya VAT/WHT), budgets
- Asset management, recurring transactions, batch processing
- Financial reports (P&L, Balance Sheet, Cash Flow, Trial Balance, Aged Receivables)
- AI-powered financial analysis and forecasting

#### CRM Module
- Contacts, Leads, Opportunities, Deals with Kanban pipeline view
- Custom fields, custom objects, AI-powered lead scoring
- Marketing campaigns, email sequences, workflow automation
- AI agents for CRM tasks, collaboration tools, audit trail
- Form submission → auto-create lead integration

#### HR & Payroll Module
- Employee management, org chart, onboarding workflows
- Leave management, attendance tracking, shift scheduling
- Payroll processing with Kenya statutory deductions (NHIF, NSSF, PAYE)
- Goals & OKRs, performance reviews, compensation planning
- AI-powered resume screening, learning management system (LMS)
- People analytics and manager dashboards

#### Calendar & Meetings
- Full calendar with day/week/month views, recurring events
- Smart scheduling with availability detection, focus time blocks
- Meeting rooms and resource booking, attendee management
- Calendar analytics and ROI tracking, webhook integrations
- AI-powered scheduling suggestions and mail scanning for events
- Jitsi Meet integration for video conferencing (self-hosted engine)

#### Projects Module
- Kanban boards, list view, Gantt-style timeline
- Task management with subtasks, comments, custom fields
- Sprint planning, time tracking, recurring tasks
- Cross-module integrations: Drive folders, CRM deals, Finance expenses
- Project automation rules (on task status change → trigger actions)

#### Support & Help Desk
- Ticket management with SLA tracking and escalation rules
- Omnichannel support (email, live chat, voice, portal)
- AI-powered ticket triage and auto-categorization
- Knowledge base, customer portal, satisfaction surveys
- Agent skills-based routing, presence management
- Proactive support and sandbox environments

#### Communication Suite
- **Y&U Mails**: Full email client (inbox, compose, threads, folders, rules, signatures)
- **Chat**: Real-time messaging with channels, DMs, file sharing
- **Notes**: Rich text editor with notebooks, templates, sharing, AI summarization
- **Drive**: File management with folders, sharing, versioning, WebDAV
- **Docs**: ONLYOFFICE-powered document editing (Word, Excel, PowerPoint)

#### Inventory & Warehouse
- Multi-warehouse stock management, stock adjustments
- Serial number and UOM tracking, kit/bundle management
- Automated replenishment rules, inventory costing (FIFO, LIFO, weighted average)
- Warehouse management system (WMS) with bin locations

#### Supply Chain
- Supplier management, purchase orders, goods receiving (GRN)
- Procurement planning, supplier performance tracking
- Auto-procurement from e-commerce orders
- GRN → Inventory stock movement integration

#### Manufacturing
- Bill of Materials (BOM), work orders, production scheduling
- Quality control checkpoints, equipment management
- Labor tracking, engineering change orders (ECO)
- Full traceability (lot/serial tracking through production)
- Cost breakdown integration with Finance

#### Point of Sale (POS)
- Session management, multi-terminal support
- Barcode scanning, receipt printing, cash drawer management
- Customer loyalty program, gift cards
- Kitchen Display System (KDS) for restaurant operations
- POS sale → Finance journal entry integration

#### E-Commerce
- Product catalog, order management, checkout flow
- B2B portal with tiered pricing, subscriptions
- Blog/CMS for storefront content
- Customer loyalty and rewards program
- Storefront theme customization
- Order → CRM contact + Finance invoice + Mail confirmation integration

#### Analytics
- Built-in analytics dashboard (replaced Superset)
- Revenue, user activity, module usage, expense, and support metrics
- Top products, customer acquisition, and retention analytics
- Direct PostgreSQL queries for real-time data

#### AI System
- Ollama-powered local AI (primary) with OpenAI/Anthropic/Grok fallback
- 55 AI tools across all modules (financial analysis, lead scoring, scheduling, etc.)
- AI chat with WebSocket streaming and voice input
- Urban Bad AI: Multi-agent system (Orchestrator, Researcher, Verifier, Executor)
- Tool approval tiers: auto_approve / warn / require_approval
- Right sidebar UI with agent thinking indicators and approval workflow

#### Handbook
- Built-in user handbook with article management and WYSIWYG editor
- Category-based organization, full-text search, breadcrumb navigation
- User feedback collection, reading progress tracking, view analytics
- Pro tips, AI shortcut integration, table of contents sidebar

#### Forms
- Form builder with multiple field types
- Public form sharing, response collection
- Form submission → CRM lead creation integration

#### Booking
- Appointment and resource booking system
- Calendar integration for availability management

#### Infrastructure
- Docker Compose stack with 14 containers (all prefixed `urban-vibes-dynamics-*`)
- GitHub Actions CI: lint (ruff), typecheck (tsc), test (pytest + vitest), build
- Deployment scripts (backup, deploy, SSL, restore)
- Nginx reverse proxy configuration
- Grafana monitoring setup

### Changed
- Docker containers renamed from generic names to `urban-vibes-dynamics-*` prefix
- HTTP 204 responses changed to HTTP 200 across 79 router files for frontend compatibility
- Analytics `Goal` class renamed to `AnalyticsGoal` to resolve SQLAlchemy conflict with `hr_phase1.Goal`
- Production Dockerfiles replace development versions

### Removed
- Nextcloud (replaced by built-in Drive + MinIO)
- Superset (replaced by built-in Analytics with direct Postgres queries)
- PgAdmin (dev tool, no longer needed in stack)
- Mailhog (replaced by Stalwart SMTP with configurable SMTP_HOST/SMTP_PORT)
- WhatsApp button (removed from UI)
- Stalwart mail server container (mail handled via configurable SMTP settings)
- `docker-compose.prod.yml` (consolidated into single `docker-compose.yml`)

### Fixed
- Sidebar visibility: created `sidebarMenus.tsx`, rewrote `Sidebar.tsx` with collapsible groups, added KDS + Loyalty to AppShell
- Backend startup errors resolved across all modules
- Database schema gaps fixed (broken FK references, missing columns)
- ONLYOFFICE docs integration configuration corrected
- Agent WebSocket connection stability improvements
- Jitsi-web port conflict resolved
- All unused imports removed across backend and frontend
- Celerybeat-schedule file excluded from git tracking

### Security
- RBAC enforcement on all API endpoints
- JWT-based authentication with configurable expiry
- Rate limiting via slowapi with Redis backend
- Input sanitization and security headers middleware
- CORS configuration for frontend origin

---

[Unreleased]: https://github.com/urban-vibes-dynamics/urban-vibes-dynamics/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/urban-vibes-dynamics/urban-vibes-dynamics/releases/tag/v1.0.0

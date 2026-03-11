# Y&U ERP – Rewrite Checklists

Per-module progress tracking for the full rewrite to 100% owned React + FastAPI code.

## Master Checklist

**[MASTER-IMPLEMENTATION-CHECKLIST.md](MASTER-IMPLEMENTATION-CHECKLIST.md)** — 718 items across 6 priority tiers, covering every gap identified in the codebase audit. Start here.

## Module Status Overview

| Module | Checklist | Status | Owner |
|--------|-----------|--------|-------|
| Admin | [yu-admin.md](yu-admin.md) | COMPLETE | 100% Ours |
| Urban Board AI | [yu-ai.md](yu-ai.md) | COMPLETE | 100% Ours |
| Drive | [yu-drive.md](yu-drive.md) | COMPLETE | 100% Ours |
| Calendar | [yu-calendar.md](yu-calendar.md) | COMPLETE | 100% Ours |
| Notes | [yu-notes.md](yu-notes.md) | COMPLETE | 100% Ours |
| Forms | [yu-forms.md](yu-forms.md) | COMPLETE | 100% Ours |
| Projects | [yu-projects.md](yu-projects.md) | COMPLETE | 100% Ours |
| Finance | [yu-finance.md](yu-finance.md) | COMPLETE | 100% Ours |
| CRM | [yu-crm.md](yu-crm.md) | COMPLETE | 100% Ours |
| HR & Payroll | [yu-hr.md](yu-hr.md) | COMPLETE | 100% Ours |
| Inventory | [yu-inventory.md](yu-inventory.md) | COMPLETE | 100% Ours |
| Supply Chain | [yu-supply-chain.md](yu-supply-chain.md) | COMPLETE | 100% Ours |
| Manufacturing | [yu-manufacturing.md](yu-manufacturing.md) | COMPLETE | 100% Ours |
| POS | [yu-pos.md](yu-pos.md) | COMPLETE | 100% Ours |
| E-Commerce | [yu-ecommerce.md](yu-ecommerce.md) | COMPLETE | 100% Ours |
| Support | [yu-support.md](yu-support.md) | COMPLETE | 100% Ours |
| Mails | [yu-mail.md](yu-mail.md) | COMPLETE | 100% Ours |
| Docs/Excel/PPT | [yu-docs.md](yu-docs.md) | COMPLETE | Ours + ONLYOFFICE (forever) |
| Teams/Meetings | [yu-teams.md](yu-teams.md) | COMPLETE | Ours + Jitsi (forever) |
| Analytics | [yu-analytics.md](yu-analytics.md) | COMPLETE | Replaces Superset |

## Engines Kept Forever
- **ONLYOFFICE Document Server** – document editing engine (internal Docker)
- **Jitsi Meet** – video conferencing engine (internal Docker)

## Containers to Remove
- [x] ERPNext (already removed)
- [x] Nextcloud (replaced by our Drive)
- [x] Superset (replaced by our Analytics)
- [x] PgAdmin (dev tool only)
- [x] Mailhog (replaced by configurable SMTP → Stalwart)
- [x] Stalwart (removed — replaced by built-in mail)

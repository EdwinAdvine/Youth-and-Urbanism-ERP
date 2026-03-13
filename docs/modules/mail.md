# Mail Module (Y&U Mails)

> Full email client with inbox, compose, threading, folders, rules, AI, and cross-module actions.

## Overview

Y&U Mails provides a complete Outlook-like email experience powered by an internal SMTP/IMAP server (configurable). All email is stored in PostgreSQL — not in an external mail server — giving full control and searchability.

---

## Features

- **Inbox** — full email client with folder navigation, threading, search
- **Compose** — rich text editor, attachments, CC/BCC, reply tracking
- **Folders & labels** — custom folders, smart labels, color tags
- **Rules** — auto-sort, auto-reply, forward rules based on sender/subject
- **Signatures** — per-user email signatures
- **Filters** — AI-powered email categorization (primary, promotions, updates)
- **Advanced search** — full-text search across all messages
- **Mail accounts** — connect multiple IMAP/SMTP accounts
- **Cross-module actions** — save email to Drive, create task, link to CRM contact
- **AI features** — smart reply suggestions, thread summarization, auto-categorization

---

## Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/mail.py` | Core: inbox, compose, folders, messages |
| `backend/app/api/v1/mail_accounts.py` | External mail account management |
| `backend/app/api/v1/mail_advanced.py` | Advanced features: rules, filters, signatures |
| `backend/app/api/v1/mail_ext.py` | Cross-module action endpoints |
| `backend/app/api/v1/mail_filters.py` | AI-powered email filtering |
| `backend/app/integrations/smtp_client.py` | SMTP sending integration |
| `backend/app/integrations/imap_client.py` | IMAP inbox sync |
| `backend/app/models/mail.py` | Mail SQLAlchemy models |

---

## Cross-Module Integrations

| Module | Integration |
|--------|-------------|
| CRM | Link email to Contact; CardDAV contact sync |
| Calendar | Email invitations auto-create calendar events |
| Drive | Attach Drive files; save email attachments to Drive |
| Projects | Create task from email |
| Notes | Save email body as a note |
| Support | Inbound emails can create support tickets |

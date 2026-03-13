# Notes Module

> Rich text notebooks with AI summarization, templates, sharing, and cross-module linking.

## Overview

Y&U Notes provides a Notion/OneNote-like note-taking system with hierarchical notebooks, rich text editing (Tiptap), templates, AI features, sharing, and cross-module linking.

---

## Features

- **Notebooks** — hierarchical organization (workspace → notebook → note)
- **Rich text editor** — Tiptap-based with headings, lists, tables, code blocks, embeds
- **Templates** — note templates for meeting notes, project plans, etc.
- **AI features** — summarize, extract action items, suggest tags, auto-title
- **Sharing** — share notes with specific users or publicly
- **Sync** — offline sync with conflict resolution
- **Note databases** — structured data tables within notes (like Notion databases)
- **Email inbound** — email a note to your notebook (unique email address per notebook)
- **Analytics** — most-viewed notes, collaboration activity
- **Widgets** — embed charts, calendars, and live data in notes
- **Tagging** — hierarchical tag system with search

---

## Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/notes_router.py` | Core note CRUD |
| `backend/app/api/v1/notebooks.py` | Notebook management |
| `backend/app/api/v1/notes_ai.py` | AI features: summarize, extract, tag |
| `backend/app/api/v1/notes_analytics.py` | View and collaboration analytics |
| `backend/app/api/v1/notes_convert.py` | Convert note to other formats (PDF, Markdown) |
| `backend/app/api/v1/notes_email_inbound.py` | Email-to-note inbox |
| `backend/app/api/v1/notes_share.py` | Sharing and permissions |
| `backend/app/api/v1/notes_sync.py` | Offline sync support |
| `backend/app/api/v1/notes_templates_seeder.py` | Seed default note templates |
| `backend/app/api/v1/note_databases.py` | Structured data tables in notes |

---

## Cross-Module Integrations

| Module | Integration |
|--------|-------------|
| Calendar | Meeting notes linked to calendar events |
| Projects | Project notes linked to tasks and projects |
| Drive | Note attachments stored in Drive |
| Mail | Save important emails as notes |
| CRM | Contact meeting notes linked to CRM records |

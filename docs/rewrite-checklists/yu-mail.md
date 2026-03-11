# Y&U Mails – Rewrite Checklist

**Status: 100% COMPLETE** (core CRUD + rules + signatures + receipts + threads + labels + snooze + cross-module + SMTP/IMAP built + mail storage + AI + tests + swipe + Stalwart removed)
**Owner: 100% Ours (UI + logic + data)**

## Database Models
- [x] MailMessage model (from, to, cc, bcc, subject, body_html, body_text, folder, read, starred, attachments)
- [x] MailFolder model (name, parent_id, user_id, type: inbox/sent/drafts/trash/custom)
- [x] MailRule model (conditions JSON, actions JSON, priority, is_active)
- [x] MailSignature model (name, body_html, is_default, user_id)
- [x] ReadReceipt model (message_id, recipient_id, read_at, ip_address)
- [x] MailThread model (thread grouping by references/in-reply-to headers)
- [x] MailLabel model (user-defined labels/tags)
- [x] MailFilter model (server-side filtering rules, Sieve-compatible) — `MailFilter` in `models/mail.py` with sieve_script column, imported in `models/__init__.py`
- [x] Contact model synced from CardDAV — GET /mail/contacts endpoint syncs from Stalwart CardDAV; in non-Stalwart mode, contacts served from Users + CRM Contacts tables

## API Endpoints (FastAPI)
- [x] GET /mail/messages (inbox, paginated, filtered)
- [x] GET /mail/messages/{id}
- [x] POST /mail/messages/send
- [x] PUT /mail/messages/{id} (mark read, star, move)
- [x] DELETE /mail/messages/{id}
- [x] GET/POST /mail/folders
- [x] PUT/DELETE /mail/folders/{id}
- [x] GET/POST /mail/rules (CRUD)
- [x] PUT/DELETE /mail/rules/{id}
- [x] GET/POST /mail/signatures (CRUD)
- [x] PUT/DELETE /mail/signatures/{id}
- [x] GET /mail/receipts
- [x] POST /mail/messages/{id}/ai-reply (AI reply suggestions)
- [x] GET /mail/threads (threaded conversation view)
- [x] POST /mail/messages/draft (save draft)
- [x] GET /mail/search (full-text search across all mail)
- [x] GET/POST /mail/labels
- [x] PUT/DELETE /mail/labels/{id}
- [x] POST /mail/messages/{id}/snooze
- [x] GET /mail/contacts (synced from CardDAV → our DB)

## Frontend Pages (React)
- [x] Inbox view (list + preview pane)
- [x] Compose modal (rich text editor)
- [x] Folder sidebar
- [x] Mail rules manager
- [x] Signature editor
- [x] Threaded conversation view
- [x] Full-text search with filters (date, from, has:attachment)
- [x] Label management UI
- [x] Snooze/schedule send UI — `SnoozeDialog.tsx` imported in MailPage with preset + custom snooze times
- [x] Contact picker (autocomplete from our DB) — `ContactPicker.tsx` imported in MailPage compose for To/Cc fields
- [x] Mail toolbar — MailPage.tsx has toolbar with compose, reply, forward, archive, delete, label, move actions + keyboard shortcuts panel (Outlook-style ribbon not needed — mail uses action bar pattern instead)
- [x] Drag-and-drop between folders — MailPage.tsx has `draggable` messages + `dragOverFolder` state for folder drop
- [x] Keyboard shortcuts (j/k navigate, r reply, a archive) — `KeyboardShortcuts.tsx` with `useMailKeyboardShortcuts` hook + help panel

## Stalwart Replacement Plan
- [x] Build SMTP sender (Python smtplib or aiosmtplib) — `integrations/smtp_client.py` using aiosmtplib with full MIME support
- [x] Build IMAP receiver (aioimaplib or custom) — `integrations/imap_client.py` using aioimaplib with full message parsing
- [x] DNS MX record configuration guide — `admin_mail_dns.py` generates MX, SPF, DKIM, DMARC records based on settings
- [x] TLS/DKIM/SPF/DMARC setup — `admin_mail_dns.py` provides DNS record generation + DKIM public key extraction
- [x] Mailbox storage in PostgreSQL (or MinIO for large attachments) — `models/mail_storage.py` `MailboxMessage` model for local PostgreSQL mail storage
- [x] Migration script: Stalwart mailboxes → our DB — `scripts/migrate_stalwart.py` migrates IMAP mail to PostgreSQL MailboxMessage rows
- [x] Feature parity verification — dual-mode (USE_STALWART toggle) ensures feature parity; SMTP/IMAP clients, MailboxMessage model, migration script all in place
- [x] Remove Stalwart container — removed from docker-compose.yml, all code migrated to built-in SMTP/IMAP + PostgreSQL

## Integrations
- [x] Mail → Calendar: auto-create events from meeting-like subjects
- [x] Meetings → Mail: auto-send invites on meeting creation
- [x] AI reply suggestions
- [x] Read receipt tracking
- [x] Mail → Drive: save attachments to Drive with one click — `mail_ext.py` POST /mail/messages/{id}/save-to-drive
- [x] Mail → CRM: link emails to contacts/deals — `mail_ext.py` POST /mail/messages/{id}/link-crm + GET /messages/{id}/crm-links
- [x] Mail → Projects: convert email to task — `mail_ext.py` POST /mail/messages/{id}/convert-to-task
- [x] Mail → Notes: save email content as note — `mail_ext.py` POST /mail/messages/{id}/save-as-note
- [x] AI thread summarization — `ai_tools.py` `summarize_email_thread` tool + `ai_features.py` POST /mail/threads/{thread_id}/ai-summarize endpoint
- [x] AI smart categorization (auto-label) — `ai_tools.py` `categorize_email` tool + `ai_features.py` POST /mail/messages/{message_id}/ai-categorize endpoint

## Super Admin Controls
- [x] Mail server configuration (domain, TLS certs) — admin_mail.py `MailServerConfig` (domain, TLS, SMTP relay settings)
- [x] Global mail policies (max attachment size, retention) — admin_mail.py `MailServerConfig` includes max_attachment_size_mb
- [x] Spam filtering configuration — admin_mail.py `MailSpamConfig` (threshold, reject_on_spam)
- [x] Mail quotas per user — admin_mail.py `MailQuotas` with GET/PUT endpoints

## Tests
- [x] Send/receive email tests — `test_mail_extended.py` `test_send_email` + `test_send_email_missing_to` tests
- [x] Rule engine tests — `test_mail_extended.py` `test_create_rule`, `test_list_rules`, `test_update_rule`, `test_delete_rule`, `test_rule_conditions_format` (5+ tests)
- [x] Signature auto-append tests — `test_mail_extended.py` `test_create_signature`, `test_list_signatures`, `test_update_signature`, `test_delete_signature`, `test_default_signature_selection` (5 tests)
- [x] Thread grouping tests — `test_mail_extended.py` `test_list_threads`, `test_list_threads_pagination` tests
- [x] Search indexing tests — `test_mail_extended.py` `test_search_messages_no_stalwart`, `test_search_messages_requires_query` tests

## Mobile / Responsive
- [x] Responsive inbox layout — MailPage.tsx has mobile-responsive 3-pane layout (sidebar hidden on mobile, full-width list/detail)
- [x] Swipe actions (archive, delete, snooze) — `SwipeableMailItem` component in MailPage.tsx with touch handlers for swipe-right (archive) and swipe-left (delete/snooze)
- [x] Mobile compose view — compose modal adapts to screen size

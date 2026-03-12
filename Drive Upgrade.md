Ready for review
Select text to add comments on the plan
Y&U Drive Mega-Upgrade: OneDrive + Google Drive Killer
Context
Y&U Drive currently has a solid foundation (9 models, 50+ endpoints, MinIO storage, ONLYOFFICE integration, cross-module links to Finance/Mail/Projects/CRM/Support) but lacks AI-powered semantic search, content extraction, desktop sync, offline access, mobile apps, DLP, and several enterprise features that OneDrive and Google Drive offer in their 2026 Enterprise editions. This upgrade plan transforms Y&U Drive from a functional file manager into the smartest, most deeply integrated cloud storage platform in any ERP — one that leverages native Era ERP intelligence to deliver capabilities impossible in standalone cloud storage products.

1. GAP ANALYSIS — Feature-by-Feature
1.1 High-Capacity Cloud Storage with Smart Folders, Labels, Metadata Tagging, Custom Views
Status: PARTIAL

What Exists	What's Missing
DriveFolder with hierarchy (parent_id)	Smart Folders (virtual folders from saved queries)
FileTag model (flat tag_name strings)	Custom metadata key-value fields per file
TeamFolder with department scoping	Color labels / priority markers on files & folders
StorageWidget.tsx for usage breakdown	Saved Views (persistent filter/sort/column configs)
DrivePage.tsx with grid/list toggle	Folder description, color, icon, pinned status
How to match/beat OneDrive + Google Drive:

Add FileMetadata model: file_id, key, value, value_type — arbitrary key-value properties with indexed search
Add SmartFolder model: name, owner_id, filter_json — virtual folders that auto-populate from query DSL (e.g., "All PDFs from Q4 linked to Finance")
Add SavedView model: name, owner_id, filters_json, sort_json, columns_json — persist layout per folder
Add color, description, icon, is_pinned columns to DriveFolder
Beat them: Smart folders that query ACROSS ERP modules ("All invoices from Acme Corp deal" cross-referencing CRM + Finance + Drive) — impossible in standalone OneDrive/Google Drive
Files to modify:

backend/app/models/drive.py — new models
backend/app/api/v1/drive_ext.py — smart folder + saved view endpoints
frontend/src/features/drive/DrivePage.tsx — smart folder sidebar, saved view selector
1.2 Desktop Sync Client with Files On-Demand, Selective Sync, Real-Time Bidirectional Updates
Status: NO

What Exists	What's Missing
Nothing — all web-based	Desktop sync daemon (Win/macOS/Linux)
Files On-Demand / cloud placeholders
Selective sync (choose folders)
Real-time bidirectional sync + conflict resolution
System tray icon, sync overlays, bandwidth throttle
How to match/beat:

Phase 3 (long-term): Electron + Node.js file watcher + local SQLite for sync state. Windows Cloud Files API (cfapi) for placeholders, macOS NSFileProviderExtension
Phase 2 (interim quick-win): WebDAV endpoint on FastAPI via wsgidav — gives native Finder/Explorer integration with zero client install. ONLYOFFICE already expects WebDAV.
Add /drive/changes delta API: returns all changes since a cursor/timestamp for sync clients
Beat them: WebDAV gives instant "sync" without installing anything. Desktop client can leverage ERP context to auto-organize synced files by project/deal
1.3 Secure Sharing Links with Expiry, Password, Download Limits, Guest Access, Granular Permissions
Status: YES (Strong)

What Exists	What's Missing
FileShare with: expires_at, link_password, max_downloads, download_count, no_download, is_file_drop	Guest accounts (tracked external user identity)
Permissions: view, edit, delete, reshare, upload_only	Link scope controls (org-only vs anyone vs specific)
Share targets: user, team, public link	Dynamic watermarking on preview/download
Password-protected links + file-drop	Share link analytics dashboard (frontend)
ShareAuditLog with action/actor/IP/timestamp	Password hashing uses SHA256 (should be bcrypt)
Approval workflow (requires_approval + approved)	
How to match/beat:

Fix _hash_password in drive.py: SHA256 → bcrypt (security fix)
Add GuestUser model or is_guest flag on User for tracked external collaboration
Add link_scope enum to FileShare: anyone, organization, specific_people
Add sharing analytics dashboard in frontend (access heatmaps, geo distribution from IP, download trends)
Beat them: Approval workflow is already more sophisticated than OneDrive. Add watermarking via Pillow/WeasyPrint overlay on download.
Files to modify:

backend/app/api/v1/drive.py — fix _hash_password, add link_scope
backend/app/models/file_share.py — add link_scope column
frontend/src/components/drive/ShareDialog.tsx — scope selector UI
1.4 Full Version History, Deleted File Recovery, Point-in-Time Restore, Ransomware Protection
Status: PARTIAL

What Exists	What's Missing
MinIO bucket versioning (list_versions endpoint)	Point-in-time restore (restore entire Drive to a date)
TrashBin with 30-day auto-purge config	Ransomware detection (mass-change + entropy alerts)
Restore from trash endpoint	Version diffing (side-by-side comparison)
Admin retention policies (trash days, version count/days)	Folder-level trash (only files currently)
FileVersionsPanel.tsx frontend	Version comments/annotations
Trash auto-purge not enforced (no Celery beat task)
How to match/beat:

Critical fix: Add Celery beat task purge_expired_trash — admin set auto_delete_trash_days=30 but nothing enforces it
Add DriveSnapshot model: user_id, snapshot_at, metadata_json — daily snapshots via Celery beat, restore from any snapshot
Add ransomware detection: Celery task monitors >50 file modifications in 5 minutes with entropy analysis → auto-lock + admin alert
Extend TrashBin to support folder_id
Add version_comment field to version metadata
Beat them: ERP-aware ransomware detection correlates file changes with HR user patterns, device fingerprints, and anomalous access times
Files to modify:

backend/app/tasks/celery_app.py — add purge_expired_trash beat task
backend/app/models/drive.py — add DriveSnapshot, extend TrashBin
backend/app/api/v1/drive_ext.py — snapshot/restore endpoints
1.5 AI-Powered Semantic Search (Natural Language, Content Inside Files, OCR, Smart Recommendations)
Status: PARTIAL (Filename-only)

What Exists	What's Missing
Filename ILIKE search (drive_ext.py)	Content-inside-files search
AI tools search_files + find_file (also ILIKE)	OCR for images/scanned PDFs
Search filters: content_type, folder_id, tag	Natural language queries
SearchPage.tsx with type/date filters	pgvector semantic search (infra exists but unused)
Ollama available in Docker stack	Smart recommendations ("Suggested for you")
PostgreSQL 16 with pgvector	Full-text search index (tsvector)
How to match/beat:

Add file_content_text (TEXT) and content_embedding (vector(1536)) columns to DriveFile
Celery task extract_and_embed on upload:
Extract text: pdfplumber (PDF), python-docx (DOCX), openpyxl (XLSX), pytesseract (OCR on images)
Store in file_content_text
Generate embedding via Ollama (nomic-embed-text) → store in content_embedding
Create tsvector GIN index for PostgreSQL full-text search
New endpoint /drive/files/semantic-search: weighted scoring = tsvector match + pgvector cosine similarity + filename ILIKE
Upgrade _exec_find_file AI tool to use semantic search
Add "Suggested files" based on collaborative filtering + current ERP context
Beat them: Semantic search that cross-references CRM deals, Finance invoices, and Drive files simultaneously. "Find the invoice for the Acme Corp deal" is impossible in standalone OneDrive/Google Drive.
New files:

backend/app/tasks/file_processing.py — text extraction + embedding pipeline
backend/app/services/embedding.py — Ollama embedding service
Files to modify:

backend/app/models/drive.py — new columns
backend/app/api/v1/drive_ext.py — semantic search endpoint
backend/app/services/ai_tools.py — upgrade search tools
frontend/src/features/drive/SearchPage.tsx — semantic search UI
1.6 AI Copilot for Files (Auto-Summarization, Data Extraction, Q&A, Auto-Tagging & Organization)
Status: PARTIAL (Basic Organization Only)

What Exists	What's Missing
AI tool organize_files (MIME-type grouping)	Auto-summarization of documents
AI tool suggest_file_organization	Structured data extraction (entities, amounts, dates)
Urban Bad AI multi-agent system (exists but not file-aware)	Q&A on documents ("What is the total in this contract?")
Auto-tagging based on content analysis
Content classification (public/internal/confidential)
How to match/beat:

Add FileAIMetadata model: file_id, summary, entities_json, suggested_tags, sensitivity_level, processed_at
Celery task ai_process_file on file.uploaded:
Extract text (reuse from search pipeline)
Summarize via Ollama (Llama 3.1/Mistral)
Extract entities (names, dates, amounts, companies)
Suggest tags + sensitivity classification
New AI tools: summarize_document(file_id), extract_data(file_id, schema), ask_document(file_id, question)
Frontend: "AI Insights" panel in FilePreviewPanel showing summary, entities, suggested tags with one-click apply
Beat them: Uploading a receipt auto-links to matching Finance expense. Uploading a contract auto-creates CRM deal tasks. Cross-module AI intelligence is unique.
New files:

backend/app/models/drive.py — FileAIMetadata model
frontend/src/features/drive/AIInsightsPanel.tsx — AI panel
Files to modify:

backend/app/tasks/file_processing.py — AI processing pipeline
backend/app/services/ai_tools.py — new tools
frontend/src/features/drive/FilePreviewPanel.tsx — integrate AI panel
1.7 Real-Time Co-Editing Integration with Y&U Docs
Status: PARTIAL

What Exists	What's Missing
ONLYOFFICE integration (open_file_in_editor in drive_ext.py)	Real-time presence ("who's viewing this file")
Supports: docx/xlsx/pptx/pdf + 7 more formats	ONLYOFFICE comment sync back to FileComment
Editor config with callback URL for save-back	File locking for non-collaborative types
useOpenInEditor frontend hook	Suggested edits / track changes workflow
How to match/beat:

Add FilePresence tracking: WebSocket /ws/drive/file/{file_id}/presence broadcasting who is viewing/editing
Add is_locked, locked_by, locked_at columns to DriveFile for exclusive editing
Sync ONLYOFFICE inline comments back to FileComment via callback handler
Frontend: presence avatars on file list + editor view
Files to modify:

backend/app/models/drive.py — lock columns
backend/app/api/v1/drive_ext.py — presence WebSocket, lock/unlock endpoints
1.8 File Requests, Upload Portals, Camera Uploads
Status: PARTIAL (File-drop only)

What Exists	What's Missing
is_file_drop=True on FileShare	Dedicated FileRequest model (title, deadline, required types)
upload_to_file_drop endpoint	Branded upload portal page (logo, instructions, terms)
Password-protected file-drop	Camera auto-upload
PublicSharePage.tsx with upload zone	Upload notifications (notify_on_access exists but doesn't dispatch)
Submission tracking for requestors
How to match/beat:

Add FileRequest model: title, description, deadline, required_types, max_file_size, max_files, folder_id, created_by, branding_json
Add FileRequestSubmission: request_id, file_id, submitted_by_name, submitted_by_email, status
Wire notify_on_access to send emails via Stalwart SMTP
Camera upload deferred to mobile app (Phase 3)
New files:

backend/app/models/file_request.py
frontend/src/features/drive/FileRequestPage.tsx
1.9 Deep ERP Integrations (Finance, Support, Teams, Calendar)
Status: YES (Strong — Our Best Feature)

What Exists	What's Missing
Finance: receipt_file_id → DriveFile, upload-receipt	Calendar: attach Drive file to calendar event
Projects: ProjectDriveFolder auto-create, link-task	HR: employee document folders
Mail: as-attachment endpoint	Manufacturing: work order document folders
Docs/ONLYOFFICE: open-in-editor	Supply Chain: PO attachment folders
CRM: attachments flow through Drive	Contextual file suggestions per module
Support: ticket documents in Drive	
Event bus: 5 drive events	
drive_linker.py central upload helper	
How to match/beat:

Add auto-folder creation for HR, Manufacturing, Supply Chain — following ProjectDriveFolder pattern
Add context_files endpoint: given module + entity ID, return ALL linked files across cross-module links
Add Calendar integration: CalendarEventAttachment model + "Attach from Drive" in Calendar UI
Beat them: This is already the strongest area. No standalone cloud storage can match this depth. Lean in hard.
1.10 Offline Access with Automatic Sync
Status: NO

How to match/beat:

Phase 2 quick-win: PWA service worker (Workbox) caching file metadata + thumbnails. "Available offline" marking per file → download to Cache API/IndexedDB
Phase 3: Full desktop sync client (see 1.2)
Service worker intercepts /drive/files and /drive/file/*/download, serves from cache when offline
1.11 Mobile Apps with Full Preview, Editing, Upload, Offline
Status: NO

How to match/beat:

Phase 2: Responsive design audit on DrivePage.tsx (Tailwind responsive exists but needs mobile testing)
Phase 2: PWA installability (manifest + service worker) for "Add to Home Screen"
Phase 3: React Native app wrapping existing API. react-native-webview for ONLYOFFICE. react-native-camera-roll for auto-upload.
1.12 Admin Center with Storage Policies, Quotas, Activity Monitoring, Retention
Status: YES (Good)

What Exists	What's Missing
Admin CRUD: quotas (per-user/team), file types (allow/block), retention	Quotas NOT enforced at upload
MinIO health check	Activity monitoring dashboard
DriveConfigPage.tsx with 4 tabs	Per-user storage usage admin view
System settings JSON storage	Alert system for threshold warnings
Legal hold / compliance hold
How to match/beat:

Critical: Add quota enforcement in upload_file endpoint — check user's total storage, return 413 if exceeded
Add GET /admin/drive/users-storage — per-user breakdown
Add Celery beat task for threshold alerts (email admin at 90%)
Add DriveActivityDashboard.tsx in admin
Add legal hold flag on DriveFile: is_on_hold, hold_reason, hold_by
1.13 Analytics & Usage Reports
Status: PARTIAL (Basic)

What Exists	What's Missing
storage_usage endpoint (total, by type, trash)	User engagement analytics (who uploads/shares most)
StorageWidget.tsx pie chart	Storage growth trends (time-series)
Share audit log	File lifecycle (stale files, never accessed)
Admin health check	Sharing analytics (external vs internal ratio)
CSV/PDF export
Department-level reporting
How to match/beat:

Add FileAccessLog model: user_id, action, file_id, timestamp, metadata_json — tracks ALL interactions
Add analytics endpoints: /drive/analytics/usage-trends, /drive/analytics/top-files, /drive/analytics/user-activity
Reuse pattern from backend/app/api/v1/analytics.py
Add DriveAnalyticsDashboard.tsx with time-series charts
1.14 Security & Compliance (Encryption, DLP, Sensitivity Labels, Audit, eDiscovery)
Status: PARTIAL

What Exists	What's Missing
MinIO SSE-S3 encryption at rest	DLP (content scanning for sensitive data)
HTTPS for transit	Sensitivity labels (Public/Internal/Confidential)
ShareAuditLog (sharing actions only)	eDiscovery (search + export all files for legal)
Blocked MIME types	Client-side encryption option
Password-protected links	File access audit beyond sharing
RBAC: Super Admin/App Admin/User	Geo-fencing, information barriers
How to match/beat:

Phase 2: SensitivityLabel model + AI auto-classification
Phase 2: FileAccessLog for comprehensive audit (every view/download/preview/edit)
Phase 3: DLP rule engine (regex + AI classification) — block sharing of flagged files
Phase 3: eDiscovery search interface for admins
Beat them: DLP rules that understand ERP data. "Prevent sharing files with salary data outside HR" is possible because Y&U knows department membership.
1.15 Personal Vault / Secure Safe
Status: NO

How to match/beat:

Add PersonalVault model: user_id, is_locked, last_accessed, lock_timeout_minutes, vault_folder_id
/drive/vault/unlock requiring re-authentication (password or TOTP)
Vault files in separate MinIO prefix with additional encryption key
Frontend: Vault section with lock/unlock UI, auto-lock timer
1.16 Comments, @Mentions, Activity Feed, Notifications
Status: PARTIAL

What Exists	What's Missing
FileComment model (flat, CRUD endpoints)	@Mentions (parsing + notification trigger)
Event bus publishes drive events	Activity feed UI (unified file activity)
notify_on_access flag on shares	Notification panel (bell icon, notification center)
Comment threads (parent_id for replies)
Comment resolution (mark as resolved)
Real-time comment updates (WebSocket)
How to match/beat:

Add parent_id, is_resolved to FileComment
Parse @username in comment content → trigger notification
Add/reuse Notification model + event handlers for drive events
WebSocket for real-time comment push
1.17 API Access, Webhooks, Extensibility
Status: PARTIAL

What Exists	What's Missing
Full REST API (50+ endpoints, JWT auth)	Webhooks for external systems
Event bus (Redis pub/sub, internal)	API keys / service accounts
OpenAPI/Swagger docs at /docs	Batch API (multi-operation in one request)
drive_linker.py cross-module helper	Delta/change feed API for sync clients
SDK/client libraries
How to match/beat:

Add Webhook model: url, events[], secret, owner_id, is_active + Celery dispatch
Add ApiKey model: key_hash, user_id, scopes[], expires_at + middleware
Add /drive/changes delta endpoint for sync clients
Webhooks are highest priority for enterprise integration
1.18 Templates, Custom Content Types, Auto-Backup Rules
Status: NO

How to match/beat:

DocumentTemplate model: name, description, content_type, minio_key, category — admin uploads templates, users create from template
ContentType model: name, required_fields_json — linked to folders, enforce required metadata on upload
AutoBackupRule model: folder_id, schedule_cron, destination, retention_count — Celery beat execution
2. MODERN AI-ERA ENHANCEMENTS (2026)
Storage & Sync
AI Deduplication: On upload, compute content hash + embedding similarity. Prompt: "This file is 94% similar to 'Budget_v3.xlsx'. Link instead of duplicate?" Saves storage, reduces confusion.
Predictive Pre-caching: Analyze user access patterns and pre-generate presigned URLs for files likely accessed next. When user opens a project folder, predictively cache related Finance/CRM files.
Smart Storage Tiering: Auto-move files not accessed in 90 days to cold MinIO tier. "Archived" badge. Auto-restore on access.
Search & Discovery
Multimodal Search: Upload an image to "find files similar to this screenshot." CLIP embeddings via Ollama match images to documents. No competitor offers this for enterprise files.
Contextual Search Boost: When searching from within a module (CRM deal page), automatically boost files linked to that deal, customer, or time period. Search relevance is ERP-aware.
Natural Language File Agent: "Show me all contracts expiring this quarter" — AI queries Drive embeddings AND CRM/Finance databases simultaneously.
Sharing & Collaboration
AI-Suggested Sharing: AI suggests: "5 team members on Project X haven't seen this yet. Share?" Based on project membership + file relevance scoring.
Real-Time Co-Presence Map: Multiple users viewing/editing → show avatars with cursor positions (ONLYOFFICE docs) or "currently viewing" badges. WebSocket-powered.
Smart Share Expiry: AI analyzes file sensitivity and sharing context to suggest optimal expiry periods. Confidential files default to 24h; project docs default to project end date.
AI Intelligence & Automation
Auto-Document Linking: AI scans uploaded file content and suggests cross-module links: "This invoice mentions 'Acme Corp' — link to CRM Deal #2847?" One-click creation.
Meeting-to-Document Pipeline: After Jitsi meeting ends, AI transcribes (Whisper on Ollama), generates summary document, and links to meeting + project + attendees' folders automatically.
Contract Intelligence: For PDF contracts, extract key terms (parties, dates, amounts, obligations). Create structured metadata. Alert when renewal dates approach.
ERP Integrations
Module-Aware File Routing: Uploaded invoice PDF auto-creates Finance draft. Resume PDF auto-attaches to HR applicant. AI classifies and routes to appropriate module.
Unified Document Timeline: For any ERP entity (deal, project, employee, ticket), show timeline of ALL associated documents across Drive, Mail, and generated reports. Single source of truth.
Automated Compliance Packaging: For audits, one-click export of ALL files related to a project/deal with full access audit trail, sorted chronologically.
Security & Compliance
AI-Powered DLP: Ollama classifies document sensitivity in real-time. Flags salary data, medical info, trade secrets. Auto-applies sensitivity labels. Blocks inappropriate sharing.
Behavioral Anomaly Detection: ML model on user's normal Drive behavior. Alert admin on: unusual bulk download, access at unusual hours, new IP, rapid deletion. Correlate with HR data for insider threat detection.
Zero-Knowledge Vault: Personal vault with client-side encryption — server never sees plaintext. Decrypt only in browser via Web Crypto API.
3. PRIORITIZED 6-MONTH ROADMAP
Phase 1: AI-First Foundation (Weeks 1-8)
Goal: Make Y&U Drive the most intelligent file storage in any ERP.

Week	Deliverable	Key Changes
1-2	Content extraction pipeline	New backend/app/tasks/file_processing.py: Celery task extracts text from PDF/DOCX/XLSX/images (OCR). Add file_content_text TEXT column to DriveFile.
2-3	Embedding generation	New backend/app/services/embedding.py: Ollama embedding. Add content_embedding vector(1536) via pgvector. GIN index on tsvector. Alembic migration.
3-4	Semantic search endpoint	New /drive/files/semantic-search in drive_ext.py: weighted tsvector + pgvector cosine + filename. Update SearchPage.tsx frontend.
4-5	AI file processing	Auto-summarize, extract entities, suggest tags on upload. New FileAIMetadata model in drive.py. Pipeline in file_processing.py.
5-6	AI Insights panel	New AIInsightsPanel.tsx: shows summary, entities, suggested tags with one-click apply. Integrate into FilePreviewPanel.tsx.
6-7	Quota enforcement + activity logging	Enforce quotas in drive.py upload endpoint. New FileAccessLog model. Log all interactions. Fix SHA256 → bcrypt.
7-8	Smart folders + saved views	New SmartFolder + SavedView models. Smart folder sidebar in DrivePage.tsx.
Phase 2: Collaboration & Security (Months 2-3)
Deliverable	Description
Comment threading + @mentions	Add parent_id, is_resolved to FileComment. Parse @mentions, trigger notifications.
Notification system	Create/reuse Notification model. Event handlers for file.shared, comment.created, @mention. Bell icon UI.
Real-time file presence	WebSocket /ws/drive/file/{id}/presence. "User X is viewing" badges.
Sensitivity labels	SensitivityLabel model. Admin CRUD. AI auto-classification on upload. Sharing enforcement.
File requests	FileRequest + FileRequestSubmission models. Branded portal page. Deadline tracking.
PWA offline access	Workbox service worker. Cache metadata + thumbnails. "Available offline" per-file marking.
Sharing analytics dashboard	Frontend dashboard: access heatmaps, download trends, geographic distribution.
Trash auto-purge	Celery beat purge_expired_trash task (critical fix — currently unenforced).
WebDAV endpoint	FastAPI WebDAV for native Finder/Explorer access (interim before desktop client).
Password hashing fix	SHA256 → bcrypt in share link passwords.
Phase 3: Enterprise & Platform (Months 4-6)
Deliverable	Description
Desktop sync client MVP	Electron app + selective sync + /drive/changes delta API + local SQLite.
Webhooks	Webhook model. Admin config. Celery dispatch on drive events.
API keys + service accounts	ApiKey model. X-API-Key header middleware. Scoped permissions.
DLP rule engine	Regex patterns + AI classification. Block sharing of sensitive files. Admin rules.
eDiscovery	Admin cross-user search. Content search + date range. Export to ZIP. Legal hold.
Document templates	DocumentTemplate model. Template gallery. "New from template" flow.
Personal vault	Re-auth for vault. Separate encryption. Auto-lock timeout.
Point-in-time restore	DriveSnapshot model. Daily Celery beat snapshots. Restore UI.
Ransomware detection	Anomaly detection task. Mass-change detection. Auto-lock + admin alert.
Mobile PWA optimization	Responsive Drive UI. Touch context menus. Camera upload via PWA.
Analytics dashboard	Storage trends, user engagement, file lifecycle, department breakdown charts.
4. TECHNICAL RECOMMENDATIONS
Component	Choice	Rationale
Text extraction	pdfplumber (PDF), python-docx (DOCX), openpyxl (XLSX), pytesseract + Pillow (OCR)	All pure Python, no external services. Pillow already in stack for thumbnails.
Embeddings	Ollama nomic-embed-text (768d) or mxbai-embed-large (1024d)	Ollama already in Docker stack. Zero API cost. Fast local inference.
Vector search	pgvector with HNSW index	PostgreSQL 16 with pgvector already in stack. No new infrastructure.
Full-text search	PostgreSQL tsvector + GIN index	Avoid Elasticsearch dependency. PostgreSQL FTS sufficient for <1M files.
WebSocket presence	FastAPI WebSocket + Redis pub/sub	Redis already in stack. Event bus pattern established.
Desktop sync	Electron + chokidar (file watcher) + better-sqlite3	Cross-platform. JS matches frontend ecosystem.
WebDAV	wsgidav Python library wrapped in FastAPI	Native OS file manager access. No client install.
PWA/Offline	Workbox (Google's PWA library)	Industry standard. Works with Vite build.
Password hashing	bcrypt via passlib	Likely already in requirements for user auth. Fixes SHA256 gap.
Mobile (Phase 3)	React Native + react-native-webview (ONLYOFFICE)	Code reuse with web frontend. Camera roll integration.
5. COMPETITIVE EDGE — 5 "Y&U Drive-Only" Differentiators
1. ERP-Context-Aware Semantic Search
When a CRM user searches "Acme proposal", Y&U searches filenames + file content + cross-references the CRM deal "Acme Corp" + finds linked Drive files + boosts content mentioning "Acme." OneDrive and Google Drive are isolated silos that know nothing about your business data.

2. Automated Document-to-Module Routing
Upload an invoice PDF → Y&U automatically: (a) extracts vendor name + amount via AI, (b) creates draft Finance expense, (c) links to matching CRM vendor, (d) auto-tags "invoice + finance + vendor name." In OneDrive, this requires Power Automate + AI Builder + SharePoint + Dynamics 365 — 4 separate products.

3. Cross-Module Unified Document Timeline
For any entity (project, deal, employee, ticket), Y&U shows a single timeline of every document ever associated — Drive files, email attachments, generated reports, meeting recordings, form submissions. Impossible in Google Drive/OneDrive because they cannot see into your CRM, HR, or Finance data.

4. AI Agent with Multi-Step File Operations
Urban Bad AI can "Find last quarter's expense reports, summarize top 5 expenses, and share the summary with Finance team" in one natural-language command. The multi-agent system (Orchestrator → Researcher → Verifier → Executor) plans and executes cross-module file workflows with human approval gates. Neither OneDrive Copilot nor Google Gemini can execute cross-module file workflows with approval chains.

5. Self-Hosted Zero-Trust File Intelligence
All AI (OCR, embeddings, summarization, classification, DLP) runs on local Ollama — no file content ever leaves the organization's infrastructure. For regulated industries (healthcare, finance, government, legal), this is fundamental. OneDrive sends data to Azure AI. Google Drive sends data to Google AI. Y&U provides Copilot-level intelligence with zero data exfiltration risk.

6. VERIFICATION PLAN
After Phase 1 implementation:
Upload a PDF invoice → verify text extraction, embedding generation, AI summary, entity extraction, auto-tags appear in AI Insights panel
Search "invoice from Acme" → verify semantic search returns relevant results even if "Acme" isn't in filename
Create a Smart Folder "All Finance PDFs" → verify auto-population
Upload a file that exceeds quota → verify 413 response
Check FileAccessLog records all views/downloads
Run docker compose exec backend python -c "from app.tasks.file_processing import extract_and_embed; print('OK')" to verify task registration
After Phase 2:
Comment with @username → verify notification created
Open same file in two browsers → verify presence indicators
Mark file "Available offline" → go offline → verify file accessible
Create file request with deadline → upload via portal → verify submission tracking
Verify purge_expired_trash Celery beat task runs and deletes expired items
After Phase 3:
Configure webhook → upload file → verify webhook payload delivered
Use API key to upload file → verify authentication works
Upload file with credit card number → verify DLP blocks sharing
Admin eDiscovery search across all users → export ZIP
Critical Files Summary
File	Changes
backend/app/models/drive.py	New columns (content_embedding, file_content_text, is_locked, locked_by) + new models (FileAIMetadata, SmartFolder, SavedView, FileAccessLog, DriveSnapshot, PersonalVault)
backend/app/models/file_share.py	Add link_scope to FileShare
backend/app/api/v1/drive.py	Quota enforcement, bcrypt password fix, activity logging
backend/app/api/v1/drive_ext.py	Semantic search, smart folders, presence WebSocket, sensitivity labels, analytics endpoints
backend/app/services/ai_tools.py	Upgrade search to semantic, new tools (summarize, extract, ask_document)
backend/app/tasks/file_processing.py	NEW — text extraction + embedding + AI processing pipeline
backend/app/services/embedding.py	NEW — Ollama embedding service
backend/app/tasks/celery_app.py	Add purge_expired_trash beat task
backend/app/integrations/minio_client.py	Add tiering support, snapshot helpers
frontend/src/features/drive/DrivePage.tsx	Smart folder sidebar, presence indicators, responsive mobile
frontend/src/features/drive/SearchPage.tsx	Semantic search UI, natural language input
frontend/src/features/drive/AIInsightsPanel.tsx	NEW — AI summary, entities, tags panel
frontend/src/features/drive/FilePreviewPanel.tsx	Integrate AI panel
frontend/src/features/drive/FileRequestPage.tsx	NEW — file request portal
frontend/src/components/drive/ShareDialog.tsx	Link scope selector, analytics tab
frontend/src/api/drive.ts	New hooks for semantic search, smart folders, presence, AI metadata
frontend/src/api/drive_ext.ts	New hooks for file requests, analytics, vault
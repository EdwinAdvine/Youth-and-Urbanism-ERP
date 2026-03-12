Ready for review
Select text to add comments on the plan
Y&U Docs Upgrade Plan — Compete with & Beat Microsoft 365 (Word + Excel + PowerPoint + Copilot 2026)
Context
Y&U Docs is the document suite inside Urban ERP. It currently wraps ONLYOFFICE Document Server for Word/Excel/PowerPoint editing with a React shell providing comments, version history, sharing, templates, and a basic AI panel. The goal is to transform Y&U Docs into a superior alternative to Microsoft 365 by leveraging the native, two-way connection to the entire ERP ecosystem (Finance, HR, CRM, Projects, Support, Supply Chain, Manufacturing, POS) — something Microsoft 365 fundamentally cannot do.

Critical bug found: The AI panel (AIGenerationPanel.tsx:37-62) uses fake setTimeout responses instead of calling real backend AI endpoints. This must be fixed first.

PART 1: GAP ANALYSIS (19 Microsoft 365 Feature Categories)
1. Advanced Word Processing
Status: PARTIAL — ONLYOFFICE handles rich text, styles, track changes, TOC, footnotes internally. Our RibbonToolbar.tsx Edit/Insert/Format menus are UI stubs (disabled: true).
Missing: Custom dictation, immersive reader, focus mode, bibliography manager, AI writing coach, ERP data merge fields
Beat M365: Build "ERP Data Merge" toolbar — insert live fields from Finance (invoice totals), HR (employee records), CRM (deal pipeline), Projects (milestones) directly into documents. Add "Contract Intelligence" that cross-references contract terms against CRM deals and Finance payment schedules.
2. Robust Spreadsheet Engine
Status: PARTIAL — ONLYOFFICE cell editor provides formulas, charts, pivot tables, conditional formatting
Missing: No Power Query equivalent, no What-If/Goal Seek/Solver, no Python-in-cells, no live ERP data connections, no custom formula engine
Beat M365: Build "ERP Data Connector" sheets — pull live data from any ERP module (Finance ledger, HR payroll, CRM pipeline, Inventory levels, POS sales) directly into cells as refreshable data sources. M365 needs Power Automate + external connectors; Y&U has direct database access.
3. Professional Presentation Designer
Status: PARTIAL — ONLYOFFICE slide editor handles layouts, animations, transitions
Missing: No AI slide design, no presenter coach/rehearsal, no brand kit enforcement, no stock image library
Beat M365: "ERP Presentation Generator" — AI creates a Q3 finance review deck pulling actual data from Finance, CRM, HR with real charts and numbers.
4. Real-Time Co-Authoring & Collaboration
Status: PARTIAL — ONLYOFFICE handles concurrent editing. Redis presence tracking with 15s polling. Threaded comments with anchor positioning.
Missing: No WebSocket presence (polling only), no @mentions, no in-document chat, no cursor position sharing, no suggesting mode UI
Beat M365: Add @mentions resolving to ERP users + #entity references (#INV-2024-001, #PROJ-Alpha, #DEAL-WidgetCorp) with hover previews showing live ERP data.
5. AI Copilot Across All Apps
Status: PARTIAL (BROKEN) — AI panel has 6 actions (Generate, Summarize, Translate, Improve, Expand, Simplify) but uses fake placeholder responses (AIGenerationPanel.tsx:37-62). Backend endpoints exist in docs_ext.py:520-658 but are never called.
Missing: No inline AI, no AI chart generation, no AI formula suggestions, no context-aware AI with ERP data, no agentic multi-step document creation
Beat M365: Build "ERP-Aware Copilot" — prompt "Write a proposal for {CRM Deal}" and AI pulls deal details, contact info, mail history, project tasks, and financial terms to generate a fully contextualized proposal. Microsoft Copilot cannot access ERP data natively.
6. Templates, Themes, SmartArt, Icons, Stock Images
Status: PARTIAL — DocumentTemplate model exists, TemplateGalleryPage.tsx with filtering, admin template management
Missing: No pre-loaded templates, create-from-template copies empty file (docs_ext.py:428: file_data=b""), no theme engine, no SmartArt, no icon/stock image library
Beat M365: Pre-build 50+ ERP-specific templates (Invoice, PO, Offer Letter, Performance Review, Project Report, Board Deck, Sales Proposal) pre-wired with merge fields for live ERP data auto-population.
7. Version History, Auto-Save, Comments, Review Mode, Compare
Status: PARTIAL — DocVersion model with snapshots, auto-save via ONLYOFFICE (configurable interval), threaded comments, version restore
Missing: No document comparison/diff tool, no named version labels UI (field exists but no endpoint), no review approval workflow, no track changes UI wrapper
Beat M365: Add "Document Approval Workflows" tied to RBAC roles (Author → App Admin → Super Admin). Add "ERP-Triggered Auto-Versioning" (auto-create named version when linked invoice status changes).
8. Offline Access, Cached Mode, Local File Support
Status: NO — All editing requires live connection to ONLYOFFICE server
Beat M365: PWA with Service Worker caching app shell + recently-opened documents in IndexedDB. Offline queue for comments/bookmarks that syncs on reconnect.
9. Mobile Apps with Editing Parity
Status: PARTIAL — Mobile UA detection, mobile ONLYOFFICE config (type: "mobile"), responsive grid with 44px touch targets
Missing: No native mobile app, no mobile-optimized AI panel, no mobile gestures
Beat M365: PWA first (install-to-homescreen), then React Native wrapper. Add photo-to-document and voice-to-document mobile features.
10. Deep Integrations (Mail, Calendar, Teams, Drive + ERP)
Status: PARTIAL — Links to Finance (invoice generation), Mail (attach-to-email), Notes (link-to-note), Projects (DocLink model). Event bus publishes doc.saved, doc.linked, etc.
Missing: No Calendar integration, no Meeting→Document auto-creation, no HR document generation, no CRM proposal/contract generation, no Supply Chain PO docs, no Manufacturing work orders, no embedded doc previews in other modules
Beat M365: Build "Universal Document Generator" for ALL modules — HR offer letters, CRM proposals, Supply Chain POs, Manufacturing work orders, Finance statements — all auto-populated from ERP data.
11. Security Features (DLP, Labels, Encryption, Rights, Audit)
Status: PARTIAL — FileShare model with password-protected/expiring/download-limited links, ShareAuditLog, RBAC, ONLYOFFICE JWT auth, retention policies
Missing: No DLP rules, no sensitivity labels, no at-rest encryption, no IRM (prevent copy/print/screenshot), no watermarking, no compliance reporting
Beat M365: "ERP-Aware DLP" — auto-classify documents based on linked ERP data (Finance doc over $100K → "Confidential", HR employee record → "PII-Sensitive"). Dynamic watermarking (M365 requires E5 licensing for this).
12. Analytics & Insights
Status: NO — Only RecentDocument tracking and ShareAuditLog
Beat M365: "Document Intelligence Dashboard" — most edited docs, collaboration heatmaps, storage trends, AI usage patterns, cross-module document activity.
13. Add-Ins, APIs, Extensibility
Status: PARTIAL — ONLYOFFICE plugins/macros enabled via admin config, comprehensive REST API, event bus
Missing: No custom plugin framework, no marketplace, no webhook system, no Power Automate equivalent
Beat M365: "Document Actions" framework — custom triggers when docs are saved/shared/approved that call any ERP endpoint (e.g., "When PO document approved → create Supply Chain PO record").
14. File Storage & Sharing with Granular Permissions
Status: YES (strong) — MinIO storage, DriveFile model, FileShare with user/team/public sharing, password-protected/expiring links, file-drop mode, approval workflow, TeamFolder (SharePoint-like), ShareAuditLog, admin quotas
Missing: No external guest sharing, no share analytics, sharing dialog not fully wired to backend
Beat M365: "ERP-Contextual Sharing" — auto-share documents with relevant team members based on ERP context (project docs → project team, Finance reports → Finance team folder).
15. Voice Dictation, Inking, Immersive Reader, Accessibility
Status: NO — Only dark mode and basic ONLYOFFICE accessibility
Beat M365: Web Speech API for browser dictation, AI-powered immersive reader mode, accessibility checker (alt-text, heading structure, color contrast).
16. Data Analysis Tools (What-If, Goal Seek, Solver, BI Visuals)
Status: NO — ONLYOFFICE handles basic formulas/charts. Existing analytics module does direct PostgreSQL queries.
Beat M365: "ERP Analytics Sheets" — pre-built spreadsheet templates connected to Finance P&L, HR Headcount, CRM Pipeline, Inventory Levels. "AI Data Analyst" for natural language queries.
17. Presentation Delivery Tools (Presenter View, Q&A, Polls)
Status: NO — ONLYOFFICE has basic presentation mode, Jitsi exists separately
Beat M365: Integrate presentation delivery with Jitsi — present slides in a video call with Q&A and polls. "ERP Live Data Slides" that update from real-time data during presentations.
18. Mail Merge, Data Import/Export, Linked Data
Status: PARTIAL — ONLYOFFICE built-in mail merge, conversion API (12+ formats), invoice generation, attach-to-email
Missing: No custom ERP mail merge, no bulk document generation, no linked data types, no scheduled reports
Beat M365: "ERP Mail Merge" — generate 500 personalized employee letters from HR or 200 customer invoices from Finance in one batch via Celery. "ERP Data Types" for spreadsheets.
19. Sandbox/Testing for Templates & Macros
Status: NO — Admin macros config with mode (warn/enable/disable), retention dry_run
Beat M365: "Template Studio" — design templates with ERP merge fields, preview with sample data, versioning, approval workflow.
PART 2: MODERN AI-ERA ENHANCEMENTS
Word Processing
ERP Context Writer — "Draft a project status report for Project X" pulls task completion, budget from Finance, team allocation from HR, client comms from CRM/Mail — complete report in 30 seconds
Contract Intelligence Engine — AI highlights obligations, deadlines, financial terms and cross-references against CRM deal terms and Finance payment schedules. Flags discrepancies.
Regulatory Compliance Writer — Auto-checks content against configurable compliance rulesets (SOX for Finance, employment law for HR)
Spreadsheet Analysis
ERP Live Data Sheets — One-click connection to any ERP module. Finance Admin selects "Revenue by Month" → sheet auto-populates with live PostgreSQL data, refreshable on demand
AI Financial Modeler — "Create a 12-month cash flow projection using our revenue run rate and planned headcount from HR" → queries Finance + HR → generates complete financial model
Anomaly Detection — AI monitors ERP-connected spreadsheet data, highlights anomalies ("Revenue dropped 40% in Region X") with auto drill-down to CRM lost deals
Presentation Design
AI Deck Generator from ERP Data — "Create a board meeting deck" → 20 slides with financial highlights, sales pipeline, hiring updates, project milestones, customer satisfaction — all real numbers from ERP modules, branded with design tokens
Live Data Slides + Jitsi Integration — Present in Jitsi calls with auto-updating ERP charts, audience Q&A panel, auto-generated meeting notes saved as linked documents
Collaboration & Co-Authoring
ERP-Contextual @Mentions — @user for people, #INV-2024-001 for invoices, #PROJ-Alpha for projects — clickable cross-references with hover previews of live ERP data
Document Approval Workflows — RBAC-tied approval chains (Author → App Admin → Super Admin) with tamper-evident seals and audit trails
AI Meeting-to-Document Pipeline — After a Jitsi meeting ends, AI auto-generates summary, extracts action items, creates Project tasks, shares with all participants
AI Copilot & Automation
Multi-Modal ERP Copilot — Extend Urban Bad AI (Orchestrator, Researcher, Verifier, Executor) to operate within the document editor. Researcher queries all ERP modules, Executor creates documents, Verifier cross-checks numbers.
Document Intelligence Layer — On every save, AI extracts entities (people, companies, amounts, dates), classifies document type, suggests tags, creates cross-module links. Runs as Celery task.
Predictive Document Assistance — Based on user context: "You just closed CRM Deal #1234 — would you like to generate the Statement of Work?"
ERP Integrations
Universal Document Generator — Extensible DocumentGenerator class: any ERP module registers templates + data mapping → gets document generation without module-specific code
Embedded Document Viewer — Any ERP page embeds document preview (Project detail shows linked docs inline, CRM deal shows proposal, HR profile shows offer letter)
Security & Offline
ERP-Aware Data Classification — Auto-classify based on linked ERP entities. Finance docs > $100K → "Confidential". HR PII → "Sensitive". Labels enforce sharing restrictions and retention.
PWA with Offline Queue — Service Worker caches editor shell + recent docs (encrypted in IndexedDB). Offline edits queue and sync on reconnect.
PART 3: PHASED 6-MONTH ROADMAP
Phase 1: MVP (Weeks 1-8) — Core Docs + Deep ERP Integration + Working Copilot
Weeks 1-2: Fix Foundations & Wire AI
Backend:

New service backend/app/services/doc_ai.py — DocAIService wrapping AIService with document-specific prompts for generate/summarize/translate/improve/expand/simplify
New endpoints in docs_ext.py: POST /docs/{doc_id}/ai-improve, POST /docs/{doc_id}/ai-expand, POST /docs/{doc_id}/ai-simplify
New model DocumentBookmark — id, user_id, file_id, created_at
Fix shared_with column on DriveFile via Alembic migration
Endpoints: GET /docs/bookmarks, POST /docs/{doc_id}/bookmark
Frontend:

Fix AIGenerationPanel.tsx — Replace fake setTimeout (lines 37-62) with real API calls to backend AI endpoints
Add useAIGenerate, useAISummarize, useAITranslate, useAIImprove, useAIExpand, useAISimplify hooks in api/docs.ts
Add bookmark toggle in RibbonToolbar, "Bookmarked" filter in DocsPage
Weeks 3-4: ERP Smart Templates & Document Generation
Backend:

New service backend/app/services/doc_templates.py — ERPTemplateEngine using python-docx + openpyxl
Template generators: generate_invoice_docx(invoice_id), generate_payslip_docx(employee_id, period), generate_purchase_order_docx(po_id), generate_project_report_docx(project_id), generate_financial_report_xlsx(report_type, date_range), generate_crm_pipeline_xlsx(pipeline_id)
Fix create-from-template to copy actual template content (not empty b"")
Endpoints: POST /docs/generate-from-erp, GET /docs/erp-templates
Dependencies: python-docx>=1.1.0, openpyxl>=3.1.0
Frontend:

New ERPTemplateDialog.tsx — template type selector, dynamic form fields per module, "Generate & Open" button
Wire into DocsPage as "Generate from ERP" button
Weeks 5-6: WebSocket Presence & Enhanced Collaboration
Backend:

New WebSocket ws /docs/ws/presence/{file_id} — real-time presence replacing 15s polling
On connect: register in Redis, broadcast join. On disconnect: broadcast leave. Heartbeat 10s.
Message types: cursor_position, user_joined, user_left, user_typing
New endpoint: POST /docs/file/{file_id}/versions/{version_id}/compare/{other_version_id} — diff between versions
Frontend:

New useDocPresence.ts hook — WebSocket with exponential backoff reconnect
Update EditorAvatars in RibbonToolbar to use WebSocket (not polling)
New CursorOverlay.tsx — colored cursor labels over ONLYOFFICE editor
Weeks 7-8: Document-Context AI Copilot (Chat)
Backend:

New WebSocket ws /docs/ws/copilot/{file_id} — authenticated document-context AI chat
Flow: fetch doc content from MinIO → build context (doc text + metadata + linked ERP entities) → RAG search → stream response
New AI tools in ai_tools.py: insert_text_at_cursor, replace_selection, format_as_table, insert_erp_data
Frontend:

Redesign AIGenerationPanel.tsx → DocCopilot.tsx — chat-style interface with streaming, context awareness, quick actions, "Insert" button
New useDocCopilot.ts hook — WebSocket, message history, streaming state
Phase 2: Months 3-4 — Advanced Features, Charts, Mobile & Offline
Month 3, Weeks 1-2: Collaboration Engine (Yjs Layer)
Strategy: Keep ONLYOFFICE OT for document content. Add Yjs CRDT for metadata layer (cursors, comments-in-progress, sidebar state)
Backend: CollabSyncService managing Yjs state in Redis, WebSocket sync protocol
Frontend: yjs + y-websocket packages, useYjsCollab.ts hook, instant comment sync, sub-100ms cursor latency
Month 3, Weeks 3-4: ERP Data Connections for Spreadsheets
Backend: ERPFormulaEngine with custom ERP.* functions — ERP.REVENUE(period), ERP.EXPENSE(category, period), ERP.HEADCOUNT(dept, date), ERP.STOCK(product_id), ERP.PIPELINE(pipeline_id, metric)
New model: SpreadsheetDataConnection — source_module, query_params, target_range, refresh_interval
Endpoints: POST /docs/spreadsheet/{file_id}/data-connection, POST /docs/spreadsheet/{file_id}/evaluate, POST /docs/spreadsheet/{file_id}/refresh-data
Celery Beat auto-refresh tasks
Month 4, Weeks 1-2: Charts & AI Visualization
Backend: ChartEngine generating ONLYOFFICE-compatible chart configs from ERP data
Endpoints: POST /docs/{doc_id}/chart, POST /docs/{doc_id}/ai-chart, GET /docs/chart-templates
Frontend: ChartInsertDialog.tsx — chart gallery, ERP data source selector, AI suggestion button
Month 4, Weeks 3-4: PWA & Offline Foundation
vite-plugin-pwa for Service Worker generation
IndexedDB cache: doc metadata, last 20 opened documents, pending operations queue
useOfflineSync.ts hook — sync queue, online/offline detection
OfflineBanner.tsx — "Offline mode — changes sync when connected"
Backend: GET /docs/sync-manifest, POST /docs/sync-batch, POST /docs/offline-queue
Phase 3: Months 5-6 — Agentic Copilot, Analytics, Security, Polish
Month 5, Weeks 1-2: Agentic Document Copilot
Extend AgentOrchestrator with DocAgent persona — multi-step document creation
New service backend/app/services/doc_agent.py — create_board_deck(period), create_monthly_report(dept, month), create_proposal(deal_id), create_contract(template_id, entity_data)
New AI tools: create_document_from_data, insert_chart_into_document, merge_documents, create_presentation_from_outline
Dependencies: python-pptx>=0.6.23
Frontend: AgenticCopilot.tsx — multi-step progress UI, wizards, approval gates
Month 5, Weeks 3-4: Document Analytics & Full-Text Search
New service backend/app/services/doc_analytics.py — usage, storage, collaboration, AI metrics
Endpoints: GET /docs/analytics/overview, /usage, /storage, /collaboration
Full-text search via pgvector embeddings: GET /docs/search — index on doc.saved event
Frontend: DocsAnalyticsPage.tsx — dashboard with charts
Month 6, Weeks 1-2: Advanced Security & Compliance
New model: DocumentAuditLog — action (viewed/edited/shared/downloaded/printed), IP, user_agent
New model: DocumentSecurity — prevent_download/print/copy, watermark, classification (public/internal/confidential/restricted), expiry
Endpoints: GET /docs/{doc_id}/audit-log, POST /docs/{doc_id}/watermark, PUT /docs/{doc_id}/security, GET /docs/admin/compliance-report
Frontend: SecuritySettingsDialog.tsx
Month 6, Weeks 3-4: Template Marketplace & Enterprise Polish
New models: DocumentTemplateCategory, DocumentTemplateFavorite
Endpoints: GET /docs/templates/marketplace, POST /docs/templates/publish, PUT /docs/templates/{id}/rate
Ship 50+ pre-built ERP templates (Invoice, PO, Offer Letter, Performance Review, Project Report, Board Deck, etc.)
Redesigned TemplateGalleryPage.tsx — categories, search, ratings, preview, "My Templates"
PART 4: TECHNICAL RECOMMENDATIONS
a) Real-Time Collaboration
ONLYOFFICE OT (document content) + Yjs CRDT (metadata layer). Do NOT replace ONLYOFFICE's OT engine. Yjs handles cursors, comments-in-progress, sidebar state. Upgrades presence from 15s polling to sub-100ms WebSocket.

b) Spreadsheet Formula Engine
Keep ONLYOFFICE for standard formulas + custom server-side ERP formula evaluation. User enters =ERP.REVENUE("2024-Q1") → frontend detects ERP. prefix → calls backend → backend queries Finance → returns computed value → injects into ONLYOFFICE cell. Avoids conflicting formula engines.

c) Rich Text Enhancement
Keep ONLYOFFICE only. Do NOT add TipTap/ProseMirror — creates UX confusion and doubles maintenance. Notes module handles lightweight editing. AI panel covers quick text manipulation.

d) Presentation Engine
ONLYOFFICE Slide for editing + python-pptx for AI-generated decks. Do NOT add reveal.js/Slidev (HTML output breaks OOXML workflow). Agentic copilot generates PPTX via python-pptx → uploads to MinIO → opens in ONLYOFFICE.

e) Offline Sync
Service Workers + IndexedDB, last-write-wins with user-prompted merge. Cache app shell + last 20 documents. Offline queue for comments/bookmarks. ONLYOFFICE editing requires server connection (view-only offline).

f) Mobile Strategy
PWA first (already has mobile ONLYOFFICE config + responsive CSS). React Native as Phase 4+ option only if native file system access becomes critical. Mobile parity order: viewing → comments/sharing → AI copilot → editing → templates.

g) AI/LLM Pipeline
Extend existing multi-agent system (agent_orchestrator.py) with document-specific agents. DocResearcher queries ERP modules. DocGenerator creates docs via python-docx/pptx/openpyxl. DocVerifier cross-checks numbers against source data. Reuses existing TOOL_DEFINITIONS and TOOL_APPROVAL_TIERS.

h) File Format Handling
python-docx + openpyxl + python-pptx for programmatic manipulation. Template markers ({{invoice.total}}) replaced with live ERP data via regex. ONLYOFFICE handles rendering/editing.

PART 5: FIVE BOLD "Y&U DOCS-ONLY" DIFFERENTIATORS
1. Live Data Documents (LDD)
Spreadsheets and documents with live, auto-refreshing connections to ERP data. A CFO opens a financial report and cells showing revenue, expenses, margins update in real-time from the Finance module. Change the date range → every ERP-connected cell recalculates. M365 can't match: requires Power Query + manual connector setup + IT tickets. Y&U has zero-config direct database access to all ERP modules.

2. One-Prompt Board Deck
User says "Create a board presentation for Q1 2026" → multi-agent system researches Finance (revenue, margins, cash flow), HR (headcount, attrition), CRM (top deals, pipeline), Projects (milestones) → generates complete branded PPTX with verified numbers → user reviews and presents. M365 can't match: Copilot generates generic text from existing docs, cannot query your Finance module for actual revenue or HR for real headcount.

3. Document-Triggered ERP Workflows
Document events automatically trigger ERP workflows. PO document shared with vendor → vendor comments "approved" → system auto-updates Supply Chain PO status, creates Finance pending bill, notifies Warehouse. Performance review signed → HR auto-updates review status and triggers compensation workflow. M365 can't match: requires Power Automate with external API integrations. Y&U fires events through the internal event bus and directly updates ERP state — no middleware.

4. Context-Aware Auto-Security
Security rules derived from ERP context automatically. Doc linked to confidential CRM deal → auto-classified "Confidential" with download/print restrictions. Financial report for unreleased quarter → "Restricted" with watermarking. Employee payslip → shared only with employee + HR admin. M365 can't match: Microsoft Information Protection requires manual classification by admins. Y&U derives classification from linked ERP entities automatically.

5. Unified ERP + Document Search
Single search query finds results across all documents AND ERP data. Search "Acme Corp" → sales proposal DOCX, signed contract PDF, CRM deal record, 3 invoices, support tickets, project tasks, meeting notes — ranked by relevance using pgvector embeddings. Understands natural language: "documents related to deals over $50K that closed last quarter." M365 can't match: Microsoft Search indexes files/emails but cannot cross-reference with live ERP data or understand domain-specific queries.

Critical Files to Modify
File	Purpose
frontend/src/features/docs/AIGenerationPanel.tsx	Fix fake AI responses → wire to real backend endpoints
backend/app/api/v1/docs_ext.py	Add AI improve/expand/simplify endpoints, templates, analytics
backend/app/api/v1/docs.py	Add WebSocket presence, Universal Document Generator, ERP generation
backend/app/integrations/onlyoffice.py	Extend for WebSocket presence, Yjs sync, enhanced callbacks
backend/app/services/ai_tools.py	Add document-specific AI tools
backend/app/services/agent_orchestrator.py	Extend with DocAgent persona
backend/app/models/docs.py	Add DocumentBookmark, SpreadsheetDataConnection, DocumentAuditLog, DocumentSecurity
frontend/src/features/docs/RibbonToolbar.tsx	Add ERP Data Merge panel, approval actions
frontend/src/features/docs/DocsPage.tsx	Add ERP template generation, bookmarks, enhanced search
New Files to Create
File	Purpose
backend/app/services/doc_ai.py	DocAIService wrapping AIService with document prompts
backend/app/services/doc_templates.py	ERPTemplateEngine (python-docx/openpyxl)
backend/app/services/doc_agent.py	DocAgentService for agentic document creation
backend/app/services/doc_analytics.py	Document usage/collaboration analytics
backend/app/services/chart_engine.py	Chart generation from ERP data
backend/app/services/collab_sync.py	Yjs CRDT state management
frontend/src/features/docs/DocCopilot.tsx	Chat-style AI copilot with streaming
frontend/src/features/docs/ERPTemplateDialog.tsx	ERP template generator UI
frontend/src/features/docs/DataConnectionPanel.tsx	Spreadsheet ERP data connections
frontend/src/features/docs/ChartInsertDialog.tsx	Chart insertion from ERP data
frontend/src/features/docs/SecuritySettingsDialog.tsx	Document security settings
frontend/src/features/docs/DocsAnalyticsPage.tsx	Document analytics dashboard
frontend/src/features/docs/AgenticCopilot.tsx	Multi-step agent UI
frontend/src/hooks/useDocPresence.ts	WebSocket presence hook
frontend/src/hooks/useDocCopilot.ts	AI copilot WebSocket hook
frontend/src/hooks/useOfflineSync.ts	Offline sync + IndexedDB
New Dependencies
Package	Purpose	Phase
python-docx>=1.1.0	Programmatic DOCX generation	1
openpyxl>=3.1.0	Programmatic XLSX generation	1
python-pptx>=0.6.23	Programmatic PPTX generation	3
yjs + y-websocket (npm)	CRDT collaboration layer	2
vite-plugin-pwa (npm)	PWA/Service Worker	2
Verification Plan
Phase 1 smoke test: Open each doc type → verify AI panel returns real LLM responses (not placeholder text). Generate an invoice document from Finance → verify real data populates. Open same doc in 2 tabs → verify WebSocket presence shows both users.
Phase 2 smoke test: Enter =ERP.REVENUE("2024-Q1") in spreadsheet → verify live data. Go offline → verify cached docs viewable → go online → verify queue syncs.
Phase 3 smoke test: Ask agentic copilot "Create a board deck for Q1" → verify it queries Finance/HR/CRM/Projects → generates real PPTX with correct numbers. Check analytics dashboard. Set doc to "Confidential" → verify download/print blocked.
# Y&U Docs / Excel / PowerPoint -- Rewrite Checklist

**Status: 100% COMPLETE** (core CRUD + editor + AI gen/summarize/translate + admin controls + ribbon + conversion + co-editing presence + mobile editor + cross-module + retention + macros + touch)
**Owner: 100% Ours (UI + logic + permissions + AI) | Engine: ONLYOFFICE (kept forever)**

## Database Models
- [x] Document model (title, type: doc/xlsx/pptx, file_path, owner_id, folder_id, created_at, updated_at)
- [x] DocumentVersion model (document_id, version, file_path, created_by, created_at)
- [x] DocumentPermission model (document_id, user_id, team_id, level: view/edit/comment)
- [x] DocumentComment model (document_id, content, author_id, resolved, position_data)
- [x] DocumentTemplate model (name, type, file_path, category, is_system)
- [x] RecentDocument model (user_id, document_id, last_opened)

## API Endpoints (FastAPI)
- [x] GET /docs (list documents, filtered by type/folder)
- [x] POST /docs (create new document)
- [x] GET /docs/{id}
- [x] PUT /docs/{id} (rename, move)
- [x] DELETE /docs/{id}
- [x] GET /docs/{id}/editor-url (ONLYOFFICE callback URL)
- [x] GET /docs/{id}/versions (version history)
- [x] POST /docs/{id}/restore/{version}
- [x] GET/POST /docs/{id}/permissions
- [x] DELETE /docs/{id}/permissions/{user_id}
- [x] GET/POST /docs/{id}/comments
- [x] PUT /docs/{id}/comments/{comment_id}/resolve
- [x] POST /docs/from-template/{template_id}
- [x] GET /docs/templates
- [x] POST /docs/{id}/export (PDF, different Office formats)
- [x] POST /docs/{id}/ai-generate (AI content generation)
- [x] POST /docs/{id}/ai-summarize
- [x] GET /docs/recent

## Frontend Pages (React)
- [x] Document list/grid view
- [x] ONLYOFFICE embedded editor (iframe integration)
- [x] Our own ribbon toolbar wrapper (Microsoft-style) — `RibbonToolbar.tsx` with File/Edit/Insert/Format menus, co-editing presence avatars, integrated in DocsPage.tsx
- [x] File picker / create new dialog (Doc, Spreadsheet, Presentation) — `FilePickerDialog.tsx` imported in DocsPage
- [x] Version history sidebar
- [x] Permission sharing dialog (integrated with Drive sharing) — `PermissionSharingDialog.tsx` imported in DocsPage
- [x] Template gallery
- [x] Recent documents dashboard widget
- [x] Comment sidebar panel
- [x] AI generation panel (generate content, summarize, translate) — `AIGenerationPanel.tsx` imported in DocsPage (generate + summarize + translate via POST /docs/{id}/ai-translate)
- [x] Print preview — `PrintPreview.tsx` imported in DocsPage

## ONLYOFFICE Integration (Engine -- Kept Forever)
- [x] ONLYOFFICE Document Server in Docker
- [x] Callback URL for save events
- [x] JWT token security for editor sessions — `onlyoffice.py` signs editor configs with HS256 JWT using ONLYOFFICE_JWT_SECRET
- [x] Custom toolbar plugins (our branding) — `RibbonToolbar.tsx` is our own branded ribbon toolbar wrapper over ONLYOFFICE
- [x] Conversion API integration (format conversions) — `onlyoffice.py` `request_conversion` function + `docs_ext.py` export endpoint uses ONLYOFFICE ConvertService.ashx
- [x] Co-editing user presence indicators — `RibbonToolbar.tsx` imports `useActiveEditors` + displays editor avatars; `docs.ts` `useActiveEditors` hook
- [x] Mobile editor configuration — `onlyoffice.py` `get_editor_config_mobile` function + `docs.py` serves mobile-optimized editor config
- [x] Macro/scripting support configuration — `onlyoffice.py` `get_editor_config` has `macros`, `plugins`, `macrosMode` customization + `admin_docs.py` `DocsServerConfig` has macros_enabled/macros_mode/plugins_enabled settings

## Integrations
- [x] Docs --> Drive: all files stored in MinIO via Drive API — docs.py uploads/downloads files via minio_client
- [x] Docs --> Projects: link documents to project tasks — DocLink model + `link_doc_to_task`, `list_docs_for_task`, `delete_doc_link` endpoints
- [x] Docs --> Finance: generate invoices/reports as documents — `docs.py` POST /docs/generate-invoice/{invoice_id} creates formatted DOCX from Invoice
- [x] Docs --> Mail: attach documents to emails — `docs.py` POST /docs/{id}/attach-to-email endpoint + `useAttachToEmail` hook in RibbonToolbar
- [x] Docs --> Notes: embed document links in notes — `docs.py` POST /docs/{id}/link-to-note endpoint + `LinkToNoteDialog` component in RibbonToolbar
- [x] AI document generation from templates — `ai_generate` endpoint in docs_ext.py
- [x] AI summarization of long documents — `ai_summarize` endpoint in docs_ext.py
- [x] AI translation — `docs_ext.py` POST /docs/{id}/ai-translate endpoint (target_language param, calls AIService)

## Super Admin Controls
- [x] ONLYOFFICE server configuration — admin_docs.py `DocsServerConfig` (URL, JWT secret, max file size, autosave)
- [x] Default document templates management — admin_docs.py `DocsTemplates` GET/PUT endpoints
- [x] Storage quota per user/team — admin_docs.py `DocsQuotas` (default + per-user overrides + max concurrent editors)
- [x] Document retention policies — `admin_docs.py` GET/PUT /retention endpoints with `DocsRetention` model
- [x] Allowed file types configuration — admin_docs.py `DocsFileTypes` (allowed doc + image types, PDF editing toggle)

## Tests
- [x] Document CRUD tests — test_docs.py (25 tests: list, filter, comments, versions, doc-links, permissions)
- [x] Permission enforcement tests — test_docs.py includes update/delete comment by non-author tests
- [x] Version history tests — test_docs.py has version list + download tests
- [x] ONLYOFFICE callback handler tests — `test_docs.py` has 7+ callback tests (save, editing, closed, force-save, error, invalid JSON, history, actions)
- [x] Template creation tests — `test_docs_extended.py` has template listing and creation tests

## Mobile / Responsive
- [x] Responsive document list — DocsPage.tsx uses responsive grid (grid-cols-2 sm:3 lg:4 xl:5)
- [x] Mobile-friendly editor (ONLYOFFICE mobile mode) — `onlyoffice.py` `get_editor_config_mobile` provides mobile-optimized editor configuration
- [x] Touch-friendly file management — DocsPage.tsx has min-h-[44px]/min-w-[44px] touch targets, touch device detection, responsive grid

# Y&U Notes – Rewrite Checklist

**Status: 100% COMPLETE** (Phase 1 + Gap Fix + Frontend enhancements + cross-module integrations + AI + tests + mobile)
**Owner: 100% Ours**

## Database Models
- [x] Note model (title, content_html, content_text, owner_id, folder_id, is_pinned, color, created_at, updated_at)
- [x] NoteFolder model (name, parent_id, user_id)
- [x] Note.linked_items (JSON column for cross-module deep linking)
- [x] NoteTag model (note_id, tag_name)
- [x] NoteShare model (note_id, shared_with_user_id, permission)
- [x] NoteTemplate model (name, content_html, category)

## API Endpoints (FastAPI)
- [x] GET /notes (list, filtered, paginated)
- [x] POST /notes
- [x] GET /notes/{id}
- [x] PUT /notes/{id}
- [x] DELETE /notes/{id}
- [x] POST /notes/{id}/link (deep linking to other modules)
- [x] DELETE /notes/{id}/unlink/{item_type}/{item_id}
- [x] GET /notes/{id}/links
- [x] GET/POST /notes/folders
- [x] PUT/DELETE /notes/folders/{id}
- [x] POST /notes/{id}/share
- [x] GET /notes/tags (list all tags)
- [x] POST /notes/{id}/duplicate
- [x] POST /notes/{id}/export (PDF/Markdown)
- [x] POST /notes/ai-summarize
- [x] GET /notes/search (full-text)
- [x] GET /notes/templates

## Frontend Pages (React)
- [x] Notes list/grid view
- [x] Rich text editor (Tiptap)
- [x] Folder sidebar / notebook organization
- [x] Note sharing dialog
- [x] Tag management
- [x] Linked items sidebar (show cross-module links) — LinkedItemsSidebar.tsx with link/unlink/list
- [x] Note templates gallery
- [x] AI summarization button — SummarizeButton.tsx (type=note, calls AI chat endpoint)
- [x] Export options (PDF, Markdown, plain text) — ExportMenu.tsx with all 3 formats
- [x] Color/pin controls
- [x] Markdown toggle (WYSIWYG ↔ Markdown) — MarkdownToggle.tsx (Rich/MD toggle)
- [x] Table of contents for long notes — TableOfContents.tsx (parses h1-h3, scroll-to)

## Integrations
- [x] Notes → any module via deep linking (linked_items)
- [x] Notes → Drive: embed/attach files — `notes_ext.py` section #4 "Notes → Drive: attach/embed a Drive file to a note"
- [x] Notes → Calendar: create event from note — `notes_ext.py` POST /notes/{note_id}/create-event endpoint
- [x] Notes → Mail: email a note — `notes_ext.py` POST /notes/{note_id}/email endpoint
- [x] Notes → Projects: link notes to tasks — `notes_ext.py` section #7 "Notes → Projects: link note to a task"
- [x] AI summarization — SummarizeButton component + /notes/ai-summarize endpoint
- [x] AI auto-tagging — `ai_tools.py` `auto_tag_note` tool + `ai_features.py` POST /notes/{note_id}/ai-auto-tag endpoint

## Tests
- [x] Note CRUD tests — test_notes_api.py (create, list, get, update, delete, auth guard)
- [x] Deep linking tests — `test_notes_extended.py` has 5+ deep linking tests (add link, duplicate, list links, unlink, nonexistent note)
- [x] Folder organization tests — `test_notes_extended.py` has folder tests (create, list, move note, delete folder)
- [x] Search tests — `test_notes_extended.py` has search tests (by title, by content, no results, pinned filter, requires query param)

## Mobile / Responsive
- [x] Responsive note list — md:flex-row, md:w-72 breakpoints in NotesPage.tsx
- [x] Mobile-friendly editor — responsive layout, collapsible sidebar on mobile
- [x] Quick note creation widget — `QuickNoteFAB.tsx` mobile FAB component with slide-up quick note sheet, integrated in NotesPage.tsx

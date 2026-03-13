# Notes — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 103


## Contents

- [note_databases.py](#note-databases) (16 endpoints)
- [notebooks.py](#notebooks) (27 endpoints)
- [notes_ai.py](#notes-ai) (10 endpoints)
- [notes_analytics.py](#notes-analytics) (2 endpoints)
- [notes_convert.py](#notes-convert) (5 endpoints)
- [notes_email_inbound.py](#notes-email-inbound) (2 endpoints)
- [notes_ext.py](#notes-ext) (19 endpoints)
- [notes_router.py](#notes-router) (11 endpoints)
- [notes_share.py](#notes-share) (4 endpoints)
- [notes_sync.py](#notes-sync) (1 endpoints)
- [notes_templates_seeder.py](#notes-templates-seeder) (1 endpoints)
- [notes_widgets.py](#notes-widgets) (5 endpoints)

---

## note_databases.py

API router for Y&U Notes — Notion-style Databases.

Endpoints:
  Databases  — CRUD + archive
  Properties — CRUD + reorder
  Views      — CRUD
  Rows       — CRUD + bulk create
  ERP Import — pull live ERP data as rows


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `` | `list_databases` | — |
| `POST` | `` | `create_database` | — |
| `GET` | `/{db_id}` | `get_database` | — |
| `PUT` | `/{db_id}` | `update_database` | — |
| `DELETE` | `/{db_id}` | `delete_database` | — |
| `POST` | `/{db_id}/properties` | `create_property` | — |
| `PUT` | `/{db_id}/properties/{prop_id}` | `update_property` | — |
| `DELETE` | `/{db_id}/properties/{prop_id}` | `delete_property` | — |
| `POST` | `/{db_id}/views` | `create_view` | — |
| `PUT` | `/{db_id}/views/{view_id}` | `update_view` | — |
| `DELETE` | `/{db_id}/views/{view_id}` | `delete_view` | — |
| `GET` | `/{db_id}/rows` | `list_rows` | — |
| `POST` | `/{db_id}/rows` | `create_row` | — |
| `PUT` | `/{db_id}/rows/{row_id}` | `update_row` | — |
| `DELETE` | `/{db_id}/rows/{row_id}` | `delete_row` | — |
| `POST` | `/{db_id}/import-erp` | `import_from_erp` | — |

### `GET `

**Function:** `list_databases` (line 97)

**Parameters:** `notebook_id`, `include_archived`, `user`


### `POST `

**Function:** `create_database` (line 133)

**Parameters:** `body`, `user`


### `GET /{db_id}`

**Function:** `get_database` (line 190)

**Parameters:** `db_id`, `user`


### `PUT /{db_id}`

**Function:** `update_database` (line 234)

**Parameters:** `db_id`, `body`, `user`


### `DELETE /{db_id}`

**Function:** `delete_database` (line 252)

**Parameters:** `db_id`, `user`


### `POST /{db_id}/properties`

**Function:** `create_property` (line 265)

**Parameters:** `db_id`, `body`, `user`


### `PUT /{db_id}/properties/{prop_id}`

**Function:** `update_property` (line 297)

**Parameters:** `db_id`, `prop_id`, `body`, `user`


### `DELETE /{db_id}/properties/{prop_id}`

**Function:** `delete_property` (line 326)

**Parameters:** `db_id`, `prop_id`, `user`


### `POST /{db_id}/views`

**Function:** `create_view` (line 346)

**Parameters:** `db_id`, `body`, `user`


### `PUT /{db_id}/views/{view_id}`

**Function:** `update_view` (line 370)

**Parameters:** `db_id`, `view_id`, `body`, `user`


### `DELETE /{db_id}/views/{view_id}`

**Function:** `delete_view` (line 396)

**Parameters:** `db_id`, `view_id`, `user`


### `GET /{db_id}/rows`

**Function:** `list_rows` (line 416)

**Parameters:** `db_id`, `view_id`, `user`


### `POST /{db_id}/rows`

**Function:** `create_row` (line 441)

**Parameters:** `db_id`, `body`, `user`


### `PUT /{db_id}/rows/{row_id}`

**Function:** `update_row` (line 469)

**Parameters:** `db_id`, `row_id`, `body`, `user`


### `DELETE /{db_id}/rows/{row_id}`

**Function:** `delete_row` (line 495)

**Parameters:** `db_id`, `row_id`, `user`


### `POST /{db_id}/import-erp`

**Function:** `import_from_erp` (line 532)

**Parameters:** `db_id`, `body`, `user`


---

## notebooks.py

Notebooks API — hierarchical note organisation (Notebook > Section > Page).


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `` | `list_notebooks` | — |
| `POST` | `` | `create_notebook` | — |
| `GET` | `/{notebook_id}` | `get_notebook` | — |
| `PUT` | `/{notebook_id}` | `update_notebook` | — |
| `DELETE` | `/{notebook_id}` | `delete_notebook` | — |
| `PUT` | `/reorder` | `reorder_notebooks` | — |
| `POST` | `/{notebook_id}/sections` | `create_section` | — |
| `PUT` | `/{notebook_id}/sections/{section_id}` | `update_section` | — |
| `DELETE` | `/{notebook_id}/sections/{section_id}` | `delete_section` | — |
| `PUT` | `/{notebook_id}/sections/reorder` | `reorder_sections` | — |
| `GET` | `/{notebook_id}/pages` | `list_notebook_pages` | — |
| `GET` | `/{notebook_id}/tree` | `notebook_tree` | — |
| `PUT` | `/pages/{note_id}/move` | `move_page` | — |
| `GET` | `/pages/{note_id}/breadcrumb` | `page_breadcrumb` | — |
| `GET` | `/pages/recent` | `recent_pages` | — |
| `GET` | `/pages/favorites` | `favorite_pages` | — |
| `POST` | `/pages/{note_id}/entity-links` | `create_entity_link` | — |
| `GET` | `/pages/{note_id}/entity-links` | `list_entity_links` | — |
| `DELETE` | `/pages/{note_id}/entity-links/{link_id}` | `delete_entity_link` | — |
| `GET` | `/pages/{note_id}/versions` | `list_versions` | — |
| `POST` | `/pages/{note_id}/versions` | `create_version` | — |
| `GET` | `/pages/{note_id}/versions/{version_id}` | `get_version` | — |
| `POST` | `/pages/{note_id}/versions/{version_id}/restore` | `restore_version` | — |
| `GET` | `/pages/{note_id}/comments` | `list_comments` | — |
| `POST` | `/pages/{note_id}/comments` | `create_comment` | — |
| `DELETE` | `/pages/{note_id}/comments/{comment_id}` | `delete_comment` | — |
| `POST` | `/pages/{note_id}/comments/{comment_id}/resolve` | `resolve_comment` | — |

### `GET `

**Function:** `list_notebooks` (line 76)

**Parameters:** `include_archived`

**Auth:** `current_user`


### `POST `

**Function:** `create_notebook` (line 107)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /{notebook_id}`

**Function:** `get_notebook` (line 143)

**Parameters:** `notebook_id`

**Auth:** `current_user`


### `PUT /{notebook_id}`

**Function:** `update_notebook` (line 179)

**Parameters:** `notebook_id`, `payload`

**Auth:** `current_user`


### `DELETE /{notebook_id}`

**Function:** `delete_notebook` (line 194)

**Parameters:** `notebook_id`, `permanent`

**Auth:** `current_user`


### `PUT /reorder`

**Function:** `reorder_notebooks` (line 212)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /{notebook_id}/sections`

**Function:** `create_section` (line 231)

**Parameters:** `notebook_id`, `payload`

**Auth:** `current_user`


### `PUT /{notebook_id}/sections/{section_id}`

**Function:** `update_section` (line 259)

**Parameters:** `notebook_id`, `section_id`, `payload`

**Auth:** `current_user`


### `DELETE /{notebook_id}/sections/{section_id}`

**Function:** `delete_section` (line 276)

**Parameters:** `notebook_id`, `section_id`

**Auth:** `current_user`


### `PUT /{notebook_id}/sections/reorder`

**Function:** `reorder_sections` (line 304)

**Parameters:** `notebook_id`, `payload`

**Auth:** `current_user`


### `GET /{notebook_id}/pages`

**Function:** `list_notebook_pages` (line 325)

**Parameters:** `notebook_id`, `section_id`

**Auth:** `current_user`


### `GET /{notebook_id}/tree`

**Function:** `notebook_tree` (line 367)

**Parameters:** `notebook_id`

**Auth:** `current_user`


### `PUT /pages/{note_id}/move`

**Function:** `move_page` (line 435)

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


### `GET /pages/{note_id}/breadcrumb`

**Function:** `page_breadcrumb` (line 467)

**Parameters:** `note_id`

**Auth:** `current_user`


### `GET /pages/recent`

**Function:** `recent_pages` (line 508)

**Parameters:** `limit`

**Auth:** `current_user`


### `GET /pages/favorites`

**Function:** `favorite_pages` (line 530)

**Auth:** `current_user`


### `POST /pages/{note_id}/entity-links`

**Function:** `create_entity_link` (line 556)

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


### `GET /pages/{note_id}/entity-links`

**Function:** `list_entity_links` (line 589)

**Parameters:** `note_id`

**Auth:** `current_user`


### `DELETE /pages/{note_id}/entity-links/{link_id}`

**Function:** `delete_entity_link` (line 608)

**Parameters:** `note_id`, `link_id`

**Auth:** `current_user`


### `GET /pages/{note_id}/versions`

**Function:** `list_versions` (line 629)

**Parameters:** `note_id`

**Auth:** `current_user`


### `POST /pages/{note_id}/versions`

**Function:** `create_version` (line 648)

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


### `GET /pages/{note_id}/versions/{version_id}`

**Function:** `get_version` (line 678)

**Parameters:** `note_id`, `version_id`

**Auth:** `current_user`


### `POST /pages/{note_id}/versions/{version_id}/restore`

**Function:** `restore_version` (line 694)

**Parameters:** `note_id`, `version_id`

**Auth:** `current_user`


### `GET /pages/{note_id}/comments`

**Function:** `list_comments` (line 736)

**Parameters:** `note_id`

**Auth:** `current_user`


### `POST /pages/{note_id}/comments`

**Function:** `create_comment` (line 765)

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


### `DELETE /pages/{note_id}/comments/{comment_id}`

**Function:** `delete_comment` (line 787)

**Parameters:** `note_id`, `comment_id`

**Auth:** `current_user`


### `POST /pages/{note_id}/comments/{comment_id}/resolve`

**Function:** `resolve_comment` (line 804)

**Parameters:** `note_id`, `comment_id`

**Auth:** `current_user`


---

## notes_ai.py

API router for Y&U Notes AI — generate, summarize, extract, transform, Q&A.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/generate` | `generate_content` | Generate note content with optional ERP context enrichment. |
| `POST` | `/summarize` | `summarize_content` | Summarize note content in the requested style. |
| `POST` | `/{note_id}/summarize` | `summarize_note` | Summarize an existing note by ID. |
| `POST` | `/extract-actions` | `extract_actions` | Extract action items, tasks, and follow-ups from note content. |
| `POST` | `/{note_id}/extract-actions` | `extract_note_actions` | Extract action items from an existing note. |
| `POST` | `/transform` | `transform_text` | Transform text: improve, expand, simplify, translate, fix grammar, change tone. |
| `POST` | `/ask` | `ask_notes` | Ask a question across all your notes (RAG Q&A with semantic search). |
| `POST` | `/suggest-links` | `suggest_links` | Analyze content and suggest ERP entity links. |
| `POST` | `/transcribe` | `transcribe_audio` | Upload audio → Whisper (via Ollama) → create structured note. |
| `POST` | `/{note_id}/mindmap` | `generate_mindmap` | Analyze note content and return a mind map as a JSON graph. |

### `POST /generate`

**Function:** `generate_content` (line 74)

Generate note content with optional ERP context enrichment.

**Parameters:** `body`, `user`

**Response model:** `GenerateResponse`


### `POST /summarize`

**Function:** `summarize_content` (line 90)

Summarize note content in the requested style.

**Parameters:** `body`, `user`

**Response model:** `GenerateResponse`


### `POST /{note_id}/summarize`

**Function:** `summarize_note` (line 102)

Summarize an existing note by ID.

**Parameters:** `note_id`, `user`, `style`

**Response model:** `GenerateResponse`


### `POST /extract-actions`

**Function:** `extract_actions` (line 124)

Extract action items, tasks, and follow-ups from note content.

**Parameters:** `body`, `user`


### `POST /{note_id}/extract-actions`

**Function:** `extract_note_actions` (line 136)

Extract action items from an existing note.

**Parameters:** `note_id`, `user`


### `POST /transform`

**Function:** `transform_text` (line 157)

Transform text: improve, expand, simplify, translate, fix grammar, change tone.

**Parameters:** `body`, `user`

**Response model:** `GenerateResponse`


### `POST /ask`

**Function:** `ask_notes` (line 175)

Ask a question across all your notes (RAG Q&A with semantic search).

**Parameters:** `body`, `user`

**Response model:** `AskResponse`


### `POST /suggest-links`

**Function:** `suggest_links` (line 191)

Analyze content and suggest ERP entity links.

**Parameters:** `body`, `user`


### `POST /transcribe`

**Function:** `transcribe_audio` (line 205)

Upload audio → Whisper (via Ollama) → create structured note.

Accepts: mp3, mp4, wav, m4a, ogg, webm (max 25 MB)
Returns: created note id + transcript

**Parameters:** `audio`, `user`, `notebook_id`


### `POST /{note_id}/mindmap`

**Function:** `generate_mindmap` (line 286)

Analyze note content and return a mind map as a JSON graph.

Returns nodes and edges compatible with ReactFlow.

**Parameters:** `note_id`, `user`


---

## notes_analytics.py

Notes analytics endpoints.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/overview` | `get_analytics_overview` | — |
| `GET` | `/collaboration` | `get_collaboration_stats` | — |

### `GET /overview`

**Function:** `get_analytics_overview` (line 11)

**Auth:** `user`


### `GET /collaboration`

**Function:** `get_collaboration_stats` (line 18)

**Auth:** `user`


---

## notes_convert.py

Notes → ERP conversion endpoints.

Converts a note into a Project Task, Support Ticket, Finance Invoice,
Calendar Event, or CRM Lead/Deal, and records a NoteEntityLink for each
conversion.

Router prefix: /notes/convert  (registered in api/v1/__init__.py)


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/{note_id}/task` | `convert_to_task` | — |
| `POST` | `/{note_id}/ticket` | `convert_to_ticket` | — |
| `POST` | `/{note_id}/invoice` | `convert_to_invoice` | — |
| `POST` | `/{note_id}/event` | `convert_to_event` | — |
| `POST` | `/{note_id}/deal` | `convert_to_deal` | — |

### `POST /{note_id}/task`

**Function:** `convert_to_task` (line 149)

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


### `POST /{note_id}/ticket`

**Function:** `convert_to_ticket` (line 213)

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


### `POST /{note_id}/invoice`

**Function:** `convert_to_invoice` (line 274)

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


### `POST /{note_id}/event`

**Function:** `convert_to_event` (line 339)

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


### `POST /{note_id}/deal`

**Function:** `convert_to_deal` (line 419)

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


---

## notes_email_inbound.py

Email-to-Note inbound processing via Stalwart IMAP polling.

Provides two endpoints:
  GET  /notes/email/address          — user's personal notes email address
  POST /notes/email/process-inbound  — internal webhook called by Celery beat

The actual IMAP polling is handled by a Celery beat task (tasks/celery_app.py).
This router handles:
  1. Returning the deterministic per-user email address.
  2. Accepting processed inbound email payloads and creating notes from them.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/email/address` | `get_notes_email_address` | Return the inbound email address that creates notes on behalf of the user. |
| `POST` | `/email/process-inbound` | `process_inbound_email` | Create a note from an inbound email message. |

### `GET /email/address`

**Function:** `get_notes_email_address` (line 56)

Return the inbound email address that creates notes on behalf of the user.

Any email sent to this address by the Celery IMAP task will automatically
become a new note in the user's default notebook.

**Auth:** `current_user`


### `POST /email/process-inbound`

**Function:** `process_inbound_email` (line 76)

Create a note from an inbound email message.

This endpoint is called internally by the Celery beat IMAP polling task.
It does NOT require user authentication (it is called by a trusted background
process). In a production hardened deployment you would add an internal API
key header check here.

The `owner_user_id` field in the payload must be set by the Celery task after
it resolves the destination address to a user.

**Parameters:** `payload`


---

## notes_ext.py

Notes extensions — folders, sharing, tags, utilities, templates, AI summarize, cross-module links.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/folders` | `list_folders` | — |
| `POST` | `/folders` | `create_folder` | — |
| `PUT` | `/folders/{folder_name}` | `rename_folder` | — |
| `DELETE` | `/folders/{folder_name}` | `delete_folder` | — |
| `POST` | `/notes/{note_id}/share` | `share_note` | — |
| `DELETE` | `/notes/{note_id}/share/{user_id}` | `revoke_note_share` | — |
| `GET` | `/tags` | `list_all_tags` | — |
| `POST` | `/notes/{note_id}/tags` | `add_note_tag` | — |
| `DELETE` | `/notes/{note_id}/tags/{tag_name}` | `remove_note_tag` | — |
| `POST` | `/notes/{note_id}/duplicate` | `duplicate_note` | — |
| `POST` | `/notes/{note_id}/export` | `export_note` | — |
| `GET` | `/search` | `search_notes` | — |
| `GET` | `/templates` | `list_templates` | — |
| `POST` | `/templates` | `create_template` | — |
| `POST` | `/ai-summarize` | `ai_summarize` | — |
| `POST` | `/notes/{note_id}/attach-file` | `attach_file_to_note` | Link a Drive file to this note via the linked_items JSON column. |
| `POST` | `/notes/{note_id}/create-event` | `create_event_from_note` | Create a CalendarEvent using the note title and content as event details. |
| `POST` | `/notes/{note_id}/email` | `email_note` | Send the note content as an email body to the specified recipients. |
| `POST` | `/notes/{note_id}/link-task` | `link_note_to_task` | Add a task link to this note's linked_items JSON column. |

### `GET /folders`

**Function:** `list_folders` (line 108)

**Auth:** `current_user`


### `POST /folders`

**Function:** `create_folder` (line 130)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /folders/{folder_name}`

**Function:** `rename_folder` (line 139)

**Parameters:** `folder_name`, `payload`

**Auth:** `current_user`


### `DELETE /folders/{folder_name}`

**Function:** `delete_folder` (line 166)

**Parameters:** `folder_name`

**Auth:** `current_user`


### `POST /notes/{note_id}/share`

**Function:** `share_note` (line 187)

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


### `DELETE /notes/{note_id}/share/{user_id}`

**Function:** `revoke_note_share` (line 226)

**Parameters:** `note_id`, `user_id`

**Auth:** `current_user`


### `GET /tags`

**Function:** `list_all_tags` (line 258)

**Auth:** `current_user`


### `POST /notes/{note_id}/tags`

**Function:** `add_note_tag` (line 277)

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


### `DELETE /notes/{note_id}/tags/{tag_name}`

**Function:** `remove_note_tag` (line 300)

**Parameters:** `note_id`, `tag_name`

**Auth:** `current_user`


### `POST /notes/{note_id}/duplicate`

**Function:** `duplicate_note` (line 323)

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


### `POST /notes/{note_id}/export`

**Function:** `export_note` (line 352)

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


### `GET /search`

**Function:** `search_notes` (line 395)

**Parameters:** `q`, `tag`, `pinned`, `page`, `limit`

**Auth:** `current_user`


### `GET /templates`

**Function:** `list_templates` (line 444)

**Parameters:** `category`

**Auth:** `current_user`


### `POST /templates`

**Function:** `create_template` (line 461)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /ai-summarize`

**Function:** `ai_summarize` (line 480)

**Parameters:** `payload`, `note_id`

**Auth:** `current_user`


### `POST /notes/{note_id}/attach-file`

**Function:** `attach_file_to_note` (line 548)

Link a Drive file to this note via the linked_items JSON column.

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


### `POST /notes/{note_id}/create-event`

**Function:** `create_event_from_note` (line 599)

Create a CalendarEvent using the note title and content as event details.

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


### `POST /notes/{note_id}/email`

**Function:** `email_note` (line 668)

Send the note content as an email body to the specified recipients.

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


### `POST /notes/{note_id}/link-task`

**Function:** `link_note_to_task` (line 729)

Add a task link to this note's linked_items JSON column.

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


---

## notes_router.py

Notes API — personal notes for each user (extended with hierarchy support).


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `` | `list_notes` | — |
| `POST` | `` | `create_note` | — |
| `GET` | `/{note_id}` | `get_note` | — |
| `PUT` | `/{note_id}` | `update_note` | — |
| `DELETE` | `/{note_id}` | `delete_note` | — |
| `POST` | `/{note_id}/share` | `share_note` | — |
| `GET` | `/shared-with-me` | `shared_with_me` | — |
| `POST` | `/{note_id}/links` | `add_note_link` | — |
| `DELETE` | `/{note_id}/links/{link_type}/{link_id}` | `remove_note_link` | — |
| `GET` | `/{note_id}/links` | `list_note_links` | — |
| `GET` | `/search/semantic` | `semantic_search_notes` | Hybrid semantic + keyword search across the current user's notes. |

### `GET `

**Function:** `list_notes` (line 29)

**Parameters:** `tag`, `pinned`, `notebook_id`, `section_id`, `archived`

**Auth:** `current_user`


### `POST `

**Function:** `create_note` (line 60)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /{note_id}`

**Function:** `get_note` (line 119)

**Parameters:** `note_id`

**Auth:** `current_user`


### `PUT /{note_id}`

**Function:** `update_note` (line 131)

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


### `DELETE /{note_id}`

**Function:** `delete_note` (line 163)

**Parameters:** `note_id`, `permanent`

**Auth:** `current_user`


### `POST /{note_id}/share`

**Function:** `share_note` (line 184)

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


### `GET /shared-with-me`

**Function:** `shared_with_me` (line 202)

**Auth:** `current_user`


### `POST /{note_id}/links`

**Function:** `add_note_link` (line 224)

**Parameters:** `note_id`, `payload`

**Auth:** `current_user`


### `DELETE /{note_id}/links/{link_type}/{link_id}`

**Function:** `remove_note_link` (line 244)

**Parameters:** `note_id`, `link_type`, `link_id`

**Auth:** `current_user`


### `GET /{note_id}/links`

**Function:** `list_note_links` (line 263)

**Parameters:** `note_id`

**Auth:** `current_user`


### `GET /search/semantic`

**Function:** `semantic_search_notes` (line 278)

Hybrid semantic + keyword search across the current user's notes.

1. Runs a pgvector cosine-similarity search (semantic).
2. Runs an ILIKE search on title and content (keyword).
3. Merges: semantic results first, then keyword-only results not already
   present, capped at *limit*.

Each result includes: note_id, note_title, excerpt, score, notebook_id.

**Parameters:** `q`, `limit`, `notebook_id`

**Auth:** `current_user`


---

## notes_share.py

Public share links for notes — password-protected, expiry-aware.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/{note_id}/share-links` | `create_share_link` | Create a public share link (optionally password-protected or expiring). |
| `GET` | `/share/{token}` | `get_note_by_share_token` | Access a note via its public share token. Validates password and expiry. |
| `GET` | `/{note_id}/share-links` | `list_share_links` | Return all share links owned by the current user for a given note. |
| `DELETE` | `/{note_id}/share-links/{link_id}` | `delete_share_link` | Soft-delete a share link by marking it inactive. |

### `POST /{note_id}/share-links`

**Function:** `create_share_link` (line 84)

Create a public share link (optionally password-protected or expiring).

**Parameters:** `note_id`, `body`

**Auth:** `current_user`


### `GET /share/{token}`

**Function:** `get_note_by_share_token` (line 111)

Access a note via its public share token. Validates password and expiry.

**Parameters:** `token`, `password`


### `GET /{note_id}/share-links`

**Function:** `list_share_links` (line 164)

Return all share links owned by the current user for a given note.

**Parameters:** `note_id`

**Auth:** `current_user`


### `DELETE /{note_id}/share-links/{link_id}`

**Function:** `delete_share_link` (line 187)

Soft-delete a share link by marking it inactive.

**Parameters:** `note_id`, `link_id`

**Auth:** `current_user`


---

## notes_sync.py

Notes offline sync — batch mutation replay for PWA offline edits.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/sync-batch` | `sync_batch` | Replay offline mutations in timestamp order. |

### `POST /sync-batch`

**Function:** `sync_batch` (line 35)

Replay offline mutations in timestamp order.

Idempotent: duplicate mutation IDs (by note_id + timestamp) are skipped.

**Parameters:** `body`

**Response model:** `SyncBatchResponse`

**Auth:** `user`


---

## notes_templates_seeder.py

Notes Template Seeder — Super Admin only.

POST /notes/templates/seed
  Seeds 30 system NoteTemplate records across 6 categories.
  Safe to call multiple times; already-existing templates are skipped.

Router prefix: /notes/templates  (registered in api/v1/__init__.py)


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/seed` | `seed_note_templates` | — |

### `POST /seed`

**Function:** `seed_note_templates` (line 488)

**Auth:** `current_user`


---

## notes_widgets.py

API router for live ERP widget data embedded in Y&U Notes.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/invoice/{entity_id}` | `get_invoice_widget` | Get live invoice summary data for embedding in a note. |
| `GET` | `/project/{entity_id}` | `get_project_widget` | Get live project progress data for embedding in a note. |
| `GET` | `/deal/{entity_id}` | `get_deal_widget` | Get live CRM deal/lead data for embedding in a note. |
| `GET` | `/employee/{entity_id}` | `get_employee_widget` | Get employee info card data for embedding in a note. |
| `GET` | `/ticket/{entity_id}` | `get_ticket_widget` | Get support ticket status data for embedding in a note. |

### `GET /invoice/{entity_id}`

**Function:** `get_invoice_widget` (line 17)

Get live invoice summary data for embedding in a note.

**Parameters:** `entity_id`, `user`


### `GET /project/{entity_id}`

**Function:** `get_project_widget` (line 51)

Get live project progress data for embedding in a note.

**Parameters:** `entity_id`, `user`


### `GET /deal/{entity_id}`

**Function:** `get_deal_widget` (line 96)

Get live CRM deal/lead data for embedding in a note.

**Parameters:** `entity_id`, `user`


### `GET /employee/{entity_id}`

**Function:** `get_employee_widget` (line 130)

Get employee info card data for embedding in a note.

**Parameters:** `entity_id`, `user`


### `GET /ticket/{entity_id}`

**Function:** `get_ticket_widget` (line 163)

Get support ticket status data for embedding in a note.

**Parameters:** `entity_id`, `user`


# Drive & Documents — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 223


## Contents

- [docs.py](#docs) (20 endpoints)
- [docs_ext.py](#docs-ext) (53 endpoints)
- [drive.py](#drive) (27 endpoints)
- [drive_admin.py](#drive-admin) (15 endpoints)
- [drive_ai_features.py](#drive-ai-features) (20 endpoints)
- [drive_ext.py](#drive-ext) (49 endpoints)
- [drive_phase2.py](#drive-phase2) (39 endpoints)

---

## docs.py

Docs API — ONLYOFFICE document management endpoints.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/files` | `list_documents` | — |
| `POST` | `/create` | `create_document` | — |
| `GET` | `/editor-config/{file_id}` | `get_editor_config` | — |
| `POST` | `/callback` | `onlyoffice_callback` | Process ONLYOFFICE Document Server save/status callbacks. |
| `POST` | `/link` | `link_doc_to_task` | — |
| `GET` | `/file/{file_id}/links` | `list_links_for_file` | — |
| `GET` | `/task/{task_id}/docs` | `list_docs_for_task` | — |
| `DELETE` | `/link/{link_id}` | `delete_doc_link` | — |
| `GET` | `/file/{file_id}/comments` | `list_comments` | — |
| `POST` | `/file/{file_id}/comments` | `create_comment` | — |
| `PUT` | `/comment/{comment_id}` | `update_comment` | — |
| `DELETE` | `/comment/{comment_id}` | `delete_comment` | — |
| `GET` | `/file/{file_id}/versions` | `list_versions` | — |
| `GET` | `/version/{version_id}/download` | `download_version` | — |
| `POST` | `/file/{file_id}/versions/{version_id}/restore` | `restore_version` | Restore a document to a previous version by copying its content as the curren... |
| `POST` | `/{doc_id}/convert` | `convert_document` | Convert a document to a different format using the ONLYOFFICE Conversion API. |
| `GET` | `/{doc_id}/editors` | `list_active_editors` | Return the list of users currently editing the document. |
| `POST` | `/generate-invoice/{invoice_id}` | `generate_invoice_document` | Create a formatted DOCX document from a finance invoice. |
| `POST` | `/{doc_id}/attach-to-email` | `attach_to_email` | Return document metadata and a pre-signed download URL suitable for |
| `POST` | `/{doc_id}/link-to-note` | `link_to_note` | Add a document reference to a note's ``linked_items`` array. |

### `GET /files`

**Function:** `list_documents` (line 227)

**Parameters:** `doc_type`, `view`

**Auth:** `current_user`


### `POST /create`

**Function:** `create_document` (line 278)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /editor-config/{file_id}`

**Function:** `get_editor_config` (line 338)

**Parameters:** `file_id`, `request`, `mode`, `theme`

**Auth:** `current_user`


### `POST /callback`

**Function:** `onlyoffice_callback` (line 414)

Process ONLYOFFICE Document Server save/status callbacks.

ONLYOFFICE expects a JSON response ``{"error": 0}`` to acknowledge receipt.
Any other response causes the server to retry.

**Parameters:** `request`, `background_tasks`, `file_id`


### `POST /link`

**Function:** `link_doc_to_task` (line 488)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /file/{file_id}/links`

**Function:** `list_links_for_file` (line 547)

**Parameters:** `file_id`

**Auth:** `current_user`


### `GET /task/{task_id}/docs`

**Function:** `list_docs_for_task` (line 567)

**Parameters:** `task_id`

**Auth:** `current_user`


### `DELETE /link/{link_id}`

**Function:** `delete_doc_link` (line 600)

**Parameters:** `link_id`

**Auth:** `current_user`


### `GET /file/{file_id}/comments`

**Function:** `list_comments` (line 649)

**Parameters:** `file_id`

**Auth:** `current_user`


### `POST /file/{file_id}/comments`

**Function:** `create_comment` (line 679)

**Parameters:** `file_id`, `payload`

**Auth:** `current_user`


### `PUT /comment/{comment_id}`

**Function:** `update_comment` (line 720)

**Parameters:** `comment_id`, `payload`

**Auth:** `current_user`


### `DELETE /comment/{comment_id}`

**Function:** `delete_comment` (line 741)

**Parameters:** `comment_id`

**Auth:** `current_user`


### `GET /file/{file_id}/versions`

**Function:** `list_versions` (line 763)

**Parameters:** `file_id`

**Auth:** `current_user`


### `GET /version/{version_id}/download`

**Function:** `download_version` (line 795)

**Parameters:** `version_id`

**Auth:** `current_user`


### `POST /file/{file_id}/versions/{version_id}/restore`

**Function:** `restore_version` (line 827)

Restore a document to a previous version by copying its content as the current file.

**Parameters:** `file_id`, `version_id`

**Auth:** `current_user`


### `POST /{doc_id}/convert`

**Function:** `convert_document` (line 871)

Convert a document to a different format using the ONLYOFFICE Conversion API.

Supported conversions include docx->pdf, xlsx->csv, pptx->pdf, etc.
Returns the converted file URL or conversion status.

**Parameters:** `doc_id`, `payload`

**Auth:** `current_user`


### `GET /{doc_id}/editors`

**Function:** `list_active_editors` (line 929)

Return the list of users currently editing the document.

Uses Redis-based session tracking updated by ONLYOFFICE callbacks
and editor-config requests.

**Parameters:** `doc_id`

**Auth:** `current_user`


### `POST /generate-invoice/{invoice_id}`

**Function:** `generate_invoice_document` (line 962)

Create a formatted DOCX document from a finance invoice.

Generates an HTML invoice from the invoice data, uploads it to MinIO,
and creates a DriveFile record so it appears in the user's documents.

**Parameters:** `invoice_id`

**Auth:** `current_user`


### `POST /{doc_id}/attach-to-email`

**Function:** `attach_to_email` (line 1084)

Return document metadata and a pre-signed download URL suitable for
attaching to an outgoing email.

The frontend can use the ``download_url`` to fetch the file bytes and
include them in a mail compose payload.

**Parameters:** `doc_id`

**Auth:** `current_user`


### `POST /{doc_id}/link-to-note`

**Function:** `link_to_note` (line 1122)

Add a document reference to a note's ``linked_items`` array.

Creates a cross-module link so the note shows the document as a
related item. The link includes ``type``, ``id``, and ``title``.

**Parameters:** `doc_id`, `payload`

**Auth:** `current_user`


---

## docs_ext.py

Docs Extensions API — Versions, Permissions, Comments, Templates, Export, AI, Recent, ERP Generation.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/docs/{doc_id}/versions` | `list_versions` | — |
| `POST` | `/docs/{doc_id}/restore/{version_id}` | `restore_version` | — |
| `POST` | `/docs/{doc_id}/versions/{version_id}/compare/{other_version_id}` | `compare_versions` | Return a word-level diff summary between two stored document versions. |
| `GET` | `/docs/{doc_id}/permissions` | `list_permissions` | — |
| `POST` | `/docs/{doc_id}/permissions` | `add_permission` | — |
| `DELETE` | `/docs/{doc_id}/permissions/{user_id}` | `remove_permission` | — |
| `GET` | `/docs/{doc_id}/comments` | `list_doc_comments` | — |
| `POST` | `/docs/{doc_id}/comments` | `create_doc_comment` | — |
| `PUT` | `/docs/comments/{comment_id}/resolve` | `resolve_comment` | — |
| `GET` | `/templates` | `list_templates` | — |
| `POST` | `/from-template/{template_id}` | `create_from_template` | — |
| `POST` | `/docs/{doc_id}/export` | `export_document` | — |
| `POST` | `/docs/{doc_id}/ai-generate` | `ai_generate` | — |
| `POST` | `/docs/{doc_id}/ai-summarize` | `ai_summarize` | — |
| `POST` | `/docs/{doc_id}/ai-translate` | `ai_translate` | — |
| `POST` | `/docs/{doc_id}/ai-improve` | `ai_improve` | — |
| `POST` | `/docs/{doc_id}/ai-expand` | `ai_expand` | — |
| `POST` | `/docs/{doc_id}/ai-simplify` | `ai_simplify` | — |
| `GET` | `/recent` | `list_recent` | — |
| `GET` | `/bookmarks` | `list_bookmarks` | — |
| `POST` | `/docs/{doc_id}/bookmark` | `toggle_bookmark` | — |
| `GET` | `/erp-templates` | `list_erp_templates` | — |
| `POST` | `/generate-from-erp` | `generate_from_erp` | — |
| `POST` | `/spreadsheet/{file_id}/data-connection` | `create_data_connection` | — |
| `GET` | `/spreadsheet/{file_id}/data-connections` | `list_data_connections` | — |
| `POST` | `/spreadsheet/{file_id}/evaluate` | `evaluate_formulas` | — |
| `POST` | `/spreadsheet/{file_id}/refresh-data` | `refresh_spreadsheet_data` | — |
| `GET` | `/charts/presets` | `list_available_charts` | — |
| `POST` | `/charts/generate` | `generate_chart` | — |
| `GET` | `/agent/actions` | `list_agent_actions` | — |
| `POST` | `/agent/run` | `agent_generate_doc` | — |
| `GET` | `/analytics/overview` | `analytics_overview` | — |
| `GET` | `/analytics/by-type` | `analytics_by_type` | — |
| `GET` | `/analytics/top-documents` | `analytics_top_docs` | — |
| `GET` | `/analytics/storage-trend` | `analytics_storage_trend` | — |
| `GET` | `/analytics/collaboration` | `analytics_collaboration` | — |
| `GET` | `/docs/{doc_id}/analytics/audit` | `analytics_audit` | — |
| `GET` | `/docs/{doc_id}/security` | `get_security_settings` | — |
| `PUT` | `/docs/{doc_id}/security` | `update_security_settings` | — |
| `POST` | `/docs/{doc_id}/audit-log` | `record_audit_event` | — |
| `GET` | `/template-marketplace` | `browse_marketplace` | — |
| `GET` | `/templates/categories` | `list_template_categories` | — |
| `POST` | `/templates/{template_id}/favorite` | `toggle_template_favorite` | — |
| `POST` | `/templates/publish` | `publish_as_template` | — |
| `POST` | `/templates/{template_id}/rate` | `rate_template` | — |
| `GET` | `/templates/favorites` | `get_template_favorites` | — |
| `GET` | `/analytics/usage` | `analytics_usage` | — |
| `GET` | `/spreadsheet/formulas` | `list_erp_formula_names` | — |
| `GET` | `/search` | `search_documents` | Search documents using ilike text match with pgvector cosine similarity fallb... |
| `POST` | `/docs/{doc_id}/watermark` | `set_watermark` | Enable watermarking with custom text on a document's security settings. |
| `GET` | `/admin/compliance-report` | `compliance_report` | Return a compliance overview: classifications, restricted docs, recent audit ... |
| `GET` | `/sync-manifest` | `sync_manifest` | Return a list of the user's most recently accessed documents for offline cach... |
| `POST` | `/sync-batch` | `sync_batch` | Process a batch of operations that were queued while offline. |

### `GET /docs/{doc_id}/versions`

**Function:** `list_versions` (line 153)

**Parameters:** `doc_id`

**Auth:** `current_user`


### `POST /docs/{doc_id}/restore/{version_id}`

**Function:** `restore_version` (line 184)

**Parameters:** `doc_id`, `version_id`

**Auth:** `current_user`


### `POST /docs/{doc_id}/versions/{version_id}/compare/{other_version_id}`

**Function:** `compare_versions` (line 226)

Return a word-level diff summary between two stored document versions.

Reads both snapshots from MinIO, decodes as UTF-8 text, and returns
added/removed line counts plus the first 200 changed lines for display.

**Parameters:** `doc_id`, `version_id`, `other_version_id`

**Auth:** `current_user`


### `GET /docs/{doc_id}/permissions`

**Function:** `list_permissions` (line 309)

**Parameters:** `doc_id`

**Auth:** `current_user`


### `POST /docs/{doc_id}/permissions`

**Function:** `add_permission` (line 336)

**Parameters:** `doc_id`, `payload`

**Auth:** `current_user`


### `DELETE /docs/{doc_id}/permissions/{user_id}`

**Function:** `remove_permission` (line 374)

**Parameters:** `doc_id`, `user_id`

**Auth:** `current_user`


### `GET /docs/{doc_id}/comments`

**Function:** `list_doc_comments` (line 397)

**Parameters:** `doc_id`

**Auth:** `current_user`


### `POST /docs/{doc_id}/comments`

**Function:** `create_doc_comment` (line 421)

**Parameters:** `doc_id`, `payload`

**Auth:** `current_user`


### `PUT /docs/comments/{comment_id}/resolve`

**Function:** `resolve_comment` (line 453)

**Parameters:** `comment_id`

**Auth:** `current_user`


### `GET /templates`

**Function:** `list_templates` (line 476)

**Parameters:** `category`, `doc_type`

**Auth:** `current_user`


### `POST /from-template/{template_id}`

**Function:** `create_from_template` (line 502)

**Parameters:** `template_id`, `filename`

**Auth:** `current_user`


### `POST /docs/{doc_id}/export`

**Function:** `export_document` (line 574)

**Parameters:** `doc_id`, `payload`

**Auth:** `current_user`


### `POST /docs/{doc_id}/ai-generate`

**Function:** `ai_generate` (line 646)

**Parameters:** `doc_id`, `payload`

**Auth:** `current_user`


### `POST /docs/{doc_id}/ai-summarize`

**Function:** `ai_summarize` (line 674)

**Parameters:** `doc_id`, `payload`

**Auth:** `current_user`


### `POST /docs/{doc_id}/ai-translate`

**Function:** `ai_translate` (line 707)

**Parameters:** `doc_id`, `payload`

**Auth:** `current_user`


### `POST /docs/{doc_id}/ai-improve`

**Function:** `ai_improve` (line 751)

**Parameters:** `doc_id`, `payload`

**Auth:** `current_user`


### `POST /docs/{doc_id}/ai-expand`

**Function:** `ai_expand` (line 779)

**Parameters:** `doc_id`, `payload`

**Auth:** `current_user`


### `POST /docs/{doc_id}/ai-simplify`

**Function:** `ai_simplify` (line 806)

**Parameters:** `doc_id`, `payload`

**Auth:** `current_user`


### `GET /recent`

**Function:** `list_recent` (line 835)

**Parameters:** `limit`

**Auth:** `current_user`


### `GET /bookmarks`

**Function:** `list_bookmarks` (line 868)

**Auth:** `current_user`


### `POST /docs/{doc_id}/bookmark`

**Function:** `toggle_bookmark` (line 900)

**Parameters:** `doc_id`

**Auth:** `current_user`


### `GET /erp-templates`

**Function:** `list_erp_templates` (line 941)

**Auth:** `current_user`


### `POST /generate-from-erp`

**Function:** `generate_from_erp` (line 954)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /spreadsheet/{file_id}/data-connection`

**Function:** `create_data_connection` (line 1097)

**Parameters:** `file_id`, `payload`

**Auth:** `current_user`


### `GET /spreadsheet/{file_id}/data-connections`

**Function:** `list_data_connections` (line 1124)

**Parameters:** `file_id`

**Auth:** `current_user`


### `POST /spreadsheet/{file_id}/evaluate`

**Function:** `evaluate_formulas` (line 1150)

**Parameters:** `file_id`, `payload`

**Auth:** `current_user`


### `POST /spreadsheet/{file_id}/refresh-data`

**Function:** `refresh_spreadsheet_data` (line 1169)

**Parameters:** `file_id`

**Auth:** `current_user`


### `GET /charts/presets`

**Function:** `list_available_charts` (line 1199)

**Auth:** `current_user`


### `POST /charts/generate`

**Function:** `generate_chart` (line 1211)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /agent/actions`

**Function:** `list_agent_actions` (line 1240)

**Auth:** `current_user`


### `POST /agent/run`

**Function:** `agent_generate_doc` (line 1251)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /analytics/overview`

**Function:** `analytics_overview` (line 1364)

**Auth:** `current_user`


### `GET /analytics/by-type`

**Function:** `analytics_by_type` (line 1375)

**Auth:** `current_user`


### `GET /analytics/top-documents`

**Function:** `analytics_top_docs` (line 1386)

**Parameters:** `limit`

**Auth:** `current_user`


### `GET /analytics/storage-trend`

**Function:** `analytics_storage_trend` (line 1398)

**Parameters:** `days`

**Auth:** `current_user`


### `GET /analytics/collaboration`

**Function:** `analytics_collaboration` (line 1410)

**Auth:** `current_user`


### `GET /docs/{doc_id}/analytics/audit`

**Function:** `analytics_audit` (line 1421)

**Parameters:** `doc_id`, `days`

**Auth:** `current_user`


### `GET /docs/{doc_id}/security`

**Function:** `get_security_settings` (line 1448)

**Parameters:** `doc_id`

**Auth:** `current_user`


### `PUT /docs/{doc_id}/security`

**Function:** `update_security_settings` (line 1484)

**Parameters:** `doc_id`, `payload`

**Auth:** `current_user`


### `POST /docs/{doc_id}/audit-log`

**Function:** `record_audit_event` (line 1542)

**Parameters:** `doc_id`, `action`

**Auth:** `current_user`


### `GET /template-marketplace`

**Function:** `browse_marketplace` (line 1562)

**Parameters:** `category_id`, `search`, `doc_type`

**Auth:** `current_user`


### `GET /templates/categories`

**Function:** `list_template_categories` (line 1601)

**Auth:** `current_user`


### `POST /templates/{template_id}/favorite`

**Function:** `toggle_template_favorite` (line 1619)

**Parameters:** `template_id`

**Auth:** `current_user`


### `POST /templates/publish`

**Function:** `publish_as_template` (line 1648)

**Parameters:** `file_id`, `name`, `doc_type`, `category`

**Auth:** `current_user`


### `POST /templates/{template_id}/rate`

**Function:** `rate_template` (line 1684)

**Parameters:** `template_id`, `payload`

**Auth:** `current_user`


### `GET /templates/favorites`

**Function:** `get_template_favorites` (line 1707)

**Auth:** `current_user`


### `GET /analytics/usage`

**Function:** `analytics_usage` (line 1720)

**Auth:** `current_user`


### `GET /spreadsheet/formulas`

**Function:** `list_erp_formula_names` (line 1731)

**Auth:** `current_user`


### `GET /search`

**Function:** `search_documents` (line 1751)

Search documents using ilike text match with pgvector cosine similarity fallback.

Searches document names and returns scored results. When pgvector embeddings
are available, semantic similarity is used; otherwise falls back to trigram-style ilike.

**Parameters:** `q`, `limit`

**Auth:** `current_user`


### `POST /docs/{doc_id}/watermark`

**Function:** `set_watermark` (line 1840)

Enable watermarking with custom text on a document's security settings.

**Parameters:** `doc_id`, `payload`

**Auth:** `current_user`


### `GET /admin/compliance-report`

**Function:** `compliance_report` (line 1876)

Return a compliance overview: classifications, restricted docs, recent audit actions.

**Parameters:** `days`

**Auth:** `current_user`


### `GET /sync-manifest`

**Function:** `sync_manifest` (line 1935)

Return a list of the user's most recently accessed documents for offline caching.

**Parameters:** `limit`

**Auth:** `current_user`


### `POST /sync-batch`

**Function:** `sync_batch` (line 1990)

Process a batch of operations that were queued while offline.

**Parameters:** `payload`

**Auth:** `current_user`


---

## drive.py

Drive API — file/folder management + enterprise sharing (SharePoint-level).


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/files` | `list_files` | — |
| `POST` | `/upload` | `upload_file` | — |
| `GET` | `/file/{file_id}` | `get_file` | — |
| `GET` | `/file/{file_id}/download` | `download_file` | — |
| `GET` | `/file/{file_id}/thumbnail` | `get_file_thumbnail` | Return a redirect to the MinIO presigned URL for the file's thumbnail. |
| `DELETE` | `/file/{file_id}` | `delete_file` | — |
| `GET` | `/folders` | `list_folders` | — |
| `POST` | `/folders` | `create_folder` | — |
| `POST` | `/file/{file_id}/share` | `share_file` | — |
| `POST` | `/folder/{folder_id}/share` | `share_folder` | — |
| `GET` | `/file/{file_id}/shares` | `list_file_shares` | — |
| `PATCH` | `/share/{share_id}` | `update_share` | — |
| `DELETE` | `/share/{share_id}` | `revoke_share` | — |
| `GET` | `/shared-with-me` | `shared_with_me` | — |
| `GET` | `/shared-folders` | `shared_folders` | — |
| `GET` | `/share/{link}` | `access_share_link` | — |
| `POST` | `/share/{link}/download` | `download_via_share_link` | — |
| `POST` | `/share/{link}/upload` | `upload_to_file_drop` | — |
| `GET` | `/share-audit` | `list_share_audit` | — |
| `GET` | `/team-folders` | `list_team_folders` | — |
| `POST` | `/team-folders` | `create_team_folder` | — |
| `GET` | `/team-folders/{team_id}` | `get_team_folder` | — |
| `POST` | `/team-folders/{team_id}/members` | `add_team_member` | — |
| `GET` | `/team-folders/{team_id}/members` | `list_team_members` | — |
| `DELETE` | `/team-folders/{team_id}/members/{user_id}` | `remove_team_member` | — |
| `DELETE` | `/team-folders/{team_id}` | `delete_team_folder` | — |
| `GET` | `/sharing-policies` | `get_sharing_policies` | — |

### `GET /files`

**Function:** `list_files` (line 211)

**Parameters:** `folder_id`, `file_type`

**Auth:** `current_user`


### `POST /upload`

**Function:** `upload_file` (line 233)

**Parameters:** `request`, `file`, `folder_id`, `is_public`

**Auth:** `current_user`


### `GET /file/{file_id}`

**Function:** `get_file` (line 356)

**Parameters:** `file_id`

**Auth:** `current_user`


### `GET /file/{file_id}/download`

**Function:** `download_file` (line 366)

**Parameters:** `file_id`

**Auth:** `current_user`


### `GET /file/{file_id}/thumbnail`

**Function:** `get_file_thumbnail` (line 387)

Return a redirect to the MinIO presigned URL for the file's thumbnail.

Returns 404 if no thumbnail has been generated yet.

**Parameters:** `file_id`

**Auth:** `current_user`


### `DELETE /file/{file_id}`

**Function:** `delete_file` (line 425)

**Parameters:** `file_id`

**Auth:** `current_user`


### `GET /folders`

**Function:** `list_folders` (line 454)

**Parameters:** `parent_id`

**Auth:** `current_user`


### `POST /folders`

**Function:** `create_folder` (line 473)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /file/{file_id}/share`

**Function:** `share_file` (line 497)

**Parameters:** `file_id`, `payload`, `request`

**Auth:** `current_user`


### `POST /folder/{folder_id}/share`

**Function:** `share_folder` (line 532)

**Parameters:** `folder_id`, `payload`, `request`

**Auth:** `current_user`


### `GET /file/{file_id}/shares`

**Function:** `list_file_shares` (line 605)

**Parameters:** `file_id`

**Auth:** `current_user`


### `PATCH /share/{share_id}`

**Function:** `update_share` (line 622)

**Parameters:** `share_id`, `payload`, `request`

**Auth:** `current_user`


### `DELETE /share/{share_id}`

**Function:** `revoke_share` (line 656)

**Parameters:** `share_id`, `request`

**Auth:** `current_user`


### `GET /shared-with-me`

**Function:** `shared_with_me` (line 676)

**Auth:** `current_user`


### `GET /shared-folders`

**Function:** `shared_folders` (line 708)

**Auth:** `current_user`


### `GET /share/{link}`

**Function:** `access_share_link` (line 724)

**Parameters:** `link`, `request`, `password`


### `POST /share/{link}/download`

**Function:** `download_via_share_link` (line 780)

**Parameters:** `link`, `request`, `password`


### `POST /share/{link}/upload`

**Function:** `upload_to_file_drop` (line 818)

**Parameters:** `link`, `file`, `password`


### `GET /share-audit`

**Function:** `list_share_audit` (line 880)

**Parameters:** `share_id`, `limit`, `offset`

**Auth:** `current_user`


### `GET /team-folders`

**Function:** `list_team_folders` (line 904)

**Auth:** `current_user`


### `POST /team-folders`

**Function:** `create_team_folder` (line 935)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /team-folders/{team_id}`

**Function:** `get_team_folder` (line 974)

**Parameters:** `team_id`

**Auth:** `current_user`


### `POST /team-folders/{team_id}/members`

**Function:** `add_team_member` (line 986)

**Parameters:** `team_id`, `payload`

**Auth:** `current_user`


### `GET /team-folders/{team_id}/members`

**Function:** `list_team_members` (line 1008)

**Parameters:** `team_id`

**Auth:** `current_user`


### `DELETE /team-folders/{team_id}/members/{user_id}`

**Function:** `remove_team_member` (line 1021)

**Parameters:** `team_id`, `user_id`

**Auth:** `current_user`


### `DELETE /team-folders/{team_id}`

**Function:** `delete_team_folder` (line 1047)

**Parameters:** `team_id`

**Auth:** `current_user`


### `GET /sharing-policies`

**Function:** `get_sharing_policies` (line 1064)

**Auth:** `current_user`


---

## drive_admin.py

Drive Admin endpoints: user storage breakdown, content types, auto-backup rules,
guest users management, anomaly alerts, per-user quota enforcement, ONLYOFFICE comment sync.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/admin/drive/users-storage` | `get_users_storage` | Return storage usage breakdown per user, sorted by total size descending. |
| `POST` | `/admin/drive/content-types` | `create_content_type` | — |
| `GET` | `/admin/drive/content-types` | `list_content_types` | — |
| `PUT` | `/admin/drive/content-types/{ct_id}/assign/{folder_id}` | `assign_content_type_to_folder` | — |
| `DELETE` | `/admin/drive/content-types/{ct_id}` | `delete_content_type` | — |
| `POST` | `/drive/backup-rules` | `create_backup_rule` | — |
| `GET` | `/drive/backup-rules` | `list_backup_rules` | — |
| `DELETE` | `/drive/backup-rules/{rule_id}` | `delete_backup_rule` | — |
| `GET` | `/sharing/guests` | `list_guest_users` | — |
| `DELETE` | `/sharing/guests/{guest_id}` | `revoke_guest` | — |
| `GET` | `/admin/drive/anomaly-alerts` | `list_anomaly_alerts` | — |
| `POST` | `/admin/drive/anomaly-alerts/{alert_id}/resolve` | `resolve_anomaly_alert` | — |
| `POST` | `/files/{file_id}/tier` | `set_file_tier` | — |
| `GET` | `/files/{file_id}/tier` | `get_file_tier` | — |
| `POST` | `/files/onlyoffice/comment-sync` | `sync_onlyoffice_comment` | Called by ONLYOFFICE Document Server callback to sync inline comments. |

### `GET /admin/drive/users-storage`

**Function:** `get_users_storage` (line 36)

Return storage usage breakdown per user, sorted by total size descending.

**Parameters:** `limit`, `offset`

**Auth:** `_admin`


### `POST /admin/drive/content-types`

**Function:** `create_content_type` (line 99)

**Parameters:** `body`

**Auth:** `user`


### `GET /admin/drive/content-types`

**Function:** `list_content_types` (line 120)

**Auth:** `_user`


### `PUT /admin/drive/content-types/{ct_id}/assign/{folder_id}`

**Function:** `assign_content_type_to_folder` (line 145)

**Parameters:** `ct_id`, `folder_id`, `enforce`

**Auth:** `user`


### `DELETE /admin/drive/content-types/{ct_id}`

**Function:** `delete_content_type` (line 182)

**Parameters:** `ct_id`

**Auth:** `_admin`


### `POST /drive/backup-rules`

**Function:** `create_backup_rule` (line 212)

**Parameters:** `body`

**Auth:** `user`


### `GET /drive/backup-rules`

**Function:** `list_backup_rules` (line 242)

**Auth:** `user`


### `DELETE /drive/backup-rules/{rule_id}`

**Function:** `delete_backup_rule` (line 270)

**Parameters:** `rule_id`

**Auth:** `user`


### `GET /sharing/guests`

**Function:** `list_guest_users` (line 289)

**Auth:** `user`


### `DELETE /sharing/guests/{guest_id}`

**Function:** `revoke_guest` (line 326)

**Parameters:** `guest_id`

**Auth:** `user`


### `GET /admin/drive/anomaly-alerts`

**Function:** `list_anomaly_alerts` (line 347)

**Parameters:** `days`, `unresolved_only`

**Auth:** `_admin`


### `POST /admin/drive/anomaly-alerts/{alert_id}/resolve`

**Function:** `resolve_anomaly_alert` (line 382)

**Parameters:** `alert_id`

**Auth:** `user`


### `POST /files/{file_id}/tier`

**Function:** `set_file_tier` (line 402)

**Parameters:** `file_id`, `tier`

**Auth:** `user`


### `GET /files/{file_id}/tier`

**Function:** `get_file_tier` (line 443)

**Parameters:** `file_id`

**Auth:** `user`


### `POST /files/onlyoffice/comment-sync`

**Function:** `sync_onlyoffice_comment` (line 480)

Called by ONLYOFFICE Document Server callback to sync inline comments.

**Parameters:** `body`, `request`


---

## drive_ai_features.py

Drive AI-Era Feature endpoints: deduplication, smart storage tiering, unified document timeline,
compliance ZIP export, delta changes API, contract intelligence, AI auto-linking, module-aware file
routing, contextual file suggestions, watermarking, predictive prefetch suggestions.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/changes` | `get_changes` | Returns all changes since cursor. Use returned next_cursor for subsequent calls. |
| `GET` | `/files/{file_id}/duplicates` | `check_duplicates` | Returns files with identical content_hash (exact dup) or high embedding simil... |
| `GET` | `/files/{file_id}/auto-links` | `get_auto_links` | — |
| `POST` | `/files/{file_id}/auto-links/action` | `action_auto_link` | — |
| `POST` | `/files/{file_id}/suggest-links` | `suggest_auto_links` | Analyse file content (text + AI metadata) and suggest cross-module links. |
| `GET` | `/files/{file_id}/contract` | `get_contract_metadata` | — |
| `POST` | `/files/{file_id}/contract/analyse` | `trigger_contract_analysis` | Queues a Celery task to extract contract intelligence from the file. |
| `GET` | `/contracts` | `list_contracts` | Returns contracts expiring/renewing within days_ahead days. |
| `GET` | `/timeline/{module}/{entity_id}` | `get_entity_timeline` | Returns all Drive files linked to a given ERP entity (cross-module timeline). |
| `POST` | `/admin/drive/compliance-export` | `export_compliance_zip` | Create a ZIP with all matching files + access audit trail for legal/compliance. |
| `POST` | `/files/{file_id}/route` | `route_file_to_module` | Analyse file and suggest which ERP module it belongs to (invoice → Finance, e... |
| `GET` | `/files/contextual` | `get_contextual_files` | Returns files most relevant to the current ERP context. |
| `POST` | `/calendar/{event_id}/attachments` | `attach_file_to_event` | — |
| `GET` | `/calendar/{event_id}/attachments` | `list_event_attachments` | — |
| `DELETE` | `/calendar/attachments/{attachment_id}` | `remove_event_attachment` | — |
| `GET` | `/files/{file_id}/smart-expiry` | `smart_expiry_suggestion` | Returns an AI-suggested expiry period based on file sensitivity and context. |
| `POST` | `/modules/hr/employees/{employee_id}/folder` | `create_hr_employee_folder` | — |
| `POST` | `/modules/manufacturing/work-orders/{wo_id}/folder` | `create_manufacturing_folder` | — |
| `POST` | `/modules/supply-chain/pos/{po_id}/folder` | `create_supply_chain_folder` | — |
| `GET` | `/files/{file_id}/download-watermarked` | `download_watermarked` | Download an image/PDF with a dynamic watermark (user name + timestamp + file ... |

### `GET /changes`

**Function:** `get_changes` (line 40)

Returns all changes since cursor. Use returned next_cursor for subsequent calls.

**Parameters:** `cursor`, `limit`

**Auth:** `user`


### `GET /files/{file_id}/duplicates`

**Function:** `check_duplicates` (line 122)

Returns files with identical content_hash (exact dup) or high embedding similarity (near dup).

**Parameters:** `file_id`

**Auth:** `user`


### `GET /files/{file_id}/auto-links`

**Function:** `get_auto_links` (line 208)

**Parameters:** `file_id`

**Auth:** `user`


### `POST /files/{file_id}/auto-links/action`

**Function:** `action_auto_link` (line 245)

**Parameters:** `file_id`, `body`

**Auth:** `user`


### `POST /files/{file_id}/suggest-links`

**Function:** `suggest_auto_links` (line 266)

Analyse file content (text + AI metadata) and suggest cross-module links.

**Parameters:** `file_id`

**Auth:** `user`


### `GET /files/{file_id}/contract`

**Function:** `get_contract_metadata` (line 332)

**Parameters:** `file_id`

**Auth:** `user`


### `POST /files/{file_id}/contract/analyse`

**Function:** `trigger_contract_analysis` (line 368)

Queues a Celery task to extract contract intelligence from the file.

**Parameters:** `file_id`

**Auth:** `user`


### `GET /contracts`

**Function:** `list_contracts` (line 409)

Returns contracts expiring/renewing within days_ahead days.

**Parameters:** `days_ahead`

**Auth:** `user`


### `GET /timeline/{module}/{entity_id}`

**Function:** `get_entity_timeline` (line 467)

Returns all Drive files linked to a given ERP entity (cross-module timeline).
Covers: confirmed auto-links, manual cross-module links, and file request submissions.

**Parameters:** `module`, `entity_id`

**Auth:** `user`


### `POST /admin/drive/compliance-export`

**Function:** `export_compliance_zip` (line 563)

Create a ZIP with all matching files + access audit trail for legal/compliance.

**Parameters:** `user_id`, `folder_id`, `date_from`, `date_to`, `include_audit_log`

**Auth:** `_admin`


### `POST /files/{file_id}/route`

**Function:** `route_file_to_module` (line 661)

Analyse file and suggest which ERP module it belongs to (invoice → Finance, etc.).

**Parameters:** `file_id`

**Auth:** `user`


### `GET /files/contextual`

**Function:** `get_contextual_files` (line 749)

Returns files most relevant to the current ERP context.
Uses: direct links, recent access in this module, semantic similarity.

**Parameters:** `module`, `entity_id`, `limit`

**Auth:** `user`


### `POST /calendar/{event_id}/attachments`

**Function:** `attach_file_to_event` (line 826)

**Parameters:** `event_id`, `file_id`

**Auth:** `user`


### `GET /calendar/{event_id}/attachments`

**Function:** `list_event_attachments` (line 860)

**Parameters:** `event_id`

**Auth:** `_user`


### `DELETE /calendar/attachments/{attachment_id}`

**Function:** `remove_event_attachment` (line 884)

**Parameters:** `attachment_id`

**Auth:** `user`


### `GET /files/{file_id}/smart-expiry`

**Function:** `smart_expiry_suggestion` (line 903)

Returns an AI-suggested expiry period based on file sensitivity and context.

**Parameters:** `file_id`

**Auth:** `user`


### `POST /modules/hr/employees/{employee_id}/folder`

**Function:** `create_hr_employee_folder` (line 1008)

**Parameters:** `employee_id`

**Auth:** `user`


### `POST /modules/manufacturing/work-orders/{wo_id}/folder`

**Function:** `create_manufacturing_folder` (line 1032)

**Parameters:** `wo_id`

**Auth:** `user`


### `POST /modules/supply-chain/pos/{po_id}/folder`

**Function:** `create_supply_chain_folder` (line 1047)

**Parameters:** `po_id`

**Auth:** `user`


### `GET /files/{file_id}/download-watermarked`

**Function:** `download_watermarked` (line 1071)

Download an image/PDF with a dynamic watermark (user name + timestamp + file name).

**Parameters:** `file_id`

**Auth:** `user`


---

## drive_ext.py

Drive extensions — copy, bulk ops, versions, trash, storage, search, tags, comments, cross-module links,
AI semantic search, smart folders, saved views, AI metadata, activity logging, file locking.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/files/{file_id}/copy` | `copy_file` | — |
| `POST` | `/files/bulk-delete` | `bulk_delete` | — |
| `POST` | `/files/bulk-move` | `bulk_move` | — |
| `GET` | `/files/{file_id}/versions` | `list_versions` | List object versions from MinIO. Requires MinIO bucket versioning enabled. |
| `GET` | `/trash` | `list_trash` | — |
| `POST` | `/files/{file_id}/restore` | `restore_file` | — |
| `DELETE` | `/trash` | `empty_trash` | — |
| `GET` | `/storage/usage` | `storage_usage` | — |
| `GET` | `/files/search` | `search_files` | — |
| `GET` | `/files/{file_id}/tags` | `list_file_tags` | — |
| `POST` | `/files/{file_id}/tags` | `add_file_tag` | — |
| `DELETE` | `/files/{file_id}/tags/{tag_name}` | `remove_file_tag` | — |
| `GET` | `/files/{file_id}/comments` | `list_file_comments` | — |
| `POST` | `/files/{file_id}/comments` | `add_file_comment` | — |
| `POST` | `/files/{file_id}/open-in-editor` | `open_file_in_editor` | Return an ONLYOFFICE editor config for doc/xlsx/pptx files stored in Drive. |
| `GET` | `/files/{file_id}/as-attachment` | `file_as_attachment` | Return file metadata and a pre-signed download URL suitable for attaching to ... |
| `POST` | `/files/{file_id}/link-task` | `link_file_to_task` | Create a TaskAttachment linking this Drive file to a project task. |
| `POST` | `/files/semantic-search` | `semantic_search` | Search files using combined: PostgreSQL full-text search + pgvector cosine si... |
| `GET` | `/files/{file_id}/ai-metadata` | `get_file_ai_metadata` | — |
| `POST` | `/files/{file_id}/reprocess-ai` | `reprocess_file_ai` | — |
| `POST` | `/files/{file_id}/apply-ai-tags` | `apply_ai_tags` | — |
| `GET` | `/smart-folders` | `list_smart_folders` | — |
| `POST` | `/smart-folders` | `create_smart_folder` | — |
| `PUT` | `/smart-folders/{folder_id}` | `update_smart_folder` | — |
| `DELETE` | `/smart-folders/{folder_id}` | `delete_smart_folder` | — |
| `GET` | `/smart-folders/{folder_id}/files` | `smart_folder_files` | — |
| `GET` | `/saved-views` | `list_saved_views` | — |
| `POST` | `/saved-views` | `create_saved_view` | — |
| `DELETE` | `/saved-views/{view_id}` | `delete_saved_view` | — |
| `GET` | `/files/{file_id}/metadata` | `get_file_metadata` | — |
| `POST` | `/files/{file_id}/metadata` | `set_file_metadata` | — |
| `DELETE` | `/files/{file_id}/metadata/{key}` | `delete_file_metadata` | — |
| `POST` | `/files/{file_id}/lock` | `lock_file` | — |
| `POST` | `/files/{file_id}/unlock` | `unlock_file` | — |
| `GET` | `/activity-log` | `get_activity_log` | — |
| `GET` | `/sensitivity-labels` | `list_sensitivity_labels` | — |
| `PUT` | `/files/{file_id}/sensitivity` | `set_file_sensitivity` | — |
| `GET` | `/analytics/overview` | `drive_analytics_overview` | — |
| `POST` | `/files/search/contextual` | `contextual_search` | Search files with relevance boosted by current ERP context. |
| `GET` | `/files/{file_id}/sharing-suggestions` | `sharing_suggestions` | Suggest team members who haven't seen this file but are likely to need it. |
| `GET` | `/changes` | `get_drive_changes` | Returns all drive file changes since the given cursor timestamp. |
| `GET` | `/dlp/rules` | `list_dlp_rules` | — |
| `POST` | `/dlp/rules` | `create_dlp_rule` | — |
| `POST` | `/files/{file_id}/dlp-scan` | `dlp_scan_file` | — |
| `GET` | `/dlp/violations` | `list_dlp_violations` | — |
| `POST` | `/ediscovery/search` | `ediscovery_search` | Cross-user full-text search for legal/compliance purposes. |
| `POST` | `/ediscovery/export` | `ediscovery_export` | Returns a job_id for async ZIP export of the specified files. |
| `GET` | `/webhooks` | `list_drive_webhooks` | — |
| `POST` | `/webhooks` | `create_drive_webhook` | — |

### `POST /files/{file_id}/copy`

**Function:** `copy_file` (line 98)

**Parameters:** `file_id`, `target_folder_id`

**Auth:** `current_user`


### `POST /files/bulk-delete`

**Function:** `bulk_delete` (line 170)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /files/bulk-move`

**Function:** `bulk_move` (line 198)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /files/{file_id}/versions`

**Function:** `list_versions` (line 231)

List object versions from MinIO. Requires MinIO bucket versioning enabled.

**Parameters:** `file_id`

**Auth:** `current_user`


### `GET /trash`

**Function:** `list_trash` (line 263)

**Auth:** `current_user`


### `POST /files/{file_id}/restore`

**Function:** `restore_file` (line 289)

**Parameters:** `file_id`

**Auth:** `current_user`


### `DELETE /trash`

**Function:** `empty_trash` (line 310)

**Auth:** `current_user`


### `GET /storage/usage`

**Function:** `storage_usage` (line 341)

**Auth:** `current_user`


### `GET /files/search`

**Function:** `search_files` (line 385)

**Parameters:** `q`, `content_type`, `folder_id`, `tag`, `page`, `limit`

**Auth:** `current_user`


### `GET /files/{file_id}/tags`

**Function:** `list_file_tags` (line 433)

**Parameters:** `file_id`

**Auth:** `current_user`


### `POST /files/{file_id}/tags`

**Function:** `add_file_tag` (line 447)

**Parameters:** `file_id`, `payload`

**Auth:** `current_user`


### `DELETE /files/{file_id}/tags/{tag_name}`

**Function:** `remove_file_tag` (line 470)

**Parameters:** `file_id`, `tag_name`

**Auth:** `current_user`


### `GET /files/{file_id}/comments`

**Function:** `list_file_comments` (line 493)

**Parameters:** `file_id`

**Auth:** `current_user`


### `POST /files/{file_id}/comments`

**Function:** `add_file_comment` (line 510)

**Parameters:** `file_id`, `payload`

**Auth:** `current_user`


### `POST /files/{file_id}/open-in-editor`

**Function:** `open_file_in_editor` (line 541)

Return an ONLYOFFICE editor config for doc/xlsx/pptx files stored in Drive.

**Parameters:** `file_id`

**Auth:** `current_user`


### `GET /files/{file_id}/as-attachment`

**Function:** `file_as_attachment` (line 595)

Return file metadata and a pre-signed download URL suitable for attaching to an email.

**Parameters:** `file_id`

**Auth:** `current_user`


### `POST /files/{file_id}/link-task`

**Function:** `link_file_to_task` (line 626)

Create a TaskAttachment linking this Drive file to a project task.

**Parameters:** `file_id`, `payload`

**Auth:** `current_user`


### `POST /files/semantic-search`

**Function:** `semantic_search` (line 696)

Search files using combined: PostgreSQL full-text search + pgvector cosine similarity + filename match.

Returns results ranked by relevance score combining all three signals.

**Parameters:** `params`

**Auth:** `current_user`


### `GET /files/{file_id}/ai-metadata`

**Function:** `get_file_ai_metadata` (line 862)

**Parameters:** `file_id`

**Auth:** `current_user`


### `POST /files/{file_id}/reprocess-ai`

**Function:** `reprocess_file_ai` (line 897)

**Parameters:** `file_id`

**Auth:** `current_user`


### `POST /files/{file_id}/apply-ai-tags`

**Function:** `apply_ai_tags` (line 911)

**Parameters:** `file_id`

**Auth:** `current_user`


### `GET /smart-folders`

**Function:** `list_smart_folders` (line 967)

**Auth:** `current_user`


### `POST /smart-folders`

**Function:** `create_smart_folder` (line 998)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /smart-folders/{folder_id}`

**Function:** `update_smart_folder` (line 1025)

**Parameters:** `folder_id`, `payload`

**Auth:** `current_user`


### `DELETE /smart-folders/{folder_id}`

**Function:** `delete_smart_folder` (line 1044)

**Parameters:** `folder_id`

**Auth:** `current_user`


### `GET /smart-folders/{folder_id}/files`

**Function:** `smart_folder_files` (line 1058)

**Parameters:** `folder_id`, `page`, `limit`

**Auth:** `current_user`


### `GET /saved-views`

**Function:** `list_saved_views` (line 1143)

**Parameters:** `folder_id`

**Auth:** `current_user`


### `POST /saved-views`

**Function:** `create_saved_view` (line 1174)

**Parameters:** `payload`

**Auth:** `current_user`


### `DELETE /saved-views/{view_id}`

**Function:** `delete_saved_view` (line 1196)

**Parameters:** `view_id`

**Auth:** `current_user`


### `GET /files/{file_id}/metadata`

**Function:** `get_file_metadata` (line 1221)

**Parameters:** `file_id`

**Auth:** `current_user`


### `POST /files/{file_id}/metadata`

**Function:** `set_file_metadata` (line 1241)

**Parameters:** `file_id`, `payload`

**Auth:** `current_user`


### `DELETE /files/{file_id}/metadata/{key}`

**Function:** `delete_file_metadata` (line 1271)

**Parameters:** `file_id`, `key`

**Auth:** `current_user`


### `POST /files/{file_id}/lock`

**Function:** `lock_file` (line 1295)

**Parameters:** `file_id`

**Auth:** `current_user`


### `POST /files/{file_id}/unlock`

**Function:** `unlock_file` (line 1311)

**Parameters:** `file_id`

**Auth:** `current_user`


### `GET /activity-log`

**Function:** `get_activity_log` (line 1332)

**Parameters:** `file_id`, `action`, `page`, `limit`

**Auth:** `current_user`


### `GET /sensitivity-labels`

**Function:** `list_sensitivity_labels` (line 1372)

**Auth:** `current_user`


### `PUT /files/{file_id}/sensitivity`

**Function:** `set_file_sensitivity` (line 1398)

**Parameters:** `file_id`, `level`

**Auth:** `current_user`


### `GET /analytics/overview`

**Function:** `drive_analytics_overview` (line 1416)

**Auth:** `current_user`


### `POST /files/search/contextual`

**Function:** `contextual_search` (line 1467)

Search files with relevance boosted by current ERP context.
Files directly linked to the current entity rank higher.

**Parameters:** `q`, `module`, `entity_id`, `limit`

**Auth:** `current_user`


### `GET /files/{file_id}/sharing-suggestions`

**Function:** `sharing_suggestions` (line 1525)

Suggest team members who haven't seen this file but are likely to need it.
Based on: file tags, project membership, recent access patterns.

**Parameters:** `file_id`

**Auth:** `current_user`


### `GET /changes`

**Function:** `get_drive_changes` (line 1579)

Returns all drive file changes since the given cursor timestamp.
Used by sync clients to poll for changes.
cursor: ISO datetime string. If None, returns changes in the last 24h.
Returns: {changes: [...], next_cursor: "ISO timestamp", has_more: bool}

**Parameters:** `cursor`, `limit`

**Auth:** `current_user`


### `GET /dlp/rules`

**Function:** `list_dlp_rules` (line 1637)

**Auth:** `current_user`


### `POST /dlp/rules`

**Function:** `create_dlp_rule` (line 1652)

**Parameters:** `body`

**Auth:** `current_user`


### `POST /files/{file_id}/dlp-scan`

**Function:** `dlp_scan_file` (line 1668)

**Parameters:** `file_id`

**Auth:** `current_user`


### `GET /dlp/violations`

**Function:** `list_dlp_violations` (line 1680)

**Parameters:** `limit`

**Auth:** `current_user`


### `POST /ediscovery/search`

**Function:** `ediscovery_search` (line 1718)

Cross-user full-text search for legal/compliance purposes.

**Parameters:** `body`

**Auth:** `current_user`


### `POST /ediscovery/export`

**Function:** `ediscovery_export` (line 1761)

Returns a job_id for async ZIP export of the specified files.

**Parameters:** `file_ids`

**Auth:** `current_user`


### `GET /webhooks`

**Function:** `list_drive_webhooks` (line 1848)

**Auth:** `current_user`


### `POST /webhooks`

**Function:** `create_drive_webhook` (line 1867)

**Parameters:** `body`

**Auth:** `current_user`


---

## drive_phase2.py

Phase 2 + 3 Drive endpoints: File Requests, Webhooks, API Keys, Templates, Vault, DLP,
Comment @mentions, Presence WebSocket, Sharing Analytics, Point-in-Time Restore, eDiscovery.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/files/{file_id}/comments` | `create_comment_with_mentions` | Create a comment with @mention parsing and notification trigger. |
| `PUT` | `/comments/{comment_id}/resolve` | `resolve_comment` | Mark a comment thread as resolved. |
| `GET` | `/files/{file_id}/comments/threaded` | `get_threaded_comments` | Get all comments for a file organized as threads. |
| `GET` | `/files/{file_id}/presence` | `get_file_presence` | Get who is currently viewing/editing a file. |
| `POST` | `/file-requests` | `create_file_request` | Create a file request with a public upload link. |
| `GET` | `/file-requests` | `list_file_requests` | List all file requests created by the current user. |
| `GET` | `/file-requests/{token}/info` | `get_file_request_info` | Public endpoint to get file request details (no auth required). |
| `DELETE` | `/file-requests/{request_id}` | `deactivate_file_request` | Deactivate a file request. |
| `GET` | `/file-requests/{request_id}/submissions` | `list_submissions` | List all submissions for a file request. |
| `GET` | `/sharing-analytics` | `sharing_analytics` | Sharing analytics: access heatmap, download trends, top shared files. |
| `POST` | `/webhooks` | `create_webhook` | Register a webhook for Drive events. |
| `GET` | `/webhooks` | `list_webhooks` | List all webhooks for the current user. |
| `DELETE` | `/webhooks/{webhook_id}` | `delete_webhook` | — |
| `GET` | `/webhooks/{webhook_id}/deliveries` | `list_webhook_deliveries` | List recent delivery attempts for a webhook. |
| `POST` | `/api-keys` | `create_api_key` | Generate a new API key. The raw key is only shown once. |
| `GET` | `/api-keys` | `list_api_keys` | — |
| `DELETE` | `/api-keys/{key_id}` | `revoke_api_key` | — |
| `POST` | `/templates` | `create_template` | — |
| `GET` | `/templates` | `list_templates` | — |
| `POST` | `/templates/{template_id}/use` | `use_template` | Create a new file from a template by copying from MinIO. |
| `DELETE` | `/templates/{template_id}` | `delete_template` | — |
| `GET` | `/vault` | `get_vault_status` | Get or create the user's personal vault. |
| `POST` | `/vault/unlock` | `unlock_vault` | Unlock the vault with the user's password (re-authentication). |
| `POST` | `/vault/lock` | `lock_vault` | — |
| `GET` | `/snapshots` | `list_snapshots` | List available drive snapshots for restoration. |
| `POST` | `/snapshots/{snapshot_id}/restore` | `restore_snapshot` | Restore drive to a snapshot. Creates a 'Restored' folder with snapshot contents. |
| `POST` | `/admin/dlp-rules` | `create_dlp_rule` | — |
| `GET` | `/admin/dlp-rules` | `list_dlp_rules` | — |
| `DELETE` | `/admin/dlp-rules/{rule_id}` | `delete_dlp_rule` | — |
| `GET` | `/admin/dlp-violations` | `list_dlp_violations` | List recent DLP violations. |
| `GET` | `/admin/ediscovery/search` | `ediscovery_search` | Cross-user file search for legal/compliance. Admin only. |
| `POST` | `/admin/ediscovery/hold/{file_id}` | `toggle_legal_hold` | Place or remove a legal hold on a file. |
| `GET` | `/admin/ransomware-status` | `ransomware_status` | Check for recent anomalous activity that may indicate ransomware. |
| `GET` | `/analytics/storage-trends` | `storage_trends` | Storage usage trends over time from snapshot data. |
| `GET` | `/analytics/user-activity` | `user_activity_analytics` | User activity breakdown by action type. |
| `GET` | `/analytics/file-lifecycle` | `file_lifecycle_analytics` | Find stale files (not accessed in 90 days) and never-accessed files. |
| `GET` | `/admin/ediscovery/export` | `ediscovery_export_zip` | Export all files matching eDiscovery criteria as a ZIP archive with audit man... |
| `POST` | `/files/{file_id}/notify-share` | `notify_share` | Send a Drive share notification to a specific user. |
| `POST` | `/files/{file_id}/version-comment` | `add_version_comment` | Attach a textual comment/annotation to a specific MinIO version ID. |

### `POST /files/{file_id}/comments`

**Function:** `create_comment_with_mentions` (line 71)

Create a comment with @mention parsing and notification trigger.

**Parameters:** `file_id`, `body`

**Auth:** `user`


### `PUT /comments/{comment_id}/resolve`

**Function:** `resolve_comment` (line 114)

Mark a comment thread as resolved.

**Parameters:** `comment_id`

**Auth:** `user`


### `GET /files/{file_id}/comments/threaded`

**Function:** `get_threaded_comments` (line 130)

Get all comments for a file organized as threads.

**Parameters:** `file_id`

**Auth:** `user`


### `GET /files/{file_id}/presence`

**Function:** `get_file_presence` (line 226)

Get who is currently viewing/editing a file.

**Parameters:** `file_id`

**Auth:** `user`


### `POST /file-requests`

**Function:** `create_file_request` (line 248)

Create a file request with a public upload link.

**Parameters:** `body`

**Auth:** `user`


### `GET /file-requests`

**Function:** `list_file_requests` (line 278)

List all file requests created by the current user.

**Auth:** `user`


### `GET /file-requests/{token}/info`

**Function:** `get_file_request_info` (line 308)

Public endpoint to get file request details (no auth required).

**Parameters:** `token`


### `DELETE /file-requests/{request_id}`

**Function:** `deactivate_file_request` (line 330)

Deactivate a file request.

**Parameters:** `request_id`

**Auth:** `user`


### `GET /file-requests/{request_id}/submissions`

**Function:** `list_submissions` (line 346)

List all submissions for a file request.

**Parameters:** `request_id`

**Auth:** `user`


### `GET /sharing-analytics`

**Function:** `sharing_analytics` (line 381)

Sharing analytics: access heatmap, download trends, top shared files.

**Parameters:** `days`

**Auth:** `user`


### `POST /webhooks`

**Function:** `create_webhook` (line 463)

Register a webhook for Drive events.

**Parameters:** `body`

**Auth:** `user`


### `GET /webhooks`

**Function:** `list_webhooks` (line 477)

List all webhooks for the current user.

**Auth:** `user`


### `DELETE /webhooks/{webhook_id}`

**Function:** `delete_webhook` (line 499)

**Parameters:** `webhook_id`

**Auth:** `user`


### `GET /webhooks/{webhook_id}/deliveries`

**Function:** `list_webhook_deliveries` (line 508)

List recent delivery attempts for a webhook.

**Parameters:** `webhook_id`

**Auth:** `user`


### `POST /api-keys`

**Function:** `create_api_key` (line 543)

Generate a new API key. The raw key is only shown once.

**Parameters:** `body`

**Auth:** `user`


### `GET /api-keys`

**Function:** `list_api_keys` (line 569)

**Auth:** `user`


### `DELETE /api-keys/{key_id}`

**Function:** `revoke_api_key` (line 591)

**Parameters:** `key_id`

**Auth:** `user`


### `POST /templates`

**Function:** `create_template` (line 617)

**Parameters:** `body`

**Auth:** `user`


### `GET /templates`

**Function:** `list_templates` (line 634)

**Parameters:** `category`

**Auth:** `user`


### `POST /templates/{template_id}/use`

**Function:** `use_template` (line 665)

Create a new file from a template by copying from MinIO.

**Parameters:** `template_id`, `folder_id`, `file_name`

**Auth:** `user`


### `DELETE /templates/{template_id}`

**Function:** `delete_template` (line 709)

**Parameters:** `template_id`

**Auth:** `user`


### `GET /vault`

**Function:** `get_vault_status` (line 729)

Get or create the user's personal vault.

**Auth:** `user`


### `POST /vault/unlock`

**Function:** `unlock_vault` (line 760)

Unlock the vault with the user's password (re-authentication).

**Parameters:** `body`

**Auth:** `user`


### `POST /vault/lock`

**Function:** `lock_vault` (line 786)

**Auth:** `user`


### `GET /snapshots`

**Function:** `list_snapshots` (line 800)

List available drive snapshots for restoration.

**Auth:** `user`


### `POST /snapshots/{snapshot_id}/restore`

**Function:** `restore_snapshot` (line 823)

Restore drive to a snapshot. Creates a 'Restored' folder with snapshot contents.

**Parameters:** `snapshot_id`

**Auth:** `user`


### `POST /admin/dlp-rules`

**Function:** `create_dlp_rule` (line 885)

**Parameters:** `body`

**Auth:** `user`


### `GET /admin/dlp-rules`

**Function:** `list_dlp_rules` (line 902)

**Auth:** `user`


### `DELETE /admin/dlp-rules/{rule_id}`

**Function:** `delete_dlp_rule` (line 921)

**Parameters:** `rule_id`

**Auth:** `user`


### `GET /admin/dlp-violations`

**Function:** `list_dlp_violations` (line 928)

List recent DLP violations.

**Parameters:** `days`

**Auth:** `user`


### `GET /admin/ediscovery/search`

**Function:** `ediscovery_search` (line 965)

Cross-user file search for legal/compliance. Admin only.

**Parameters:** `query`, `owner_id`, `content_type`, `date_from`, `date_to`, `sensitivity`, `limit`

**Auth:** `user`


### `POST /admin/ediscovery/hold/{file_id}`

**Function:** `toggle_legal_hold` (line 1016)

Place or remove a legal hold on a file.

**Parameters:** `file_id`, `hold`

**Auth:** `user`


### `GET /admin/ransomware-status`

**Function:** `ransomware_status` (line 1046)

Check for recent anomalous activity that may indicate ransomware.

**Auth:** `user`


### `GET /analytics/storage-trends`

**Function:** `storage_trends` (line 1086)

Storage usage trends over time from snapshot data.

**Parameters:** `days`

**Auth:** `user`


### `GET /analytics/user-activity`

**Function:** `user_activity_analytics` (line 1110)

User activity breakdown by action type.

**Parameters:** `days`

**Auth:** `user`


### `GET /analytics/file-lifecycle`

**Function:** `file_lifecycle_analytics` (line 1130)

Find stale files (not accessed in 90 days) and never-accessed files.

**Auth:** `user`


### `GET /admin/ediscovery/export`

**Function:** `ediscovery_export_zip` (line 1182)

Export all files matching eDiscovery criteria as a ZIP archive with audit manifest.

**Parameters:** `query`, `owner_id`, `content_type`, `date_from`, `date_to`, `sensitivity`

**Auth:** `_admin`


### `POST /files/{file_id}/notify-share`

**Function:** `notify_share` (line 1280)

Send a Drive share notification to a specific user.

**Parameters:** `file_id`, `recipient_id`, `permission`

**Auth:** `user`


### `POST /files/{file_id}/version-comment`

**Function:** `add_version_comment` (line 1304)

Attach a textual comment/annotation to a specific MinIO version ID.

**Parameters:** `file_id`, `version_id`, `comment`

**Auth:** `user`


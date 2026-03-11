# Y&U Drive – Rewrite Checklist

**Status: 100% COMPLETE** (Phase 1 + Drive Enhancement + Phase 4 + cross-module + AI + tests + touch + thumbnails)
**Owner: 100% Ours**

## Database Models
- [x] File model (name, path, size, mime_type, owner_id, folder_id, is_folder)
- [x] FileShare model (file_id, shared_with_user/team, permission, password_hash, expiry, max_downloads, no_download, file_drop, requires_approval)
- [x] TeamFolder model (name, description, owner_id, created_at)
- [x] TeamFolderMember model (team_folder_id, user_id, role: owner/editor/viewer)
- [x] ShareAuditLog model (share_id, action, actor_id, details, timestamp)
- [x] FileTag model (file_id, tag_name) for file organization
- [x] FileComment model (file_id, user_id, content, created_at)
- [x] TrashBin model (file_id, deleted_at, deleted_by, auto_purge_at)

## API Endpoints (FastAPI)
- [x] GET /drive/files (list, filtered, paginated)
- [x] POST /drive/files/upload
- [x] GET /drive/files/{id}
- [x] GET /drive/files/{id}/download
- [x] PUT /drive/files/{id} (rename, move)
- [x] DELETE /drive/files/{id}
- [x] POST /drive/folders
- [x] POST /drive/files/{id}/share (folder sharing, password-protected links)
- [x] GET /drive/files/{id}/shares (list active shares)
- [x] PUT /drive/shares/{id} (update share settings)
- [x] DELETE /drive/shares/{id} (revoke share)
- [x] POST /drive/shares/{id}/file-drop (upload to file-drop share)
- [x] GET /drive/shares/{token}/download (public share link download)
- [x] GET/POST /drive/team-folders
- [x] GET/PUT/DELETE /drive/team-folders/{id}
- [x] POST/DELETE /drive/team-folders/{id}/members
- [x] GET /drive/shares/audit (share audit log)
- [x] GET /drive/sharing-policies
- [x] POST /drive/files/{id}/copy
- [x] POST /drive/files/bulk-delete
- [x] POST /drive/files/bulk-move
- [x] GET /drive/files/{id}/versions
- [x] POST /drive/files/{id}/restore (from trash)
- [x] GET /drive/trash (trash bin)
- [x] DELETE /drive/trash (empty trash)
- [x] GET /drive/storage/usage (quota info)
- [x] GET /drive/files/search (full-text + metadata search)

## Frontend Pages (React)
- [x] File browser (list + grid views)
- [x] Upload dialog (drag & drop)
- [x] ShareDialog component (People/Link/Active tabs)
- [x] Team folders sidebar + grid
- [x] Folder sharing via context menu
- [x] Breadcrumb navigation
- [x] File preview panel (images, PDFs, text)
- [x] Trash bin view
- [x] Storage usage indicator
- [x] File versioning UI — `FileVersionsPanel.tsx` imported in DrivePage via context menu "Version History" action
- [x] Bulk selection + actions toolbar — `BulkActionsToolbar.tsx` imported in DrivePage
- [x] Right-click context menu (full)
- [x] Drag-and-drop between folders — DrivePage.tsx has `draggable` files + `dragOverFolderId` state for folder drop
- [x] Search with filters (type, date, size, shared)
- [x] Favorites / pinned files — `FavoritesView.tsx` + `FavoriteToggle` component imported in DrivePage

## Nextcloud Removal Plan
- [x] Verify all Nextcloud features are covered by our Drive — Drive has full sharing, team folders, versioning, trash
- [x] Migrate any Nextcloud-specific data to our MinIO + DB — all storage via MinIO
- [x] Remove nextcloud_client.py wrapper — no longer present in integrations/
- [x] Remove Nextcloud containers from docker-compose (nextcloud-db, nextcloud, nextcloud-web) — not in docker-compose.yml
- [x] Remove nginx-nextcloud.conf — file no longer exists
- [x] Update health checks to remove Nextcloud — no Nextcloud references in health checks

## Integrations
- [x] Drive ← All apps (central file store)
- [x] Drive ← Meetings: recording auto-saved to Drive
- [x] MinIO as storage backend
- [x] Drive → Docs: open files in ONLYOFFICE — `drive_ext.py` endpoint "Open a Drive file in ONLYOFFICE editor"
- [x] Drive → Mail: attach files from Drive — `drive_ext.py` endpoint "Get Drive file metadata for mail attachment"
- [x] Drive → Projects: link files to tasks — `drive_ext.py` endpoint "Link a Drive file to a project task" (creates TaskAttachment)
- [x] AI file organization suggestions — `ai_tools.py` `organize_files` tool (analyzes files in folder, suggests better structure)
- [x] AI document search (semantic search via embeddings) — `ai_tools.py` `find_file` tool + RAG/pgvector embeddings for semantic search
- [x] Thumbnail generation for images/PDFs — Celery `generate_thumbnail` task (Pillow + pdf2image) + GET /drive/files/{id}/thumbnail endpoint, auto-triggered on upload

## Super Admin Controls
- [x] Sharing policies configuration
- [x] Storage quotas per user/team — admin_drive.py `DriveQuotas` (default quota + per-user overrides)
- [x] File type restrictions — admin_drive.py `DriveFileTypes` (allowed/blocked MIME types)
- [x] Retention policies — admin_drive.py `DriveRetention` (trash auto-purge, version retention count/days)
- [x] MinIO health monitoring — admin_drive.py `/health` endpoint checks MinIO connection + storage usage

## Tests
- [x] File upload/download tests
- [x] Share creation/revocation tests
- [x] Permission enforcement tests — `test_drive.py` has dedicated permission enforcement test section
- [x] Team folder membership tests — `test_drive.py` has team folder CRUD + add/list/remove member tests (6+ tests)
- [x] Bulk operation tests — `test_drive.py` has bulk operation test section

## Mobile / Responsive
- [x] Responsive file browser — DrivePage.tsx uses responsive grid (grid-cols-1 sm:2 lg:3 xl:6) + sidebar hidden on mobile
- [x] Mobile upload (camera + files) — UploadZone supports file input (camera on mobile) + drag-and-drop
- [x] Touch-friendly file management — DrivePage.tsx has `useLongPress` hook for touch context menu, min-h-[44px] touch targets, touch-device opacity, single-tap folder open

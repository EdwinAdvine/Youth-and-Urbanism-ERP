# Collaboration — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 8


## Contents

- [collab.py](#collab) (8 endpoints)

---

## collab.py

Y&U Notes real-time collaboration: WebSocket Yjs sync, comments, and versions.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/presence/{note_id}` | `get_presence` | Return list of users currently editing a note. |
| `GET` | `/comments/{note_id}` | `list_comments` | — |
| `POST` | `/comments/{note_id}` | `create_comment` | — |
| `PATCH` | `/comments/{note_id}/{comment_id}/resolve` | `resolve_comment` | — |
| `DELETE` | `/comments/{note_id}/{comment_id}` | `delete_comment` | — |
| `GET` | `/versions/{note_id}` | `list_versions` | — |
| `POST` | `/versions/{note_id}` | `create_version` | — |
| `POST` | `/versions/{note_id}/{version_id}/restore` | `restore_version` | — |

### `GET /presence/{note_id}`

**Function:** `get_presence` (line 194)

Return list of users currently editing a note.

**Parameters:** `note_id`

**Auth:** `user`


### `GET /comments/{note_id}`

**Function:** `list_comments` (line 224)

**Parameters:** `note_id`

**Auth:** `user`


### `POST /comments/{note_id}`

**Function:** `create_comment` (line 252)

**Parameters:** `note_id`, `body`

**Response model:** `CommentOut`

**Auth:** `user`


### `PATCH /comments/{note_id}/{comment_id}/resolve`

**Function:** `resolve_comment` (line 281)

**Parameters:** `note_id`, `comment_id`

**Auth:** `user`


### `DELETE /comments/{note_id}/{comment_id}`

**Function:** `delete_comment` (line 293)

**Parameters:** `note_id`, `comment_id`

**Auth:** `user`


### `GET /versions/{note_id}`

**Function:** `list_versions` (line 318)

**Parameters:** `note_id`

**Auth:** `user`


### `POST /versions/{note_id}`

**Function:** `create_version` (line 348)

**Parameters:** `note_id`, `body`

**Response model:** `VersionOut`

**Auth:** `user`


### `POST /versions/{note_id}/{version_id}/restore`

**Function:** `restore_version` (line 387)

**Parameters:** `note_id`, `version_id`

**Auth:** `user`


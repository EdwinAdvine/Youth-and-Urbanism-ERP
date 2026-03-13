# Handbook — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 24


## Contents

- [handbook.py](#handbook) (24 endpoints)

---

## handbook.py

Handbook API — categories, articles, search, feedback, progress, and admin.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/categories` | `list_categories` | — |
| `GET` | `/categories/{slug}` | `get_category` | — |
| `GET` | `/articles` | `list_articles` | — |
| `GET` | `/articles/{slug}` | `get_article` | — |
| `GET` | `/articles/{article_id}/related` | `get_related_articles` | — |
| `GET` | `/search` | `search_articles` | — |
| `POST` | `/articles/{article_id}/feedback` | `submit_feedback` | — |
| `POST` | `/articles/{article_id}/mark-read` | `mark_article_read` | — |
| `DELETE` | `/articles/{article_id}/mark-read` | `unmark_article_read` | — |
| `GET` | `/progress` | `get_progress` | — |
| `GET` | `/getting-started` | `getting_started` | — |
| `POST` | `/admin/categories` | `admin_create_category` | — |
| `PUT` | `/admin/categories/{cat_id}` | `admin_update_category` | — |
| `DELETE` | `/admin/categories/{cat_id}` | `admin_delete_category` | — |
| `PUT` | `/admin/categories/reorder` | `admin_reorder_categories` | — |
| `POST` | `/admin/articles` | `admin_create_article` | — |
| `PUT` | `/admin/articles/{article_id}` | `admin_update_article` | — |
| `DELETE` | `/admin/articles/{article_id}` | `admin_delete_article` | — |
| `PUT` | `/admin/articles/reorder` | `admin_reorder_articles` | — |
| `POST` | `/admin/articles/{article_id}/publish` | `admin_publish_article` | — |
| `POST` | `/admin/articles/{article_id}/archive` | `admin_archive_article` | — |
| `POST` | `/admin/articles/{article_id}/upload-media` | `admin_upload_media` | — |
| `GET` | `/admin/analytics` | `admin_analytics` | — |
| `GET` | `/admin/analytics/articles/{article_id}` | `admin_article_analytics` | — |

### `GET /categories`

**Function:** `list_categories` (line 189)

**Auth:** `current_user`


### `GET /categories/{slug}`

**Function:** `get_category` (line 205)

**Parameters:** `slug`, `page`, `limit`

**Auth:** `current_user`


### `GET /articles`

**Function:** `list_articles` (line 246)

**Parameters:** `page`, `limit`, `category`, `module`, `tag`, `article_type`

**Auth:** `current_user`


### `GET /articles/{slug}`

**Function:** `get_article` (line 292)

**Parameters:** `slug`

**Auth:** `current_user`


### `GET /articles/{article_id}/related`

**Function:** `get_related_articles` (line 324)

**Parameters:** `article_id`, `limit`

**Auth:** `current_user`


### `GET /search`

**Function:** `search_articles` (line 359)

**Parameters:** `q`, `module`, `page`, `limit`

**Auth:** `current_user`


### `POST /articles/{article_id}/feedback`

**Function:** `submit_feedback` (line 399)

**Parameters:** `article_id`, `payload`

**Auth:** `current_user`


### `POST /articles/{article_id}/mark-read`

**Function:** `mark_article_read` (line 452)

**Parameters:** `article_id`

**Auth:** `current_user`


### `DELETE /articles/{article_id}/mark-read`

**Function:** `unmark_article_read` (line 481)

**Parameters:** `article_id`

**Auth:** `current_user`


### `GET /progress`

**Function:** `get_progress` (line 500)

**Auth:** `current_user`


### `GET /getting-started`

**Function:** `getting_started` (line 524)

**Auth:** `current_user`


### `POST /admin/categories`

**Function:** `admin_create_category` (line 545)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /admin/categories/{cat_id}`

**Function:** `admin_update_category` (line 563)

**Parameters:** `cat_id`, `payload`

**Auth:** `current_user`


### `DELETE /admin/categories/{cat_id}`

**Function:** `admin_delete_category` (line 591)

**Parameters:** `cat_id`

**Auth:** `current_user`


### `PUT /admin/categories/reorder`

**Function:** `admin_reorder_categories` (line 611)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /admin/articles`

**Function:** `admin_create_article` (line 632)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /admin/articles/{article_id}`

**Function:** `admin_update_article` (line 658)

**Parameters:** `article_id`, `payload`

**Auth:** `current_user`


### `DELETE /admin/articles/{article_id}`

**Function:** `admin_delete_article` (line 693)

**Parameters:** `article_id`

**Auth:** `current_user`


### `PUT /admin/articles/reorder`

**Function:** `admin_reorder_articles` (line 713)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /admin/articles/{article_id}/publish`

**Function:** `admin_publish_article` (line 734)

**Parameters:** `article_id`

**Auth:** `current_user`


### `POST /admin/articles/{article_id}/archive`

**Function:** `admin_archive_article` (line 755)

**Parameters:** `article_id`

**Auth:** `current_user`


### `POST /admin/articles/{article_id}/upload-media`

**Function:** `admin_upload_media` (line 776)

**Parameters:** `article_id`, `file`

**Auth:** `current_user`


### `GET /admin/analytics`

**Function:** `admin_analytics` (line 808)

**Parameters:** `days`

**Auth:** `current_user`


### `GET /admin/analytics/articles/{article_id}`

**Function:** `admin_article_analytics` (line 880)

**Parameters:** `article_id`, `days`

**Auth:** `current_user`


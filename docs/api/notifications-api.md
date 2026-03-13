# Notifications — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 6


## Contents

- [notifications.py](#notifications) (6 endpoints)

---

## notifications.py


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `` | `list_notifications` | List notifications for the current user. |
| `GET` | `/unread-count` | `unread_count` | Return the number of unread notifications for the current user. |
| `PUT` | `/read-all` | `mark_all_read` | Mark every notification for the current user as read. |
| `PUT` | `/{notification_id}/read` | `mark_read` | Mark a single notification as read. |
| `POST` | `/test` | `create_test_notification` | Create a test notification for the current user (useful for verifying the sys... |
| `DELETE` | `/{notification_id}` | `delete_notification` | Delete a notification owned by the current user. |

### `GET `

**Function:** `list_notifications` (line 40)

List notifications for the current user.

**Parameters:** `is_read`, `skip`, `limit`

**Auth:** `current_user`


### `GET /unread-count`

**Function:** `unread_count` (line 68)

Return the number of unread notifications for the current user.

**Response model:** `UnreadCountOut`

**Auth:** `current_user`


### `PUT /read-all`

**Function:** `mark_all_read` (line 82)

Mark every notification for the current user as read.

**Auth:** `current_user`


### `PUT /{notification_id}/read`

**Function:** `mark_read` (line 101)

Mark a single notification as read.

**Parameters:** `notification_id`

**Response model:** `NotificationOut`

**Auth:** `current_user`


### `POST /test`

**Function:** `create_test_notification` (line 128)

Create a test notification for the current user (useful for verifying the system).

**Response model:** `NotificationOut`

**Auth:** `current_user`


### `DELETE /{notification_id}`

**Function:** `delete_notification` (line 148)

Delete a notification owned by the current user.

**Parameters:** `notification_id`

**Auth:** `current_user`


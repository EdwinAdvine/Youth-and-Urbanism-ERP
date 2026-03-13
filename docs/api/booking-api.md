# Booking — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 9


## Contents

- [booking.py](#booking) (9 endpoints)

---

## booking.py

Booking pages API — public scheduling links (Calendly-style).


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/pages` | `list_booking_pages` | — |
| `POST` | `/pages` | `create_booking_page` | — |
| `PUT` | `/pages/{page_id}` | `update_booking_page` | — |
| `DELETE` | `/pages/{page_id}` | `delete_booking_page` | — |
| `GET` | `/public/{slug}` | `get_public_booking_page` | — |
| `GET` | `/public/{slug}/available-slots` | `get_available_slots` | — |
| `POST` | `/public/{slug}/book` | `book_slot` | — |
| `GET` | `/pages/{page_id}/slots` | `list_booking_slots` | — |
| `POST` | `/slots/{slot_id}/cancel` | `cancel_booking` | — |

### `GET /pages`

**Function:** `list_booking_pages` (line 113)

**Auth:** `current_user`


### `POST /pages`

**Function:** `create_booking_page` (line 124)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /pages/{page_id}`

**Function:** `update_booking_page` (line 158)

**Parameters:** `page_id`, `payload`

**Auth:** `current_user`


### `DELETE /pages/{page_id}`

**Function:** `delete_booking_page` (line 180)

**Parameters:** `page_id`

**Auth:** `current_user`


### `GET /public/{slug}`

**Function:** `get_public_booking_page` (line 193)

**Parameters:** `slug`


### `GET /public/{slug}/available-slots`

**Function:** `get_available_slots` (line 202)

**Parameters:** `slug`, `date`


### `POST /public/{slug}/book`

**Function:** `book_slot` (line 270)

**Parameters:** `slug`, `payload`


### `GET /pages/{page_id}/slots`

**Function:** `list_booking_slots` (line 329)

**Parameters:** `page_id`, `status_filter`

**Auth:** `current_user`


### `POST /slots/{slot_id}/cancel`

**Function:** `cancel_booking` (line 348)

**Parameters:** `slot_id`, `reason`

**Auth:** `current_user`


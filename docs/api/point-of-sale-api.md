# Point of Sale — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 101


## Contents

- [kds.py](#kds) (14 endpoints)
- [loyalty.py](#loyalty) (17 endpoints)
- [pos.py](#pos) (26 endpoints)
- [pos_ext.py](#pos-ext) (35 endpoints)
- [pos_loyalty.py](#pos-loyalty) (9 endpoints)

---

## kds.py

KDS API — Kitchen Display System: stations, orders, order items, real-time WebSocket.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/stations` | `create_station` | — |
| `GET` | `/stations` | `list_stations` | — |
| `GET` | `/stations/{station_id}` | `get_station` | — |
| `PUT` | `/stations/{station_id}` | `update_station` | — |
| `DELETE` | `/stations/{station_id}` | `delete_station` | — |
| `GET` | `/stations/{station_id}/orders` | `list_station_orders` | — |
| `POST` | `/orders` | `create_order` | — |
| `GET` | `/orders/{order_id}` | `get_order` | — |
| `POST` | `/orders/{order_id}/start` | `start_order` | — |
| `POST` | `/orders/{order_id}/ready` | `ready_order` | — |
| `POST` | `/orders/{order_id}/served` | `served_order` | — |
| `POST` | `/orders/{order_id}/cancel` | `cancel_order` | — |
| `POST` | `/orders/{order_id}/items/{item_id}/cooking` | `item_cooking` | — |
| `POST` | `/orders/{order_id}/items/{item_id}/ready` | `item_ready` | — |

### `POST /stations`

**Function:** `create_station` (line 166)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /stations`

**Function:** `list_stations` (line 184)

**Parameters:** `warehouse_id`

**Auth:** `current_user`


### `GET /stations/{station_id}`

**Function:** `get_station` (line 199)

**Parameters:** `station_id`

**Auth:** `current_user`


### `PUT /stations/{station_id}`

**Function:** `update_station` (line 211)

**Parameters:** `station_id`, `payload`

**Auth:** `current_user`


### `DELETE /stations/{station_id}`

**Function:** `delete_station` (line 230)

**Parameters:** `station_id`

**Auth:** `current_user`


### `GET /stations/{station_id}/orders`

**Function:** `list_station_orders` (line 245)

**Parameters:** `station_id`

**Auth:** `current_user`


### `POST /orders`

**Function:** `create_order` (line 259)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /orders/{order_id}`

**Function:** `get_order` (line 302)

**Parameters:** `order_id`

**Auth:** `current_user`


### `POST /orders/{order_id}/start`

**Function:** `start_order` (line 319)

**Parameters:** `order_id`

**Auth:** `current_user`


### `POST /orders/{order_id}/ready`

**Function:** `ready_order` (line 349)

**Parameters:** `order_id`

**Auth:** `current_user`


### `POST /orders/{order_id}/served`

**Function:** `served_order` (line 381)

**Parameters:** `order_id`

**Auth:** `current_user`


### `POST /orders/{order_id}/cancel`

**Function:** `cancel_order` (line 410)

**Parameters:** `order_id`

**Auth:** `current_user`


### `POST /orders/{order_id}/items/{item_id}/cooking`

**Function:** `item_cooking` (line 441)

**Parameters:** `order_id`, `item_id`

**Auth:** `current_user`


### `POST /orders/{order_id}/items/{item_id}/ready`

**Function:** `item_ready` (line 477)

**Parameters:** `order_id`, `item_id`

**Auth:** `current_user`


---

## loyalty.py

Loyalty Program API — Programs, Tiers, Members, Points, Rewards.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/programs` | `create_program` | — |
| `GET` | `/programs` | `list_programs` | — |
| `GET` | `/programs/{program_id}` | `get_program` | — |
| `PUT` | `/programs/{program_id}` | `update_program` | — |
| `POST` | `/programs/{program_id}/tiers` | `create_tier` | — |
| `PUT` | `/tiers/{tier_id}` | `update_tier` | — |
| `DELETE` | `/tiers/{tier_id}` | `delete_tier` | — |
| `POST` | `/members` | `enroll_member` | — |
| `GET` | `/members` | `list_members` | — |
| `GET` | `/members/by-customer/{customer_id}` | `get_member_by_customer` | — |
| `GET` | `/members/{member_id}` | `get_member` | — |
| `POST` | `/members/{member_id}/earn` | `earn_points` | — |
| `POST` | `/members/{member_id}/redeem` | `redeem_points` | — |
| `POST` | `/programs/{program_id}/rewards` | `create_reward` | — |
| `GET` | `/programs/{program_id}/rewards` | `list_rewards` | — |
| `PUT` | `/rewards/{reward_id}` | `update_reward` | — |
| `DELETE` | `/rewards/{reward_id}` | `delete_reward` | — |

### `POST /programs`

**Function:** `create_program` (line 190)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /programs`

**Function:** `list_programs` (line 208)

**Parameters:** `is_active`

**Auth:** `current_user`


### `GET /programs/{program_id}`

**Function:** `get_program` (line 223)

**Parameters:** `program_id`

**Auth:** `current_user`


### `PUT /programs/{program_id}`

**Function:** `update_program` (line 252)

**Parameters:** `program_id`, `payload`

**Auth:** `current_user`


### `POST /programs/{program_id}/tiers`

**Function:** `create_tier` (line 274)

**Parameters:** `program_id`, `payload`

**Auth:** `current_user`


### `PUT /tiers/{tier_id}`

**Function:** `update_tier` (line 299)

**Parameters:** `tier_id`, `payload`

**Auth:** `current_user`


### `DELETE /tiers/{tier_id}`

**Function:** `delete_tier` (line 319)

**Parameters:** `tier_id`

**Auth:** `current_user`


### `POST /members`

**Function:** `enroll_member` (line 343)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /members`

**Function:** `list_members` (line 388)

**Parameters:** `program_id`

**Auth:** `current_user`


### `GET /members/by-customer/{customer_id}`

**Function:** `get_member_by_customer` (line 409)

**Parameters:** `customer_id`

**Auth:** `current_user`


### `GET /members/{member_id}`

**Function:** `get_member` (line 432)

**Parameters:** `member_id`

**Auth:** `current_user`


### `POST /members/{member_id}/earn`

**Function:** `earn_points` (line 467)

**Parameters:** `member_id`, `payload`

**Auth:** `current_user`


### `POST /members/{member_id}/redeem`

**Function:** `redeem_points` (line 506)

**Parameters:** `member_id`, `payload`

**Auth:** `current_user`


### `POST /programs/{program_id}/rewards`

**Function:** `create_reward` (line 561)

**Parameters:** `program_id`, `payload`

**Auth:** `current_user`


### `GET /programs/{program_id}/rewards`

**Function:** `list_rewards` (line 587)

**Parameters:** `program_id`, `is_active`

**Auth:** `current_user`


### `PUT /rewards/{reward_id}`

**Function:** `update_reward` (line 603)

**Parameters:** `reward_id`, `payload`

**Auth:** `current_user`


### `DELETE /rewards/{reward_id}`

**Function:** `delete_reward` (line 623)

**Parameters:** `reward_id`

**Auth:** `current_user`


---

## pos.py

POS API — Sessions, Transactions, Products, Dashboard.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/sessions/open` | `open_session` | — |
| `POST` | `/sessions/{session_id}/close` | `close_session` | — |
| `GET` | `/sessions` | `list_sessions` | — |
| `GET` | `/sessions/active` | `get_active_session` | — |
| `GET` | `/sessions/{session_id}` | `get_session` | — |
| `GET` | `/sessions/{session_id}/reconciliation` | `session_reconciliation` | — |
| `GET` | `/sessions/{session_id}/export` | `export_session` | — |
| `POST` | `/transactions` | `create_transaction` | Core POS sale: validates stock, creates transaction + lines + payments, |
| `GET` | `/transactions` | `list_transactions` | — |
| `GET` | `/transactions/{txn_id}` | `get_transaction` | — |
| `POST` | `/transactions/{txn_id}/refund` | `refund_transaction` | — |
| `POST` | `/transactions/{txn_id}/void` | `void_transaction` | — |
| `GET` | `/transactions/{txn_id}/receipt` | `get_receipt` | — |
| `GET` | `/products` | `list_products` | Return inventory items with their stock levels for the POS product grid. |
| `GET` | `/products/search` | `search_products` | — |
| `GET` | `/dashboard/stats` | `pos_dashboard` | — |
| `POST` | `/transactions/hold` | `hold_transaction` | Create a held transaction and reserve stock for each line item. |
| `GET` | `/transactions/held` | `list_held_transactions` | — |
| `POST` | `/transactions/{txn_id}/resume` | `resume_held_transaction` | — |
| `POST` | `/transactions/{txn_id}/cancel-hold` | `cancel_held_transaction` | — |
| `POST` | `/products/quick-add` | `quick_add_product` | — |
| `GET` | `/products/{item_id}/variants` | `get_product_variants` | — |
| `GET` | `/products/{item_id}/modifiers` | `get_product_modifiers` | — |
| `GET` | `/reports/tips` | `tips_report` | — |
| `GET` | `/products/rfid/{tag}` | `lookup_product_by_rfid` | Look up a product by its RFID tag. |
| `POST` | `/customer-display/{terminal_id}/push` | `push_customer_display` | Push a display update from the cashier's POS to the customer screen. |

### `POST /sessions/open`

**Function:** `open_session` (line 190)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /sessions/{session_id}/close`

**Function:** `close_session` (line 233)

**Parameters:** `session_id`, `payload`

**Auth:** `current_user`


### `GET /sessions`

**Function:** `list_sessions` (line 295)

**Parameters:** `status_filter`, `skip`, `limit`

**Auth:** `current_user`


### `GET /sessions/active`

**Function:** `get_active_session` (line 321)

**Auth:** `current_user`


### `GET /sessions/{session_id}`

**Function:** `get_session` (line 332)

**Parameters:** `session_id`

**Auth:** `current_user`


### `GET /sessions/{session_id}/reconciliation`

**Function:** `session_reconciliation` (line 344)

**Parameters:** `session_id`

**Auth:** `current_user`


### `GET /sessions/{session_id}/export`

**Function:** `export_session` (line 394)

**Parameters:** `session_id`

**Auth:** `current_user`


### `POST /transactions`

**Function:** `create_transaction` (line 432)

Core POS sale: validates stock, creates transaction + lines + payments,
issues stock movements, auto-creates a Finance Invoice + Payment, publishes event.

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /transactions`

**Function:** `list_transactions` (line 716)

**Parameters:** `session_id`, `status_filter`, `skip`, `limit`

**Auth:** `current_user`


### `GET /transactions/{txn_id}`

**Function:** `get_transaction` (line 745)

**Parameters:** `txn_id`

**Auth:** `current_user`


### `POST /transactions/{txn_id}/refund`

**Function:** `refund_transaction` (line 762)

**Parameters:** `txn_id`

**Auth:** `current_user`


### `POST /transactions/{txn_id}/void`

**Function:** `void_transaction` (line 833)

**Parameters:** `txn_id`

**Auth:** `current_user`


### `GET /transactions/{txn_id}/receipt`

**Function:** `get_receipt` (line 889)

**Parameters:** `txn_id`

**Auth:** `current_user`


### `GET /products`

**Function:** `list_products` (line 938)

Return inventory items with their stock levels for the POS product grid.

**Parameters:** `category`, `skip`, `limit`

**Auth:** `current_user`


### `GET /products/search`

**Function:** `search_products` (line 997)

**Parameters:** `q`

**Auth:** `current_user`


### `GET /dashboard/stats`

**Function:** `pos_dashboard` (line 1046)

**Auth:** `current_user`


### `POST /transactions/hold`

**Function:** `hold_transaction` (line 1121)

Create a held transaction and reserve stock for each line item.

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /transactions/held`

**Function:** `list_held_transactions` (line 1199)

**Parameters:** `session_id`

**Auth:** `current_user`


### `POST /transactions/{txn_id}/resume`

**Function:** `resume_held_transaction` (line 1218)

**Parameters:** `txn_id`

**Auth:** `current_user`


### `POST /transactions/{txn_id}/cancel-hold`

**Function:** `cancel_held_transaction` (line 1255)

**Parameters:** `txn_id`

**Auth:** `current_user`


### `POST /products/quick-add`

**Function:** `quick_add_product` (line 1300)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /products/{item_id}/variants`

**Function:** `get_product_variants` (line 1369)

**Parameters:** `item_id`

**Auth:** `current_user`


### `GET /products/{item_id}/modifiers`

**Function:** `get_product_modifiers` (line 1410)

**Parameters:** `item_id`

**Auth:** `current_user`


### `GET /reports/tips`

**Function:** `tips_report` (line 1457)

**Parameters:** `date_from`, `date_to`, `session_id`

**Auth:** `current_user`


### `GET /products/rfid/{tag}`

**Function:** `lookup_product_by_rfid` (line 1506)

Look up a product by its RFID tag.

**Parameters:** `tag`

**Auth:** `_user`


### `POST /customer-display/{terminal_id}/push`

**Function:** `push_customer_display` (line 1597)

Push a display update from the cashier's POS to the customer screen.

Expected payload examples::

    {"type": "cart_update", "items": [...], "subtotal": "12.50", "tax": "1.50"}
    {"type": "payment", "amount": "14.00", "method": "cash", "change": "6.00"}
    {"type": "idle"}

**Parameters:** `terminal_id`, `payload`

**Auth:** `current_user`


---

## pos_ext.py

POS Extensions — Terminals, Discounts, Receipts, Cash Movements, Reports, Offline Sync.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/terminals` | `list_terminals` | — |
| `POST` | `/terminals` | `create_terminal` | — |
| `PUT` | `/terminals/{terminal_id}` | `update_terminal` | — |
| `DELETE` | `/terminals/{terminal_id}` | `delete_terminal` | — |
| `POST` | `/sessions/{session_id}/close` | `close_session_ext` | — |
| `GET` | `/sessions/{session_id}/summary` | `session_summary` | — |
| `GET` | `/discounts` | `list_discounts` | — |
| `POST` | `/discounts` | `create_discount` | — |
| `PUT` | `/discounts/{discount_id}` | `update_discount` | — |
| `DELETE` | `/discounts/{discount_id}` | `delete_discount` | — |
| `POST` | `/transactions/{txn_id}/receipt` | `generate_receipt` | — |
| `POST` | `/transactions/{txn_id}/refund` | `refund_transaction_ext` | — |
| `POST` | `/cash-movements` | `create_cash_movement` | — |
| `GET` | `/sessions/{session_id}/cash-movements` | `list_cash_movements` | — |
| `GET` | `/reports/daily-sales` | `report_daily_sales` | — |
| `GET` | `/reports/by-cashier` | `report_by_cashier` | — |
| `GET` | `/reports/by-product` | `report_by_product` | — |
| `POST` | `/transactions/offline-sync` | `offline_sync` | Import a batch of transactions created while the POS was offline. |
| `POST` | `/products/sync-from-ecommerce` | `sync_from_ecommerce` | Pull published products from e-commerce and create inventory items + stock le... |
| `POST` | `/bundles` | `create_bundle` | — |
| `GET` | `/bundles` | `list_bundles` | — |
| `GET` | `/bundles/{bundle_id}` | `get_bundle` | — |
| `PUT` | `/bundles/{bundle_id}` | `update_bundle` | — |
| `DELETE` | `/bundles/{bundle_id}` | `delete_bundle` | — |
| `POST` | `/modifier-groups` | `create_modifier_group` | — |
| `GET` | `/modifier-groups` | `list_modifier_groups` | — |
| `PUT` | `/modifier-groups/{group_id}` | `update_modifier_group` | — |
| `DELETE` | `/modifier-groups/{group_id}` | `delete_modifier_group` | — |
| `POST` | `/products/{item_id}/modifier-groups/{group_id}` | `link_modifier_group_to_product` | — |
| `DELETE` | `/products/{item_id}/modifier-groups/{group_id}` | `unlink_modifier_group_from_product` | — |
| `GET` | `/sessions/{session_id}/x-reading` | `x_reading` | — |
| `GET` | `/sessions/{session_id}/z-reading` | `z_reading` | — |
| `GET` | `/reports/profitability` | `profitability_report` | — |
| `POST` | `/tips/pool` | `create_tip_pool` | — |
| `POST` | `/tips/{pool_id}/distribute` | `distribute_tip_pool` | — |

### `GET /terminals`

**Function:** `list_terminals` (line 176)

**Parameters:** `is_active`, `skip`, `limit`

**Auth:** `current_user`


### `POST /terminals`

**Function:** `create_terminal` (line 201)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /terminals/{terminal_id}`

**Function:** `update_terminal` (line 219)

**Parameters:** `terminal_id`, `payload`

**Auth:** `current_user`


### `DELETE /terminals/{terminal_id}`

**Function:** `delete_terminal` (line 239)

**Parameters:** `terminal_id`

**Auth:** `current_user`


### `POST /sessions/{session_id}/close`

**Function:** `close_session_ext` (line 254)

**Parameters:** `session_id`, `payload`

**Auth:** `current_user`


### `GET /sessions/{session_id}/summary`

**Function:** `session_summary` (line 337)

**Parameters:** `session_id`

**Auth:** `current_user`


### `GET /discounts`

**Function:** `list_discounts` (line 453)

**Parameters:** `is_active`, `skip`, `limit`

**Auth:** `current_user`


### `POST /discounts`

**Function:** `create_discount` (line 478)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /discounts/{discount_id}`

**Function:** `update_discount` (line 510)

**Parameters:** `discount_id`, `payload`

**Auth:** `current_user`


### `DELETE /discounts/{discount_id}`

**Function:** `delete_discount` (line 539)

**Parameters:** `discount_id`

**Auth:** `current_user`


### `POST /transactions/{txn_id}/receipt`

**Function:** `generate_receipt` (line 558)

**Parameters:** `txn_id`

**Auth:** `current_user`


### `POST /transactions/{txn_id}/refund`

**Function:** `refund_transaction_ext` (line 633)

**Parameters:** `txn_id`, `payload`

**Auth:** `current_user`


### `POST /cash-movements`

**Function:** `create_cash_movement` (line 724)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /sessions/{session_id}/cash-movements`

**Function:** `list_cash_movements` (line 755)

**Parameters:** `session_id`

**Auth:** `current_user`


### `GET /reports/daily-sales`

**Function:** `report_daily_sales` (line 785)

**Parameters:** `start_date`, `end_date`

**Auth:** `current_user`


### `GET /reports/by-cashier`

**Function:** `report_by_cashier` (line 831)

**Parameters:** `start_date`, `end_date`

**Auth:** `current_user`


### `GET /reports/by-product`

**Function:** `report_by_product` (line 881)

**Parameters:** `start_date`, `end_date`, `top_n`

**Auth:** `current_user`


### `POST /transactions/offline-sync`

**Function:** `offline_sync` (line 934)

Import a batch of transactions created while the POS was offline.

Each transaction is validated and imported independently. Failures for
individual transactions do not roll back the entire batch — results
are returned per-transaction so the client can retry failures.

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /products/sync-from-ecommerce`

**Function:** `sync_from_ecommerce` (line 1124)

Pull published products from e-commerce and create inventory items + stock levels for POS use.

Products that already have a linked inventory_item_id are skipped (already synced).

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /bundles`

**Function:** `create_bundle` (line 1240)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /bundles`

**Function:** `list_bundles` (line 1266)

**Parameters:** `active_only`

**Auth:** `current_user`


### `GET /bundles/{bundle_id}`

**Function:** `get_bundle` (line 1281)

**Parameters:** `bundle_id`

**Auth:** `current_user`


### `PUT /bundles/{bundle_id}`

**Function:** `update_bundle` (line 1293)

**Parameters:** `bundle_id`, `payload`

**Auth:** `current_user`


### `DELETE /bundles/{bundle_id}`

**Function:** `delete_bundle` (line 1327)

**Parameters:** `bundle_id`

**Auth:** `current_user`


### `POST /modifier-groups`

**Function:** `create_modifier_group` (line 1398)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /modifier-groups`

**Function:** `list_modifier_groups` (line 1425)

**Auth:** `current_user`


### `PUT /modifier-groups/{group_id}`

**Function:** `update_modifier_group` (line 1435)

**Parameters:** `group_id`, `payload`

**Auth:** `current_user`


### `DELETE /modifier-groups/{group_id}`

**Function:** `delete_modifier_group` (line 1470)

**Parameters:** `group_id`

**Auth:** `current_user`


### `POST /products/{item_id}/modifier-groups/{group_id}`

**Function:** `link_modifier_group_to_product` (line 1484)

**Parameters:** `item_id`, `group_id`

**Auth:** `current_user`


### `DELETE /products/{item_id}/modifier-groups/{group_id}`

**Function:** `unlink_modifier_group_from_product` (line 1507)

**Parameters:** `item_id`, `group_id`

**Auth:** `current_user`


### `GET /sessions/{session_id}/x-reading`

**Function:** `x_reading` (line 1556)

**Parameters:** `session_id`

**Auth:** `current_user`


### `GET /sessions/{session_id}/z-reading`

**Function:** `z_reading` (line 1565)

**Parameters:** `session_id`

**Auth:** `current_user`


### `GET /reports/profitability`

**Function:** `profitability_report` (line 1667)

**Parameters:** `date_from`, `date_to`, `group_by`, `limit_val`

**Auth:** `current_user`


### `POST /tips/pool`

**Function:** `create_tip_pool` (line 1776)

**Parameters:** `body`

**Response model:** `TipPoolOut`

**Auth:** `current_user`


### `POST /tips/{pool_id}/distribute`

**Function:** `distribute_tip_pool` (line 1799)

**Parameters:** `pool_id`, `body`

**Response model:** `TipPoolOut`

**Auth:** `current_user`


---

## pos_loyalty.py

POS Loyalty — Gift Cards & Store Credit endpoints.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/gift-cards` | `issue_gift_card` | — |
| `GET` | `/gift-cards` | `list_gift_cards` | — |
| `GET` | `/gift-cards/{card_number}` | `get_gift_card` | — |
| `POST` | `/gift-cards/{card_id}/load` | `load_gift_card` | — |
| `POST` | `/gift-cards/{card_id}/redeem` | `redeem_gift_card` | — |
| `PUT` | `/gift-cards/{card_id}/deactivate` | `deactivate_gift_card` | — |
| `GET` | `/store-credits/{customer_id}` | `get_store_credit` | — |
| `POST` | `/store-credits/{customer_id}/adjust` | `adjust_store_credit` | — |
| `GET` | `/store-credits/{customer_id}/transactions` | `list_store_credit_transactions` | — |

### `POST /gift-cards`

**Function:** `issue_gift_card` (line 103)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /gift-cards`

**Function:** `list_gift_cards` (line 141)

**Parameters:** `active_only`, `customer_id`

**Auth:** `current_user`


### `GET /gift-cards/{card_number}`

**Function:** `get_gift_card` (line 160)

**Parameters:** `card_number`

**Auth:** `current_user`


### `POST /gift-cards/{card_id}/load`

**Function:** `load_gift_card` (line 189)

**Parameters:** `card_id`, `payload`

**Auth:** `current_user`


### `POST /gift-cards/{card_id}/redeem`

**Function:** `redeem_gift_card` (line 219)

**Parameters:** `card_id`, `payload`

**Auth:** `current_user`


### `PUT /gift-cards/{card_id}/deactivate`

**Function:** `deactivate_gift_card` (line 257)

**Parameters:** `card_id`

**Auth:** `current_user`


### `GET /store-credits/{customer_id}`

**Function:** `get_store_credit` (line 275)

**Parameters:** `customer_id`

**Auth:** `current_user`


### `POST /store-credits/{customer_id}/adjust`

**Function:** `adjust_store_credit` (line 298)

**Parameters:** `customer_id`, `payload`

**Auth:** `current_user`


### `GET /store-credits/{customer_id}/transactions`

**Function:** `list_store_credit_transactions` (line 340)

**Parameters:** `customer_id`

**Auth:** `current_user`


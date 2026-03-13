# Cross-Module — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 10


## Contents

- [cross_module_links.py](#cross-module-links) (10 endpoints)

---

## cross_module_links.py

Cross-module soft links — lightweight integration endpoints between modules.

Integrations:
  1. Support -> CRM: Link ticket to CRM contact
  2. Support -> Projects: Escalate ticket to project task
  3. POS -> CRM: Customer purchase history
  4. POS -> Mail: Email receipt to customer
  5. E-Commerce -> Supply Chain: Order -> procurement request
  6. Supply Chain -> Finance: (event handler in integration_handlers.py)
  7. Manufacturing -> Finance: Production cost breakdown
  8. Manufacturing -> Supply Chain: Material requisition
  9. Manufacturing -> HR: Operator scheduling


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/support/tickets/{ticket_id}/link-contact` | `link_ticket_to_contact` | — |
| `GET` | `/support/tickets/{ticket_id}/linked-contact` | `get_ticket_linked_contact` | — |
| `POST` | `/support/tickets/{ticket_id}/escalate-to-task` | `escalate_ticket_to_task` | — |
| `GET` | `/crm/contacts/{contact_id}/purchase-history` | `get_contact_purchase_history` | — |
| `POST` | `/pos/transactions/{txn_id}/email-receipt` | `email_pos_receipt` | — |
| `POST` | `/ecommerce/orders/{order_id}/create-procurement` | `create_procurement_from_order` | — |
| `GET` | `/manufacturing/work-orders/{wo_id}/cost-breakdown` | `get_work_order_cost_breakdown` | — |
| `POST` | `/manufacturing/work-orders/{wo_id}/request-materials` | `request_materials_for_work_order` | — |
| `POST` | `/manufacturing/work-orders/{wo_id}/assign-operators` | `assign_operators_to_work_order` | — |
| `GET` | `/manufacturing/work-orders/{wo_id}/operators` | `get_work_order_operators` | — |

### `POST /support/tickets/{ticket_id}/link-contact`

**Function:** `link_ticket_to_contact` (line 62)

**Parameters:** `ticket_id`, `payload`

**Auth:** `current_user`


### `GET /support/tickets/{ticket_id}/linked-contact`

**Function:** `get_ticket_linked_contact` (line 100)

**Parameters:** `ticket_id`

**Auth:** `current_user`


### `POST /support/tickets/{ticket_id}/escalate-to-task`

**Function:** `escalate_ticket_to_task` (line 144)

**Parameters:** `ticket_id`, `payload`

**Auth:** `current_user`


### `GET /crm/contacts/{contact_id}/purchase-history`

**Function:** `get_contact_purchase_history` (line 210)

**Parameters:** `contact_id`, `limit`

**Auth:** `current_user`


### `POST /pos/transactions/{txn_id}/email-receipt`

**Function:** `email_pos_receipt` (line 287)

**Parameters:** `txn_id`, `payload`

**Auth:** `current_user`


### `POST /ecommerce/orders/{order_id}/create-procurement`

**Function:** `create_procurement_from_order` (line 359)

**Parameters:** `order_id`, `payload`

**Auth:** `current_user`


### `GET /manufacturing/work-orders/{wo_id}/cost-breakdown`

**Function:** `get_work_order_cost_breakdown` (line 475)

**Parameters:** `wo_id`

**Auth:** `current_user`


### `POST /manufacturing/work-orders/{wo_id}/request-materials`

**Function:** `request_materials_for_work_order` (line 571)

**Parameters:** `wo_id`

**Auth:** `current_user`


### `POST /manufacturing/work-orders/{wo_id}/assign-operators`

**Function:** `assign_operators_to_work_order` (line 692)

**Parameters:** `wo_id`, `payload`

**Auth:** `current_user`


### `GET /manufacturing/work-orders/{wo_id}/operators`

**Function:** `get_work_order_operators` (line 756)

**Parameters:** `wo_id`

**Auth:** `current_user`


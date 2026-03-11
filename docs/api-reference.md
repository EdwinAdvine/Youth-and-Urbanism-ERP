# API Reference

Base URL: `http://localhost:8010/api/v1`

All endpoints require JWT authentication unless noted otherwise. Include the token as:
```
Authorization: Bearer <access_token>
```

Interactive Swagger docs available at `http://localhost:8010/docs`.

---

## Authentication

### `POST /auth/login`
Login with email and password. Returns access + refresh tokens.

### `POST /auth/register`
Register a new user account.

### `POST /auth/refresh`
Refresh an expired access token using a refresh token.

### `POST /auth/logout`
Invalidate the current session.

---

## Users

### `GET /users/` — List all users (admin)
### `GET /users/{id}` — Get user details
### `POST /users/` — Create user (admin)
### `PUT /users/{id}` — Update user
### `DELETE /users/{id}` — Delete user (super admin)

---

## Roles & Permissions

### `GET /roles/` — List roles
### `POST /roles/` — Create role (admin)
### `PUT /roles/{id}` — Update role permissions
### `DELETE /roles/{id}` — Delete role

---

## Admin (Super Admin)

### `GET /admin/users` — All users with role info
### `POST /admin/users` — Create user with role assignment
### `GET /admin/audit-logs` — System audit log
### `GET /admin/stats` — System-wide statistics
### `POST /admin/ai-config` — Configure AI provider settings
### `GET /admin/backups` — List database backups
### `POST /admin/backups` — Trigger new backup
### `POST /admin/backups/{id}/restore` — Restore from backup

---

## App Admin

### `GET /app-admin/{app}/dashboard` — Per-app admin dashboard
### `GET /app-admin/{app}/users` — Users within app scope
### `POST /app-admin/{app}/users` — Manage app-scoped users

---

## AI (Urban Board)

### `WebSocket /ws/chat/{session_id}` — Real-time AI chat
Send: `{"message": "...", "context": {}}` — Receive: streaming token deltas

### `POST /ai/chat` — Non-streaming AI chat
### `GET /ai/sessions` — List chat sessions
### `GET /ai/sessions/{id}/messages` — Chat history
### `POST /ai/summarize` — Summarize text
### `POST /ai/generate-doc` — Generate document from prompt
### `POST /ai/embed` — Create document embedding (RAG)
### `POST /ai/voice` — Voice input processing

---

## Drive (File Management)

### `GET /drive/files` — List files in directory
### `POST /drive/upload` — Upload file to MinIO
### `GET /drive/files/{id}` — Get file metadata
### `GET /drive/files/{id}/download` — Download file
### `DELETE /drive/files/{id}` — Delete file
### `POST /drive/folders` — Create folder
### `GET /drive/shares` — List active file shares
### `POST /drive/shares` — Create share link
### `PUT /drive/shares/{id}` — Update share settings (password, expiry, permissions)
### `DELETE /drive/shares/{id}` — Revoke share
### `GET /drive/shares/{token}/download` — Public share link download
### `POST /drive/shares/{token}/upload` — File-drop upload (if enabled)
### `GET /drive/team-folders` — List team folders
### `POST /drive/team-folders` — Create team folder
### `POST /drive/team-folders/{id}/members` — Add team member
### `DELETE /drive/team-folders/{id}/members/{user_id}` — Remove member
### `GET /drive/audit` — Share audit log

---

## Documents (ONLYOFFICE)

### `POST /docs/create` — Create new document (doc/sheet/presentation)
### `GET /docs/{id}/edit-url` — Get ONLYOFFICE editing URL with JWT
### `POST /docs/convert` — Convert between formats
### `GET /docs/{id}/versions` — Version history

---

## Mail (Stalwart)

### `GET /mail/inbox` — Get inbox messages
### `GET /mail/folders` — List mail folders
### `GET /mail/messages/{id}` — Read message with attachments
### `POST /mail/send` — Compose and send email
### `POST /mail/folders` — Create folder
### `PUT /mail/messages/{id}` — Move/flag/mark read
### `DELETE /mail/messages/{id}` — Delete message

---

## Meetings (Jitsi)

### `POST /meetings/` — Schedule meeting (creates Jitsi room)
### `GET /meetings/` — List meetings
### `GET /meetings/{id}` — Get meeting details + join URL
### `DELETE /meetings/{id}` — Cancel meeting

---

## Calendar

### `GET /calendar/events` — List events (with date range filter)
### `POST /calendar/events` — Create event
### `GET /calendar/events/{id}` — Get event details
### `PUT /calendar/events/{id}` — Update event
### `DELETE /calendar/events/{id}` — Delete event
### `POST /calendar/events/{id}/recurrence` — Set recurrence rule
### `POST /calendar/sync/caldav` — Force CalDAV sync with Stalwart

---

## Notes

### `GET /notes/` — List notes
### `POST /notes/` — Create note (Tiptap JSON content)
### `GET /notes/{id}` — Get note
### `PUT /notes/{id}` — Update note content
### `DELETE /notes/{id}` — Delete note
### `POST /notes/{id}/share` — Share note with users

---

## Forms

### `GET /forms/` — List forms
### `POST /forms/` — Create form (JSON schema fields)
### `GET /forms/{id}` — Get form with fields
### `PUT /forms/{id}` — Update form
### `DELETE /forms/{id}` — Delete form
### `POST /forms/{id}/submit` — Submit form response (public)
### `GET /forms/{id}/responses` — List responses
### `GET /forms/{id}/export/csv` — Export responses as CSV
### `GET /forms/{id}/export/xlsx` — Export responses as XLSX

---

## Projects

### `GET /projects/` — List projects
### `POST /projects/` — Create project
### `GET /projects/{id}` — Get project with tasks
### `PUT /projects/{id}` — Update project
### `DELETE /projects/{id}` — Delete project
### `POST /projects/{id}/tasks` — Create task
### `PUT /projects/tasks/{id}` — Update task (status, assignee, etc.)
### `PUT /projects/tasks/{id}/kanban` — Move task on Kanban board (DnD)
### `POST /projects/tasks/{id}/subtasks` — Add subtask
### `GET /projects/{id}/members` — List project members
### `POST /projects/{id}/members` — Add member
### `POST /projects/tasks/{id}/time-log` — Log time entry
### `GET /projects/{id}/time-logs` — Time log report

---

## Finance

### Accounts
- `GET /finance/accounts` — Chart of accounts
- `POST /finance/accounts` — Create account
- `PUT /finance/accounts/{id}` — Update account

### Invoices
- `GET /finance/invoices` — List invoices (filterable)
- `POST /finance/invoices` — Create invoice
- `GET /finance/invoices/{id}` — Invoice detail
- `PUT /finance/invoices/{id}` — Update invoice
- `POST /finance/invoices/{id}/send` — Send invoice (triggers email + event)

### Payments
- `GET /finance/payments` — List payments
- `POST /finance/payments` — Record payment (links to invoice)

### Journal
- `GET /finance/journal` — Journal entries
- `POST /finance/journal` — Create journal entry (double-entry)

### Reports
- `GET /finance/reports/pnl` — Profit & Loss statement
- `GET /finance/reports/balance-sheet` — Balance sheet

### Extended Finance
- `GET /finance/currencies` — List currencies
- `POST /finance/currencies` — Add currency
- `GET /finance/tax-rates` — Tax rate configuration
- `POST /finance/tax-rates` — Create tax rate
- `GET /finance/bank-accounts` — Bank accounts
- `POST /finance/bank-accounts` — Add bank account
- `POST /finance/bank-accounts/{id}/reconcile` — Bank reconciliation
- `GET /finance/budgets` — Budget allocations
- `POST /finance/budgets` — Create budget

---

## HR & Payroll

### HR
- `GET /hr/departments` — List departments
- `POST /hr/departments` — Create department
- `GET /hr/employees` — List employees
- `POST /hr/employees` — Create employee record
- `GET /hr/employees/{id}` — Employee detail
- `GET /hr/leave` — Leave requests
- `POST /hr/leave` — Submit leave request
- `PUT /hr/leave/{id}/approve` — Approve/reject leave
- `GET /hr/attendance` — Attendance records
- `POST /hr/attendance/check-in` — Record check-in
- `POST /hr/attendance/check-out` — Record check-out

### Payroll
- `GET /hr/payslips` — List payslips
- `POST /hr/payslips` — Generate payslip
- `PUT /hr/payslips/{id}/approve` — Approve payslip
- `GET /hr/tax-brackets` — Tax bracket configuration
- `POST /hr/pay-runs` — Create pay run
- `GET /hr/pay-runs/{id}` — Pay run details

### Extended Payroll
- `GET /payroll/deductions` — Deduction types
- `POST /payroll/deductions` — Create deduction
- `GET /payroll/allowances` — Allowance types
- `POST /payroll/allowances` — Create allowance

---

## CRM

### `GET /crm/contacts` — List contacts
### `POST /crm/contacts` — Create contact
### `GET /crm/contacts/{id}` — Contact detail
### `GET /crm/leads` — List leads
### `POST /crm/leads` — Create lead
### `PUT /crm/leads/{id}/convert` — Convert lead to contact/deal
### `GET /crm/deals` — List deals
### `POST /crm/deals` — Create deal
### `PUT /crm/deals/{id}` — Update deal (stage, value, etc.)
### `GET /crm/pipeline` — Pipeline view with stages
### `GET /crm/activities` — CRM activities log

---

## Inventory

### `GET /inventory/items` — List inventory items
### `POST /inventory/items` — Create item
### `GET /inventory/items/{id}` — Item detail with stock levels
### `GET /inventory/warehouses` — List warehouses
### `POST /inventory/warehouses` — Create warehouse
### `GET /inventory/stock-movements` — Stock movement history
### `POST /inventory/stock-movements` — Record stock movement
### `GET /inventory/purchase-orders` — List purchase orders
### `POST /inventory/purchase-orders` — Create PO
### `GET /inventory/purchase-orders/{id}` — PO detail
### `PUT /inventory/purchase-orders/{id}/receive` — Receive PO (updates stock)
### `GET /inventory/reorder-alerts` — Active reorder alerts

---

## Supply Chain

### `GET /supplychain/suppliers` — List suppliers
### `POST /supplychain/suppliers` — Create supplier
### `GET /supplychain/requisitions` — Purchase requisitions
### `POST /supplychain/requisitions` — Create requisition
### `PUT /supplychain/requisitions/{id}/approve` — Approve requisition
### `GET /supplychain/grns` — Goods received notes
### `POST /supplychain/grns` — Create GRN
### `GET /supplychain/returns` — Return orders
### `POST /supplychain/returns` — Create return

---

## Manufacturing

### `GET /manufacturing/boms` — Bills of materials
### `POST /manufacturing/boms` — Create BOM
### `GET /manufacturing/workstations` — Work stations
### `POST /manufacturing/workstations` — Create work station
### `GET /manufacturing/work-orders` — Work orders
### `POST /manufacturing/work-orders` — Create work order
### `PUT /manufacturing/work-orders/{id}/status` — Update work order status
### `GET /manufacturing/quality-checks` — Quality check records
### `POST /manufacturing/quality-checks` — Record quality check

---

## Point of Sale (POS)

### `POST /pos/sessions` — Open POS session
### `PUT /pos/sessions/{id}/close` — Close session (reconcile cash)
### `GET /pos/sessions/{id}` — Session detail with transactions
### `POST /pos/transactions` — Record sale
### `GET /pos/transactions/{id}/receipt` — Get receipt

---

## E-Commerce

### `GET /ecommerce/stores` — List stores
### `POST /ecommerce/stores` — Create store
### `GET /ecommerce/products` — List products
### `POST /ecommerce/products` — Create product
### `PUT /ecommerce/products/{id}` — Update product
### `GET /ecommerce/orders` — List orders
### `GET /ecommerce/orders/{id}` — Order detail
### `PUT /ecommerce/orders/{id}/status` — Update order status
### `GET /ecommerce/customers` — Customer list

### Storefront (Public)
### `GET /storefront/products` — Public product catalog
### `POST /storefront/cart` — Add to cart
### `POST /storefront/checkout` — Place order

---

## Support

### `GET /support/tickets` — List support tickets
### `POST /support/tickets` — Create ticket
### `GET /support/tickets/{id}` — Ticket detail with replies
### `POST /support/tickets/{id}/reply` — Reply to ticket
### `PUT /support/tickets/{id}/status` — Update ticket status
### `PUT /support/tickets/{id}/assign` — Assign ticket to agent

---

## Global Search

### `GET /search?q={query}` — Full-text search across all modules
Returns grouped results: contacts, invoices, employees, items, projects, files, etc.

---

## Dashboard

### `GET /dashboard/stats` — Cross-module KPI tiles
### `GET /dashboard/activity` — Recent activity feed

---

## Settings

### `GET /settings/company` — Company settings
### `PUT /settings/company` — Update company settings
### `GET /settings/user` — User preferences
### `PUT /settings/user` — Update user preferences

---

## Profile

### `GET /profile/` — Current user profile
### `PUT /profile/` — Update profile info
### `PUT /profile/password` — Change password
### `GET /profile/activity` — User's activity log

---

## Notifications

### `GET /notifications/` — List notifications (paginated)
### `PUT /notifications/{id}/read` — Mark as read
### `PUT /notifications/read-all` — Mark all as read

---

## SSO (OAuth2/OIDC)

### `GET /sso/providers` — List SSO providers
### `POST /sso/providers` — Configure SSO provider
### `GET /sso/providers/{id}/callback` — OAuth2 callback handler

---

## License Management

### `GET /license/` — Current license info
### `POST /license/activate` — Activate license key
### `GET /license/features` — Available features per license tier

---

## Bulk User Import

### `POST /user-import/csv` — Import users from CSV file
### `GET /user-import/template` — Download CSV template

---

## Backups

### `GET /backups/` — List available backups
### `POST /backups/` — Create backup
### `POST /backups/{id}/restore` — Restore from backup
### `DELETE /backups/{id}` — Delete backup

---

## Health & Monitoring

### `GET /health` — Health check (all services)
### `GET /metrics` — Prometheus metrics

---

## Common Patterns

### Pagination
Most list endpoints support:
```
?page=1&page_size=20
```

### Filtering
Module-specific filters:
```
?status=active&date_from=2026-01-01&date_to=2026-12-31
```

### Sorting
```
?sort_by=created_at&sort_order=desc
```

### CSV Export
Many list endpoints support CSV export:
```
GET /finance/invoices/export/csv
GET /hr/employees/export/csv
GET /inventory/items/export/csv
```

### Error Response Format
```json
{
  "detail": "Error description",
  "status_code": 400
}
```

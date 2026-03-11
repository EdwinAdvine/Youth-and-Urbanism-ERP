# Y&U ERP — Master Implementation Checklist

> **Total gaps identified: 340+ items across 18 modules**
> Organized by priority tier → module → layer (models → API → frontend → integrations → tests)
> Each item has a unique ID for tracking.

---

## TIER 0 — Cleanup (Do First)

| ID | Item | Module | Status |
|----|------|--------|--------|
| T0-01 | Delete `backend/app/integrations/nextcloud_client.py` | Infra | [ ] |
| T0-02 | Delete `nginx-nextcloud.conf` | Infra | [ ] |
| T0-03 | Delete `superset/` directory | Infra | [ ] |
| T0-04 | Update README.md `Containers to Remove` section (mark Nextcloud/Superset/PgAdmin/Mailhog as done) | Infra | [ ] |

---

## TIER 1 — Core ERP Gaps (High Business Value)

### 1.1 Finance — Missing Models + Endpoints + Pages

| ID | Layer | Item | Status |
|----|-------|------|--------|
| F-01 | Model | `RecurringInvoice` (template, frequency: daily/weekly/monthly, next_date, end_date, is_active, source_invoice_id) | [ ] |
| F-02 | Model | `Expense` (description, amount, category, date, user_id, receipt_file_id, status: draft/submitted/approved/rejected/reimbursed, approver_id) | [ ] |
| F-03 | Model | `VendorBill` (vendor_id, amount, due_date, status, line_items, reference) | [ ] |
| F-04 | Model | `FixedAsset` (name, purchase_date, cost, salvage_value, depreciation_method: straight_line/declining, useful_life_months, accumulated_depreciation) | [ ] |
| F-05 | API | `POST /finance/invoices/{id}/recurring` — set up recurring schedule | [ ] |
| F-06 | API | `GET /finance/recurring-invoices` — list all recurring configs | [ ] |
| F-07 | API | `PUT /finance/recurring-invoices/{id}` — update/pause/cancel | [ ] |
| F-08 | API | `GET/POST /finance/expenses` — expense CRUD | [ ] |
| F-09 | API | `GET /finance/expenses/{id}` | [ ] |
| F-10 | API | `PUT /finance/expenses/{id}/submit` — submit for approval | [ ] |
| F-11 | API | `PUT /finance/expenses/{id}/approve` — approve/reject | [ ] |
| F-12 | API | `GET/POST /finance/vendor-bills` | [ ] |
| F-13 | API | `GET/PUT /finance/vendor-bills/{id}` | [ ] |
| F-14 | API | `POST /finance/vendor-bills/{id}/pay` | [ ] |
| F-15 | API | `GET/POST /finance/fixed-assets` | [ ] |
| F-16 | API | `POST /finance/fixed-assets/{id}/depreciate` — run depreciation | [ ] |
| F-17 | API | `GET /finance/reports/cash-flow` | [ ] |
| F-18 | API | `GET /finance/reports/trial-balance` | [ ] |
| F-19 | API | `GET /finance/reports/aged-receivables` | [ ] |
| F-20 | API | `GET /finance/reports/aged-payables` | [ ] |
| F-21 | API | `GET /finance/dashboard/kpis` — revenue, expenses, profit, cash position | [ ] |
| F-22 | Page | Bank reconciliation UI (match statement lines to transactions) | [ ] |
| F-23 | Page | Expense tracking page (submit, list, approve/reject workflow) | [ ] |
| F-24 | Page | Vendor bills page (list, detail, payment) | [ ] |
| F-25 | Page | Recurring invoices page (list, create, pause, history) | [ ] |
| F-26 | Page | Cash flow report | [ ] |
| F-27 | Page | Aged receivables/payables report | [ ] |
| F-28 | Page | Financial dashboard KPIs (real-time cards) | [ ] |
| F-29 | Page | Invoice PDF generation + preview | [ ] |
| F-30 | Page | Multi-currency transaction UI | [ ] |
| F-31 | Page | Fixed asset register + depreciation schedule | [ ] |
| F-32 | Integration | Projects → Finance: project costs tracking | [ ] |
| F-33 | Integration | Inventory → Finance: stock valuation → balance sheet | [ ] |
| F-34 | Integration | POS → Finance: daily sales summary → journal entries | [ ] |
| F-35 | Integration | E-Commerce → Finance: order payments → invoices | [ ] |
| F-36 | Integration | AI financial forecasting | [ ] |
| F-37 | Integration | AI anomaly detection in transactions | [ ] |
| F-38 | Test | Report calculation tests (P&L, balance sheet, cash flow) | [ ] |
| F-39 | Test | Budget vs actual tests | [ ] |
| F-40 | Test | Multi-currency tests | [ ] |
| F-41 | Test | Expense lifecycle tests | [ ] |
| F-42 | Test | Recurring invoice generation tests | [ ] |
| F-43 | Celery | Auto-generate recurring invoices (beat schedule) | [ ] |
| F-44 | Celery | Auto-run depreciation (monthly beat) | [ ] |
| F-45 | Mobile | Responsive dashboard | [ ] |
| F-46 | Mobile | Mobile invoice creation | [ ] |
| F-47 | Mobile | Expense capture (photo receipt → upload) | [ ] |

### 1.2 HR & Payroll — Missing Models + Endpoints + Pages

| ID | Layer | Item | Status |
|----|-------|------|--------|
| HR-01 | Model | `EmployeeDocument` (employee_id, type: contract/id/cert, file_id, expiry_date, uploaded_by) | [ ] |
| HR-02 | Model | `Training` (name, description, date, trainer, duration, cost) + `TrainingAttendee` M2M | [ ] |
| HR-03 | Model | `PerformanceReview` (employee_id, reviewer_id, period, rating 1-5, goals JSON, strengths, areas_for_improvement, status) | [ ] |
| HR-04 | Model | `Benefit` (employee_id, type: health/pension/transport, amount, start_date, end_date) | [ ] |
| HR-05 | Model | `Overtime` (employee_id, date, hours, rate_multiplier, status: pending/approved, approver_id) | [ ] |
| HR-06 | API | `GET/POST /hr/employees/{id}/documents` | [ ] |
| HR-07 | API | `DELETE /hr/employees/{id}/documents/{doc_id}` | [ ] |
| HR-08 | API | `GET/POST /hr/training` | [ ] |
| HR-09 | API | `GET/PUT /hr/training/{id}` | [ ] |
| HR-10 | API | `GET/POST /hr/performance-reviews` | [ ] |
| HR-11 | API | `GET/PUT /hr/performance-reviews/{id}` | [ ] |
| HR-12 | API | `GET /hr/reports/headcount` | [ ] |
| HR-13 | API | `GET /hr/reports/attrition` | [ ] |
| HR-14 | API | `GET /hr/reports/leave-balance` | [ ] |
| HR-15 | API | `GET /hr/org-chart` — hierarchy tree data | [ ] |
| HR-16 | API | `POST /hr/attendance/bulk` — CSV import | [ ] |
| HR-17 | API | `GET /hr/dashboard/kpis` | [ ] |
| HR-18 | Page | Organization chart (visual tree/hierarchy) | [ ] |
| HR-19 | Page | Performance review forms (create, fill, view history) | [ ] |
| HR-20 | Page | Training management (schedule, track attendance) | [ ] |
| HR-21 | Page | Employee documents vault | [ ] |
| HR-22 | Page | Leave calendar (team view overlay) | [ ] |
| HR-23 | Page | Payroll reports (cost by department, tax summary) | [ ] |
| HR-24 | Page | Employee onboarding wizard | [ ] |
| HR-25 | Page | Employee offboarding checklist | [ ] |
| HR-26 | Integration | HR → Calendar: leave displayed on shared calendar | [ ] |
| HR-27 | Integration | HR → Mail: leave approval notifications via email | [ ] |
| HR-28 | Integration | HR → Projects: employee availability | [ ] |
| HR-29 | Integration | AI attrition prediction | [ ] |
| HR-30 | Integration | AI payroll anomaly detection | [ ] |
| HR-31 | Test | Payroll calculation tests | [ ] |
| HR-32 | Test | Tax bracket application tests | [ ] |
| HR-33 | Test | Pay run tests | [ ] |
| HR-34 | Mobile | Mobile attendance check-in/out | [ ] |
| HR-35 | Mobile | Mobile leave request | [ ] |
| HR-36 | Mobile | Responsive org chart | [ ] |

### 1.3 CRM — Missing Models + Endpoints + Pages

| ID | Layer | Item | Status |
|----|-------|------|--------|
| CRM-01 | Model | `Campaign` (name, type: email/social/event, status, budget, start_date, end_date, description) | [ ] |
| CRM-02 | Model | `CampaignContact` (campaign_id, contact_id, status: sent/opened/clicked/converted) | [ ] |
| CRM-03 | Model | `Ticket` (contact_id, subject, description, status, priority, assigned_to) | [ ] |
| CRM-04 | Model | `Product` (name, description, price, sku, category) — for deal line items | [ ] |
| CRM-05 | Model | `Quote` (deal_id, items JSON, total, status: draft/sent/accepted/rejected, valid_until) | [ ] |
| CRM-06 | API | `GET/POST /crm/campaigns` | [ ] |
| CRM-07 | API | `GET/PUT/DELETE /crm/campaigns/{id}` | [ ] |
| CRM-08 | API | `GET /crm/campaigns/{id}/analytics` — opens, clicks, conversions | [ ] |
| CRM-09 | API | `POST /crm/campaigns/{id}/send` — launch campaign | [ ] |
| CRM-10 | API | `GET/POST /crm/tickets` | [ ] |
| CRM-11 | API | `PUT /crm/tickets/{id}/assign` | [ ] |
| CRM-12 | API | `POST /crm/deals/{id}/quote` | [ ] |
| CRM-13 | API | `GET /crm/reports/pipeline` — conversion rates | [ ] |
| CRM-14 | API | `GET /crm/reports/sales-forecast` | [ ] |
| CRM-15 | API | `GET /crm/contacts/{id}/timeline` — all activities | [ ] |
| CRM-16 | API | `POST /crm/contacts/import` — CSV import | [ ] |
| CRM-17 | API | `GET /crm/contacts/export` | [ ] |
| CRM-18 | Page | Campaign management (create, send, track) | [ ] |
| CRM-19 | Page | Campaign analytics (email opens, conversions chart) | [ ] |
| CRM-20 | Page | Support tickets (list, detail, assign) | [ ] |
| CRM-21 | Page | Contact timeline (all interactions across modules) | [ ] |
| CRM-22 | Page | Quote builder (itemized, PDF preview) | [ ] |
| CRM-23 | Page | Sales forecast chart | [ ] |
| CRM-24 | Page | Pipeline analytics (win rate, average deal size, velocity) | [ ] |
| CRM-25 | Page | Contact import wizard (CSV mapping) | [ ] |
| CRM-26 | Integration | CRM → Mail: email linked to contacts | [ ] |
| CRM-27 | Integration | CRM → Calendar: schedule follow-ups | [ ] |
| CRM-28 | Integration | CRM → Meetings: meeting linked to deals | [ ] |
| CRM-29 | Integration | CRM → Forms: lead capture forms | [ ] |
| CRM-30 | Integration | CRM → E-Commerce: customer sync | [ ] |
| CRM-31 | Integration | AI lead scoring | [ ] |
| CRM-32 | Integration | AI next-best-action suggestions | [ ] |
| CRM-33 | Test | Lead conversion tests | [ ] |
| CRM-34 | Test | Campaign tests | [ ] |
| CRM-35 | Test | Pipeline analytics tests | [ ] |
| CRM-36 | Mobile | Responsive pipeline view | [ ] |
| CRM-37 | Mobile | Mobile contact detail | [ ] |
| CRM-38 | Mobile | Quick activity logging | [ ] |

### 1.4 Inventory — Missing Models + Endpoints + Pages

| ID | Layer | Item | Status |
|----|-------|------|--------|
| INV-01 | Model | `Supplier` (name, email, phone, address, payment_terms, contact_person) | [ ] |
| INV-02 | Model | `StockAdjustment` (item_id, warehouse_id, old_qty, new_qty, reason, adjusted_by) | [ ] |
| INV-03 | Model | `ItemVariant` (item_id, variant_name, sku, price_adjustment, attributes JSON) | [ ] |
| INV-04 | Model | `BatchNumber` (item_id, batch_no, manufacture_date, expiry_date, quantity) | [ ] |
| INV-05 | Model | `InventoryCount` (warehouse_id, date, status: in_progress/completed, counted_by) | [ ] |
| INV-06 | API | `GET/POST /inventory/suppliers` | [ ] |
| INV-07 | API | `GET/PUT/DELETE /inventory/suppliers/{id}` | [ ] |
| INV-08 | API | `POST /inventory/stock-adjustments` | [ ] |
| INV-09 | API | `GET /inventory/items/{id}/history` — movement history | [ ] |
| INV-10 | API | `GET /inventory/valuation` — stock value by warehouse | [ ] |
| INV-11 | API | `POST /inventory/counts` — physical inventory count | [ ] |
| INV-12 | API | `PUT /inventory/counts/{id}` — submit count results | [ ] |
| INV-13 | API | `GET /inventory/reports/turnover` | [ ] |
| INV-14 | API | `GET /inventory/reports/aging` | [ ] |
| INV-15 | API | `POST /inventory/items/import` — CSV bulk import | [ ] |
| INV-16 | API | `GET /inventory/items/export` | [ ] |
| INV-17 | Page | Supplier management page (CRUD + contacts) | [ ] |
| INV-18 | Page | Stock adjustment form | [ ] |
| INV-19 | Page | Physical count workflow (start → count → reconcile → approve) | [ ] |
| INV-20 | Page | Item movement history timeline | [ ] |
| INV-21 | Page | Stock valuation report | [ ] |
| INV-22 | Page | Inventory turnover report | [ ] |
| INV-23 | Page | Barcode/QR scanner integration | [ ] |
| INV-24 | Page | Item variants editor | [ ] |
| INV-25 | Page | Batch/serial number tracking | [ ] |
| INV-26 | Integration | Inventory → Finance: stock valuation → balance sheet | [ ] |
| INV-27 | Integration | Inventory → POS: real-time stock sync | [ ] |
| INV-28 | Integration | Inventory → E-Commerce: product stock sync | [ ] |
| INV-29 | Integration | Inventory → Supply Chain: procurement integration | [ ] |
| INV-30 | Integration | AI demand forecasting | [ ] |
| INV-31 | Integration | AI reorder point optimization | [ ] |
| INV-32 | Test | Purchase order lifecycle tests | [ ] |
| INV-33 | Test | Reorder alert tests | [ ] |
| INV-34 | Test | Stock valuation calculation tests | [ ] |
| INV-35 | Mobile | Mobile stock check | [ ] |
| INV-36 | Mobile | Barcode scanning | [ ] |
| INV-37 | Mobile | Mobile PO receipt | [ ] |

---

## TIER 2 — Module Feature Completion

### 2.1 E-Commerce — Full Module Build

| ID | Layer | Item | Status |
|----|-------|------|--------|
| EC-01 | Model | `Cart` (session_id, user_id, items JSON, created_at, updated_at) | [ ] |
| EC-02 | Model | `Coupon` (code, type: percentage/fixed, value, min_order, valid_from, valid_to, usage_limit, usage_count) | [ ] |
| EC-03 | Model | `ShippingMethod` (name, price, estimated_days, zones JSON, is_active) | [ ] |
| EC-04 | Model | `Review` (product_id, user_id, rating 1-5, comment, approved, created_at) | [ ] |
| EC-05 | Model | `Wishlist` (user_id, product_id, added_at) | [ ] |
| EC-06 | Model | `PaymentGateway` (name, provider, config JSON, is_active) | [ ] |
| EC-07 | API | `GET/POST /ecommerce/cart` | [ ] |
| EC-08 | API | `PUT /ecommerce/cart/items/{id}` — update quantity | [ ] |
| EC-09 | API | `DELETE /ecommerce/cart/items/{id}` | [ ] |
| EC-10 | API | `POST /ecommerce/checkout` — cart → order | [ ] |
| EC-11 | API | `GET/POST /ecommerce/coupons` | [ ] |
| EC-12 | API | `POST /ecommerce/coupons/validate` | [ ] |
| EC-13 | API | `GET/POST /ecommerce/shipping-methods` | [ ] |
| EC-14 | API | `POST /ecommerce/orders/{id}/ship` — mark shipped | [ ] |
| EC-15 | API | `POST /ecommerce/orders/{id}/refund` | [ ] |
| EC-16 | API | `GET/POST /ecommerce/reviews` | [ ] |
| EC-17 | API | `PUT /ecommerce/reviews/{id}/approve` | [ ] |
| EC-18 | API | `GET /ecommerce/wishlist` | [ ] |
| EC-19 | API | `POST /ecommerce/wishlist` | [ ] |
| EC-20 | API | `DELETE /ecommerce/wishlist/{id}` | [ ] |
| EC-21 | API | `GET /ecommerce/reports/sales` | [ ] |
| EC-22 | API | `GET /ecommerce/reports/top-products` | [ ] |
| EC-23 | API | `GET /ecommerce/reports/conversion-funnel` | [ ] |
| EC-24 | API | `GET /ecommerce/storefront/{slug}` — public storefront API | [ ] |
| EC-25 | Page | Store admin dashboard (orders, revenue, top products) | [ ] |
| EC-26 | Page | Product management (CRUD + image gallery + variants) | [ ] |
| EC-27 | Page | Category management (tree editor) | [ ] |
| EC-28 | Page | Order management (list + detail + status updates) | [ ] |
| EC-29 | Page | Customer storefront (public-facing shop) | [ ] |
| EC-30 | Page | Product catalog page (grid + filters + search) | [ ] |
| EC-31 | Page | Product detail page (images, reviews, add to cart) | [ ] |
| EC-32 | Page | Shopping cart page | [ ] |
| EC-33 | Page | Checkout flow (address → shipping → payment → confirm) | [ ] |
| EC-34 | Page | Order tracking page (customer-facing) | [ ] |
| EC-35 | Page | Coupon management | [ ] |
| EC-36 | Page | Shipping configuration | [ ] |
| EC-37 | Page | Review moderation | [ ] |
| EC-38 | Page | Storefront theme editor | [ ] |
| EC-39 | Integration | E-Commerce → Inventory: stock sync | [ ] |
| EC-40 | Integration | E-Commerce → Finance: order → invoice | [ ] |
| EC-41 | Integration | E-Commerce → CRM: customer sync | [ ] |
| EC-42 | Integration | E-Commerce → Supply Chain: order → procurement | [ ] |
| EC-43 | Integration | E-Commerce → Mail: order confirmation, shipping notification | [ ] |
| EC-44 | Integration | E-Commerce → POS: unified product catalog | [ ] |
| EC-45 | Integration | AI product recommendations | [ ] |
| EC-46 | Integration | AI pricing optimization | [ ] |
| EC-47 | Test | Product CRUD tests | [ ] |
| EC-48 | Test | Order lifecycle tests | [ ] |
| EC-49 | Test | Cart/checkout flow tests | [ ] |
| EC-50 | Test | Coupon validation tests | [ ] |
| EC-51 | Test | Inventory sync tests | [ ] |
| EC-52 | Mobile | Responsive storefront | [ ] |
| EC-53 | Mobile | Mobile checkout | [ ] |
| EC-54 | Mobile | Mobile order management | [ ] |

### 2.2 POS — Full Frontend + Missing Backend

| ID | Layer | Item | Status |
|----|-------|------|--------|
| POS-01 | Model | `POSTerminal` (name, location, is_active, settings JSON) | [ ] |
| POS-02 | Model | `POSDiscount` (name, type: percentage/fixed, value, valid_from, valid_to, conditions JSON) | [ ] |
| POS-03 | Model | `POSReceipt` (transaction_id, receipt_number, printed_at) | [ ] |
| POS-04 | Model | `POSCashMovement` (session_id, type: in/out, amount, reason, timestamp) | [ ] |
| POS-05 | API | `GET/POST /pos/terminals` | [ ] |
| POS-06 | API | `POST /pos/sessions/{id}/close` — with cash count | [ ] |
| POS-07 | API | `GET /pos/sessions/{id}/summary` — shift summary | [ ] |
| POS-08 | API | `GET/POST /pos/discounts` | [ ] |
| POS-09 | API | `POST /pos/transactions/{id}/receipt` — generate/print | [ ] |
| POS-10 | API | `POST /pos/transactions/{id}/refund` | [ ] |
| POS-11 | API | `POST /pos/cash-movements` | [ ] |
| POS-12 | API | `GET /pos/reports/daily-sales` | [ ] |
| POS-13 | API | `GET /pos/reports/by-cashier` | [ ] |
| POS-14 | API | `GET /pos/reports/by-product` | [ ] |
| POS-15 | API | `POST /pos/transactions/offline-sync` | [ ] |
| POS-16 | Page | POS terminal interface (full-screen, touch-optimized) | [ ] |
| POS-17 | Page | Product grid with categories + search | [ ] |
| POS-18 | Page | Cart sidebar (add/remove, quantity, discounts) | [ ] |
| POS-19 | Page | Payment dialog (cash, card, split payment) | [ ] |
| POS-20 | Page | Receipt preview + print | [ ] |
| POS-21 | Page | Session open/close workflow | [ ] |
| POS-22 | Page | Cash drawer management | [ ] |
| POS-23 | Page | POS settings page | [ ] |
| POS-24 | Page | Daily sales report | [ ] |
| POS-25 | Page | Cashier performance report | [ ] |
| POS-26 | Page | Offline mode indicator + sync status | [ ] |
| POS-27 | Page | Barcode scanner input | [ ] |
| POS-28 | Page | Customer lookup + loyalty points | [ ] |
| POS-29 | Integration | POS → Inventory: real-time stock deduction | [ ] |
| POS-30 | Integration | POS → Finance: daily sales → journal entries | [ ] |
| POS-31 | Integration | POS → CRM: customer purchase history | [ ] |
| POS-32 | Integration | POS → E-Commerce: unified product catalog | [ ] |
| POS-33 | Integration | Receipt → Mail: email receipt to customer | [ ] |
| POS-34 | Integration | Offline mode with IndexedDB + sync | [ ] |
| POS-35 | Test | Session lifecycle tests | [ ] |
| POS-36 | Test | Transaction calculation tests (tax, discount) | [ ] |
| POS-37 | Test | Refund tests | [ ] |
| POS-38 | Test | Offline sync tests | [ ] |
| POS-39 | Test | Cash reconciliation tests | [ ] |
| POS-40 | Mobile | Tablet POS layout (primary use case) | [ ] |
| POS-41 | Mobile | Mobile payment terminal | [ ] |
| POS-42 | Mobile | Touch-optimized buttons | [ ] |

### 2.3 Supply Chain — Full Frontend + Missing Backend

| ID | Layer | Item | Status |
|----|-------|------|--------|
| SC-01 | Model | `Shipment` (order_id, carrier, tracking_no, status, shipped_at, delivered_at) | [ ] |
| SC-02 | Model | `ReturnOrder` (original_order_id, reason, status, return_items JSON) | [ ] |
| SC-03 | Model | `QualityInspection` (goods_receipt_id, inspector_id, result, notes) | [ ] |
| SC-04 | Model | `SupplierRating` (supplier_id, quality_score, delivery_score, price_score, period) | [ ] |
| SC-05 | Model | `Contract` (supplier_id, start_date, end_date, terms, auto_renew, value) | [ ] |
| SC-06 | API | `GET/POST /supply-chain/shipments` | [ ] |
| SC-07 | API | `POST /supply-chain/shipments/{id}/track` | [ ] |
| SC-08 | API | `GET/POST /supply-chain/returns` | [ ] |
| SC-09 | API | `GET/POST /supply-chain/quality-inspections` | [ ] |
| SC-10 | API | `GET /supply-chain/supplier-ratings` | [ ] |
| SC-11 | API | `GET /supply-chain/reports/lead-times` | [ ] |
| SC-12 | API | `GET /supply-chain/reports/supplier-performance` | [ ] |
| SC-13 | API | `GET/POST /supply-chain/contracts` | [ ] |
| SC-14 | Page | Supply chain dashboard | [ ] |
| SC-15 | Page | Supplier management (full CRUD + rating display) | [ ] |
| SC-16 | Page | Procurement workflow (request → quote → order → receipt) | [ ] |
| SC-17 | Page | Shipment tracking (map + status timeline) | [ ] |
| SC-18 | Page | Returns management | [ ] |
| SC-19 | Page | Quality inspection forms | [ ] |
| SC-20 | Page | Supplier performance analytics | [ ] |
| SC-21 | Page | Contract management | [ ] |
| SC-22 | Integration | Supply Chain → Inventory: goods receipt → stock update | [ ] |
| SC-23 | Integration | Supply Chain → Finance: purchase invoices | [ ] |
| SC-24 | Integration | Supply Chain → Manufacturing: material requisition | [ ] |
| SC-25 | Integration | AI supplier recommendation | [ ] |
| SC-26 | Integration | AI demand planning | [ ] |
| SC-27 | Test | Procurement lifecycle tests | [ ] |
| SC-28 | Test | Supplier rating tests | [ ] |
| SC-29 | Test | Shipment tracking tests | [ ] |
| SC-30 | Mobile | Mobile goods receipt | [ ] |
| SC-31 | Mobile | Mobile quality inspection | [ ] |

### 2.4 Manufacturing — Full Frontend + Missing Backend

| ID | Layer | Item | Status |
|----|-------|------|--------|
| MFG-01 | Model | `RoutingStep` (bom_id, workstation_id, sequence, operation, duration_minutes) | [ ] |
| MFG-02 | Model | `ScrapEntry` (work_order_id, item_id, quantity, reason, date) | [ ] |
| MFG-03 | Model | `MaintenanceSchedule` (workstation_id, frequency, next_date, last_completed, description) | [ ] |
| MFG-04 | Model | `QualityControl` (work_order_id, test_name, result: pass/fail, inspector_id, notes) | [ ] |
| MFG-05 | API | `GET/POST /manufacturing/routing` | [ ] |
| MFG-06 | API | `POST /manufacturing/scrap-entries` | [ ] |
| MFG-07 | API | `GET/POST /manufacturing/maintenance-schedules` | [ ] |
| MFG-08 | API | `GET/POST /manufacturing/quality-control` | [ ] |
| MFG-09 | API | `GET /manufacturing/reports/oee` — Overall Equipment Effectiveness | [ ] |
| MFG-10 | API | `GET /manufacturing/reports/production-plan` | [ ] |
| MFG-11 | API | `GET /manufacturing/dashboard/kpis` | [ ] |
| MFG-12 | Page | Manufacturing dashboard (OEE, production status) | [ ] |
| MFG-13 | Page | BOM editor (tree view, nested materials) | [ ] |
| MFG-14 | Page | Work order management (list, detail, status flow) | [ ] |
| MFG-15 | Page | Production tracking (real-time progress) | [ ] |
| MFG-16 | Page | Workstation management | [ ] |
| MFG-17 | Page | Maintenance scheduling | [ ] |
| MFG-18 | Page | Quality control forms | [ ] |
| MFG-19 | Page | Scrap tracking | [ ] |
| MFG-20 | Page | Production planning calendar | [ ] |
| MFG-21 | Integration | Manufacturing → Inventory: consume raw materials, produce finished goods | [ ] |
| MFG-22 | Integration | Manufacturing → Supply Chain: material requisition | [ ] |
| MFG-23 | Integration | Manufacturing → Finance: production costs | [ ] |
| MFG-24 | Integration | Manufacturing → HR: operator scheduling | [ ] |
| MFG-25 | Integration | AI production optimization | [ ] |
| MFG-26 | Integration | AI predictive maintenance | [ ] |
| MFG-27 | Test | BOM calculation tests | [ ] |
| MFG-28 | Test | Work order lifecycle tests | [ ] |
| MFG-29 | Test | Production entry tests | [ ] |
| MFG-30 | Test | Material consumption tests | [ ] |
| MFG-31 | Mobile | Mobile production entry | [ ] |
| MFG-32 | Mobile | Workstation dashboard (tablet) | [ ] |

### 2.5 Support — Full Frontend + Missing Backend

| ID | Layer | Item | Status |
|----|-------|------|--------|
| SUP-01 | Model | `SLAPolicy` (name, response_time_hours, resolution_time_hours, priority_rules JSON) | [ ] |
| SUP-02 | Model | `CannedResponse` (name, content, category, created_by) | [ ] |
| SUP-03 | Model | `TicketTag` (ticket_id, tag_name) | [ ] |
| SUP-04 | Model | `CustomerSatisfaction` (ticket_id, rating 1-5, feedback, submitted_at) | [ ] |
| SUP-05 | API | `GET/POST /support/sla-policies` | [ ] |
| SUP-06 | API | `GET /support/tickets/{id}/sla-status` | [ ] |
| SUP-07 | API | `GET/POST /support/canned-responses` | [ ] |
| SUP-08 | API | `POST /support/tickets/{id}/merge` | [ ] |
| SUP-09 | API | `GET /support/reports/response-times` | [ ] |
| SUP-10 | API | `GET /support/reports/satisfaction` | [ ] |
| SUP-11 | API | `GET /support/dashboard/kpis` | [ ] |
| SUP-12 | Page | Support dashboard (open tickets, SLA breaches, satisfaction) | [ ] |
| SUP-13 | Page | Ticket list (filtered, sortable, search) | [ ] |
| SUP-14 | Page | Ticket detail (conversation thread, status, assignee) | [ ] |
| SUP-15 | Page | Knowledge base editor | [ ] |
| SUP-16 | Page | Knowledge base public view | [ ] |
| SUP-17 | Page | SLA configuration | [ ] |
| SUP-18 | Page | Canned response manager | [ ] |
| SUP-19 | Page | Customer satisfaction reports | [ ] |
| SUP-20 | Page | Ticket assignment/routing rules | [ ] |
| SUP-21 | Integration | Support → Mail: ticket creation from email | [ ] |
| SUP-22 | Integration | Support → CRM: link tickets to contacts | [ ] |
| SUP-23 | Integration | Support → Projects: escalate ticket to task | [ ] |
| SUP-24 | Integration | AI ticket classification | [ ] |
| SUP-25 | Integration | AI suggested responses | [ ] |
| SUP-26 | Integration | AI KB article generation from resolved tickets | [ ] |
| SUP-27 | Test | Ticket lifecycle tests | [ ] |
| SUP-28 | Test | SLA calculation tests | [ ] |
| SUP-29 | Test | KB search tests | [ ] |
| SUP-30 | Mobile | Mobile ticket view | [ ] |
| SUP-31 | Mobile | Mobile ticket creation | [ ] |

---

## TIER 3 — Analytics Platform (Full Build)

| ID | Layer | Item | Status |
|----|-------|------|--------|
| AN-01 | Model | `Dashboard` (name, description, layout JSON, owner_id, is_shared) | [ ] |
| AN-02 | Model | `DashboardWidget` (dashboard_id, type, title, query_config JSON, position, size) | [ ] |
| AN-03 | Model | `SavedQuery` (name, sql, description, owner_id, module) | [ ] |
| AN-04 | Model | `Report` (name, type, schedule cron, query_id, format: PDF/CSV/Excel, recipients) | [ ] |
| AN-05 | Model | `DataAlert` (name, condition, threshold, query_id, notify_users, is_active) | [ ] |
| AN-06 | API | `GET/POST /analytics/dashboards` | [ ] |
| AN-07 | API | `GET/PUT/DELETE /analytics/dashboards/{id}` | [ ] |
| AN-08 | API | `GET/POST /analytics/dashboards/{id}/widgets` | [ ] |
| AN-09 | API | `PUT/DELETE /analytics/widgets/{id}` | [ ] |
| AN-10 | API | `POST /analytics/query` — execute ad-hoc query (read-only) | [ ] |
| AN-11 | API | `GET/POST /analytics/saved-queries` | [ ] |
| AN-12 | API | `GET/POST /analytics/reports` | [ ] |
| AN-13 | API | `POST /analytics/reports/{id}/run` — generate report now | [ ] |
| AN-14 | API | `GET /analytics/reports/{id}/download` | [ ] |
| AN-15 | API | `GET/POST /analytics/alerts` | [ ] |
| AN-16 | API | `GET /analytics/modules/{module}/kpis` — pre-built KPIs | [ ] |
| AN-17 | API | `GET /analytics/modules/{module}/trends` | [ ] |
| AN-18 | API | `GET /analytics/cross-module/summary` — executive overview | [ ] |
| AN-19 | Library | Choose chart library (Recharts recommended — React-native) | [ ] |
| AN-20 | Library | Implement chart wrapper components | [ ] |
| AN-21 | Page | Analytics home (list dashboards) | [ ] |
| AN-22 | Page | Dashboard builder (drag-and-drop widgets) | [ ] |
| AN-23 | Page | Widget: Line chart (trends) | [ ] |
| AN-24 | Page | Widget: Bar chart (comparisons) | [ ] |
| AN-25 | Page | Widget: Pie/donut chart (distributions) | [ ] |
| AN-26 | Page | Widget: KPI card (single metric + trend) | [ ] |
| AN-27 | Page | Widget: Data table (grid) | [ ] |
| AN-28 | Page | Widget: Heatmap | [ ] |
| AN-29 | Page | Widget: Funnel chart | [ ] |
| AN-30 | Page | Widget: Gauge chart | [ ] |
| AN-31 | Page | Query builder (visual, no SQL required) | [ ] |
| AN-32 | Page | SQL editor (advanced users) | [ ] |
| AN-33 | Page | Report scheduler | [ ] |
| AN-34 | Page | Alert configuration | [ ] |
| AN-35 | Page | Pre-built: Finance dashboard (revenue, expenses, P&L trend) | [ ] |
| AN-36 | Page | Pre-built: CRM dashboard (pipeline, conversion rates) | [ ] |
| AN-37 | Page | Pre-built: HR dashboard (headcount, attrition, leave) | [ ] |
| AN-38 | Page | Pre-built: Inventory dashboard (stock levels, turnover) | [ ] |
| AN-39 | Page | Pre-built: E-Commerce dashboard (orders, revenue) | [ ] |
| AN-40 | Page | Pre-built: Support dashboard (tickets, resolution time) | [ ] |
| AN-41 | Page | Pre-built: Manufacturing dashboard (OEE, production) | [ ] |
| AN-42 | Page | Executive dashboard (cross-module KPIs) | [ ] |
| AN-43 | Page | Export to PDF/Excel | [ ] |
| AN-44 | Page | Dashboard sharing + embedding | [ ] |
| AN-45 | Integration | Direct PostgreSQL queries (read-only connection) | [ ] |
| AN-46 | Integration | All modules expose KPI endpoints | [ ] |
| AN-47 | Integration | Scheduled report generation (Celery beat) | [ ] |
| AN-48 | Integration | Report → Mail: email scheduled reports | [ ] |
| AN-49 | Integration | Report → Drive: save generated reports | [ ] |
| AN-50 | Integration | AI insight generation (anomaly detection, trend narration) | [ ] |
| AN-51 | Integration | AI natural language queries ("show me revenue by month") | [ ] |
| AN-52 | Test | Query execution tests (safe, read-only) | [ ] |
| AN-53 | Test | Widget rendering tests | [ ] |
| AN-54 | Test | Report generation tests | [ ] |
| AN-55 | Test | Alert trigger tests | [ ] |
| AN-56 | Test | Dashboard CRUD tests | [ ] |
| AN-57 | Mobile | Responsive dashboard layout | [ ] |
| AN-58 | Mobile | Mobile-friendly charts | [ ] |
| AN-59 | Mobile | Swipe between dashboards | [ ] |

---

## TIER 4 — Projects + Calendar + Docs + Teams Enhancements

### 4.1 Projects — Gantt, Dependencies, Milestones

| ID | Layer | Item | Status |
|----|-------|------|--------|
| PRJ-01 | Model | `TaskDependency` (task_id, depends_on_task_id, type: finish_to_start/start_to_start) | [ ] |
| PRJ-02 | Model | `ProjectMilestone` (project_id, name, due_date, status: open/completed) | [ ] |
| PRJ-03 | Model | `TaskAttachment` (task_id, file_id) | [ ] |
| PRJ-04 | Model | `ProjectTemplate` (name, tasks JSON, settings JSON) | [ ] |
| PRJ-05 | API | `PUT /tasks/{id}/position` — Kanban reorder | [ ] |
| PRJ-06 | API | `POST /tasks/{id}/dependencies` | [ ] |
| PRJ-07 | API | `DELETE /tasks/{id}/dependencies/{dep_id}` | [ ] |
| PRJ-08 | API | `GET/POST /projects/{id}/milestones` | [ ] |
| PRJ-09 | API | `PUT /projects/milestones/{id}` | [ ] |
| PRJ-10 | API | `GET /projects/{id}/timeline` — Gantt data | [ ] |
| PRJ-11 | API | `GET /projects/{id}/report` — hours, progress, burndown | [ ] |
| PRJ-12 | API | `POST /projects/from-template` | [ ] |
| PRJ-13 | API | `GET /projects/templates` | [ ] |
| PRJ-14 | Page | Gantt chart view (dhtmlxGantt or frappe-gantt) | [ ] |
| PRJ-15 | Page | Task dependencies visualization (arrows on Gantt) | [ ] |
| PRJ-16 | Page | Project milestones timeline | [ ] |
| PRJ-17 | Page | Burndown / velocity charts | [ ] |
| PRJ-18 | Page | Project dashboard (summary stats) | [ ] |
| PRJ-19 | Page | Workload view (team member capacity) | [ ] |
| PRJ-20 | Page | Board customization (custom columns/labels) | [ ] |
| PRJ-21 | Page | Task templates | [ ] |
| PRJ-22 | Page | Bulk task operations | [ ] |
| PRJ-23 | Integration | Projects → Finance: project costs tracking | [ ] |
| PRJ-24 | Integration | Projects → Drive: project files folder | [ ] |
| PRJ-25 | Integration | Projects → Mail: task notifications via email | [ ] |
| PRJ-26 | Integration | Projects → CRM: link projects to deals | [ ] |
| PRJ-27 | Integration | Projects → Docs: project documentation | [ ] |
| PRJ-28 | Integration | AI task estimation | [ ] |
| PRJ-29 | Integration | AI project risk analysis | [ ] |
| PRJ-30 | Test | Kanban reorder tests | [ ] |
| PRJ-31 | Test | Time logging tests | [ ] |
| PRJ-32 | Test | Dependency tests | [ ] |
| PRJ-33 | Mobile | Responsive Kanban board | [ ] |
| PRJ-34 | Mobile | Mobile task detail view | [ ] |
| PRJ-35 | Mobile | Quick task creation | [ ] |

### 4.2 Calendar — Enhancements

| ID | Layer | Item | Status |
|----|-------|------|--------|
| CAL-01 | Model | `CalendarSubscription` (user_id, external_ical_url, sync_interval, last_synced) | [ ] |
| CAL-02 | Model | `CalendarCategory` (name, color, user_id) | [ ] |
| CAL-03 | API | `GET /calendar/events/recurring` — expand recurrence instances | [ ] |
| CAL-04 | API | `POST /calendar/events/{id}/rsvp` | [ ] |
| CAL-05 | API | `GET /calendar/availability` — free/busy lookup | [ ] |
| CAL-06 | API | `POST /calendar/subscriptions` — subscribe to external iCal | [ ] |
| CAL-07 | API | `GET/POST /calendar/categories` | [ ] |
| CAL-08 | API | `POST /calendar/events/{id}/duplicate` | [ ] |
| CAL-09 | API | `GET /calendar/events/export` — iCal export | [ ] |
| CAL-10 | Page | Agenda/list view | [ ] |
| CAL-11 | Page | Multi-calendar sidebar (toggle calendars on/off) | [ ] |
| CAL-12 | Page | Drag-and-drop event rescheduling | [ ] |
| CAL-13 | Page | Event detail popover (quick view) | [ ] |
| CAL-14 | Page | Recurring event editor (daily/weekly/monthly/custom) | [ ] |
| CAL-15 | Page | Free/busy scheduling assistant | [ ] |
| CAL-16 | Page | Mini calendar in sidebar | [ ] |
| CAL-17 | Page | Calendar sharing UI | [ ] |
| CAL-18 | Page | Print view | [ ] |
| CAL-19 | Integration | Calendar → Mail: send event invites via email | [ ] |
| CAL-20 | Integration | Calendar → Notifications: reminders (push + email) | [ ] |
| CAL-21 | Integration | HR → Calendar: leave/holidays displayed | [ ] |
| CAL-22 | Integration | AI scheduling suggestions | [ ] |
| CAL-23 | Test | Recurrence expansion tests | [ ] |
| CAL-24 | Test | Timezone handling tests | [ ] |
| CAL-25 | Mobile | Responsive calendar views | [ ] |
| CAL-26 | Mobile | Mobile event creation | [ ] |
| CAL-27 | Mobile | Swipe between days/weeks | [ ] |

### 4.3 Docs — ONLYOFFICE Wrapper Enhancements

| ID | Layer | Item | Status |
|----|-------|------|--------|
| DOC-01 | Model | `DocumentComment` (document_id, content, author_id, resolved, position_data JSON) | [ ] |
| DOC-02 | Model | `DocumentTemplate` (name, type, file_path, category, is_system) | [ ] |
| DOC-03 | Model | `RecentDocument` (user_id, document_id, last_opened) | [ ] |
| DOC-04 | API | `GET /docs/{id}/versions` — version history | [ ] |
| DOC-05 | API | `POST /docs/{id}/restore/{version}` | [ ] |
| DOC-06 | API | `GET/POST /docs/{id}/permissions` | [ ] |
| DOC-07 | API | `DELETE /docs/{id}/permissions/{user_id}` | [ ] |
| DOC-08 | API | `GET/POST /docs/{id}/comments` | [ ] |
| DOC-09 | API | `PUT /docs/{id}/comments/{comment_id}/resolve` | [ ] |
| DOC-10 | API | `POST /docs/from-template/{template_id}` | [ ] |
| DOC-11 | API | `GET /docs/templates` | [ ] |
| DOC-12 | API | `POST /docs/{id}/export` — PDF, Office formats | [ ] |
| DOC-13 | API | `POST /docs/{id}/ai-generate` | [ ] |
| DOC-14 | API | `POST /docs/{id}/ai-summarize` | [ ] |
| DOC-15 | API | `GET /docs/recent` | [ ] |
| DOC-16 | Page | Our own ribbon toolbar wrapper (consistent branding) | [ ] |
| DOC-17 | Page | File picker / create new dialog (Doc/Spreadsheet/Presentation) | [ ] |
| DOC-18 | Page | Version history sidebar | [ ] |
| DOC-19 | Page | Permission sharing dialog (integrated with Drive) | [ ] |
| DOC-20 | Page | Template gallery | [ ] |
| DOC-21 | Page | Recent documents dashboard widget | [ ] |
| DOC-22 | Page | Comment sidebar panel | [ ] |
| DOC-23 | Page | AI generation panel (generate, summarize, translate) | [ ] |
| DOC-24 | Page | Print preview | [ ] |
| DOC-25 | ONLYOFFICE | JWT token security for editor sessions | [ ] |
| DOC-26 | ONLYOFFICE | Conversion API integration (format conversions) | [ ] |
| DOC-27 | ONLYOFFICE | Co-editing user presence indicators | [ ] |
| DOC-28 | Integration | Docs → Drive: all files stored in MinIO via Drive API | [ ] |
| DOC-29 | Integration | Docs → Projects: link documents to tasks | [ ] |
| DOC-30 | Integration | Docs → Finance: generate invoices as documents | [ ] |
| DOC-31 | Integration | Docs → Mail: attach documents to emails | [ ] |
| DOC-32 | Integration | AI document generation from templates | [ ] |
| DOC-33 | Integration | AI summarization + translation | [ ] |
| DOC-34 | Test | Document CRUD tests | [ ] |
| DOC-35 | Test | Permission enforcement tests | [ ] |
| DOC-36 | Test | Version history tests | [ ] |
| DOC-37 | Test | ONLYOFFICE callback handler tests | [ ] |
| DOC-38 | Mobile | Responsive document list | [ ] |
| DOC-39 | Mobile | Mobile-friendly editor (ONLYOFFICE mobile mode) | [ ] |

### 4.4 Teams/Meetings — Jitsi Wrapper Enhancements

| ID | Layer | Item | Status |
|----|-------|------|--------|
| MTG-01 | Model | `MeetingRecording` (meeting_id, file_id, duration, size, recorded_at) | [ ] |
| MTG-02 | Model | `MeetingChat` (meeting_id, messages JSON, exported_at) | [ ] |
| MTG-03 | Model | `MeetingTemplate` (name, default_duration, default_settings, recurring_pattern) | [ ] |
| MTG-04 | Model | `MeetingNote` (meeting_id, content, author_id, created_at) | [ ] |
| MTG-05 | API | `POST /meetings/{id}/invite` — send invites via Mail | [ ] |
| MTG-06 | API | `PUT /meetings/{id}/attendees/{user_id}/respond` | [ ] |
| MTG-07 | API | `GET /meetings/{id}/recording` | [ ] |
| MTG-08 | API | `POST /meetings/{id}/start` — generate join link | [ ] |
| MTG-09 | API | `POST /meetings/{id}/end` | [ ] |
| MTG-10 | API | `GET /meetings/{id}/chat-export` | [ ] |
| MTG-11 | API | `POST /meetings/{id}/ai-summarize` | [ ] |
| MTG-12 | API | `GET /meetings/upcoming` — dashboard widget | [ ] |
| MTG-13 | API | `POST /meetings/instant` — quick meeting | [ ] |
| MTG-14 | API | `GET /meetings/recurring` | [ ] |
| MTG-15 | Page | Our own meeting lobby UI (branded, not Jitsi default) | [ ] |
| MTG-16 | Page | In-meeting controls overlay (mute, camera, share, chat, record) | [ ] |
| MTG-17 | Page | Meeting detail page (info, attendees, recordings, notes) | [ ] |
| MTG-18 | Page | Recording playback page | [ ] |
| MTG-19 | Page | Meeting scheduler (calendar-integrated) | [ ] |
| MTG-20 | Page | Recurring meeting setup | [ ] |
| MTG-21 | Page | Meeting templates | [ ] |
| MTG-22 | Page | Post-meeting summary view (AI-generated) | [ ] |
| MTG-23 | Page | Meeting dashboard widget (upcoming meetings) | [ ] |
| MTG-24 | Jitsi | JWT authentication for rooms (secure access) | [ ] |
| MTG-25 | Jitsi | Custom UI theme (our branding) | [ ] |
| MTG-26 | Jitsi | Breakout rooms configuration | [ ] |
| MTG-27 | Integration | Meetings → Projects: link meetings to tasks | [ ] |
| MTG-28 | Integration | Meetings → Notes: auto-create meeting notes | [ ] |
| MTG-29 | Integration | Meetings → CRM: link meetings to contacts/deals | [ ] |
| MTG-30 | Integration | AI meeting summarization (transcribe + summarize) | [ ] |
| MTG-31 | Integration | AI action items extraction | [ ] |
| MTG-32 | Test | Meeting CRUD tests | [ ] |
| MTG-33 | Test | Attendee management tests | [ ] |
| MTG-34 | Test | Recording webhook handler tests | [ ] |
| MTG-35 | Mobile | Mobile meeting join experience | [ ] |
| MTG-36 | Mobile | Responsive meeting list | [ ] |

---

## TIER 5 — Mail, Drive, Notes, Forms, AI Enhancements

### 5.1 Mail — Threaded Conversations + Search + Labels

| ID | Layer | Item | Status |
|----|-------|------|--------|
| MAIL-01 | Model | `MailThread` (thread grouping by references/in-reply-to headers) | [ ] |
| MAIL-02 | Model | `MailLabel` (name, color, user_id) | [ ] |
| MAIL-03 | Model | `MailFilter` (server-side filtering, Sieve-compatible rules) | [ ] |
| MAIL-04 | API | `GET /mail/threads` — threaded conversation view | [ ] |
| MAIL-05 | API | `POST /mail/messages/draft` — save draft | [ ] |
| MAIL-06 | API | `GET /mail/search` — full-text search across all mail | [ ] |
| MAIL-07 | API | `GET/POST /mail/labels` | [ ] |
| MAIL-08 | API | `PUT/DELETE /mail/labels/{id}` | [ ] |
| MAIL-09 | API | `POST /mail/messages/{id}/snooze` | [ ] |
| MAIL-10 | API | `GET /mail/contacts` — synced from CardDAV | [ ] |
| MAIL-11 | Page | Threaded conversation view (Gmail-style) | [ ] |
| MAIL-12 | Page | Full-text search with filters (date, from, has:attachment) | [ ] |
| MAIL-13 | Page | Label management UI | [ ] |
| MAIL-14 | Page | Snooze/schedule send UI | [ ] |
| MAIL-15 | Page | Contact picker (autocomplete from DB) | [ ] |
| MAIL-16 | Page | Drag-and-drop between folders | [ ] |
| MAIL-17 | Page | Keyboard shortcuts (j/k navigate, r reply, a archive) | [ ] |
| MAIL-18 | Integration | Mail → Drive: save attachments to Drive one click | [ ] |
| MAIL-19 | Integration | Mail → CRM: link emails to contacts/deals | [ ] |
| MAIL-20 | Integration | Mail → Projects: convert email to task | [ ] |
| MAIL-21 | Integration | Mail → Notes: save email content as note | [ ] |
| MAIL-22 | Integration | AI thread summarization | [ ] |
| MAIL-23 | Integration | AI smart categorization (auto-label) | [ ] |
| MAIL-24 | Admin | Mail server configuration (domain, TLS certs) | [ ] |
| MAIL-25 | Admin | Global mail policies (max attachment size, retention) | [ ] |
| MAIL-26 | Admin | Spam filtering configuration | [ ] |
| MAIL-27 | Admin | Mail quotas per user | [ ] |
| MAIL-28 | Test | Send/receive email tests | [ ] |
| MAIL-29 | Test | Rule engine tests | [ ] |
| MAIL-30 | Test | Thread grouping tests | [ ] |
| MAIL-31 | Test | Search indexing tests | [ ] |
| MAIL-32 | Mobile | Responsive inbox layout | [ ] |
| MAIL-33 | Mobile | Swipe actions (archive, delete, snooze) | [ ] |
| MAIL-34 | Mobile | Mobile compose view | [ ] |

### 5.2 Drive — File Preview + Trash + Versioning

| ID | Layer | Item | Status |
|----|-------|------|--------|
| DRV-01 | Model | `FileTag` (file_id, tag_name) | [ ] |
| DRV-02 | Model | `FileComment` (file_id, user_id, content, created_at) | [ ] |
| DRV-03 | Model | `TrashBin` (file_id, deleted_at, deleted_by, auto_purge_at) | [ ] |
| DRV-04 | API | `POST /drive/files/{id}/copy` | [ ] |
| DRV-05 | API | `POST /drive/files/bulk-delete` | [ ] |
| DRV-06 | API | `POST /drive/files/bulk-move` | [ ] |
| DRV-07 | API | `GET /drive/files/{id}/versions` | [ ] |
| DRV-08 | API | `POST /drive/files/{id}/restore` — from trash | [ ] |
| DRV-09 | API | `GET /drive/trash` | [ ] |
| DRV-10 | API | `DELETE /drive/trash` — empty trash | [ ] |
| DRV-11 | API | `GET /drive/storage/usage` — quota info | [ ] |
| DRV-12 | API | `GET /drive/files/search` — full-text + metadata | [ ] |
| DRV-13 | Page | Breadcrumb navigation | [ ] |
| DRV-14 | Page | File preview panel (images, PDFs, text, video) | [ ] |
| DRV-15 | Page | Trash bin view + restore | [ ] |
| DRV-16 | Page | Storage usage indicator | [ ] |
| DRV-17 | Page | File versioning UI | [ ] |
| DRV-18 | Page | Bulk selection + actions toolbar | [ ] |
| DRV-19 | Page | Right-click context menu (full) | [ ] |
| DRV-20 | Page | Drag-and-drop between folders | [ ] |
| DRV-21 | Page | Search with filters (type, date, size, shared) | [ ] |
| DRV-22 | Page | Favorites / pinned files | [ ] |
| DRV-23 | Integration | Drive → Docs: open files in ONLYOFFICE | [ ] |
| DRV-24 | Integration | Drive → Mail: attach files from Drive | [ ] |
| DRV-25 | Integration | Drive → Projects: link files to tasks | [ ] |
| DRV-26 | Integration | AI file organization suggestions | [ ] |
| DRV-27 | Integration | AI document search (semantic via embeddings) | [ ] |
| DRV-28 | Integration | Thumbnail generation for images/PDFs | [ ] |
| DRV-29 | Admin | Storage quotas per user/team | [ ] |
| DRV-30 | Admin | File type restrictions | [ ] |
| DRV-31 | Admin | Retention policies | [ ] |
| DRV-32 | Test | Permission enforcement tests | [ ] |
| DRV-33 | Test | Team folder membership tests | [ ] |
| DRV-34 | Test | Bulk operation tests | [ ] |
| DRV-35 | Mobile | Responsive file browser | [ ] |
| DRV-36 | Mobile | Mobile upload (camera + files) | [ ] |

### 5.3 Notes — Folders + Sharing + Templates

| ID | Layer | Item | Status |
|----|-------|------|--------|
| NOTE-01 | Model | `NoteTag` (note_id, tag_name) | [ ] |
| NOTE-02 | Model | `NoteShare` (note_id, shared_with_user_id, permission: view/edit) | [ ] |
| NOTE-03 | Model | `NoteTemplate` (name, content_html, category) | [ ] |
| NOTE-04 | API | `GET/POST /notes/folders` | [ ] |
| NOTE-05 | API | `PUT/DELETE /notes/folders/{id}` | [ ] |
| NOTE-06 | API | `POST /notes/{id}/share` | [ ] |
| NOTE-07 | API | `GET /notes/tags` — list all tags | [ ] |
| NOTE-08 | API | `POST /notes/{id}/duplicate` | [ ] |
| NOTE-09 | API | `POST /notes/{id}/export` — PDF/Markdown | [ ] |
| NOTE-10 | API | `POST /notes/ai-summarize` | [ ] |
| NOTE-11 | API | `GET /notes/search` — full-text | [ ] |
| NOTE-12 | API | `GET /notes/templates` | [ ] |
| NOTE-13 | Page | Folder sidebar / notebook organization | [ ] |
| NOTE-14 | Page | Note sharing dialog | [ ] |
| NOTE-15 | Page | Tag management | [ ] |
| NOTE-16 | Page | Linked items sidebar | [ ] |
| NOTE-17 | Page | Note templates gallery | [ ] |
| NOTE-18 | Page | AI summarization button | [ ] |
| NOTE-19 | Page | Export options (PDF, Markdown, plain text) | [ ] |
| NOTE-20 | Page | Color/pin controls | [ ] |
| NOTE-21 | Page | Markdown toggle (WYSIWYG ↔ Markdown) | [ ] |
| NOTE-22 | Page | Table of contents for long notes | [ ] |
| NOTE-23 | Integration | Notes → Drive: embed/attach files | [ ] |
| NOTE-24 | Integration | Notes → Calendar: create event from note | [ ] |
| NOTE-25 | Integration | Notes → Mail: email a note | [ ] |
| NOTE-26 | Integration | AI auto-tagging | [ ] |
| NOTE-27 | Test | Note CRUD tests | [ ] |
| NOTE-28 | Test | Deep linking tests | [ ] |
| NOTE-29 | Test | Folder organization tests | [ ] |
| NOTE-30 | Mobile | Responsive note list | [ ] |
| NOTE-31 | Mobile | Mobile-friendly editor | [ ] |

### 5.4 Forms — Conditional Logic + Templates

| ID | Layer | Item | Status |
|----|-------|------|--------|
| FORM-01 | Model | `FormTemplate` (name, schema JSON, category) | [ ] |
| FORM-02 | Model | `FormCollaborator` (form_id, user_id, role: editor/viewer) | [ ] |
| FORM-03 | API | `GET /forms/{id}/analytics` — response statistics | [ ] |
| FORM-04 | API | `POST /forms/{id}/duplicate` | [ ] |
| FORM-05 | API | `PUT /forms/{id}/publish` | [ ] |
| FORM-06 | API | `GET /forms/templates` | [ ] |
| FORM-07 | API | `POST /forms/from-template/{template_id}` | [ ] |
| FORM-08 | API | `POST /forms/{id}/share` — public link | [ ] |
| FORM-09 | Page | Response analytics dashboard (charts, summaries) | [ ] |
| FORM-10 | Page | Form templates gallery | [ ] |
| FORM-11 | Page | Conditional logic builder (show/hide fields by rules) | [ ] |
| FORM-12 | Page | Multi-page forms | [ ] |
| FORM-13 | Page | File upload fields | [ ] |
| FORM-14 | Page | Form sharing / embedding options | [ ] |
| FORM-15 | Page | Thank you page customization | [ ] |
| FORM-16 | Page | Response notification settings | [ ] |
| FORM-17 | Integration | Forms → Mail: notification on submission | [ ] |
| FORM-18 | Integration | Forms → Projects: create tasks from responses | [ ] |
| FORM-19 | Integration | Forms → CRM: create leads from responses | [ ] |
| FORM-20 | Integration | AI form generation from description | [ ] |
| FORM-21 | Test | Form CRUD tests | [ ] |
| FORM-22 | Test | Response submission tests | [ ] |
| FORM-23 | Test | Export tests (CSV/XLSX) | [ ] |
| FORM-24 | Mobile | Responsive form builder | [ ] |
| FORM-25 | Mobile | Mobile-friendly form filling | [ ] |

### 5.5 AI — Additional Tools + Prompt Templates + KB Management

| ID | Layer | Item | Status |
|----|-------|------|--------|
| AI-01 | Model | `AIPromptTemplate` (name, template, module, variables JSON, created_by) | [ ] |
| AI-02 | Model | `AIKnowledgeBase` (name, documents, embeddings, module) | [ ] |
| AI-03 | API | `POST /ai/templates` — prompt templates CRUD | [ ] |
| AI-04 | API | `POST /ai/knowledge-base` — upload documents for RAG | [ ] |
| AI-05 | API | `GET /ai/usage` — token usage stats | [ ] |
| AI-06 | Tools | Calendar tools (schedule meeting, check availability) | [ ] |
| AI-07 | Tools | Mail tools (compose, search, summarize thread) | [ ] |
| AI-08 | Tools | Drive tools (find file, share, organize) | [ ] |
| AI-09 | Tools | Projects tools (create task, log time) | [ ] |
| AI-10 | Tools | Analytics tools (generate report, query data) | [ ] |
| AI-11 | Page | Conversation history browser | [ ] |
| AI-12 | Page | Prompt template editor | [ ] |
| AI-13 | Page | AI usage dashboard (token consumption, cost) | [ ] |
| AI-14 | Page | Knowledge base management UI | [ ] |
| AI-15 | Test | Tool-calling integration tests | [ ] |
| AI-16 | Test | WebSocket chat tests | [ ] |
| AI-17 | Test | RAG query tests | [ ] |
| AI-18 | Mobile | Mobile chat interface | [ ] |
| AI-19 | Mobile | Voice input on mobile | [ ] |

---

## TIER 6 — Admin + Global Responsive

| ID | Layer | Item | Status |
|----|-------|------|--------|
| ADM-01 | Mobile | Responsive admin tables | [ ] |
| ADM-02 | Mobile | Mobile-friendly navigation | [ ] |

---

## Summary by Tier

| Tier | Description | Item Count |
|------|-------------|------------|
| 0 | Cleanup (orphaned files) | 4 |
| 1 | Core ERP gaps (Finance, HR, CRM, Inventory) | 159 |
| 2 | Module feature completion (E-Commerce, POS, Supply Chain, Manufacturing, Support) | 212 |
| 3 | Analytics platform (full build) | 59 |
| 4 | Projects, Calendar, Docs, Teams enhancements | 137 |
| 5 | Mail, Drive, Notes, Forms, AI enhancements | 145 |
| 6 | Admin responsive | 2 |
| **TOTAL** | | **718** |

---

## Execution Order Recommendation

```
Tier 0 → Tier 1 (Finance → HR → CRM → Inventory)
       → Tier 2 (E-Commerce → POS → Support → Supply Chain → Manufacturing)
       → Tier 3 (Analytics)
       → Tier 4 (Projects → Calendar → Docs → Teams)
       → Tier 5 (Mail → Drive → Notes → Forms → AI)
       → Tier 6 (Responsive polish)
```

Within each module, follow this build order:
1. **Models** → migration
2. **API endpoints** → test
3. **Frontend pages** → connect to API
4. **Integrations** → cross-module wiring
5. **Mobile/responsive** → last

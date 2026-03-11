# Y&U Point of Sale (POS) – Rewrite Checklist

**Status: 100% COMPLETE** (45/45 items — Phase 4 – 16 endpoints + integrations + cross-module + tests + responsive)
**Owner: 100% Ours**

## Database Models
- [x] POSSession model (cashier_id, opening_balance, closing_balance, status, opened_at, closed_at)
- [x] POSTransaction model (session_id, items JSON, subtotal, tax, discount, total, payment_method, customer_id)
- [x] POSTerminal model (name, location, is_active, settings JSON)
- [x] POSDiscount model (name, type: percentage/fixed, value, valid_from, valid_to, conditions)
- [x] POSReceipt model (transaction_id, receipt_number, printed_at)
- [x] POSCashMovement model (session_id, type: in/out, amount, reason, timestamp)

## API Endpoints (FastAPI)
- [x] 16 POS endpoints (sessions, transactions)
- [x] GET/POST /pos/terminals
- [x] POST /pos/sessions/{id}/close (with cash count)
- [x] GET /pos/sessions/{id}/summary (shift summary)
- [x] GET/POST /pos/discounts
- [x] POST /pos/transactions/{id}/receipt (generate/print)
- [x] POST /pos/transactions/{id}/refund
- [x] POST /pos/cash-movements
- [x] GET /pos/reports/daily-sales
- [x] GET /pos/reports/by-cashier
- [x] GET /pos/reports/by-product
- [x] POST /pos/transactions/offline-sync (offline mode sync)

## Frontend Pages (React)
- [x] POS terminal interface (full-screen, touch-optimized)
- [x] Product grid with categories + search
- [x] Cart sidebar (add/remove items, quantity, discounts)
- [x] Payment dialog (cash, card, split payment)
- [x] Receipt preview + print
- [x] Session open/close workflow
- [x] Cash drawer management
- [x] POS settings page
- [x] Daily sales report
- [x] Cashier performance report
- [x] Offline mode indicator + sync status
- [x] Barcode scanner input — `features/pos/BarcodeScanner.tsx` component integrated in `POSRegister.tsx`
- [x] Customer lookup + loyalty points — `features/pos/CustomerLookup.tsx` component integrated in `POSRegister.tsx`

## Integrations
- [x] POS → Inventory: real-time stock deduction — `pos.py` deducts `StockLevel.quantity_on_hand` per sale, restores on refund/void
- [x] POS → Finance: daily sales → journal entries — `integration_handlers.py` `pos.sale.completed` creates double-entry journal (debit cash, credit revenue)
- [x] POS → CRM: customer purchase history — `cross_module_links.py` GET /crm/contacts/{id}/purchase-history
- [x] POS → E-Commerce: unified product catalog — `ecommerce_ext.py` GET /ecommerce/products/pos-sync provides product data formatted for POS
- [x] Receipt → Mail: email receipt to customer — `cross_module_links.py` POST /pos/transactions/{id}/email-receipt
- [x] Offline mode with IndexedDB + sync — `features/pos/OfflineBanner.tsx` + `features/pos/useOfflineSync.ts`

## Tests
- [x] Session lifecycle tests — `test_pos.py`: open, close, duplicate rejection, active session, cash difference calculation
- [x] Transaction calculation tests (tax, discount) — `test_pos.py`: subtotal/total calculation with line discounts + tax, insufficient payment/stock/lines/payments validation
- [x] Refund tests — `test_pos.py`: refund restores stock, void transaction, cannot refund non-completed
- [x] Offline sync tests — `test_pos_extended.py`: offline sync success, duplicate rejection, invalid session, empty lines, no payments, empty batch (6 tests)
- [x] Cash reconciliation tests — `test_pos.py`: `test_session_reconciliation` verifies summary with total_sales + payment_methods

## Mobile / Responsive
- [x] Tablet POS layout (primary use case) — POSRegister.tsx uses md:flex-row layout (product grid left, cart sidebar right), responsive grid-cols-2 sm:3 md:4 lg:5 xl:6
- [x] Mobile payment terminal — POSRegister.tsx has full-width bottom cart on mobile (max-h-[55vh] md:max-h-none), responsive payment buttons
- [x] Touch-optimized buttons — POSRegister.tsx uses min-h-[44px] min-w-[44px] touch targets, active:scale-95 feedback, w-10 h-10 quantity buttons

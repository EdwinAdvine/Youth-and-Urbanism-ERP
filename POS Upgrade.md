Ready for review
Select text to add comments on the plan
POS Module Upgrade Plan — Square + Shopify + Lightspeed Hybrid
Context
The Urban ERP POS module already has a solid foundation: 8 models, ~2,245 lines of backend endpoints, 16 frontend components, and cross-module integrations to Finance (auto-invoice + journal entry), Inventory (stock deduction + low-stock alerts), E-Commerce (product sync), and CRM (purchase history + email receipt). However, it lacks loyalty/rewards, payment gateway integration, gift cards/store credit, bundles/modifiers, hold/layaway, tipping, KDS, BOPIS, AI cashier assistant, HR attendance sync, and commission tracking. Four tables (pos_terminals, pos_discounts, pos_receipts, pos_cash_movements) exist as models but lack Alembic migrations.

This plan upgrades the POS to match the best of Square (speed, tipping, offline), Shopify (omnichannel, BOPIS), and Lightspeed (inventory intelligence, reporting depth) while integrating deeply with existing ERP modules.

Phase 0: Foundation & Debt Cleanup (Week 1-2)
0.1 Migrate unmigrated tables
Run alembic revision --autogenerate to create migration for pos_terminals, pos_discounts, pos_receipts, pos_cash_movements
File: New migration in backend/alembic/versions/
0.2 Extend existing models
Modify backend/app/models/pos.py:
POSSession: add terminal_id (FK → pos_terminals.id, nullable)
POSTransaction: add customer_id (FK → crm_contacts.id, nullable), tip_amount (Numeric(15,2) default 0), held_at (DateTime nullable), expand status to include held, layaway
POSTransactionLine: add variant_id (FK → inventory_item_variants.id, nullable), batch_id (FK → inventory_batch_numbers.id, nullable), modifiers (JSON nullable)
Migration: New Alembic revision
Phase 1: MVP Core Sales Enhancements (Months 1-2)
1.1 Product Bundles & Modifiers
New models in backend/app/models/pos.py:

POSBundle (name, bundle_price, is_active)
POSBundleItem (bundle_id, item_id, quantity)
POSModifierGroup (name, selection_type: single/multiple, is_required, min/max_selections)
POSModifier (group_id, name, price_adjustment, is_active)
POSProductModifierLink (item_id, modifier_group_id)
New endpoints appended to backend/app/api/v1/pos_ext.py:

CRUD for bundles, modifier groups, modifiers
GET /pos/products/{item_id}/modifiers
Modify create_transaction in backend/app/api/v1/pos.py:

Accept bundle_id in TransactionLineIn — explode into component items for stock deduction
Accept modifiers (list of modifier IDs) — apply price adjustments
New frontend files:

frontend/src/features/pos/BundlesPage.tsx
frontend/src/features/pos/ModifierGroupsPage.tsx
frontend/src/api/pos-bundles.ts
Modify POSRegister.tsx — modifier selection dialog, bundle support in product grid
1.2 Hold/Suspend Transactions (Layaway)
New endpoints in backend/app/api/v1/pos.py:

POST /pos/transactions/{txn_id}/hold — set status "held", reserve stock via StockLevel.quantity_reserved
GET /pos/transactions/held — list held transactions
POST /pos/transactions/{txn_id}/resume — restore to active cart
POST /pos/transactions/{txn_id}/cancel-hold — cancel, release reserved stock
New frontend: frontend/src/features/pos/HeldTransactions.tsx Modify: POSRegister.tsx — "Hold" button, "Held Orders" panel

1.3 Split Payments Enhancement
Backend already supports multiple TransactionPaymentIn entries — just needs frontend UI.

New frontend: frontend/src/features/pos/SplitPaymentDialog.tsx Modify: POSRegister.tsx — split payment dialog at checkout

1.4 Tipping Support
Uses tip_amount added in Phase 0.

Modify TransactionCreateIn schema + create_transaction in backend/app/api/v1/pos.py — add tip_amount to total calculation New endpoint: GET /pos/reports/tips — tips by cashier/session/date

New frontend: frontend/src/features/pos/TipDialog.tsx (percentage presets: 10%, 15%, 20%, custom) Modify: POSRegister.tsx — tip step before final payment

1.5 Quick-Add Product from Register
New endpoint in backend/app/api/v1/pos.py:

POST /pos/products/quick-add — creates InventoryItem + StockLevel in session warehouse
New frontend: frontend/src/features/pos/QuickAddProductDialog.tsx Modify: POSRegister.tsx — "+" button in product grid

1.6 Auto-Create CRM Contact from POS Sale
New event handler in backend/app/core/integration_handlers.py:

On pos.sale.completed: if customer_email provided, check/create CRM Contact with source="pos", update transaction's customer_id
1.7 Variant Selection in POS
New endpoint: GET /pos/products/{item_id}/variants — returns ItemVariant list with stock levels (reuses existing ItemVariant model in backend/app/models/inventory.py)

New frontend: frontend/src/features/pos/VariantSelector.tsx Modify: POSRegister.tsx — variant matrix before adding to cart

1.8 X/Z Readings (Fiscal Reports)
New endpoints in backend/app/api/v1/pos_ext.py:

GET /pos/sessions/{session_id}/x-reading — mid-shift non-closing report
GET /pos/sessions/{session_id}/z-reading — end-of-day fiscal report
New frontend: frontend/src/features/pos/XZReadingPage.tsx Modify: POSSessionDetail.tsx — X/Z reading buttons

Phase 1 Migration
alembic revision --autogenerate -m "pos_bundles_modifiers"

Phase 1 Verification
Create bundle → sell → verify component stock deduction
Hold transaction → verify quantity_reserved incremented → resume → complete
Split payment cash + card → verify totals
Tip on transaction → verify in session summary
Quick-add product → sell immediately
X-reading mid-session, Z-reading at close
Phase 2: Payments, Loyalty & Omnichannel (Months 3-4)
2.1 Gift Cards & Store Credit
New models in backend/app/models/pos.py:

POSGiftCard (card_number, original_amount, current_balance, customer_id, expires_at, is_active)
POSGiftCardTransaction (gift_card_id, transaction_id, amount, balance_after)
POSStoreCredit (customer_id, balance)
POSStoreCreditTransaction (store_credit_id, transaction_id, amount, balance_after, reason)
New file: backend/app/api/v1/pos_loyalty.py

Gift card CRUD, balance lookup, load balance
Store credit adjust, lookup
Modify create_transaction — accept gift_card and store_credit as payment methods

New frontend: GiftCardsPage.tsx, StoreCreditLookup.tsx Modify: POSRegister.tsx — gift card / store credit payment option

2.2 Loyalty Program
New file: backend/app/models/loyalty.py

LoyaltyProgram (name, points_per_unit_currency, is_active)
LoyaltyTier (program_id, name, min_points, discount_percentage, points_multiplier)
LoyaltyMember (program_id, customer_id, points_balance, lifetime_points, tier_id, referral_code)
LoyaltyTransaction (member_id, pos_transaction_id, points_change, reason, balance_after)
LoyaltyReward (program_id, name, points_cost, reward_type, reward_value, is_active)
New file: backend/app/api/v1/loyalty.py

Program/tier CRUD, member enrollment, points earn/redeem, rewards catalog
Register in backend/app/api/v1/__init__.py
New event handler in integration_handlers.py:

On pos.sale.completed: auto-earn loyalty points, check tier upgrade thresholds
New frontend files: frontend/src/features/loyalty/ (LoyaltyDashboard, MemberLookup, RewardsPage) New API: frontend/src/api/loyalty.ts Modify: POSRegister.tsx — loyalty points badge, "Apply Points" at checkout

2.3 Payment Gateway Integration
New model in backend/app/models/pos.py:

POSPaymentGatewayConfig (terminal_id, gateway_id FK → ecom_payment_gateways.id, config_overrides)
New file: backend/app/integrations/pos_payments.py

Abstract POSPaymentProcessor + MpesaProcessor, StripeTerminalProcessor, ManualProcessor
New endpoints in pos_ext.py:

POST /pos/payments/initiate, GET /pos/payments/{id}/status, POST /pos/payments/webhook
New frontend: PaymentProcessing.tsx — payment processing dialog with status polling Modify: MobilePayment.tsx — connect to real M-Pesa STK push

2.4 BOPIS (Buy Online, Pickup In Store)
New model: POSPickupOrder (ecom_order_id, warehouse_id, status, ready_at, picked_up_at)

New event handler: On ecommerce.order.created with fulfillment_type == "pickup" → create POSPickupOrder, reserve stock

New endpoints: GET /pos/pickup-orders, POST /pos/pickup-orders/{id}/ready, POST /pos/pickup-orders/{id}/picked-up

New frontend: PickupOrdersPage.tsx, PickupOrderDetail.tsx

2.5 Customer 360 View in POS
New endpoint: GET /pos/customers/{customer_id}/360 — aggregates CRM contact, loyalty, store credit, purchase history, e-commerce orders, support tickets, gift card balances

New frontend: Customer360Panel.tsx — slide-out panel from CustomerLookup

Phase 2 Migration
alembic revision --autogenerate -m "pos_gift_cards_loyalty_bopis_gateway"

Phase 2 Verification
Issue gift card → use as payment → verify balance deduction
Enroll in loyalty → make purchase → verify points earned → tier upgrade
Place e-commerce order with pickup → process at POS
Customer 360 shows aggregated data from all modules
Initiate M-Pesa payment → verify callback handling
Phase 3: Employee, AI, KDS & Advanced Features (Months 5-6)
3.1 POS-HR Attendance Sync
New event handlers in integration_handlers.py:

On pos.session.opened: find Employee by cashier_id → create Attendance record (clock_in)
On pos.session.closed: update Attendance record (clock_out)
Modify session open/close endpoints to publish pos.session.opened / pos.session.closed events

3.2 Commission Tracking
New models in backend/app/models/pos.py:

POSCommissionRule (name, rule_type: flat/percentage/tiered, value, tiers JSON, category, is_active)
POSCommission (cashier_id, session_id, transaction_id, rule_id, amount, status: calculated/approved/paid)
New event handler: On pos.sale.completed → calculate commission from active rules

New endpoints: Commission rule CRUD, GET /pos/reports/commissions, POST /pos/commissions/approve

New frontend: CommissionRulesPage.tsx, CommissionReportPage.tsx

3.3 Tips Pooling
New model: POSTipPool (session_date, warehouse_id, total_tips, distribution_method, status, distributions JSON)

New endpoints: POST /pos/tips/pool, POST /pos/tips/distribute

3.4 Kitchen Display System (KDS)
New file: backend/app/models/kds.py

KDSStation (name, station_type, warehouse_id, is_active)
KDSOrder (transaction_id, station_id, status: new/in_progress/ready/served, priority, started_at, completed_at)
KDSOrderItem (kds_order_id, line_id, item_name, quantity, modifiers, notes, status)
New file: backend/app/api/v1/kds.py

Station CRUD, active orders per station, status updates (start/ready/served)
WebSocket /kds/ws/{station_id} — real-time order feed
Register in backend/app/api/v1/__init__.py
Event handler: On pos.sale.completed → route items to appropriate KDS stations by product category mapping

New frontend: frontend/src/features/kds/ (KDSDisplay, KDSStationManager, KDSOrderCard) New API: frontend/src/api/kds.ts

3.5 AI Cashier Assistant
Modify backend/app/services/ai_tools.py — add tools + approval tiers:

pos_suggest_upsell (auto_approve) — analyze history, suggest complementary products
pos_predict_demand (auto_approve) — peak hours, popular items
pos_detect_pricing_anomaly (auto_approve) — flag unusual discounts
pos_slow_mover_report (auto_approve) — identify slow-moving inventory
pos_auto_discount (warn), pos_dynamic_pricing (require_approval)
New frontend: AICashierAssistant.tsx — small AI panel in register view (connects to existing AI WebSocket)

3.6 Auto-Reorder to Supply Chain
New event handler in integration_handlers.py:

On stock.low → check preferred supplier → auto-create ProcurementRequisition if auto-reorder enabled
3.7 Profitability Dashboard
New endpoint: GET /pos/reports/profitability — COGS vs revenue vs margin by product/category/date

New frontend: ProfitabilityDashboard.tsx — margin analysis charts

3.8 Hardware Abstraction Layer
New file: backend/app/integrations/pos_hardware.py

Abstract HardwareDriver + ESCPOSPrinter, StarPrinter, USBScale implementations
New endpoints: POST /pos/hardware/print, POST /pos/hardware/open-drawer, GET /pos/hardware/scale/read

New frontend: HardwareSettings.tsx — configure printers/drawers/scales per terminal

Phase 3 Migration
alembic revision --autogenerate -m "pos_commissions_kds_tips_pool"

Phase 4: Mobile & Offline Polish (Month 7)
4.1 Enhanced Offline Mode
Modify frontend/src/features/pos/useOfflineSync.ts:

IndexedDB (via idb) instead of localStorage for offline queue
Offline product catalog sync with last_sync_timestamp
Conflict resolution for stock levels on reconnect
Retry queue with exponential backoff
4.2 Customer-Facing Display
New endpoint: WebSocket /pos/customer-display/ws/{terminal_id} — streams cart state

New frontend: CustomerDisplay.tsx — full-screen second-monitor view (items, total, loyalty points)

4.3 RFID Scanning
Modify backend/app/models/inventory.py — add rfid_tag (String(100), nullable, indexed) to InventoryItem

New endpoint: GET /pos/products/rfid/{tag}

New frontend: RFIDScanner.tsx — Web Serial API for RFID readers

Critical Files Summary
Must Modify
File	Changes
backend/app/models/pos.py	Add ~15 new models, extend 3 existing
backend/app/api/v1/pos.py	Extend create_transaction, add hold/resume/cancel/quick-add/tip endpoints
backend/app/api/v1/pos_ext.py	Add bundle/modifier CRUD, X/Z readings, payment gateway, profitability, hardware endpoints
backend/app/core/integration_handlers.py	Add 6+ event handlers (loyalty, auto-reorder, HR sync, commission, KDS routing, CRM contact)
backend/app/services/ai_tools.py	Add POS AI tools + approval tiers
backend/app/api/v1/__init__.py	Register loyalty, kds, pos_loyalty routers
backend/app/main.py	Register new event channels
backend/app/models/inventory.py	Add rfid_tag field
frontend/src/features/pos/POSRegister.tsx	Major: hold, tips, split payment, bundles, modifiers, variants, AI panel, RFID, loyalty badge
frontend/src/features/pos/CustomerLookup.tsx	Link to Customer360Panel
frontend/src/features/pos/MobilePayment.tsx	Connect to real payment gateway
frontend/src/features/pos/POSSessionDetail.tsx	X/Z reading buttons
frontend/src/features/pos/useOfflineSync.ts	IndexedDB upgrade
frontend/src/api/pos.ts	New types/hooks for new endpoints
Must Create
File	Purpose
backend/app/models/loyalty.py	Loyalty models
backend/app/models/kds.py	KDS models
backend/app/api/v1/pos_loyalty.py	Gift cards + store credit endpoints
backend/app/api/v1/loyalty.py	Loyalty program endpoints
backend/app/api/v1/kds.py	KDS endpoints + WebSocket
backend/app/integrations/pos_payments.py	Payment gateway abstraction
backend/app/integrations/pos_hardware.py	Hardware driver abstraction
frontend/src/features/pos/	~15 new components (see phases above)
frontend/src/features/kds/	3 KDS components
frontend/src/features/loyalty/	3 loyalty components
frontend/src/api/pos-bundles.ts	Bundle/modifier API hooks
frontend/src/api/loyalty.ts	Loyalty API hooks
frontend/src/api/kds.ts	KDS API hooks
4-5 Alembic migrations	One per phase
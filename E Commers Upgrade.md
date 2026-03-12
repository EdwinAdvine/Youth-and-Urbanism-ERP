Ready for review
Select text to add comments on the plan
Urban ERP — E-Commerce Full Upgrade Plan
Context
The existing e-commerce module covers core MVP functionality (products, cart, checkout, orders, coupons, shipping methods, reviews, wishlists, payment gateways, CRM sync, inventory sync, POS sync, finance invoice generation, and email notifications). This upgrade adds all missing features from the hybrid Shopify + BigCommerce + Salesforce Commerce Cloud feature list — organized into two implementation phases.

Phase 2: B2B + AI + Marketing Automation (Implement First)
2A. B2B Wholesale Portal
New Backend Models (backend/app/models/ecommerce_b2b.py):

EcomCompany — company account (name, tax_id, credit_limit, payment_terms [NET30/NET60/COD], approved_by, is_approved, crm_account_id FK)
EcomCompanyMember — links CustomerAccount to EcomCompany (role: owner/buyer/viewer)
PricingTier — tiered pricing rule (name, min_order_qty, discount_pct, fixed_price_override, product_id or NULL for global)
QuoteRequest — B2B quote (company_id, status [draft/submitted/reviewed/approved/rejected/converted], notes, valid_until, converted_order_id)
QuoteItem — line items on quote (quote_id, product_id, quantity, requested_price, approved_price)
New Endpoints (backend/app/api/v1/ecommerce_b2b.py):

POST /ecommerce/b2b/companies — register company account
GET /ecommerce/b2b/companies — list (admin)
PUT /ecommerce/b2b/companies/{id}/approve — approve company
POST /ecommerce/b2b/quotes — create quote request
GET /ecommerce/b2b/quotes — list quotes
PUT /ecommerce/b2b/quotes/{id}/review — admin review (set approved prices)
POST /ecommerce/b2b/quotes/{id}/convert — convert approved quote to order
GET /ecommerce/b2b/pricing-tiers — list tiers
POST /ecommerce/b2b/pricing-tiers — create tier
Checkout Enhancement (ecommerce_ext.py): Apply PricingTier discount for company members during checkout. Add po_number field to EcomOrder.

Frontend (frontend/src/features/ecommerce/):

B2BPortal.tsx — company registration + quote request form (storefront-facing)
B2BDashboard.tsx — admin: pending companies, active quotes, pricing tier management
QuoteDetail.tsx — admin quote review + approval UI
2B. Loyalty & Rewards Program
New Backend Models (backend/app/models/ecommerce_loyalty.py):

LoyaltyProgram — program config per store (points_per_unit_spent, currency_per_point, is_active)
CustomerLoyaltyAccount — customer balance (customer_id, points_balance, lifetime_points, tier_id)
LoyaltyTier — tier config (name, min_lifetime_points, discount_pct, free_shipping, badge_color)
LoyaltyTransaction — audit log (account_id, type [earned/spent/expired/referral], points, reference_id, note)
ReferralCode — (customer_id, code [unique], used_count, total_points_earned)
ReferralUse — (referral_code_id, new_customer_id, order_id, rewarded_at)
New Endpoints (backend/app/api/v1/ecommerce_loyalty.py):

GET /ecommerce/loyalty/account — get customer's points + tier
GET /ecommerce/loyalty/tiers — list tiers
GET /ecommerce/loyalty/transactions — customer's point history
POST /ecommerce/loyalty/redeem — apply points at checkout (returns discount amount)
GET /ecommerce/loyalty/referral-code — get or generate referral code
GET /ecommerce/loyalty/program — admin: program config
PUT /ecommerce/loyalty/program — admin: update config
GET /ecommerce/loyalty/leaderboard — top customers by points
Integration (integration_handlers.py): On ecommerce.order.paid → award loyalty points (points = total × rate). On new customer via referral code → award referral bonus to both parties.

Frontend (frontend/src/features/ecommerce/):

LoyaltyDashboard.tsx — admin: program config, tier editor, leaderboard
LoyaltyAccount.tsx — customer: points balance card, tier badge, transaction history, referral link
2C. Abandoned Cart Recovery
New Backend Model (add to ecommerce.py):

CartAbandonmentLog — (cart_id FK, customer_email, items_snapshot JSON, session_key, abandoned_at, recovery_email_1_sent_at, recovery_email_2_sent_at, recovered_order_id, discount_code_used)
Celery Tasks (backend/app/tasks/ecommerce_tasks.py):

check_abandoned_carts — scheduled every 30 min; carts inactive > 1h (configurable) with items → log + queue recovery email
send_recovery_email_1 — triggered 1h after abandonment; include cart items + optional discount
send_recovery_email_2 — triggered 24h after abandonment; stronger incentive (auto-generate single-use coupon)
send_recovery_email_3 — 72h final reminder
New Endpoints (ecommerce_ext.py):

GET /ecommerce/abandoned-carts — admin: list logs with recovery rate stats
PUT /ecommerce/abandoned-carts/config — configure recovery windows, discount amount, enable/disable
Frontend (frontend/src/features/ecommerce/):

AbandonedCartsPage.tsx — admin: recovery stats, email preview, config
2D. Subscription Management
New Backend Models (backend/app/models/ecommerce_subscriptions.py):

Subscription — (customer_id FK, product_id FK, quantity, frequency_days, discount_pct, status [active/paused/cancelled], next_billing_date, shipping_address_id, payment_gateway_id, metadata_json)
SubscriptionOrder — link table (subscription_id, order_id)
New Endpoints (backend/app/api/v1/ecommerce_subscriptions.py):

POST /ecommerce/subscriptions — customer subscribe to product
GET /ecommerce/subscriptions — list customer's subscriptions
PUT /ecommerce/subscriptions/{id}/pause — pause
PUT /ecommerce/subscriptions/{id}/resume — resume
PUT /ecommerce/subscriptions/{id}/skip — skip next cycle
DELETE /ecommerce/subscriptions/{id} — cancel
GET /ecommerce/subscriptions/admin — admin: all subscriptions
Celery Task (ecommerce_tasks.py): process_due_subscriptions — daily task; find subscriptions where next_billing_date ≤ today → auto-create order + charge → update next_billing_date.

Frontend (frontend/src/features/ecommerce/):

SubscriptionManagement.tsx — customer: manage active subscriptions
SubscriptionsAdmin.tsx — admin: all subscriptions, revenue MRR/ARR metrics
2E. Manufacturing Integration (Made-to-Order)
Model Changes (backend/app/models/ecommerce.py):

Add to EcomProduct: is_made_to_order: bool, lead_time_days: int
New model EcomOrderWorkOrderLink — (order_id, order_line_id, work_order_id FK to manufacturing)
Integration Handler (integration_handlers.py): On ecommerce.order.confirmed for made-to-order products → call manufacturing service to create work order → save link.

Endpoint (ecommerce_ext.py):

GET /ecommerce/orders/{order_id}/work-orders — get linked manufacturing work orders
2F. Projects Auto-Trigger for Large Orders
Model (add to ecommerce.py): EcomOrderProjectLink — (order_id FK, project_id FK)

Integration Handler (integration_handlers.py): On ecommerce.order.confirmed where order.total >= settings.ECOM_PROJECT_TRIGGER_THRESHOLD → auto-create Project with order details + customer info + deadline from estimated delivery.

Config (core/config.py): Add ECOM_PROJECT_TRIGGER_THRESHOLD: Decimal = 50000 (KES, configurable via SystemSettings).

2G. AI Personalization Engine
New Backend Service (backend/app/services/ecommerce_ai.py):

get_recommendations(customer_id, limit) — collaborative filtering: find customers who bought same products → recommend what they also bought. Falls back to top-rated if no history.
generate_product_description(product_name, attributes) — calls Ollama (llama3) to generate SEO-optimized product description
compute_dynamic_price_suggestion(product_id) — analyze demand (order velocity, wishlist count, competitor-like patterns) → suggest optimal price
get_ecom_health_score(store_id) — composite 0-100 score: conversion rate (30%), cart abandonment rate (20%), revenue growth (25%), repeat purchase rate (25%)
New Endpoints (ecommerce_ext.py):

GET /ecommerce/recommendations — personalized product recommendations for current user
POST /ecommerce/products/{id}/generate-description — AI-generate description
GET /ecommerce/products/{id}/price-suggestion — dynamic pricing suggestion
GET /ecommerce/health-score — e-commerce health score for dashboard
Phase 3: Advanced & Global
3A. Multi-Currency Support
New Models (backend/app/models/ecommerce_currency.py):

Currency — (code [ISO 4217], name, symbol, exchange_rate_to_base, is_active, last_updated)
Changes: EcomOrder add currency_code, exchange_rate_snapshot. Checkout endpoint: accept currency param, convert totals.

Celery Task: refresh_exchange_rates — daily, fetch from public API (exchangerate.host) or manual admin update.

Endpoints (ecommerce_ext.py): GET /ecommerce/currencies, POST /ecommerce/currencies, PUT /ecommerce/currencies/{code}.

3B. Shopify / WooCommerce / BigCommerce Import
New Models (backend/app/models/ecommerce.py):

ImportJob — (source_platform [shopify/woocommerce/bigcommerce/csv], status [pending/running/done/failed], file_path, mappings_json, progress_pct, error_log, imported_products, imported_customers, imported_orders)
New Endpoints (backend/app/api/v1/ecommerce_import.py):

POST /ecommerce/import/upload — upload Shopify/WooCommerce export CSV/JSON
POST /ecommerce/import/start — kick off background import
GET /ecommerce/import/jobs — list import jobs + progress
GET /ecommerce/import/jobs/{id} — job detail
Celery Task (ecommerce_tasks.py): run_import_job(job_id) — parse file, map fields, bulk-insert via SQLAlchemy, update progress.

Frontend (frontend/src/features/ecommerce/): ImportPage.tsx — upload + field mapping UI + progress tracking.

3C. Advanced Analytics & Health Score Dashboard
New Endpoints (ecommerce_ext.py):

GET /ecommerce/analytics/health-score — 0-100 score + component breakdown
GET /ecommerce/analytics/rfm-segments — customer RFM (Recency/Frequency/Monetary) segmentation
GET /ecommerce/analytics/demand-forecast — 30-day revenue forecast using order history trend
GET /ecommerce/analytics/cohorts — cohort retention table (monthly signup cohorts)
GET /ecommerce/analytics/ai-insights — top 3 AI-generated actionable insights (Ollama prompt over metrics)
Frontend (frontend/src/features/ecommerce/): AdvancedAnalyticsPage.tsx — health score gauge, RFM scatter chart, forecast chart, cohort heatmap, AI insights panel.

3D. Product Bundles & Kits
New Models (backend/app/models/ecommerce.py):

ProductBundle — (store_id, name, slug, description, image, discount_type [pct/fixed], discount_value, is_active)
BundleItem — (bundle_id, product_id, quantity)
New Endpoints (ecommerce_ext.py):

GET /ecommerce/bundles, POST, PUT /bundles/{id}, DELETE
GET /ecommerce/bundles/{id} — with items + total price
Frontend: Add BundlesPage.tsx + bundle detail card in catalog.

3E. Flash Sales / Urgency Engine
New Model (backend/app/models/ecommerce.py):

FlashSale — (store_id, product_id, sale_price, start_at, end_at, inventory_limit, sold_count, is_active, countdown_visible)
New Endpoints (ecommerce_ext.py):

GET /ecommerce/flash-sales — active flash sales (public)
POST /ecommerce/flash-sales — admin create
PUT /ecommerce/flash-sales/{id} — admin update/end
Celery Task: activate_scheduled_flash_sales — every 5 min; flip is_active based on start_at/end_at.

Storefront: Include flash sale price in /storefront/catalog response. Frontend countdown timer component.

3F. SEO Blog
New Models (backend/app/models/ecommerce_blog.py):

BlogPost — (store_id, title, slug, content_markdown, author_id FK users, status [draft/published], published_at, tags_json, meta_title, meta_description, feature_image)
New Endpoints (backend/app/api/v1/ecommerce_blog.py):

GET /storefront/blog — list published posts (public)
GET /storefront/blog/{slug} — post detail (public)
GET /ecommerce/blog — admin list all
POST /ecommerce/blog — create
PUT /ecommerce/blog/{id} — update
DELETE /ecommerce/blog/{id} — delete
Frontend: BlogAdminPage.tsx + BlogPostEditor.tsx (markdown editor).

3G. BOPIS Enhancement (Buy Online, Pick Up In Store)
New Model (backend/app/models/ecommerce.py):

PickupLocation — (store_id, name, address, city, phone, operating_hours_json, is_active)
Changes to EcomOrder: Add fulfillment_type [shipping/pickup], pickup_location_id.

Checkout Enhancement: If fulfillment_type=pickup → skip shipping cost calculation → assign pickup_location → notify POS on order.confirmed.

Frontend: Checkout step: "Delivery or Pickup?" → location selector if pickup.

Alembic Migrations Required
Create in order:

ecommerce_b2b_loyalty — EcomCompany, EcomCompanyMember, PricingTier, QuoteRequest, QuoteItem, LoyaltyProgram, CustomerLoyaltyAccount, LoyaltyTier, LoyaltyTransaction, ReferralCode, ReferralUse
ecommerce_subscriptions_abandoned — Subscription, SubscriptionOrder, CartAbandonmentLog
ecommerce_integrations — EcomOrderWorkOrderLink, EcomOrderProjectLink, ImportJob, FlashSale, ProductBundle, BundleItem, PickupLocation
ecommerce_blog_currency — BlogPost, Currency
Add columns to existing tables: EcomProduct (is_made_to_order, lead_time_days), EcomOrder (currency_code, exchange_rate_snapshot, po_number, fulfillment_type, pickup_location_id)
Critical Files to Modify
File	Change
backend/app/models/ecommerce.py	Add fields to EcomProduct + EcomOrder + new models
backend/app/core/integration_handlers.py	Add Manufacturing + Projects + Loyalty point award handlers
backend/app/core/config.py	Add ECOM_PROJECT_TRIGGER_THRESHOLD, ECOM_CART_ABANDONMENT_HOURS
backend/app/main.py	Register new routers
backend/app/api/v1/__init__.py	Import new routers
backend/app/tasks/celery_app.py	Register new periodic tasks
New Files to Create
Backend:

backend/app/models/ecommerce_b2b.py
backend/app/models/ecommerce_loyalty.py
backend/app/models/ecommerce_subscriptions.py
backend/app/models/ecommerce_blog.py
backend/app/models/ecommerce_currency.py
backend/app/api/v1/ecommerce_b2b.py
backend/app/api/v1/ecommerce_loyalty.py
backend/app/api/v1/ecommerce_subscriptions.py
backend/app/api/v1/ecommerce_import.py
backend/app/api/v1/ecommerce_blog.py
backend/app/services/ecommerce_ai.py
backend/app/tasks/ecommerce_tasks.py
Frontend:

frontend/src/features/ecommerce/B2BPortal.tsx
frontend/src/features/ecommerce/B2BDashboard.tsx
frontend/src/features/ecommerce/QuoteDetail.tsx
frontend/src/features/ecommerce/LoyaltyDashboard.tsx
frontend/src/features/ecommerce/LoyaltyAccount.tsx
frontend/src/features/ecommerce/AbandonedCartsPage.tsx
frontend/src/features/ecommerce/SubscriptionManagement.tsx
frontend/src/features/ecommerce/SubscriptionsAdmin.tsx
frontend/src/features/ecommerce/BundlesPage.tsx
frontend/src/features/ecommerce/ImportPage.tsx
frontend/src/features/ecommerce/AdvancedAnalyticsPage.tsx
frontend/src/features/ecommerce/BlogAdminPage.tsx
frontend/src/features/ecommerce/BlogPostEditor.tsx
Recommended Rollout Order
B2B Portal (highest business value for wholesale)
Loyalty & Rewards + Referrals (customer retention)
Abandoned Cart Recovery (immediate revenue recovery — Celery tasks)
Subscription Management (recurring revenue)
Manufacturing + Projects Integration (completes the end-to-end flow)
AI Personalization (recommendations + description generator)
Product Bundles + Flash Sales (conversion optimization)
Multi-Currency (global expansion readiness)
Shopify/WooCommerce Import (onboarding tool)
Advanced Analytics (health score + forecasting)
SEO Blog (content marketing)
BOPIS Enhancement (omnichannel)
Verification
After each module:

Run Alembic migration: docker compose exec backend alembic upgrade head
Backend health: GET /api/v1/health — 200 OK
Test new endpoints via Swagger: http://localhost:8010/docs
Frontend: navigate to each new page, verify TanStack Query data loads
Integration tests: place test order → verify loyalty points awarded, manufacturing work order created, project created (where applicable)
Celery: confirm abandoned cart + subscription tasks appear in Celery beat schedule
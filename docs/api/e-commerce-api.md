# E-Commerce — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 122


## Contents

- [ecommerce.py](#ecommerce) (16 endpoints)
- [ecommerce_b2b.py](#ecommerce-b2b) (15 endpoints)
- [ecommerce_blog.py](#ecommerce-blog) (9 endpoints)
- [ecommerce_ext.py](#ecommerce-ext) (50 endpoints)
- [ecommerce_import.py](#ecommerce-import) (4 endpoints)
- [ecommerce_loyalty.py](#ecommerce-loyalty) (9 endpoints)
- [ecommerce_subscriptions.py](#ecommerce-subscriptions) (8 endpoints)
- [storefront.py](#storefront) (11 endpoints)

---

## ecommerce.py

E-Commerce Admin API — stores, products, orders, customers, dashboard.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/stores` | `list_stores` | — |
| `GET` | `/stores/{store_id}` | `get_store` | — |
| `POST` | `/stores` | `create_store` | — |
| `PUT` | `/stores/{store_id}` | `update_store` | — |
| `GET` | `/products` | `list_products` | — |
| `GET` | `/products/{product_id}` | `get_product` | — |
| `POST` | `/products` | `create_product` | — |
| `PUT` | `/products/{product_id}` | `update_product` | — |
| `DELETE` | `/products/{product_id}` | `delete_product` | — |
| `GET` | `/orders` | `list_orders` | — |
| `GET` | `/orders/{order_id}` | `get_order` | — |
| `PUT` | `/orders/{order_id}/status` | `update_order_status` | — |
| `GET` | `/orders/export` | `export_orders` | — |
| `GET` | `/customers` | `list_customers` | — |
| `GET` | `/customers/{customer_id}` | `get_customer` | — |
| `GET` | `/dashboard` | `dashboard` | — |

### `GET /stores`

**Function:** `list_stores` (line 231)

**Auth:** `current_user`


### `GET /stores/{store_id}`

**Function:** `get_store` (line 241)

**Parameters:** `store_id`

**Auth:** `current_user`


### `POST /stores`

**Function:** `create_store` (line 253)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /stores/{store_id}`

**Function:** `update_store` (line 266)

**Parameters:** `store_id`, `payload`

**Auth:** `current_user`


### `GET /products`

**Function:** `list_products` (line 285)

**Parameters:** `store_id`, `search`, `is_published`, `page`, `limit`

**Auth:** `current_user`


### `GET /products/{product_id}`

**Function:** `get_product` (line 323)

**Parameters:** `product_id`

**Auth:** `current_user`


### `POST /products`

**Function:** `create_product` (line 335)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /products/{product_id}`

**Function:** `update_product` (line 353)

**Parameters:** `product_id`, `payload`

**Auth:** `current_user`


### `DELETE /products/{product_id}`

**Function:** `delete_product` (line 370)

**Parameters:** `product_id`

**Auth:** `current_user`


### `GET /orders`

**Function:** `list_orders` (line 386)

**Parameters:** `store_id`, `status_filter`, `search`, `page`, `limit`

**Auth:** `current_user`


### `GET /orders/{order_id}`

**Function:** `get_order` (line 422)

**Parameters:** `order_id`

**Auth:** `current_user`


### `PUT /orders/{order_id}/status`

**Function:** `update_order_status` (line 439)

**Parameters:** `order_id`, `payload`

**Auth:** `current_user`


### `GET /orders/export`

**Function:** `export_orders` (line 462)

**Parameters:** `status_filter`

**Auth:** `current_user`


### `GET /customers`

**Function:** `list_customers` (line 495)

**Parameters:** `store_id`, `search`, `page`, `limit`

**Auth:** `current_user`


### `GET /customers/{customer_id}`

**Function:** `get_customer` (line 539)

**Parameters:** `customer_id`

**Auth:** `current_user`


### `GET /dashboard`

**Function:** `dashboard` (line 556)

**Auth:** `current_user`


---

## ecommerce_b2b.py

E-Commerce B2B API — companies, pricing tiers, quotes.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/b2b/companies` | `register_company` | Register a B2B company account. |
| `GET` | `/b2b/companies` | `list_companies` | List all B2B companies (admin). |
| `GET` | `/b2b/companies/{company_id}` | `get_company` | Get B2B company detail. |
| `PUT` | `/b2b/companies/{company_id}/approve` | `approve_company` | Approve or reject a B2B company. |
| `PUT` | `/b2b/companies/{company_id}` | `update_company` | Update B2B company details. |
| `POST` | `/b2b/companies/{company_id}/members` | `add_company_member` | Add a customer as a member of a B2B company. |
| `GET` | `/b2b/pricing-tiers` | `list_pricing_tiers` | List pricing tiers. |
| `POST` | `/b2b/pricing-tiers` | `create_pricing_tier` | Create a pricing tier. |
| `PUT` | `/b2b/pricing-tiers/{tier_id}` | `update_pricing_tier` | Update a pricing tier. |
| `DELETE` | `/b2b/pricing-tiers/{tier_id}` | `delete_pricing_tier` | Delete a pricing tier. |
| `POST` | `/b2b/quotes` | `create_quote` | Create a B2B quote request. |
| `GET` | `/b2b/quotes` | `list_quotes` | List B2B quotes. |
| `GET` | `/b2b/quotes/{quote_id}` | `get_quote` | Get a single B2B quote with its line items. |
| `PUT` | `/b2b/quotes/{quote_id}/review` | `review_quote` | Admin review: set approved prices per item. |
| `POST` | `/b2b/quotes/{quote_id}/convert` | `convert_quote_to_order` | Convert an approved quote into an e-commerce order. |

### `POST /b2b/companies`

**Function:** `register_company` (line 21)

Register a B2B company account.

**Parameters:** `data`, `current_user`


### `GET /b2b/companies`

**Function:** `list_companies` (line 45)

List all B2B companies (admin).

**Parameters:** `current_user`, `is_approved`, `skip`, `limit`


### `GET /b2b/companies/{company_id}`

**Function:** `get_company` (line 75)

Get B2B company detail.

**Parameters:** `company_id`, `current_user`


### `PUT /b2b/companies/{company_id}/approve`

**Function:** `approve_company` (line 105)

Approve or reject a B2B company.

**Parameters:** `company_id`, `data`, `current_user`


### `PUT /b2b/companies/{company_id}`

**Function:** `update_company` (line 127)

Update B2B company details.

**Parameters:** `company_id`, `data`, `current_user`


### `POST /b2b/companies/{company_id}/members`

**Function:** `add_company_member` (line 148)

Add a customer as a member of a B2B company.

**Parameters:** `company_id`, `data`, `current_user`


### `GET /b2b/pricing-tiers`

**Function:** `list_pricing_tiers` (line 168)

List pricing tiers.

**Parameters:** `current_user`, `company_id`


### `POST /b2b/pricing-tiers`

**Function:** `create_pricing_tier` (line 195)

Create a pricing tier.

**Parameters:** `data`, `current_user`


### `PUT /b2b/pricing-tiers/{tier_id}`

**Function:** `update_pricing_tier` (line 217)

Update a pricing tier.

**Parameters:** `tier_id`, `data`, `current_user`


### `DELETE /b2b/pricing-tiers/{tier_id}`

**Function:** `delete_pricing_tier` (line 238)

Delete a pricing tier.

**Parameters:** `tier_id`, `current_user`


### `POST /b2b/quotes`

**Function:** `create_quote` (line 254)

Create a B2B quote request.

**Parameters:** `data`, `current_user`


### `GET /b2b/quotes`

**Function:** `list_quotes` (line 286)

List B2B quotes.

**Parameters:** `current_user`, `status`, `company_id`, `skip`, `limit`


### `GET /b2b/quotes/{quote_id}`

**Function:** `get_quote` (line 319)

Get a single B2B quote with its line items.

**Parameters:** `quote_id`, `current_user`


### `PUT /b2b/quotes/{quote_id}/review`

**Function:** `review_quote` (line 355)

Admin review: set approved prices per item.

**Parameters:** `quote_id`, `data`, `current_user`


### `POST /b2b/quotes/{quote_id}/convert`

**Function:** `convert_quote_to_order` (line 384)

Convert an approved quote into an e-commerce order.

**Parameters:** `quote_id`, `current_user`


---

## ecommerce_blog.py

E-Commerce Blog API — admin CRUD + public storefront endpoints.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/blog` | `list_blog_posts` | Admin: list all blog posts with status, author, and published_at. |
| `POST` | `/blog` | `create_blog_post` | Create a new blog post (defaults to draft status). |
| `GET` | `/blog/{post_id}` | `get_blog_post` | Get a blog post by ID (admin). |
| `PUT` | `/blog/{post_id}` | `update_blog_post` | Update a blog post. |
| `DELETE` | `/blog/{post_id}` | `delete_blog_post` | Delete a blog post. |
| `PUT` | `/blog/{post_id}/publish` | `publish_blog_post` | Set post status to published and record published_at timestamp. |
| `PUT` | `/blog/{post_id}/unpublish` | `unpublish_blog_post` | Set post status back to draft. |
| `GET` | `/blog` | `storefront_list_blog_posts` | Public: list published blog posts for a store. |
| `GET` | `/blog/{slug}` | `storefront_get_blog_post_by_slug` | Public: get a published blog post by slug and increment view_count. |

### `GET /blog`

**Function:** `list_blog_posts` (line 22)

Admin: list all blog posts with status, author, and published_at.

**Parameters:** `current_user`, `store_id`, `status`, `skip`, `limit`


### `POST /blog`

**Function:** `create_blog_post` (line 62)

Create a new blog post (defaults to draft status).

**Parameters:** `data`, `current_user`


### `GET /blog/{post_id}`

**Function:** `get_blog_post` (line 90)

Get a blog post by ID (admin).

**Parameters:** `post_id`, `current_user`


### `PUT /blog/{post_id}`

**Function:** `update_blog_post` (line 119)

Update a blog post.

**Parameters:** `post_id`, `data`, `current_user`


### `DELETE /blog/{post_id}`

**Function:** `delete_blog_post` (line 146)

Delete a blog post.

**Parameters:** `post_id`, `current_user`


### `PUT /blog/{post_id}/publish`

**Function:** `publish_blog_post` (line 160)

Set post status to published and record published_at timestamp.

**Parameters:** `post_id`, `current_user`


### `PUT /blog/{post_id}/unpublish`

**Function:** `unpublish_blog_post` (line 178)

Set post status back to draft.

**Parameters:** `post_id`, `current_user`


### `GET /blog`

**Function:** `storefront_list_blog_posts` (line 196)

Public: list published blog posts for a store.

**Parameters:** `store_id`, `skip`, `limit`


### `GET /blog/{slug}`

**Function:** `storefront_get_blog_post_by_slug` (line 228)

Public: get a published blog post by slug and increment view_count.

**Parameters:** `slug`


---

## ecommerce_ext.py

E-Commerce Extended API — cart, checkout, coupons, shipping, reviews, wishlist, reports.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/cart` | `get_cart` | — |
| `POST` | `/cart/items` | `add_cart_item` | — |
| `PUT` | `/cart/items/{item_id}` | `update_cart_item` | — |
| `DELETE` | `/cart/items/{item_id}` | `remove_cart_item` | — |
| `POST` | `/checkout` | `checkout` | — |
| `GET` | `/coupons` | `list_coupons` | — |
| `POST` | `/coupons` | `create_coupon` | — |
| `POST` | `/coupons/validate` | `validate_coupon` | — |
| `PUT` | `/coupons/{coupon_id}` | `update_coupon` | — |
| `DELETE` | `/coupons/{coupon_id}` | `delete_coupon` | — |
| `GET` | `/shipping-methods` | `list_shipping_methods` | — |
| `POST` | `/shipping-methods` | `create_shipping_method` | — |
| `PUT` | `/shipping-methods/{method_id}` | `update_shipping_method` | — |
| `DELETE` | `/shipping-methods/{method_id}` | `delete_shipping_method` | — |
| `POST` | `/orders/{order_id}/ship` | `ship_order` | — |
| `POST` | `/orders/{order_id}/refund` | `refund_order` | — |
| `GET` | `/products/{product_id}/reviews` | `list_product_reviews` | — |
| `POST` | `/products/{product_id}/reviews` | `create_review` | — |
| `PUT` | `/reviews/{review_id}/approve` | `approve_review` | — |
| `GET` | `/wishlist` | `get_wishlist` | — |
| `POST` | `/wishlist` | `add_to_wishlist` | — |
| `DELETE` | `/wishlist/{wishlist_id}` | `remove_from_wishlist` | — |
| `GET` | `/reports/sales` | `sales_report` | — |
| `GET` | `/reports/top-products` | `top_products_report` | — |
| `GET` | `/reports/conversion-funnel` | `conversion_funnel` | Returns funnel: total carts → carts with items → checkouts (orders) → complet... |
| `GET` | `/abandoned-carts` | `list_abandoned_carts` | — |
| `GET` | `/abandoned-carts/config` | `get_abandoned_cart_config` | — |
| `PUT` | `/abandoned-carts/config` | `update_abandoned_cart_config` | — |
| `GET` | `/bundles` | `list_bundles` | — |
| `GET` | `/bundles/{bundle_id}` | `get_bundle` | — |
| `POST` | `/bundles` | `create_bundle` | — |
| `PUT` | `/bundles/{bundle_id}` | `update_bundle` | — |
| `DELETE` | `/bundles/{bundle_id}` | `delete_bundle` | — |
| `GET` | `/flash-sales` | `list_flash_sales` | — |
| `POST` | `/flash-sales` | `create_flash_sale` | — |
| `PUT` | `/flash-sales/{sale_id}` | `update_flash_sale` | — |
| `GET` | `/currencies` | `list_currencies` | — |
| `POST` | `/currencies` | `create_currency` | — |
| `PUT` | `/currencies/{code}` | `update_currency` | — |
| `GET` | `/recommendations` | `get_recommendations` | — |
| `POST` | `/products/{product_id}/generate-description` | `generate_product_description` | — |
| `GET` | `/products/{product_id}/price-suggestion` | `get_price_suggestion` | — |
| `GET` | `/health-score` | `get_health_score` | — |
| `GET` | `/analytics/health-score` | `analytics_health_score` | — |
| `GET` | `/analytics/rfm-segments` | `rfm_segments` | Recency / Frequency / Monetary segmentation across all customers. |
| `GET` | `/analytics/demand-forecast` | `demand_forecast` | Simple linear trend forecast from last 90 days of daily revenue. |
| `GET` | `/analytics/cohorts` | `cohort_retention` | Monthly signup cohorts and their repeat purchase rates. |
| `GET` | `/analytics/ai-insights` | `ai_insights` | Generate 3 actionable insights using AI over store metrics. |
| `GET` | `/orders/{order_id}/work-orders` | `get_order_work_orders` | — |
| `GET` | `/products/pos-sync` | `products_for_pos` | Returns e-commerce products in a format suitable for POS import. |

### `GET /cart`

**Function:** `get_cart` (line 283)

**Auth:** `current_user`


### `POST /cart/items`

**Function:** `add_cart_item` (line 297)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /cart/items/{item_id}`

**Function:** `update_cart_item` (line 340)

**Parameters:** `item_id`, `payload`

**Auth:** `current_user`


### `DELETE /cart/items/{item_id}`

**Function:** `remove_cart_item` (line 368)

**Parameters:** `item_id`

**Auth:** `current_user`


### `POST /checkout`

**Function:** `checkout` (line 389)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /coupons`

**Function:** `list_coupons` (line 563)

**Parameters:** `is_active`, `page`, `limit`

**Auth:** `current_user`


### `POST /coupons`

**Function:** `create_coupon` (line 592)

**Parameters:** `payload`

**Auth:** `current_user`


### `POST /coupons/validate`

**Function:** `validate_coupon` (line 613)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /coupons/{coupon_id}`

**Function:** `update_coupon` (line 642)

**Parameters:** `coupon_id`, `payload`

**Auth:** `current_user`


### `DELETE /coupons/{coupon_id}`

**Function:** `delete_coupon` (line 659)

**Parameters:** `coupon_id`

**Auth:** `current_user`


### `GET /shipping-methods`

**Function:** `list_shipping_methods` (line 675)

**Parameters:** `is_active`

**Auth:** `current_user`


### `POST /shipping-methods`

**Function:** `create_shipping_method` (line 689)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /shipping-methods/{method_id}`

**Function:** `update_shipping_method` (line 702)

**Parameters:** `method_id`, `payload`

**Auth:** `current_user`


### `DELETE /shipping-methods/{method_id}`

**Function:** `delete_shipping_method` (line 719)

**Parameters:** `method_id`

**Auth:** `current_user`


### `POST /orders/{order_id}/ship`

**Function:** `ship_order` (line 735)

**Parameters:** `order_id`, `payload`

**Auth:** `current_user`


### `POST /orders/{order_id}/refund`

**Function:** `refund_order` (line 767)

**Parameters:** `order_id`, `payload`

**Auth:** `current_user`


### `GET /products/{product_id}/reviews`

**Function:** `list_product_reviews` (line 816)

**Parameters:** `product_id`, `approved_only`, `page`, `limit`

**Auth:** `current_user`


### `POST /products/{product_id}/reviews`

**Function:** `create_review` (line 859)

**Parameters:** `product_id`, `payload`

**Auth:** `current_user`


### `PUT /reviews/{review_id}/approve`

**Function:** `approve_review` (line 896)

**Parameters:** `review_id`, `approve`

**Auth:** `current_user`


### `GET /wishlist`

**Function:** `get_wishlist` (line 917)

**Parameters:** `page`, `limit`

**Auth:** `current_user`


### `POST /wishlist`

**Function:** `add_to_wishlist` (line 952)

**Parameters:** `payload`

**Auth:** `current_user`


### `DELETE /wishlist/{wishlist_id}`

**Function:** `remove_from_wishlist` (line 987)

**Parameters:** `wishlist_id`

**Auth:** `current_user`


### `GET /reports/sales`

**Function:** `sales_report` (line 1005)

**Parameters:** `start_date`, `end_date`, `group_by`

**Auth:** `current_user`


### `GET /reports/top-products`

**Function:** `top_products_report` (line 1061)

**Parameters:** `limit`, `start_date`, `end_date`

**Auth:** `current_user`


### `GET /reports/conversion-funnel`

**Function:** `conversion_funnel` (line 1102)

Returns funnel: total carts → carts with items → checkouts (orders) → completed orders.

**Parameters:** `start_date`, `end_date`

**Auth:** `current_user`


### `GET /abandoned-carts`

**Function:** `list_abandoned_carts` (line 1174)

**Parameters:** `skip`, `limit`

**Auth:** `current_user`


### `GET /abandoned-carts/config`

**Function:** `get_abandoned_cart_config` (line 1211)

**Auth:** `current_user`


### `PUT /abandoned-carts/config`

**Function:** `update_abandoned_cart_config` (line 1227)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /bundles`

**Function:** `list_bundles` (line 1279)

**Auth:** `current_user`


### `GET /bundles/{bundle_id}`

**Function:** `get_bundle` (line 1311)

**Parameters:** `bundle_id`

**Auth:** `current_user`


### `POST /bundles`

**Function:** `create_bundle` (line 1349)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /bundles/{bundle_id}`

**Function:** `update_bundle` (line 1381)

**Parameters:** `bundle_id`, `payload`

**Auth:** `current_user`


### `DELETE /bundles/{bundle_id}`

**Function:** `delete_bundle` (line 1399)

**Parameters:** `bundle_id`

**Auth:** `current_user`


### `GET /flash-sales`

**Function:** `list_flash_sales` (line 1440)

**Auth:** `current_user`


### `POST /flash-sales`

**Function:** `create_flash_sale` (line 1465)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /flash-sales/{sale_id}`

**Function:** `update_flash_sale` (line 1490)

**Parameters:** `sale_id`, `payload`

**Auth:** `current_user`


### `GET /currencies`

**Function:** `list_currencies` (line 1524)

**Auth:** `current_user`


### `POST /currencies`

**Function:** `create_currency` (line 1545)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /currencies/{code}`

**Function:** `update_currency` (line 1569)

**Parameters:** `code`, `payload`

**Auth:** `current_user`


### `GET /recommendations`

**Function:** `get_recommendations` (line 1595)

**Auth:** `current_user`


### `POST /products/{product_id}/generate-description`

**Function:** `generate_product_description` (line 1605)

**Parameters:** `product_id`, `attributes`

**Auth:** `current_user`


### `GET /products/{product_id}/price-suggestion`

**Function:** `get_price_suggestion` (line 1623)

**Parameters:** `product_id`

**Auth:** `current_user`


### `GET /health-score`

**Function:** `get_health_score` (line 1637)

**Parameters:** `store_id`

**Auth:** `current_user`


### `GET /analytics/health-score`

**Function:** `analytics_health_score` (line 1652)

**Auth:** `current_user`


### `GET /analytics/rfm-segments`

**Function:** `rfm_segments` (line 1661)

Recency / Frequency / Monetary segmentation across all customers.

**Auth:** `current_user`


### `GET /analytics/demand-forecast`

**Function:** `demand_forecast` (line 1703)

Simple linear trend forecast from last 90 days of daily revenue.

**Auth:** `current_user`


### `GET /analytics/cohorts`

**Function:** `cohort_retention` (line 1752)

Monthly signup cohorts and their repeat purchase rates.

**Auth:** `current_user`


### `GET /analytics/ai-insights`

**Function:** `ai_insights` (line 1803)

Generate 3 actionable insights using AI over store metrics.

**Auth:** `current_user`


### `GET /orders/{order_id}/work-orders`

**Function:** `get_order_work_orders` (line 1855)

**Parameters:** `order_id`

**Auth:** `current_user`


### `GET /products/pos-sync`

**Function:** `products_for_pos` (line 1899)

Returns e-commerce products in a format suitable for POS import.

**Parameters:** `store_id`, `published_only`

**Auth:** `current_user`


---

## ecommerce_import.py

E-Commerce Import API — upload import files and track background import jobs.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/import/upload` | `upload_import_file` | Upload an import file (CSV/JSON), save to MinIO, and create an ImportJob record. |
| `POST` | `/import/jobs/{job_id}/start` | `start_import_job` | Kick off background import Celery task for a pending job. |
| `GET` | `/import/jobs` | `list_import_jobs` | List import jobs for a store. |
| `GET` | `/import/jobs/{job_id}` | `get_import_job` | Get import job detail with progress. |

### `POST /import/upload`

**Function:** `upload_import_file` (line 19)

Upload an import file (CSV/JSON), save to MinIO, and create an ImportJob record.

- store_id: target store UUID (query param)
- source_platform: shopify | woocommerce | bigcommerce | csv
- file: multipart upload

**Parameters:** `store_id`, `source_platform`, `file`, `current_user`


### `POST /import/jobs/{job_id}/start`

**Function:** `start_import_job` (line 76)

Kick off background import Celery task for a pending job.

**Parameters:** `job_id`, `data`, `current_user`


### `GET /import/jobs`

**Function:** `list_import_jobs` (line 118)

List import jobs for a store.

**Parameters:** `store_id`, `current_user`, `status`, `skip`, `limit`


### `GET /import/jobs/{job_id}`

**Function:** `get_import_job` (line 153)

Get import job detail with progress.

**Parameters:** `job_id`, `current_user`


---

## ecommerce_loyalty.py

E-Commerce Loyalty & Rewards API — points, tiers, referrals, leaderboard.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/loyalty/account` | `get_loyalty_account` | Get a customer's loyalty account (points, tier, lifetime_points). |
| `GET` | `/loyalty/tiers` | `list_loyalty_tiers` | List loyalty tiers for a store. |
| `GET` | `/loyalty/transactions` | `list_loyalty_transactions` | Customer loyalty transaction history (paginated). |
| `POST` | `/loyalty/redeem` | `redeem_points` | Redeem loyalty points against an order. |
| `GET` | `/loyalty/referral-code` | `get_referral_code` | Get or auto-create a referral code for a customer. |
| `GET` | `/loyalty/program` | `get_loyalty_program` | Admin: get loyalty program configuration for a store. |
| `PUT` | `/loyalty/program` | `update_loyalty_program` | Admin: update loyalty program configuration. |
| `GET` | `/loyalty/leaderboard` | `get_loyalty_leaderboard` | Top 20 customers by points_balance. |
| `POST` | `/loyalty/adjust` | `adjust_loyalty_points` | Admin: manually adjust loyalty points for a customer. |

### `GET /loyalty/account`

**Function:** `get_loyalty_account` (line 33)

Get a customer's loyalty account (points, tier, lifetime_points).

**Parameters:** `customer_id`, `current_user`


### `GET /loyalty/tiers`

**Function:** `list_loyalty_tiers` (line 68)

List loyalty tiers for a store.

**Parameters:** `store_id`, `current_user`


### `GET /loyalty/transactions`

**Function:** `list_loyalty_transactions` (line 97)

Customer loyalty transaction history (paginated).

**Parameters:** `customer_id`, `current_user`, `skip`, `limit`


### `POST /loyalty/redeem`

**Function:** `redeem_points` (line 136)

Redeem loyalty points against an order.

Body: {customer_id: str, points: int, order_id: str}
Returns: {discount_amount: float, points_used: int}

**Parameters:** `data`, `current_user`


### `GET /loyalty/referral-code`

**Function:** `get_referral_code` (line 189)

Get or auto-create a referral code for a customer.

**Parameters:** `customer_id`, `current_user`


### `GET /loyalty/program`

**Function:** `get_loyalty_program` (line 232)

Admin: get loyalty program configuration for a store.

**Parameters:** `store_id`, `current_user`


### `PUT /loyalty/program`

**Function:** `update_loyalty_program` (line 260)

Admin: update loyalty program configuration.

**Parameters:** `store_id`, `data`, `current_user`


### `GET /loyalty/leaderboard`

**Function:** `get_loyalty_leaderboard` (line 291)

Top 20 customers by points_balance.

**Parameters:** `current_user`


### `POST /loyalty/adjust`

**Function:** `adjust_loyalty_points` (line 322)

Admin: manually adjust loyalty points for a customer.

Body: {customer_id: str, points: int, note: str}
Positive points = add, negative = deduct.

**Parameters:** `data`, `current_user`


---

## ecommerce_subscriptions.py

E-Commerce Subscriptions API — recurring product subscriptions.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/subscriptions` | `create_subscription` | Create a new product subscription for a customer. |
| `GET` | `/subscriptions` | `list_my_subscriptions` | List subscriptions for a customer. |
| `GET` | `/subscriptions/admin` | `list_all_subscriptions` | Admin: list all subscriptions with customer + product info and MRR. |
| `PUT` | `/subscriptions/{subscription_id}/pause` | `pause_subscription` | Pause an active subscription. |
| `PUT` | `/subscriptions/{subscription_id}/resume` | `resume_subscription` | Resume a paused subscription. |
| `PUT` | `/subscriptions/{subscription_id}/skip` | `skip_subscription_cycle` | Skip next billing cycle by advancing next_billing_date by frequency_days. |
| `DELETE` | `/subscriptions/{subscription_id}` | `cancel_subscription` | Cancel a subscription. |
| `GET` | `/subscriptions/{subscription_id}` | `get_subscription` | Get a single subscription with its order history. |

### `POST /subscriptions`

**Function:** `create_subscription` (line 21)

Create a new product subscription for a customer.

**Parameters:** `data`, `current_user`


### `GET /subscriptions`

**Function:** `list_my_subscriptions` (line 77)

List subscriptions for a customer.

**Parameters:** `customer_id`, `current_user`, `status`


### `GET /subscriptions/admin`

**Function:** `list_all_subscriptions` (line 110)

Admin: list all subscriptions with customer + product info and MRR.

**Parameters:** `current_user`, `status`, `skip`, `limit`


### `PUT /subscriptions/{subscription_id}/pause`

**Function:** `pause_subscription` (line 167)

Pause an active subscription.

**Parameters:** `subscription_id`, `current_user`


### `PUT /subscriptions/{subscription_id}/resume`

**Function:** `resume_subscription` (line 187)

Resume a paused subscription.

**Parameters:** `subscription_id`, `current_user`


### `PUT /subscriptions/{subscription_id}/skip`

**Function:** `skip_subscription_cycle` (line 207)

Skip next billing cycle by advancing next_billing_date by frequency_days.

**Parameters:** `subscription_id`, `current_user`


### `DELETE /subscriptions/{subscription_id}`

**Function:** `cancel_subscription` (line 229)

Cancel a subscription.

**Parameters:** `subscription_id`, `current_user`


### `GET /subscriptions/{subscription_id}`

**Function:** `get_subscription` (line 251)

Get a single subscription with its order history.

**Parameters:** `subscription_id`, `current_user`


---

## storefront.py

Storefront public API — catalog, customer auth, cart, checkout, customer orders.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/catalog` | `catalog` | — |
| `GET` | `/catalog/{slug}` | `catalog_product` | — |
| `POST` | `/customer/register` | `register_customer` | — |
| `POST` | `/customer/login` | `login_customer` | — |
| `GET` | `/cart` | `get_cart` | — |
| `POST` | `/cart/items` | `add_cart_item` | — |
| `PUT` | `/cart/items/{item_id}` | `update_cart_item` | — |
| `DELETE` | `/cart/items/{item_id}` | `remove_cart_item` | — |
| `POST` | `/checkout` | `checkout` | — |
| `GET` | `/orders` | `customer_orders` | — |
| `GET` | `/orders/{order_id}` | `customer_order_detail` | — |

### `GET /catalog`

**Function:** `catalog` (line 185)

**Parameters:** `store_id`, `search`, `page`, `limit`


### `GET /catalog/{slug}`

**Function:** `catalog_product` (line 221)

**Parameters:** `slug`


### `POST /customer/register`

**Function:** `register_customer` (line 239)

**Parameters:** `payload`


### `POST /customer/login`

**Function:** `login_customer` (line 281)

**Parameters:** `payload`


### `GET /cart`

**Function:** `get_cart` (line 341)

**Parameters:** `session_key`, `x_customer_token`


### `POST /cart/items`

**Function:** `add_cart_item` (line 367)

**Parameters:** `payload`, `x_customer_token`


### `PUT /cart/items/{item_id}`

**Function:** `update_cart_item` (line 428)

**Parameters:** `item_id`, `payload`


### `DELETE /cart/items/{item_id}`

**Function:** `remove_cart_item` (line 453)

**Parameters:** `item_id`


### `POST /checkout`

**Function:** `checkout` (line 469)

**Parameters:** `payload`, `x_customer_token`


### `GET /orders`

**Function:** `customer_orders` (line 557)

**Parameters:** `x_customer_token`, `page`, `limit`


### `GET /orders/{order_id}`

**Function:** `customer_order_detail` (line 585)

**Parameters:** `order_id`, `x_customer_token`


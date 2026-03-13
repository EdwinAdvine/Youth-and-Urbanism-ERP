---
title: Setting Up Your Online Store
slug: setting-up-online-store
category: ecommerce
article_type: guide
module: ecommerce
tags: [ecommerce, store, setup, payments, mpesa, products, shipping]
sort_order: 1
is_pinned: false
excerpt: Configure your storefront, add products, set up payment methods, and publish your shop.
---

# Setting Up Your Online Store

Urban Vibes Dynamics includes a full e-commerce storefront. You can sell products directly from your Urban Vibes Dynamics instance without a separate Shopify or WooCommerce subscription. Inventory, orders, invoices, and customer records are all linked to the rest of the ERP automatically.

## Step 1: Configure Your Store Settings

Go to **E-Commerce → Settings**.

Fill in the basic store details:

- **Store Name**: the name that appears on your storefront (e.g., "Savanna Supplies Online Store")
- **URL Slug**: the path at which your store is accessible (e.g., `/shop/savanna-supplies`). The full URL will be `https://erp.yourcompany.co.ke/shop/savanna-supplies`.
- **Logo**: upload your store logo. This appears in the storefront header.
- **Currency**: select **KES (Kenyan Shilling)** — prices across the store are displayed in KES.
- **VAT Rate**: set the applicable VAT rate (currently **16%** for standard-rated goods in Kenya). The system adds VAT to all applicable products at checkout and includes it on the generated invoice.

## Step 2: Set Up Payment Methods

In **E-Commerce → Settings → Payment Methods**, enable the payment options you accept:

- **M-Pesa (Lipa Na M-Pesa / Paybill)**: enter your Paybill or Buy Goods number. Customers pay via M-Pesa and the payment is confirmed automatically via the M-Pesa API callback. This is the most common payment method for Kenyan customers.
- **Card (Visa / Mastercard)**: if your payment gateway supports card payments, enter the API credentials. Card payments are processed securely at checkout.
- **Bank Transfer**: enable this option to display your bank account details (bank name, account number, branch, account name) at checkout. Payment is confirmed manually by your Finance team once the deposit is verified.
- **Cash on Delivery**: customers pay in cash when the order is delivered. No upfront payment is collected online.

You can enable multiple payment methods simultaneously — customers choose at checkout.

## Step 3: Configure Shipping Zones and Rates

Go to **E-Commerce → Settings → Shipping**.

1. Click **Add Shipping Zone** and name it (e.g., "Nairobi CBD", "Nairobi Suburbs", "Upcountry Kenya").
2. Define which counties or regions fall within that zone.
3. Set the shipping rate for that zone (flat rate in KES, or free above a spend threshold).

Example rates:
- Nairobi CBD: KES 200 flat
- Nairobi Suburbs: KES 350 flat
- Upcountry (all other counties): KES 600 flat
- Free shipping for orders above KES 5,000

## Step 4: Add Products

Go to **E-Commerce → Products → New Product**.

For each product, fill in:

- **Name** and **Description** (supports rich text with images)
- **Price** (in KES, excluding VAT — VAT is added automatically at checkout based on the rate set in Step 1)
- **SKU** (stock-keeping unit) — links to the Inventory module for stock tracking
- **Stock quantity** — initial stock level
- **Images** — upload one or more product photos
- **Category** — assign the product to a storefront category (e.g., "Stationery", "Electronics", "Beverages")
- **Weight** (optional, for shipping calculators)

Click **Save** to add the product. Repeat for all products in your catalogue.

## Step 5: Organise into Categories

In **E-Commerce → Categories**, create and arrange the product categories that appear in your storefront navigation. Customers can browse by category or search by product name.

## Step 6: Publish Your Store

When your store is configured and products are added, go to **E-Commerce → Settings** and toggle **Store Status** from **Draft** to **Published**.

Your storefront is now live. Copy the store URL and share it — on your website, your social media profiles, in your email signature, or via WhatsApp to customers. Customers can browse, add to cart, and complete checkout without needing an Urban Vibes Dynamics account.

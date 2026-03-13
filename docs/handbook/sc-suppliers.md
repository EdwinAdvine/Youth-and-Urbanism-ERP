---
title: Managing Suppliers
slug: managing-suppliers
category: supply-chain
article_type: guide
module: supply-chain
tags: [suppliers, procurement, vendor-management, contacts]
sort_order: 1
is_pinned: false
excerpt: Add suppliers, track performance, and manage supplier contracts and contacts.
---

# Managing Suppliers

Suppliers are the backbone of your supply chain. Urban Vibes Dynamics gives you a single place to manage every vendor relationship — from first contact through to performance scoring and payment terms.

## Adding a New Supplier

Navigate to **Supply Chain → Suppliers → New Supplier**.

Fill in the core details:

- **Name** — Legal trading name of the supplier.
- **Contact Person** — Primary point of contact at the supplier (linked to a CRM contact record if one exists).
- **Email** — Used for automated PO delivery and GRN confirmations.
- **Phone** — Primary contact number; add secondary numbers in the Notes field.
- **Payment Terms** — Select from your configured terms (e.g. Net 30, Net 60, COD, 50% upfront). These terms auto-populate on every Purchase Order raised for this supplier.
- **Delivery Lead Time** — Default number of calendar days from PO issue to expected delivery. Used by the Planning module when calculating reorder dates.
- **Preferred Currency** — KES by default; change if your supplier invoices in USD, EUR, or another currency. Urban Vibes Dynamics applies your configured exchange rate at the time of billing.

### Additional Fields

- **Tax PIN / VAT Number** — Required for ETR-compliant vendor bills in Kenya.
- **Bank Details** — Account name, bank, branch, and account number for payment processing via Finance.
- **Tags** — Freeform tags (e.g. `local`, `imported`, `preferred`, `fragile-goods`) for filtering and reporting.

## Linking to CRM

If this supplier is also a CRM contact (e.g. a supplier who is also a B2B customer), click **Link CRM Contact** and search for the existing record. This prevents duplicate entries and ensures all communication history is visible from both modules.

## Tracking Purchase Order History

Open any supplier record and click the **Purchase Orders** tab. You will see every PO raised against this supplier, with status (draft, sent, partially received, closed) and total value. Click any PO to open it directly in the Procurement module.

## Supplier Performance & Ratings

Urban Vibes Dynamics automatically calculates two performance metrics, visible on the **Performance** tab:

- **On-Time Delivery %** — Percentage of PO line items received on or before the expected delivery date over the past 12 months.
- **Quality Score** — Calculated from GRN quality acceptance rates and any Non-Conformance Reports (NCRs) raised against this supplier's deliveries.

These scores update automatically whenever a GRN or NCR is posted. Use the **Supplier Scorecard** report under Supply Chain → Reports to compare all suppliers side by side.

## Managing Contracts

Attach contract documents directly to the supplier record under the **Documents** tab. Supported file types: PDF, DOCX, XLSX. You can also set a **Contract Expiry Date** — Urban Vibes Dynamics will send an automated reminder email 30 days and 7 days before expiry to the procurement manager.

## Best Practices

- Always set a realistic **Delivery Lead Time** — this drives procurement planning accuracy.
- Review supplier performance quarterly using the Scorecard report.
- Mark unreliable suppliers with a `review` tag so procurement staff are prompted before raising new POs.
- Keep bank details up to date to avoid payment delays; the Finance module pulls these when generating payment runs.

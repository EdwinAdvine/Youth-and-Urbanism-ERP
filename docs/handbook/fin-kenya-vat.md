---
title: Kenya VAT & Tax Compliance
slug: kenya-vat-tax-compliance
category: finance
article_type: guide
module: finance
tags: [vat, tax, kenya, kra, wht, compliance, paye]
sort_order: 8
is_pinned: false
excerpt: Configure and apply Kenya VAT (16%), WHT, and other statutory deductions in Urban Vibes Dynamics.
---

# Kenya VAT & Tax Compliance

Urban Vibes Dynamics is built with Kenya's tax framework in mind. This article covers how to configure VAT rates, apply Withholding Tax (WHT), and export data for KRA filing. Payroll taxes (PAYE, NHIF, NSSF, NITA) are handled separately in the HR/Payroll module.

## Kenya VAT Rates

Under the Kenya VAT Act (Cap 476), there are three VAT treatment categories:

| Treatment | Rate | Examples |
|---|---|---|
| **Standard Rated** | 16% | Most goods and services, professional services, software |
| **Zero Rated** | 0% | Exports, certain food staples (unga, sugar), pharmaceuticals |
| **Exempt** | No VAT | Land, financial services, educational services |

The critical difference between Zero Rated and Exempt: a **Zero Rated** supplier can still claim input VAT credits on their purchases. An **Exempt** supplier cannot.

## Configuring Tax Rates

Tax rates are managed by the Finance Admin under **Finance → Tax Rates**.

Urban Vibes Dynamics ships with three default rates:
- **VAT 16%** (Standard)
- **VAT 0%** (Zero-Rated)
- **Exempt** (No VAT)

To add a custom rate (e.g. for specific goods with a different rate per a KRA public notice), click **New Tax Rate**:

| Field | Description |
|---|---|
| **Name** | e.g. "VAT 16% – Standard" |
| **Rate (%)** | e.g. 16 |
| **Tax Account** | The liability account where collected VAT is held (e.g. 2100 – VAT Payable) |
| **Tax Type** | Sales (charged to customers) or Purchase (paid to suppliers) |

## Applying VAT on Invoices

When creating an invoice, select the appropriate tax rate on each line item. Urban Vibes Dynamics calculates:

- **Tax Exclusive** pricing: the entered unit price is the pre-tax price, and VAT is added on top
- **Tax Inclusive** pricing: the entered unit price already includes VAT, and Urban Vibes Dynamics backs out the VAT component

You can set the default pricing mode per customer or globally in **Finance → Settings**.

**Example:**
A consulting firm charges KES 100,000 for advisory services (standard rated).
- Tax Exclusive: Invoice shows KES 100,000 + KES 16,000 VAT = **KES 116,000 total**
- The KES 16,000 is credited to account 2100 (VAT Payable) and remitted to KRA by the 20th of the following month.

## Withholding Tax (WHT)

Withholding Tax applies when you pay certain categories of suppliers. The payer deducts WHT from the payment and remits it to KRA on the supplier's behalf.

**Common WHT rates in Kenya:**
| Payment Type | WHT Rate |
|---|---|
| Professional fees (residents) | 5% |
| Consultancy fees (residents) | 5% |
| Management fees (residents) | 5% |
| Dividends to residents | 5% |
| Rent (commercial property) | 30% of gross (for non-resident landlords) |

To apply WHT on a vendor bill, open the bill and enable the **WHT** toggle on the relevant line item. Select the WHT rate. Urban Vibes Dynamics creates the WHT liability on the 2200 – WHT Payable account.

When you remit WHT to KRA, record the payment against the 2200 account via a manual journal entry or a bill payment to KRA.

## PAYE, NHIF, NSSF

These payroll statutory deductions are **not** handled in the Finance module. They are calculated and withheld automatically by the **HR → Payroll** module and the resulting payables appear in the Finance accounts. Refer to the HR/Payroll handbook articles for details.

## KRA iTax Filing

Urban Vibes Dynamics does not file directly to iTax — direct API integration is not officially available to third-party software. However, you can export all the data you need:

1. **VAT Report:** Finance → Reports → VAT Summary. Export for the month/quarter. This gives output VAT (charged to customers) and input VAT (paid to suppliers) and the net VAT due.

2. **WHT Schedule:** Finance → Reports → WHT Report. Export a list of all WHT deductions by supplier, required for the WHT return.

3. **Tax Transactions Export:** Finance → Reports → Tax Ledger. Full detail of every taxable transaction for a period.

Import these CSV exports into your iTax filing spreadsheets or share with your tax agent.

> **Reminder:** VAT returns are due on the **20th of the month following the end of the tax period**. WHT is also remitted monthly by the 20th. Set a recurring reminder in Urban Vibes Dynamics's Calendar module to avoid penalties.

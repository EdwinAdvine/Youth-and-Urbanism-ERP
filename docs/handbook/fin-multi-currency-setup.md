---
title: Multi-Currency & Exchange Rates
slug: fin-multi-currency-setup
category: finance
article_type: guide
module: finance
tags: [multi-currency, exchange-rates, foreign-currency, forex]
sort_order: 11
is_pinned: false
excerpt: Configure additional currencies, set exchange rates, and record foreign-currency transactions.
---

# Multi-Currency & Exchange Rates

Urban Vibes Dynamics supports transactions in multiple currencies. All amounts are stored in their original currency and converted to your base currency for financial reports. This guide covers configuration, recording foreign-currency transactions, and understanding how forex gains and losses are handled.

> **Pro tip:** Always record the exchange rate on the invoice date, not the payment date — this is the KRA-required rate for VAT purposes.

---

## 1. Base Currency

Your **base currency** is the currency used in all financial reports, account balances, and statutory filings. It is the denomination your books are kept in.

- **Default:** KES (Kenyan Shilling)
- **Set at:** Admin → Settings → Company → Currency

**Important:** Changing the base currency after transactions have been recorded does not retroactively convert historical amounts. Existing records will remain in the old base currency denomination. Only change the base currency before creating any financial records, or during a clean system setup.

If you need to restate your books in a different currency, do so at period end via a manual journal entry and consult your accountant.

---

## 2. Adding Currencies

To transact in a foreign currency, you must first add that currency to Urban Vibes Dynamics.

1. Go to **Finance → Settings → Currencies**.
2. Click **+ Add Currency**.
3. Select the currency from the list (ISO 4217 codes — USD, EUR, GBP, etc.).
4. The currency symbol, decimal places, and name are pre-populated.
5. Optionally set it as **Active** (active currencies appear in transaction forms) or **Inactive** (hidden from selection but historical records are preserved).
6. Click **Save**.

Repeat for each foreign currency you transact in. Common additions for Kenyan businesses: USD, EUR, GBP, UGX, TZS, ZAR.

---

## 3. Exchange Rate Types

Urban Vibes Dynamics supports two approaches to managing exchange rates:

| Type | Description |
|---|---|
| **Manual** | You enter the rate yourself. Suitable for businesses that transact occasionally in foreign currencies or use a specific bank's rates. |
| **Auto-fetched** | If configured by the Super Admin, rates are pulled from an external exchange rate feed automatically at a set frequency. |

To check which mode is active, go to **Finance → Settings → Exchange Rates → Rate Source**. Most self-hosted deployments use manual rates unless an API key for a rate provider has been configured.

---

## 4. Setting an Exchange Rate

You must set a rate for each currency before recording transactions in that currency. Rates are date-stamped so the correct rate is applied based on the transaction date.

1. Go to **Finance → Settings → Exchange Rates**.
2. Click **+ Add Rate**.
3. Select the **Currency** (e.g., USD).
4. Enter the **Effective Date** — the date from which this rate applies.
5. Enter the rates:

| Field | Description |
|---|---|
| **Mid Rate** | The middle market rate. Used for reporting and valuation. |
| **Buy Rate** | The rate at which you buy foreign currency (bank sells to you). Used when receiving foreign-currency payments. |
| **Sell Rate** | The rate at which you sell foreign currency (bank buys from you). Used when making foreign-currency payments. |

6. Click **Save Rate**.

Urban Vibes Dynamics uses the most recent rate on or before the transaction date. If no rate exists for a transaction date, the system will warn you before allowing the transaction to be saved.

---

## 5. Recording a Foreign-Currency Invoice

When a customer invoices you, or you invoice a customer, in a foreign currency:

1. Go to **Finance → Invoices → + New Invoice**.
2. In the **Currency** field (top of the invoice form), select the foreign currency (e.g., USD).
3. The exchange rate field will auto-populate with the rate set for the invoice date. You can override this manually if needed.
4. Enter line items in the foreign currency — amounts appear in USD (or your chosen currency).
5. The **KES equivalent** is shown at the bottom of the invoice for your reference.
6. Send and save the invoice normally.

The invoice is stored in both USD (the invoice currency) and KES (the base currency equivalent at the rate on the invoice date). All financial reports aggregate the KES equivalent.

---

## 6. Foreign-Currency Payments

When you receive or make a payment against a foreign-currency invoice, the exchange rate at the time of payment may differ from the rate at invoice date. Urban Vibes Dynamics handles this automatically.

**Receiving a foreign-currency payment:**

1. Open the foreign-currency invoice.
2. Click **Record Payment**.
3. Select the **bank account** the payment was received in (can be a foreign-currency bank account or a KES account).
4. Enter the **payment date** and **amount received** in the invoice currency.
5. If paying to a KES account, enter the **actual KES amount received** — Urban Vibes Dynamics calculates the effective rate and posts the forex difference.
6. Save the payment.

Urban Vibes Dynamics automatically calculates the **exchange gain or loss** — the difference between the KES value at invoice date and the KES value at payment date — and posts it to the **Forex Gain/Loss** account in your Chart of Accounts.

---

## 7. Unrealised vs Realised FX Gains and Losses

| Type | When It Occurs | How Urban Vibes Dynamics Handles It |
|---|---|---|
| **Unrealised** | A foreign-currency invoice is outstanding at period end and the rate has moved since the invoice date. | At period end, run the **Forex Revaluation** tool (Finance → Tools → Revalue Foreign Currency). Urban Vibes Dynamics recalculates open foreign-currency balances at the current rate and posts unrealised gain/loss entries. These reverse at the start of the next period. |
| **Realised** | A foreign-currency invoice is paid and the payment rate differs from the invoice rate. | Urban Vibes Dynamics automatically posts the realised gain/loss when the payment is recorded — no manual entry needed. |

The Forex Gain/Loss account is a system account created automatically. You can rename it or map it to an existing account in your Chart of Accounts if you have a preferred account structure.

---

## 8. Bank Accounts in Foreign Currency

If you hold a USD or other foreign-currency bank account, set it up correctly in the Chart of Accounts so balances are tracked in the account's native currency.

1. Go to **Finance → Chart of Accounts**.
2. Find your bank account or click **+ New Account**.
3. Set **Account Type** to Bank.
4. Set **Currency** to the foreign currency (e.g., USD).
5. Save the account.

When this bank account is selected in a payment, Urban Vibes Dynamics records the payment in USD and converts to KES for the general ledger. The bank account balance is shown in USD on the balance sheet with a KES equivalent in brackets.

You can reconcile a foreign-currency bank account the same way as a KES account — upload your USD bank statement and match transactions.

---

## 9. Financial Reports and Foreign Currency

All standard financial reports (P&L, Balance Sheet, Cash Flow, Trial Balance) display amounts in **base currency (KES)**.

Additional currency visibility:

| Report | Foreign Currency Support |
|---|---|
| **Invoice List** | Shows original currency and KES equivalent columns |
| **Transaction Report** | Shows original currency amount, rate used, and KES equivalent for each line |
| **Bank Account Ledger** | Shows transactions in account currency with KES equivalent |
| **Forex Gain/Loss Report** | Shows all realised and unrealised forex entries for a period |
| **Aged Receivables / Payables** | Shows both original currency and KES equivalent totals |

To run a foreign-currency report, go to **Finance → Reports**, select the report, and use the **Currency** filter to view only USD-denominated transactions, for example.

---

## Next Steps

- [Bank Reconciliation](./fin-reconciliation.md) — reconcile foreign-currency bank accounts
- [Chart of Accounts Setup](./fin-chart-of-accounts.md) — configure your account structure
- [Invoicing Guide](./fin-invoicing.md) — create and send invoices

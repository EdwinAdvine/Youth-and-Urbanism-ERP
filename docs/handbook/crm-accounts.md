---
title: Accounts (Companies)
slug: crm-accounts
category: crm
article_type: guide
module: crm
tags: [accounts, companies, organisations, b2b]
sort_order: 8
is_pinned: false
excerpt: Manage company accounts and link contacts, deals, and activities to a single organisation record.
---

# Accounts (Companies)

In Urban Vibes Dynamics CRM, **Accounts** represent companies and organisations, while **Contacts** represent individual people. Linking contacts and deals to an account gives your team a single view of your entire relationship with a business — across every rep, deal, and interaction.

---

## 1. What Accounts Are

An account is the company record. It stores:

- Company-level information (industry, size, billing address, KRA PIN)
- A list of linked contacts (people who work there)
- All deals associated with the company
- An aggregated activity timeline from every linked contact
- Notes shared across the team

Accounts are the primary unit for B2B sales reporting. Revenue, deal count, and relationship health are all measured at the account level.

---

## 2. Creating an Account

Go to **CRM → Accounts → New Account**.

| Field | Description |
|---|---|
| Company Name | Legal or trading name |
| Industry | Dropdown — e.g., Manufacturing, Retail, NGO |
| Company Size | Headcount band — e.g., 1–10, 50–200 |
| KRA PIN | For Kenyan businesses — used in invoice generation |
| Website | Company website URL |
| Physical Address | Billing / registered address |
| Phone | Main office number |
| Assigned Rep | The account owner (default assignee for new deals) |
| Source | How this account was acquired |

Save the account. You can start linking contacts immediately.

> **Tip:** Always create the Account before the Contact. Linking contacts to accounts is how you get a complete picture of your relationship with a company.

---

## 3. Linking Contacts to an Account

When creating or editing a contact, set the **Company** field to an existing account. The contact then appears under that account's **Contacts** tab.

A contact can belong to only one account at a time. If a contact moves to a different company, update their Company field — the historical activity on the old account is preserved.

To view all contacts at an account: open the account → **Contacts** tab.

---

## 4. Account Timeline

The account's **Timeline** tab aggregates activity from all linked contacts and deals:

- Calls, emails, meetings, and notes logged against any linked contact
- Deal stage changes
- Emails received from any contact at the company (if Mail module is linked)
- Invoice and payment events (if Finance module is linked)

This gives any team member the full picture of the relationship immediately, without needing to check each contact individually.

---

## 5. Account Health Score

Urban Vibes Dynamics's AI calculates an **Account Health Score** (0–100) for each account based on:

- **Engagement** — recency and frequency of activities
- **Deal momentum** — active deals in positive stages
- **Payment history** — on-time payments from Finance module
- **Support load** — open support tickets from the Support module

Health scores are updated nightly. Accounts with scores below 40 are flagged as **At Risk** in the account list view.

Use the health score to prioritise account reviews and proactive outreach.

---

## 6. Key Contacts

Within an account, mark specific contacts with roles to make them easy to identify:

| Role | Use for |
|---|---|
| Primary Contact | Default recipient for account-level communications |
| Decision Maker | The person who signs off on purchases |
| Champion | Internal advocate for your product |
| Technical Contact | Handles implementation or integration queries |

Assign roles from the contact card within the account's Contacts tab. Multiple contacts can share the same role.

---

## 7. Account-Level Deals

Deals can be linked to an account rather than an individual contact. Account-level deals appear on the account's **Deals** tab and roll up into the account's total pipeline value and won revenue.

When creating a deal, set the **Account** field to link it. The account is then visible from the deal and vice versa.

---

## 8. Account Notes

The **Notes** tab on an account holds shared notes visible to the entire team:

- Use for strategic context (e.g., "CEO is looking to exit in 18 months — focus on ROI story")
- Notes are not sent to the contact; they are internal only
- Notes are timestamped and attributed to the author
- Notes support rich text and file attachments

---

## 9. Merging Duplicate Accounts

If duplicate account records exist:

1. Open one of the duplicate accounts
2. Click **More → Merge Account**
3. Search for and select the duplicate
4. Review the merge preview — Urban Vibes Dynamics shows which account's field values will be kept
5. Confirm the merge

After merging: all contacts, deals, activities, and notes from both records are consolidated into a single account. The duplicate record is deleted. This action cannot be undone.

---

## 10. Importing Accounts

To import a list of companies from a spreadsheet:

1. **CRM → Accounts → Import**
2. Download the CSV template
3. Required columns: `company_name`
4. Optional columns: `industry`, `website`, `assigned_rep`, `phone`, `kra_pin`, `size`
5. Upload the CSV and map columns if needed
6. Run the import — duplicates are detected by company name + website

After import, review the results log for any skipped or flagged rows.

---

## Quick Reference

| Action | Path |
|---|---|
| Create an account | CRM → Accounts → New Account |
| View all accounts | CRM → Accounts |
| Link a contact | Contact record → Company field |
| Account timeline | Account → Timeline tab |
| Merge duplicates | Account → More → Merge Account |
| Import accounts | CRM → Accounts → Import |
| At-risk accounts | CRM → Accounts → Filter: Health Score < 40 |

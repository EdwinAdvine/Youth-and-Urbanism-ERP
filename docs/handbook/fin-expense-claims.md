---
title: Employee Expense Claims
slug: employee-expense-claims
category: finance
article_type: guide
module: finance
tags: [expenses, reimbursement, claims, approval, payables]
sort_order: 7
is_pinned: false
excerpt: Submit, review, and reimburse employee expense claims with approval workflow.
---

# Employee Expense Claims

When an employee spends their own money on a business expense — a client lunch, a matatu fare to a site visit, a USB cable for the office — they submit an expense claim in Urban Vibes Dynamics to get reimbursed. The full workflow goes from submission to approval to reimbursement, with every step creating a proper accounting entry.

## For Employees: Submitting a Claim

### Step 1: Create a New Claim

Navigate to **Finance → Expenses** and click **New Expense Claim**.

| Field | Description |
|---|---|
| **Title** | A brief description, e.g. "Client lunch – Sarova Stanley, 12 Mar 2025" |
| **Date** | When the expense was incurred |
| **Amount** | Total amount spent in KES |
| **Category** | Choose from the list: Meals & Entertainment, Travel, Office Supplies, Fuel, etc. |
| **Account** | The expense account this should post to (pre-filled based on category) |
| **Notes** | Any additional context your manager needs to approve this |

### Step 2: Upload Receipt

Click **Upload Receipt** and attach a photo of the receipt or invoice. This is mandatory for claims above KES 500. For M-Pesa payments, a screenshot of the confirmation message is acceptable.

> **Tip:** Use your phone to photograph receipts immediately after paying. A blurry or missing receipt will delay your reimbursement.

### Step 3: Submit for Review

Click **Submit**. The claim status changes from **Draft** to **Pending Review**, and your Finance Admin receives a notification to review it.

You can track the status of all your submitted claims from **Finance → Expenses → My Claims**.

---

## For Finance Admins: Reviewing Claims

### Step 1: View Pending Claims

Go to **Finance → Expenses → Pending Review**. All submitted claims waiting for action are listed here.

### Step 2: Review the Claim

Click a claim to open it. Review:
- The description and business purpose
- The receipt/supporting document
- The amount and the account it will post to

### Step 3: Approve or Reject

- **Approve** — The claim moves to **Approved** status and triggers the journal entry (see below).
- **Reject** — Enter a rejection reason. The employee is notified and can edit and resubmit.

You can also request more information by adding a comment on the claim before making a decision.

---

## Accounting for Approved Claims

When a claim is approved, Urban Vibes Dynamics automatically posts:

| Debit | Credit |
|---|---|
| Expense Account (e.g. 5300 Travel) | Employee Payable (2300) |

This records the expense in the correct period and creates a payable — the business now owes the employee the reimbursement amount.

---

## Paying Out the Reimbursement

Once the claim is approved and in your **Approved** queue:

1. Open the claim
2. Click **Mark as Paid**
3. Enter payment date and method (Bank Transfer, M-Pesa, Cash)
4. Enter the reference (M-Pesa transaction code, etc.)

Urban Vibes Dynamics posts the payment entry:

| Debit | Credit |
|---|---|
| Employee Payable (2300) | Bank / Cash Account |

The claim status changes to **Paid** and the employee receives a notification.

---

## Batch Payments

If you have multiple claims to reimburse at once (e.g. after a field trip where three staff members claim fuel), use **Finance → Expenses → Batch Pay**. Select all approved claims and process them together as a single bank transfer or M-Pesa bulk payment.

## Claim Limits and Policies

Finance Admins can configure per-category claim limits under **Finance → Settings → Expense Policies**. Claims that exceed the limit will be flagged automatically for additional review.

Common Kenyan business practice:
- Meals per diem: KES 1,500–3,000 per day
- Fuel reimbursement: KES 20–25 per km (or actual receipt)
- Accommodation: actual receipt required

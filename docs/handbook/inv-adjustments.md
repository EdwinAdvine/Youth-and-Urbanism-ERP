---
title: "Stock Adjustments & Write-offs"
slug: stock-adjustments-write-offs
category: inventory
article_type: guide
module: inventory
tags: [adjustments, write-offs, cycle-count, stocktake, finance]
sort_order: 3
is_pinned: false
excerpt: "Correct stock discrepancies discovered during cycle counts or audits."
---

# Stock Adjustments & Write-offs

No matter how careful your team is, the physical stock count will occasionally differ from what Urban Vibes Dynamics shows. Theft, damage, miscounts, expiry, and data entry errors all contribute. Stock adjustments are the controlled, auditable way to bring the system back into alignment with reality — and to ensure the correction is properly recorded in Finance.

## When to Create an Adjustment

Use a stock adjustment when:

- A **cycle count or annual stocktake** reveals a difference between the system quantity and the physical count.
- Items are **damaged** during storage or handling and can no longer be sold or used.
- Stock has been **stolen or lost** with no purchase or transfer record to explain the reduction.
- Goods have **expired** (particularly relevant for food products, pharmaceuticals, or perishable materials).
- A **GRN data entry error** was made during receiving and the correction window has closed.
- Items were **used internally** (e.g., office supplies consumed by your own staff) and not recorded as an issue.

## Creating a Stock Adjustment

1. Navigate to **Inventory → Adjustments → New Adjustment**.
2. Select the **Warehouse** where the discrepancy occurred.
3. Select the **Adjustment Reason** from the dropdown:

   | Reason | Use Case |
   |---|---|
   | Cycle Count Discrepancy | Quantity found during physical count differs from system |
   | Damage / Write-off | Items broken, unusable, or destroyed |
   | Theft / Shrinkage | Stock missing with no transaction explanation |
   | Expiry | Goods past their use-by date |
   | Receiving Error Correction | GRN was entered with wrong quantity |
   | Internal Consumption | Stock used internally, not sold |
   | System Correction | Data migration or import error |

4. Add items to the adjustment:
   - Click **Add Item** and search by name or SKU.
   - The system shows the **Current System Quantity** for that item at the selected warehouse.
   - Enter the **Actual Physical Quantity** — what you counted on the shelf.
   - The **Variance** column calculates automatically: positive if you have more than the system shows, negative if you have less.
   - Add an **Item Note** for each line (e.g., "5 units water-damaged in flooding on 8 March 2026").
   - Repeat for all affected items.

5. Add an **Adjustment Summary Note** covering the overall reason and any supporting context (e.g., "Post-annual stocktake conducted 12 March 2026 by warehouse team. Full count sheets on file.").

6. Click **Submit for Approval**.

## Approval Workflow

Adjustments require approval before stock levels change. This prevents unauthorised or accidental write-offs.

The approval threshold is configurable under **Inventory → Settings → Adjustment Approvals**:

- Adjustments with a total value impact below a set threshold (e.g., KES 10,000) can be set to auto-approve or require Inventory Admin approval only.
- Adjustments above the threshold require both Inventory Admin and Finance Admin sign-off.

The approver receives an in-app notification and an email. They can open the adjustment, review each line, and click **Approve** or **Reject with Comment**.

## What Happens After Approval

Once an adjustment is approved:

1. **Stock levels update immediately** — the system quantity for each affected item at the warehouse is set to the approved actual quantity.
2. **A journal entry is posted to Finance** automatically:
   - For a **positive adjustment** (found more stock than expected): Debit Inventory Asset Account → Credit Stock Adjustment Account.
   - For a **negative adjustment** (less stock than expected — the more common scenario for damage/theft): Debit Stock Write-off / Shrinkage Expense Account → Credit Inventory Asset Account.
   - The specific accounts used are configured under **Finance → Settings → Chart of Accounts → Inventory Accounts**. Common Kenya practice is to map these to the relevant expense or asset account under the business's chart.
3. **An audit log entry is created** recording: who submitted the adjustment, who approved it, date/time, each item and variance, and the total value impact in KES. This log is immutable.

## Cycle Counts: How to Conduct Them

Rather than waiting for discrepancies to surface, proactive cycle counts catch issues early. Urban Vibes Dynamics supports structured cycle counts:

1. **Plan the count**: Go to **Inventory → Cycle Count → New Count**. Select the scope — entire warehouse, a specific category (e.g., all Electrical Materials), or a specific shelf/bin location.
2. **Print the count sheet**: Urban Vibes Dynamics generates a PDF listing every item in scope with a blank column for the physical count. Distribute to your counting team.
3. **Blind count**: Ideally, counters should not see the system quantity before counting — this prevents anchoring bias.
4. **Enter the results**: Back in the system, enter the physical count for each line. The system shows variances immediately.
5. **Resolve variances**: Items with a large or unexpected variance should be recounted before the adjustment is posted. Small variances within tolerance can be adjusted directly.
6. **Generate adjustments**: Click **Create Adjustment from Count**. All lines with a variance become a single adjustment record, which then follows the standard approval workflow.

### Recommended Count Frequency

| Item Class | Frequency |
|---|---|
| High-value or fast-moving (A-class) | Monthly |
| Medium-value or medium-velocity (B-class) | Quarterly |
| Low-value or slow-moving (C-class) | Annually |

Urban Vibes Dynamics's **Inventory → Reports → Stock Velocity** report helps you classify items by movement frequency so you can build a realistic count schedule.

> **Tip:** Document every adjustment with supporting evidence — a photo of damaged goods, a count sheet signed by two team members, a police abstract for theft. Urban Vibes Dynamics stores document attachments on each adjustment record. An external audit or KRA inspection will look for this paper trail, and having it ready demonstrates good internal controls.

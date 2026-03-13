---
title: Quality Control
slug: quality-control
category: manufacturing
article_type: guide
module: manufacturing
tags: [quality, qc, inspection, ncr, capa, non-conformance]
sort_order: 3
is_pinned: false
excerpt: Set up inspection plans, record QC results, and manage non-conformances.
---

# Quality Control

Urban Vibes Dynamics's Quality Control module provides structured inspection plans, non-conformance management, and corrective action workflows. QC can be triggered at two points: on receipt of goods from suppliers (incoming inspection) and at completion of production (in-process / final inspection).

## Creating an Inspection Plan

Navigate to **Manufacturing → Quality → Inspection Plans → New**.

1. **Name** — A clear label such as "Incoming Steel Sheet Inspection" or "Final Assembly QC — Model X".
2. **Trigger** — Select when this plan applies:
   - **On GRN** — Triggered when a Goods Received Note is posted for a specified product or supplier.
   - **On Work Order Completion** — Triggered when a work order for a specified product is marked ready for QC.
3. **Product / Product Category** — Scope the plan to a specific product, a category, or all products.
4. **Inspection Criteria** — Add one row per quality check:
   - **Criterion Name** — e.g. "Tensile strength", "Visual surface defects", "Moisture content".
   - **Measurement Type** — Numeric (enter a value), Pass/Fail (checkbox), or Text (free entry).
   - **Acceptable Range / Limit** — For numeric: min and max values. For Pass/Fail: expected outcome is Pass.
   - **Required?** — Mark criteria that must be completed before the inspection can be submitted.

Save and set the plan status to **Active**.

## Recording Inspection Results

When a GRN or work order triggers an inspection, an **Inspection Order** is automatically created and assigned to the designated QC inspector (configured under Quality → Settings).

The inspector navigates to **Manufacturing → Quality → Inspection Orders**, opens the pending order, and records results:

- Enter the measured value or tick Pass/Fail for each criterion.
- Add photos or attachments (e.g. photos of damage, lab test reports) using the **Attach Evidence** button.
- Enter an **Inspector Note** for any observations outside the formal criteria.

When all required criteria are filled, click **Submit Inspection**.

## Pass Outcome

If all criteria are within acceptable limits, the inspection result is **Passed**:

- For GRN-triggered inspections: goods are released from Quality Hold to the designated warehouse location.
- For work order inspections: the work order advances to **Completed** and finished goods are added to Inventory.

## Fail Outcome — Non-Conformance Report (NCR)

If any criterion fails, Urban Vibes Dynamics automatically creates a **Non-Conformance Report**. The NCR records:

- Which criteria failed and by how much.
- The batch/lot reference.
- The source (supplier and PO, or work order reference).
- The disposition decision:
  - **Use As Is** — Minor deviation accepted by QC manager.
  - **Rework** — Return to production for correction.
  - **Scrap** — Write off the batch. Stock and cost updated accordingly.
  - **Return to Supplier** — Initiate a Return to Supplier from the NCR (for incoming inspection failures).

NCRs appear on the NCR Dashboard with status: Open → Under Review → Disposition Decided → Closed.

## CAPA — Corrective & Preventive Action

When an NCR reveals a systemic issue, raise a **CAPA** from within the NCR record. A CAPA includes:

- **Root Cause Analysis** — Free text description and an optional root cause category (Human Error, Machine, Method, Material, Environment).
- **Corrective Actions** — Specific tasks assigned to responsible persons with due dates (tracked as checklist items).
- **Preventive Actions** — Changes to prevent recurrence (e.g. update inspection plan limits, retrain operator, change supplier).
- **Verification Date** — The date by which effectiveness will be checked.

CAPAs are tracked on the CAPA board. Overdue actions generate automated reminders.

## SPC Charts

For numeric inspection criteria collected repeatedly over time, Urban Vibes Dynamics generates **Statistical Process Control (SPC) charts** automatically. Navigate to **Manufacturing → Quality → SPC Charts**, select a product and criterion, and the system plots:

- Individual measurements over time.
- Control limits (UCL / LCL) based on historical process variation.
- Out-of-control signals highlighted in red (Western Electric rules).

SPC charts are the earliest warning that a process is drifting before it produces actual defects. Review them weekly for critical production processes.

## Best Practices

- Attach inspection plans to every new product before the first production run, not after the first quality failure.
- Use photo evidence for any NCR — it is the most effective tool in supplier disputes.
- Close all CAPAs on time; an open CAPA with a missed due date defeats the purpose of corrective action.

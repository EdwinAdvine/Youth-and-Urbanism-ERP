---
title: Work Orders & Production
slug: work-orders-production
category: manufacturing
article_type: guide
module: manufacturing
tags: [work-orders, production, manufacturing, workstation, scheduling]
sort_order: 2
is_pinned: false
excerpt: Create work orders, schedule production, and track progress through workstations.
---

# Work Orders & Production

A Work Order is the instruction to produce a specific quantity of a finished good. It ties together the Bill of Materials (components), the schedule (when to produce), and the workstation (where to produce). Urban Vibes Dynamics tracks each work order from draft through to finished goods in Inventory.

## Creating a Work Order

Navigate to **Manufacturing → Work Orders → New**.

1. **Product** — Select the finished good to manufacture. Urban Vibes Dynamics automatically loads the active BOM for this product.

2. **Quantity to Produce** — Enter the production run quantity. Component requirements scale proportionally from the BOM.

3. **Scheduled Start Date / End Date** — Set when production should begin and when it should be completed. Urban Vibes Dynamics checks workstation availability and flags conflicts with other scheduled work orders on the same station.

4. **Workstation** — Select the production workstation or machine where this work order will run (e.g. Assembly Line 1, Mixing Tank A, Cutting Station). Workstations carry an hourly rate used for labour costing.

5. **Responsible Operator** — Assign the production supervisor or operator responsible for this work order. They receive an in-app notification and can update progress from the shop floor view.

6. **Priority** — Normal / High / Urgent. High and Urgent work orders appear highlighted on the production schedule board.

## Work Order Status Flow

```
Draft → Confirmed → In Progress → QC Check → Completed
                                       ↓
                                    Failed QC → Rework / Scrap
```

- **Draft** — Created but not yet released to the shop floor. Components are not yet reserved.
- **Confirmed** — Released. Components are reserved from inventory (soft allocation). The work order appears on the workstation's schedule.
- **In Progress** — Operator has clicked **Start** from the shop floor view. A timer begins tracking actual production duration.
- **QC Check** — Production is complete; work order is pending quality inspection sign-off.
- **Completed** — QC passed. Finished goods added to Inventory. Material consumption posted.

To advance the status, use the **Confirm**, **Start**, and **Mark Complete** buttons on the work order, or operators can update status from **Manufacturing → Shop Floor View** on any device.

## Component Consumption

When a work order is confirmed, the system calculates required component quantities (BOM quantity × production quantity, adjusted for scrap %). These are shown on the **Materials** tab.

At completion, click **Record Consumption**. The actual quantities consumed are posted — you can adjust from the BOM defaults if actual consumption differed (e.g. less waste than expected, or a substitution was made). The difference between expected and actual consumption is reported as a **Material Variance** on the work order.

## Scheduling & Production Board

**Manufacturing → Schedule** shows a Gantt-style production board with all work orders across all workstations. You can:

- Drag and drop work orders to reschedule them (subject to permission).
- See workstation utilisation at a glance — over-scheduled workstations appear in red.
- Filter by product, workstation, operator, or status.

## QC Check Before Completion

Before a work order can be marked Completed, a QC inspection is required if an inspection plan is attached to the product. The QC inspector opens the work order, navigates to the **QC** tab, and records results against each criterion. If all criteria pass, the work order advances to Completed automatically. If any criterion fails, the work order moves to a **Failed QC** state and the operator must choose: Rework (reopen the work order for correction) or Scrap (write off the batch).

See the [Quality Control](quality-control) article for full details on setting up inspection plans.

## Finished Goods Inventory Update

On completion:

1. Finished goods quantity is added to the selected finished goods warehouse location.
2. Component quantities consumed are deducted from raw material stock.
3. A manufacturing journal entry is posted in Finance: Raw Material stock value transferred to Finished Goods stock value, plus labour and overhead costs.

## Reporting

- **Work Order Summary** — Output vs. target, actual duration vs. scheduled, material variance.
- **Production by Product** — Total units produced per product per period.
- **Workstation Utilisation** — Actual production hours per workstation vs. available capacity.

## Tips

- Confirm work orders at least 24 hours before the scheduled start so the system can flag any material shortages while there is still time to procure.
- Use the **Notes** field to record any mid-production decisions (substitutions, batch information, operator shift changes).
- Partial completions: if a run is partially complete at end of shift, click **Partial Completion**, enter the quantity finished, and the work order remains In Progress for the next shift.

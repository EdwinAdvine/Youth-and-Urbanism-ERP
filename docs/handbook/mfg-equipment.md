---
title: Equipment & Maintenance
slug: equipment-maintenance
category: manufacturing
article_type: guide
module: manufacturing
tags: [equipment, maintenance, assets, downtime, oee, preventive-maintenance]
sort_order: 4
is_pinned: false
excerpt: Register production equipment, schedule preventive maintenance, and track downtime.
---

# Equipment & Maintenance

Urban Vibes Dynamics tracks your production equipment as assets — from purchase through to retirement — with built-in preventive maintenance scheduling, downtime logging, and an OEE (Overall Equipment Effectiveness) dashboard to measure production reliability.

## Registering Equipment

Navigate to **Manufacturing → Equipment → New Asset**.

Fill in the asset details:

- **Asset Name** — A descriptive name (e.g. "CNC Lathe 01 — Bay 4").
- **Category** — Group equipment by type (e.g. Cutting, Mixing, Packaging, Utilities) for filtered reporting.
- **Serial Number** — Manufacturer's serial number. Used for warranty tracking and spare parts ordering.
- **Model / Manufacturer** — Useful for sourcing spare parts and maintenance manuals.
- **Purchase Date** — The date the asset was acquired.
- **Purchase Cost (KES)** — Used for depreciation and ROI calculations (depreciation is handled in Finance → Fixed Assets).
- **Warranty Expiry Date** — Urban Vibes Dynamics sends a reminder 60 days before expiry.
- **Assigned Workstation** — Link the equipment to its production workstation so work order scheduling can account for asset availability.
- **Maintenance Responsible** — The technician or team responsible for maintaining this asset.

Attach the manufacturer's manual, purchase invoice, and any service records under the **Documents** tab.

## Creating a Maintenance Schedule

Open an equipment record and click **Add Maintenance Schedule**.

For each recurring maintenance task:

- **Task Name** — e.g. "Lubricate bearings", "Replace filter cartridge", "Calibrate pressure gauge".
- **Frequency** — Daily / Weekly / Monthly / Quarterly / Annually, or **Hour-Based** (triggers after a set number of operating hours, e.g. every 500 hours).
- **Estimated Duration** — How long the task takes (used to block the workstation in the production schedule during maintenance windows).
- **Checklist Steps** — Add the specific steps the technician must complete. Each step is ticked off during maintenance execution, providing a digital maintenance log.
- **Spare Parts Required** — Link any standard spare parts needed (e.g. filter cartridge, o-ring). Urban Vibes Dynamics checks current stock levels and flags shortages before the scheduled date.

When the maintenance window approaches (default: 3 days before due), the assigned technician receives an in-app notification and email.

## Logging Maintenance Completion

When a scheduled maintenance task is due, it appears on the technician's **Maintenance Queue**. The technician opens the task, ticks off each checklist step, records:

- **Actual Duration** — Time taken.
- **Parts Used** — Confirms which parts were consumed (stock is decremented automatically).
- **Technician Notes** — Any observations, additional work done, or next-service recommendations.

Then clicks **Mark Complete**. The next occurrence is automatically scheduled.

## Recording Unplanned Downtime

When equipment stops unexpectedly, navigate to **Manufacturing → Equipment → [Asset] → Log Downtime**:

- **Start Time** — When the equipment went down.
- **End Time** — When it was restored (or leave open if still down).
- **Reason Code** — Select from configured categories: Mechanical Failure, Electrical Fault, Operator Error, Material Jam, Awaiting Parts, External Utility Failure.
- **Description** — Free text details of what happened and what was done.
- **Work Order Impacted** — Link any work orders that were delayed or stopped as a result.

Downtime records feed directly into the OEE calculation.

## OEE Dashboard

Navigate to **Manufacturing → Equipment → OEE Dashboard** to view Overall Equipment Effectiveness for any asset over any date range.

OEE is calculated as:

```
OEE = Availability × Performance × Quality

Availability  = (Planned Time − Downtime) / Planned Time
Performance   = (Actual Output × Ideal Cycle Time) / Run Time
Quality       = Good Units / Total Units Produced
```

The dashboard shows OEE as a percentage with a benchmark indicator (World-class OEE is 85%). Each component (Availability, Performance, Quality) is shown separately so you can identify where losses are concentrated.

## Spare Parts Inventory

Each piece of equipment has a **Spare Parts** tab listing the recommended spare parts, minimum stock levels, and current stock. When stock falls below the minimum, Urban Vibes Dynamics creates a procurement suggestion automatically (visible in Supply Chain → Planning → Suggested Reorders, tagged as maintenance-driven).

## Best Practices

- Log all downtime, even short stoppages — the accumulation of small losses is often larger than one major breakdown.
- Review OEE monthly in the production meeting; target continuous improvement even on high-performing assets.
- Schedule preventive maintenance during planned non-production windows to minimise impact on output.

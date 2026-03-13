---
title: Production Scheduling
slug: mfg-scheduling
category: manufacturing
article_type: guide
module: manufacturing
tags: [scheduling, production, capacity, planning, workcenter]
sort_order: 5
is_pinned: false
excerpt: Plan and schedule work orders against workcenter capacity to avoid bottlenecks.
---

# Production Scheduling

Urban ERP's production scheduling system lets you plan work orders against real workcenter capacity, visualise your factory floor as a Gantt chart, and catch bottlenecks before they affect delivery dates.

## Workcenters

A workcenter is a production resource — a machine, a workstation, or a team of people that performs a specific type of operation.

Go to **Manufacturing → Workcenters → New Workcenter** and configure:

- **Name** — e.g., "CNC Machine 1", "Assembly Line A", "Painting Bay".
- **Capacity hours/day** — how many hours per day this workcenter is available for production (e.g., 8 hours for a single-shift machine, 16 hours for a double-shift line).
- **Efficiency %** — the realistic productive output as a percentage of theoretical capacity. A machine rated at 8 hours/day at 85% efficiency will be scheduled for 6.8 productive hours. Enter this honestly to prevent over-scheduling.
- **Cost per hour** — used in the manufacturing cost breakdown report.

Multiple workcenters of the same type (e.g., three CNC machines) should be created as separate records so their capacity and utilisation are tracked individually.

## Routing

A routing defines the sequence of workcenters and time required to produce one unit of a finished product. Routings are linked to products and Bills of Materials.

Go to **Manufacturing → Routings → New Routing** and add steps:

- **Operation name** — e.g., "Cut raw material", "Weld frame", "Surface coat", "QC inspection".
- **Workcenter** — which workcenter performs this step.
- **Duration per unit** — time in hours/minutes to process one unit at this step.
- **Order** — the sequence number (1, 2, 3...).

**Example routing for a steel shelf unit:**
1. Raw Material Prep → Cutting Area (0.5 h)
2. Welding → Welding Bay (1.5 h)
3. Painting → Painting Bay (1 h)
4. QC → Inspection Station (0.25 h)

## Scheduling a Work Order

When you confirm a work order:

1. The system reads the product's routing.
2. Starting from the order's planned start date, it checks workcenter availability at each step.
3. It calculates start and finish times for each routing step, queuing behind already-scheduled work if the workcenter is busy.
4. The calculated finish time becomes the work order's expected completion date.

You can also schedule manually: open the work order → Schedule tab → set a specific start date and the system will calculate the rest.

## The Production Schedule View

Go to **Manufacturing → Schedule** to see the production Gantt chart:

- The Y-axis lists workcenters. Each workcenter row shows all work orders assigned to it as horizontal bars.
- The X-axis is the calendar (day, week, or month zoom).
- Each bar shows the work order number and product name. Colour indicates status: scheduled (blue), in progress (orange), completed (green), delayed (red).
- Hover over a bar to see the full work order details in a tooltip.
- Drag a bar to a different time slot to reschedule it. The system checks for conflicts and updates the work order's dates.

## Capacity Conflicts

When two work orders overlap on the same workcenter beyond its daily capacity:

- The overlapping bars are highlighted with a red border in the schedule view.
- A Conflicts panel on the right lists all detected conflicts with suggested resolutions (shift one order, split the batch, or add a workcenter).

Resolving conflicts: drag one of the conflicting bars to a later slot, or increase workcenter capacity (e.g., by scheduling overtime in workcenter settings for a specific date range).

## Priority Settings

Each work order has a priority from 1 (lowest) to 5 (highest). When capacity is constrained and you have multiple work orders competing for the same workcenter:

- Higher priority work orders are scheduled first.
- In the Gantt view, priority 5 bars have a gold border for easy identification.
- Run **Manufacturing → Schedule → Auto-Prioritise** to let the system reorder the queue based on priority and due dates automatically.

## Planned vs Actual Time Tracking

Operators log time as they work on each routing step (via Manufacturing → Work Orders → select order → Start / Pause / Complete buttons, or via the shop floor kiosk view).

The **Variance Report** (Manufacturing → Reports → Time Variance) shows:

- Planned hours per routing step
- Actual hours logged
- Variance (over/under, as hours and %)

This data feeds back into future scheduling accuracy and reveals which workcenters are consistently under-performing their efficiency rating.

## Downtime Blocking

If a workcenter is offline for maintenance, deep cleaning, or breakdown:

1. Go to the workcenter record → Availability tab → Add Downtime Block.
2. Set the start and end date/time.
3. The workcenter shows as unavailable (grey) in that window in the Gantt view.
4. Any work orders previously scheduled in that window are flagged as conflicted and must be rescheduled.

Planned maintenance can be scheduled weeks in advance. Unplanned breakdowns can be entered retroactively to explain actual delays.

## What-If Simulation

Before confirming a batch of new work orders, use the simulation mode to test whether your workcenters can handle the load:

1. Go to **Manufacturing → Schedule → Simulate**.
2. Add the work orders you are considering (without confirming them).
3. The system shows how they would fit into the current schedule, including any conflicts.
4. If the simulation looks good, click Confirm All to create the real work orders.

Simulation mode does not affect live work orders or inventory.

## MRP — Material Requirements Planning

Go to **Manufacturing → Planning → Run MRP** to have the system automatically generate work orders and purchase orders based on:

- Sales order demand (confirmed orders with delivery dates)
- E-Commerce forecasted demand
- Current stock on hand and in-production quantities
- Lead times from suppliers
- Routing durations

MRP produces a suggested production schedule and a list of materials to purchase. Review the suggestions and approve individually or in bulk. Approved suggestions become confirmed work orders and draft purchase orders.

---

> **Tip:** Enter realistic efficiency percentages for each workcenter (e.g., 85% not 100%) — this automatically builds buffer into your schedule, so promised delivery dates are achievable rather than optimistic.

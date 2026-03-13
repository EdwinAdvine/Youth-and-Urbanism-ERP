---
title: Sales Pipelines
slug: crm-pipelines
category: crm
article_type: guide
module: crm
tags: [pipelines, stages, deals, sales-process, kanban]
sort_order: 6
is_pinned: false
excerpt: Create and customise sales pipelines with stages that match your sales process.
---

# Sales Pipelines

A pipeline is an ordered set of stages that a deal moves through from first contact to close. Urban Vibes Dynamics's CRM lets you create multiple pipelines, configure each stage with win probabilities, and visualise deals on a Kanban board.

---

## 1. What a Pipeline Is

A pipeline maps your sales process into discrete stages. As deals progress, they move from left to right across the board. Each stage carries a win probability — used by the forecasting engine to project expected revenue.

Example: `Prospecting (10%) → Proposal (30%) → Negotiation (60%) → Won (100%) / Lost (0%)`

---

## 2. The Default Pipeline

Urban Vibes Dynamics ships with a standard B2B pipeline out of the box:

| Stage | Default Win Probability |
|---|---|
| Prospecting | 10% |
| Qualified | 25% |
| Proposal Sent | 40% |
| Negotiation | 65% |
| Won | 100% |
| Lost | 0% |

This pipeline is active immediately. You can rename stages, adjust probabilities, or archive it once you have custom pipelines configured.

---

## 3. Creating a Custom Pipeline

Go to **CRM → Pipelines → New Pipeline**.

| Field | Description |
|---|---|
| Pipeline Name | e.g., New Business, Renewals, Enterprise |
| Description | Optional — helps reps pick the right pipeline |
| Stages | Add stages in order (see section 4) |
| Default Pipeline | Mark one pipeline as the default for new deals |

---

## 4. Stage Configuration

For each stage, configure:

| Field | Description |
|---|---|
| Stage Name | e.g., Proposal Sent |
| Order | Drag to reorder |
| Win Probability | 0–100% — used in weighted forecast |
| Colour | Visual label on the Kanban board |
| Stage Type | Open / Won / Lost (Won and Lost are terminal stages) |
| Rotting Days | Optional: flag deals that have not moved in N days |

You can add as many stages as needed, but see the tip below.

> **Tip:** Keep pipelines to 5–7 stages. Too many stages slow down your team and make reporting noisy.

---

## 5. Multiple Pipelines

Different sales motions often need different pipelines:

- **New Business** — full prospecting-to-close cycle
- **Renewals** — shorter cycle starting at renewal discussion
- **Enterprise** — longer cycle with security review and legal stages
- **SMB** — fast cycle, fewer stages

Each pipeline appears as a tab in the CRM Kanban view. Reps select a pipeline when creating a deal.

---

## 6. The Kanban Board

Navigate to **CRM → Deals** to see the Kanban board.

- Each column is a stage
- Deal cards show: company name, deal value, assigned rep, and days in stage
- Deals with the "rotting" flag appear with an amber border
- Deals marked Won appear in the rightmost Won column; Lost deals are hidden by default (toggle with the filter)

---

## 7. Setting a Deal's Pipeline

When creating a new deal (**CRM → Deals → New Deal**):

1. Select the **Pipeline** first — the stage list updates to match
2. Set the initial **Stage**
3. Fill in the rest of the deal fields

A deal belongs to exactly one pipeline at a time. You can move a deal to a different pipeline by editing the Pipeline field on the deal form.

---

## 8. Moving Deals

Two ways to advance a deal:

- **Drag on Kanban** — grab a deal card and drop it into the target stage column
- **Edit the Stage field** — open the deal → change the Stage dropdown → save

Both methods log a stage change event on the deal timeline with a timestamp and the acting user.

---

## 9. Pipeline Analytics

Go to **CRM → Reports → Pipeline**.

| Metric | Description |
|---|---|
| Deals by stage | Count and total value at each stage |
| Conversion rate | % of deals that move from stage A to stage B |
| Average days in stage | How long deals typically sit in each stage |
| Win rate | % of closed deals that are Won (not Lost) |
| Average deal size | By pipeline and by rep |

Use conversion rates to identify where deals stall — that stage is where coaching or process improvement has the most impact.

---

## 10. Archiving a Pipeline

When a pipeline is no longer needed:

1. **CRM → Pipelines → [Pipeline Name] → Archive**
2. The pipeline is removed from the new-deal dropdown
3. All historical deals retain their pipeline and stage data — reports are unaffected
4. Archived pipelines can be restored at any time

Do not delete pipelines — archiving preserves your historical data.

---

## Quick Reference

| Action | Path |
|---|---|
| Create a pipeline | CRM → Pipelines → New Pipeline |
| Edit stages | CRM → Pipelines → [Name] → Edit Stages |
| Kanban board | CRM → Deals |
| Pipeline analytics | CRM → Reports → Pipeline |
| Archive a pipeline | CRM → Pipelines → [Name] → Archive |

---
title: Deals & Pipeline Management
slug: deals-pipeline-management
category: crm
article_type: guide
module: crm
tags: [deals, pipeline, kanban, sales, stages, velocity]
sort_order: 3
is_pinned: false
excerpt: Manage your sales pipeline with Kanban drag-and-drop stage management.
---

# Deals & Pipeline Management

The pipeline is where active sales opportunities live. Each deal moves through a series of stages from first contact to won or lost. Urban Vibes Dynamics's Kanban view makes it easy to see exactly where every deal is and move them forward with a drag.

## Opening the Pipeline

Navigate to **CRM → Pipeline**. You will see the Kanban board with all active deals arranged in columns by stage.

## Default Pipeline Stages

| Stage | What it Means |
|---|---|
| **New Lead** | Converted from a lead — interest confirmed but nothing more |
| **Qualified** | Budget, authority, need, and timeline established |
| **Demo / Proposal Sent** | You have demonstrated the product or sent a formal proposal |
| **Negotiation** | Terms are being discussed, deal is close to closing |
| **Won** | Deal is closed and signed |
| **Lost** | Deal fell through |

Your CRM Admin can add, rename, or reorder stages to match your specific sales process under **Settings → CRM → Pipeline Stages**.

## Moving Deals Between Stages

Drag a deal card from one column and drop it into the target stage column. The stage change is logged automatically with a timestamp and the user who made the change. You can see the full stage history on the deal record under **Activity**.

Alternatively, open the deal and click the stage name in the header — a dropdown lets you move it without going back to the board.

## Deal Card Details

Each card on the Kanban board shows:

- Deal name
- Contact / company name
- Deal value (KES)
- Assigned sales rep (avatar)
- Days in current stage
- Expected close date (with a red indicator if overdue)

Cards where the expected close date has passed without movement are highlighted — these need immediate attention.

## Deal Detail Page

Click any deal card to open the full detail view.

| Section | Contents |
|---|---|
| **Overview** | Value, stage, close date, rep, source, win probability |
| **Contact** | Linked contact and company |
| **Activity** | Timeline of all calls, emails, meetings, notes, stage changes |
| **Tasks** | To-dos specific to this deal (e.g. "Send revised proposal by Thursday") |
| **Documents** | Attached proposals, contracts, NDAs (linked to Drive) |
| **Linked Invoice** | Finance invoice if deal has been invoiced |
| **Linked Project** | If delivery involves a project, it is linked here |

## Win Probability

Each stage has a default win probability percentage — for example, **Qualified = 30%**, **Negotiation = 75%**, **Won = 100%**. These probabilities are used to calculate the **Weighted Pipeline Value**: the sum of (deal value × win probability) across all open deals. This is your most realistic revenue forecast.

Your CRM Admin can adjust default probabilities per stage under **Settings → CRM → Pipeline Stages**. You can also override the probability on individual deals if you have more specific information.

## Pipeline Velocity Report

Go to **CRM → Reports → Pipeline Velocity**. This report shows:

- **Average deal size** by stage
- **Average days in each stage** — identifying where deals get stuck
- **Win rate** — percentage of deals that progress from Qualified to Won
- **Average sales cycle length** — total days from New Lead to Won

**Example insight:** If the average time in the "Demo Sent" stage is 28 days for won deals, but 60 days for lost deals, you know that chasing a stale demo is a low-priority activity — redirect that energy to fresh prospects.

## Filtering the Pipeline

Use the filter bar above the Kanban board to focus on:

- **My Deals** — only deals assigned to you
- **By rep** — see one team member's pipeline during a 1-on-1
- **By expected close** — deals closing this month vs next quarter
- **By deal value** — focus on high-value opportunities

## Tips for a Healthy Pipeline

- **Update deal values when you get more information.** A deal that starts at KES 100,000 may grow to KES 500,000 as scope is confirmed. Keep the value current.
- **Set realistic close dates.** If a deal slips, update the close date rather than leaving it in the past — stale dates make your pipeline report misleading.
- **Log every meaningful interaction.** The deal timeline should tell the full story of the relationship — a new rep picking up a deal should be able to read the history and know exactly where things stand.
- **Clear out lost deals promptly.** Keeping dead deals in the active pipeline inflates your numbers and hides the real health of your pipeline.

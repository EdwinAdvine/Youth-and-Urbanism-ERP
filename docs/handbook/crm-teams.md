---
title: Sales Teams & Territory Management
slug: crm-teams
category: crm
article_type: guide
module: crm
tags: [teams, territory, assignment, round-robin, managers]
sort_order: 11
is_pinned: false
excerpt: Organise your sales reps into teams and configure lead assignment rules.
---

# Sales Teams & Territory Management

Sales teams let you group reps under a manager, apply assignment rules, and report on performance by team.

## Creating a Sales Team

Go to **CRM → Settings → Teams → New Team**. Enter:

- **Team name** — e.g. "East Africa Enterprise"
- **Manager** — the user who sees all team activity and receives escalation alerts
- **Members** — add reps; a rep can belong to multiple teams

## Lead Assignment Methods

| Method | How It Works |
|--------|-------------|
| **Manual** | Rep assigns leads themselves |
| **Round-robin** | Rotates evenly across all team members |
| **AI-based** | Assigns to the rep with the most capacity + best match score for the lead |

Configure the method per team under **Team → Assignment Settings**.

## Territory Rules

Territory rules assign inbound leads to the right team automatically:

- **By country/region** — e.g. all leads from Uganda → "East Africa" team
- **By industry** — e.g. all Finance sector leads → "FinTech" team
- **By lead source** — e.g. all website leads → "Inbound" team

Rules are evaluated in priority order. The first matching rule wins.

## Manager Visibility

Team managers see all their team's leads, deals, and activities without needing Super Admin access. This is controlled by the team assignment — no extra permissions required.

## Team Quotas

Set monthly revenue targets per team:

1. Go to **CRM → Teams → [Team Name] → Quotas**
2. Set a monthly KES target
3. The team performance dashboard shows actual vs quota as a progress bar

## Team Performance Dashboard

**CRM → Reports → Teams** shows a leaderboard: each team's closed revenue, pipeline value, and % of quota — updated in real time.

## Reassigning Leads When a Rep Leaves

1. Go to **CRM → Leads → Filter by Assignee** → select the departing rep
2. Bulk-select all open leads
3. Click **Reassign** → choose a new rep or switch to round-robin

> **Tip:** Assign a manager to every team even if it's the team lead. Managers get automatic visibility into team activity without needing Super Admin access.

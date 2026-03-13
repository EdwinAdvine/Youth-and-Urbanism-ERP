---
title: "Time Tracking & Logging"
slug: time-tracking-logging
category: projects
article_type: guide
module: projects
tags: [time-tracking, billing, timesheets, budget]
sort_order: 2
is_pinned: false
excerpt: "Log time spent on tasks and generate project time reports for billing."
---

# Time Tracking & Logging

Urban Vibes Dynamics's time tracking is built directly into project tasks — no separate timesheet app, no manual exports. Every hour logged ties to a specific task, project, and team member, giving you clean data for client billing and budget monitoring.

## Logging Time on a Task

1. Open any task on the project board (click the task card).
2. In the task detail panel, click the **Log Time** button (clock icon).
3. A small form appears:
   - **Date** — defaults to today. Change it if you are logging time retroactively (common when catching up at the end of the week).
   - **Hours** — enter the time spent in decimal format. Examples: `1.5` = 1 hour 30 minutes; `0.25` = 15 minutes; `3` = 3 hours.
   - **Description** — a short note on what you worked on during this session (e.g., "Drafted section 3 of the technical report"). This is valuable for clients who request detailed timesheets.
   - **Billable** — toggle on or off. By default, new log entries inherit the project's billing setting. A non-billable entry is still tracked for internal cost purposes but is excluded from client-facing reports.
4. Click **Save**. The logged time appears in the task's **Time Log** tab.

You can log multiple entries per task — one per work session — rather than summing them all into one entry. This gives a more accurate picture of when work happened.

## Viewing Time on a Task

Open any task and click the **Time Log** tab. You will see a table listing:

- Date
- Team member who logged the time
- Hours logged
- Description
- Billable (yes/no)
- Running total at the bottom

Anyone on the project can view the task's time log. Only the person who created an entry (or a Project Manager) can edit or delete it.

## Project-Level Time Summary

For a full breakdown across all tasks in a project:

1. Open the project and click the **Time** tab.
2. The summary shows:
   - **Total Hours Logged** — across all tasks and all team members.
   - **Breakdown by Task** — hours per task, sorted by most time-consuming.
   - **Breakdown by Team Member** — total hours per person. Filter by date range to see contributions within a specific week or month.
   - **Billable vs Non-Billable Split** — shown as both hours and percentage.

This view is useful for project post-mortems — comparing planned vs actual hours to improve future estimates.

## Time & Budget Burn

If a project has a budget set (in KES) and team members have a billable rate defined (KES per hour), Urban Vibes Dynamics calculates:

`Budget Consumed = Sum of (Billable Hours per member × Their KES/hr Rate)`

The **Budget Burn** widget on the project Overview tab shows:

- KES budget allocated
- KES consumed (time + linked Finance expenses)
- KES remaining
- A colour-coded burn bar: green (under 70%), amber (70–90%), red (over 90%)

When the burn reaches 90%, the Project Manager receives an automatic alert so they can take action — such as having a scope conversation with the client — before the budget is exhausted.

## Exporting Time Reports

To export time data for client invoicing or internal review:

1. Go to the project's **Time** tab.
2. Apply filters: date range, team member (optional), billable only (toggle).
3. Click **Export CSV**.

The CSV includes: task name, date, team member, hours, description, billable flag, and computed cost (hours × rate). You can attach this directly to a client invoice as a time-and-materials backup.

For a cross-project time report (all projects within a date range, by team member):

- Go to **Projects → Reports → Time Report**.
- Filter by team member, date range, and/or client.
- Export as CSV or PDF.

This cross-project report is useful for monthly billing runs when you invoice multiple clients and need a consolidated timesheet summary.

## Billable vs Non-Billable Time

Not all time is chargeable to the client. Urban Vibes Dynamics allows you to track both categories within the same project:

- **Billable** — hours the client is charged for: development, design, strategy, meetings with the client.
- **Non-Billable** — internal time: project management overhead, internal review cycles, fixing internal errors.

Tracking both gives you a true picture of project profitability. A project that looks profitable on billable hours alone might be loss-making once non-billable hours are included.

> **Tip:** Encourage team members to log time daily rather than in one bulk session at week's end. Daily logging is more accurate, descriptions are more specific, and it catches forgotten sessions before they are lost entirely.

---
title: Project Reports & Analytics
slug: proj-reporting
category: projects
article_type: guide
module: projects
tags: [reports, analytics, time, budget, burndown, velocity]
sort_order: 6
is_pinned: false
excerpt: Track project health, team productivity, and budget burn with built-in project reports.
---

# Project Reports & Analytics

Urban Vibes Dynamics provides a full suite of project reports so project managers and stakeholders can track progress, identify risks, and make data-driven decisions — without exporting to a spreadsheet.

## Project Overview Dashboard

Open any project and click the Reports tab to reach the Project Overview dashboard. It shows:

- **Task completion %** — tasks marked Done divided by total tasks, displayed as a progress ring.
- **Overdue tasks count** — number of tasks past their due date and not yet complete, with a list of the most critical.
- **Budget burn rate** — percentage of the project budget consumed to date (hours logged × hourly rates + approved expenses vs total budget).
- **Team members' open tasks** — a table listing each team member, how many tasks they have open, and how many are overdue.

The dashboard refreshes every time you load the page and can be pinned as the default project view in Project Settings.

## Burndown Chart

Available for projects running in sprint mode (Projects → Settings → enable Sprints). The burndown chart plots:

- **Planned line** — the ideal remaining work if the team completes tasks at a steady pace across the sprint.
- **Actual line** — remaining work as tasks are completed each day.

A line running above the planned line means the sprint is behind schedule. The chart covers the active sprint by default; use the sprint selector dropdown to view historical sprints.

## Velocity Report

The Velocity report appears in the Sprints tab and is available when story points are enabled. It shows story points completed per sprint over time as a bar chart, alongside a rolling average line. Use the rolling average to predict how many points the team can realistically commit to in an upcoming sprint.

## Time Report

The Time report breaks down all logged time for the project:

- **By task** — total hours logged on each task.
- **By person** — total hours logged per team member.
- **By project** — aggregate (visible in Portfolio view).
- **Billable vs non-billable** — if tasks are marked billable, time splits into two totals. This is the figure used when generating a client invoice from the project.

Date filters let you narrow the report to a specific week, month, or billing period.

## Budget Report

The Budget report compares estimated costs against actual costs:

- **Estimated cost** — set in the project when it was created (fixed fee or calculated from estimated hours × assigned team members' hourly rates).
- **Actual cost** — hours logged × hourly rates + expense line items approved against the project.
- **Variance** — the difference, shown as a percentage over or under budget.

A status indicator (green/amber/red) shows at a glance whether the project is on budget.

## Task Status Breakdown

A pie chart showing the proportion of tasks in each status: To Do, In Progress, Review, Done. Hover over a segment to see the count. This chart is also embedded in the Project Overview dashboard.

## Overdue Report (Manager View)

Navigate to Projects → Reports → Overdue to see all overdue tasks across every project you manage or have visibility into. The report shows:

- Project name
- Task name
- Original due date
- Days overdue
- Assigned person

This report can be sorted by days overdue or by project. It updates in real time as tasks are completed or rescheduled.

## Cross-Project View — Portfolio

Go to Projects → Reports → Portfolio to compare all active projects side by side. Each row represents a project and shows:

- Progress % (tasks complete)
- Budget burn % (budget consumed)
- Overdue task count
- Next milestone and its due date
- Project health indicator (green/amber/red, calculated from progress vs elapsed time)

The Portfolio view is accessible to Super Admins, App Admins, and any user with the "View All Projects" permission.

## Exporting Reports

Every report has an Export button in the top-right corner:

- **CSV** — all tabular reports (time, overdue, portfolio) export to CSV for use in external tools.
- **Timesheet CSV** — the Time report has a dedicated Timesheet export that formats hours by person and date, ready to send to a client for billing approval.

Exports include whatever filters are currently active — if you filter the Time report to a specific billing period before exporting, only those rows appear in the export.

## Milestone Tracking

Milestones are special zero-duration markers in the project timeline:

- On the **Timeline view**, milestones appear as diamond shapes at their target date.
- In the **Milestones tab** (next to the Tasks tab inside a project), all milestones are listed with their due date and status (Upcoming, At Risk, Completed).
- A milestone is automatically marked At Risk when one or more tasks that feed into it are overdue.

Milestones can be linked to tasks: mark a task as a milestone dependency, and the milestone status reflects whether its dependent tasks are on track.

---

> **Tip:** Send clients the Portfolio report view (screenshot or CSV) at weekly check-ins instead of building a separate status deck.

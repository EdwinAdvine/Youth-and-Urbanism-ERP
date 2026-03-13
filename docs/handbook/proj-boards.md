---
title: Project Boards & Views
slug: proj-boards
category: projects
article_type: guide
module: projects
tags: [boards, kanban, list, gantt, views, tasks]
sort_order: 5
is_pinned: false
excerpt: Switch between Kanban, list, and timeline views to manage tasks the way your team works.
---

# Project Boards & Views

Urban Vibes Dynamics gives every project four distinct views so your team can work in whatever format makes sense for the moment — whether that is dragging cards on a board, scanning a flat list, spotting deadline clashes on a calendar, or visualising dependencies on a timeline.

## The Four Project Views

**Kanban** — the default board view. Tasks are displayed as cards organised into columns that represent workflow statuses (To Do, In Progress, Review, Done). Drag a card from one column to another to update its status instantly. If a WIP (work-in-progress) limit has been configured for a column, a warning badge appears when the limit is exceeded.

**List** — a flat, sortable table of all tasks in the project. Each row shows the task name, assignee, due date, priority, status, and any tags. Click any column header to sort. Use the checkboxes on the left to bulk-select rows and apply a batch update (change status, reassign, or set due date for multiple tasks at once).

**Calendar** — tasks that have a due date appear as blocks on a monthly (or weekly) calendar grid. Click any task block to open the task detail panel without leaving the calendar. Tasks without a due date are listed in a sidebar on the right.

**Timeline / Gantt** — horizontal bars represent task duration from start date to due date. When tasks have dependencies configured, arrows connect them to show which tasks are blocked by others. Drag the edges of a bar to adjust dates; drag the bar itself to shift the entire range.

## Switching Views

Tabs for all four views sit at the top of every project page. Click the tab to switch — your current filters are preserved when you switch between views so you do not lose your context.

## Kanban View in Detail

- Columns map directly to task statuses. You can rename statuses in Project Settings → Statuses.
- Drag a card to a new column to change its status. The change saves immediately.
- WIP limits: if the column has a configured limit and you drag a card in that would exceed it, a yellow warning banner appears. The move is allowed but flagged.
- Cards show a compact summary: title, assignee avatar, due date chip (red if overdue), and priority indicator.
- Click any card to open the full task detail panel in a right-side drawer.

## List View in Detail

- Sort by any column — due date, assignee, priority, or status — by clicking the column header. Click again to reverse the sort direction.
- Bulk-select rows using the checkbox in the header row, or select individual rows. A floating action bar appears with options: Change Status, Reassign, Set Due Date, Add Tag, Delete.
- Inline editing: click a cell (e.g., due date or assignee) to edit it without opening the full task panel.

## Calendar View in Detail

- Tasks with due dates appear as coloured blocks on the date they are due.
- Tasks are colour-coded by status: grey = To Do, blue = In Progress, orange = Review, green = Done.
- Click any task block to open the task detail panel.
- Tasks without due dates are listed in the "Undated" panel on the right side of the calendar.

## Timeline / Gantt View in Detail

- Each task appears as a horizontal bar spanning its start date to its due date.
- Dependencies are drawn as arrows between tasks. A dependency means Task B cannot start until Task A is complete.
- To set a dependency, hover over the right edge of the predecessor task's bar and drag the arrow to the dependent task.
- Drag the left or right edge of a bar to adjust start or due dates. Drag the middle of the bar to shift both dates together.
- Critical path tasks (those where any delay will push the project end date) are highlighted in red.

## Filters

Every view supports the same filter toolbar at the top:

- Assignee — show only tasks assigned to specific team members.
- Priority — filter by Urgent, High, Medium, or Low.
- Tag — filter by one or more tags applied to tasks.
- Due Date Range — show tasks due within a date window (e.g., next 7 days, this month).
- Status — filter by one or more statuses (useful in List view where all statuses show together).

Filters stack — you can filter by assignee AND priority at the same time.

## Grouping (List View)

In List view, use the Group By control to cluster tasks:

- Group by Assignee — all tasks for each person appear under a collapsible section.
- Group by Status — tasks sorted into status sections within a single list (alternative to Kanban).
- Group by Label — tasks grouped by their primary label or tag.

## Saved Views

Once you have configured a filter or grouping combination you use regularly, click Save View and give it a name (e.g., "My Overdue Tasks", "Unassigned This Week"). Saved views appear in a dropdown at the top of the project, next to the view tabs. They are personal — saved views are not shared with other team members unless you choose to publish them.

## Full-Screen Mode

Click the full-screen icon (top-right of the board) to expand the project view to fill the entire browser window. The navigation sidebar hides automatically. Press Escape or click the icon again to exit. This is useful during team standups or when presenting project status on a shared screen.

---

> **Tip:** Use Timeline view at the start of a project to set realistic deadlines — seeing dependencies visually makes bottlenecks obvious before the project starts.

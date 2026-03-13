---
title: "Sprints & Agile Project Management"
slug: sprints-agile-project-management
category: projects
article_type: guide
module: projects
tags: [sprints, agile, scrum, backlog, velocity]
sort_order: 3
is_pinned: false
excerpt: "Run agile sprints with sprint planning, backlog management, and velocity tracking."
---

# Sprints & Agile Project Management

Urban Vibes Dynamics supports an agile workflow alongside the standard Kanban board. The Sprints feature is ideal for software development teams, marketing campaign cycles, or any team that works in structured, time-boxed iterations.

## Enabling Sprints on a Project

Sprints are enabled per project. Open the project, go to **Settings** (gear icon), and toggle **Enable Agile / Sprints**. Once enabled, the project gains a **Backlog** view and a **Sprints** tab in addition to the Kanban board.

## The Backlog

The backlog is the master list of all tasks that have not been assigned to a sprint. Think of it as your ranked wish-list of everything the team might work on.

To groom the backlog:

1. Go to **Projects → [Project] → Backlog**.
2. All unscheduled tasks appear here. Drag tasks to reorder them — highest priority at the top.
3. Add story points or effort estimates to tasks by clicking the task and filling in the **Estimate (points)** field. Points are relative effort units (Fibonacci sequence: 1, 2, 3, 5, 8, 13 are common).
4. Split large tasks (epics) into smaller sub-tasks that can realistically be completed within a sprint.

## Creating a Sprint

1. Go to **Projects → [Project] → Sprints**.
2. Click **New Sprint**.
3. Fill in:
   - **Sprint Name** — e.g., "Sprint 12" or "May Marketing Sprint".
   - **Start Date** and **End Date** — typical sprints are 1–4 weeks long. Two-week sprints are the most common.
   - **Sprint Goal** — a one-sentence statement of what the team aims to achieve by the end of this sprint (e.g., "Complete user authentication and dashboard skeleton"). The sprint goal keeps the team focused when new requests come in mid-sprint.
4. Click **Create Sprint**.

## Sprint Planning: Adding Tasks to the Sprint

During your sprint planning session:

1. Open the new sprint. It starts empty.
2. Click **Add from Backlog**. A panel slides in showing your ranked backlog.
3. Drag tasks into the sprint or click the **+** button next to each task.
4. As you add tasks, the sprint's **Planned Points** total increases. Compare this to your team's historical velocity (see below) to avoid over-committing.
5. Once planning is done, click **Start Sprint** to make it active. Tasks in the sprint move to the Sprint Board.

## The Sprint Board

The Sprint Board is a focused Kanban view showing only the tasks in the current sprint. Columns: **To Do**, **In Progress**, **Review**, **Done**.

The sprint header shows:

- Sprint name and goal
- Days remaining
- Tasks remaining / total
- Burndown indicator (tasks completed vs expected pace)

Team members work tasks exactly as they would on the main board: drag cards, log time, add comments, attach files.

## Daily Standup Support

Urban Vibes Dynamics's sprint board has a **Standup Mode** (toggle it on from the sprint header). In Standup Mode, the board shows a compact checklist per team member:

- What did you complete yesterday?
- What will you work on today?
- Any blockers?

Each team member can add a quick standup note directly on the board before the daily meeting. These notes are saved and visible to the whole team, making async standups possible for distributed teams.

## Completing a Sprint

When the sprint end date arrives (or when all tasks are done):

1. Click **Complete Sprint** on the sprint header.
2. A dialogue appears showing any tasks that were not completed.
3. Choose what to do with incomplete tasks: **Move to Backlog** (most common) or **Move to Next Sprint**.
4. Confirm completion.

The sprint is closed and a **Sprint Completion Report** is generated automatically.

## Sprint Completion Report & Velocity

The report includes:

- **Planned Points** — total story points at sprint start.
- **Completed Points** — story points of tasks moved to Done.
- **Velocity** — completed points ÷ sprint duration (points per week). Track this over multiple sprints to see if the team is improving.
- **Completion Rate** — percentage of planned tasks fully completed.
- **Tasks Carried Over** — list of tasks moved back to the backlog.

Velocity data is visible on the **Projects → Reports → Sprint Velocity** chart, which shows velocity across all sprints in a project as a bar chart. A rising velocity trend indicates the team is improving. A consistently low completion rate often signals over-planning during sprint planning — use past velocity as a cap on how many points to take on.

## Backlog Grooming Tips

- Run a backlog grooming session once per sprint cycle (at the midpoint of the current sprint).
- Archive tasks that are no longer relevant rather than leaving them in the backlog indefinitely.
- Break any task estimated at 13 points or more into smaller tasks before adding it to a sprint.
- Keep the backlog ordered by priority — when planning the next sprint, you should be able to pull from the top without debate.

> **Tip:** A sprint goal is not optional — it is what lets the team push back on mid-sprint scope additions. If a request does not contribute to the sprint goal, it goes in the backlog for next sprint, not the current one.

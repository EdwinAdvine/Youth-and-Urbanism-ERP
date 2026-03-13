---
title: CRM Reports & Analytics
slug: crm-reporting
category: crm
article_type: guide
module: crm
tags: [reports, analytics, metrics, dashboard, kpis]
sort_order: 10
is_pinned: false
excerpt: Track team performance, pipeline health, and campaign effectiveness with CRM reports.
---

# CRM Reports & Analytics

Urban ERP's CRM reporting suite gives you real-time visibility into pipeline health, rep performance, lead source quality, and campaign effectiveness — without needing a separate BI tool.

---

## 1. CRM Dashboard

The dashboard is the first screen when you open CRM. It shows a real-time overview of key metrics:

| Metric | Description |
|---|---|
| Open Deals | Total count and value of deals not yet Won or Lost |
| Deals Closed This Month | Count and revenue of Won deals in the current calendar month |
| Total Revenue (MTD) | Won deal value month-to-date |
| Lead Conversion Rate | % of leads converted to deals in the selected period |
| Pipeline Value | Sum of all open deal values |
| Activities Due Today | Count of scheduled activities due today |

Click any metric card to drill into the underlying records.

Customise the dashboard date range using the period selector (top right). Managers see team-wide metrics; reps see their own by default.

---

## 2. Pipeline Report

**CRM → Reports → Pipeline**

Analyses the health and velocity of your pipeline:

| Metric | Description |
|---|---|
| Total value by stage | Sum of open deal values at each stage |
| Deal count by stage | Number of deals per stage |
| Average days in stage | How long deals typically remain in each stage |
| Win rate | Won deals ÷ (Won + Lost) deals |
| Loss rate | Lost deals ÷ (Won + Lost) deals |
| Average deal size | Won deal value ÷ Won deal count |

Use the "Average days in stage" column to find where your pipeline is bottlenecking.

---

## 3. Lead Source Report

**CRM → Reports → Lead Sources**

Tracks where your leads come from and which sources produce the best outcomes:

| Column | Description |
|---|---|
| Source | Website, Referral, LinkedIn, Cold Outreach, Event, etc. |
| Leads Generated | Total leads from this source in the period |
| Conversion to Deal | % that became deals |
| Win Rate | % of sourced deals that were Won |
| Average Deal Size | Won deal value from this source |
| Revenue Contribution | Total Won revenue attributed to this source |

Sort by Revenue Contribution to see which channels deliver real business, not just volume.

---

## 4. Rep Performance Report

**CRM → Reports → Rep Performance** (requires CRM Manager role or above)

Compares performance across your sales team:

| Column | Description |
|---|---|
| Rep Name | Individual salesperson |
| Leads Assigned | Total leads assigned in the period |
| Deals Created | Deals opened |
| Deals Won | Deals closed as Won |
| Revenue Generated | Won deal total value |
| Win Rate | Won ÷ Closed |
| Activities Logged | Total calls, emails, meetings logged |
| Quota Attainment | % of monthly/quarterly revenue target achieved |

Filter by date range, pipeline, or team. Export to CSV for payroll-linked commission calculations.

---

## 5. Activity Report

**CRM → Reports → Activities**

Measures the input side of your sales process — the actions that drive outcomes:

| Metric | Description |
|---|---|
| Calls per rep | Volume of logged calls by rep |
| Emails sent | Outbound emails logged or synced |
| Meetings held | Completed meeting activities |
| Demos completed | Demo activity type count |
| Activity per deal | Average activities per Won deal (a useful baseline) |
| Follow-up compliance | % of deals with activity in the last 14/30 days |

Filter by activity type, rep, date range, or lead/deal stage.

---

## 6. Campaign Performance Report

**CRM → Reports → Campaigns**

Tracks the effectiveness of email campaigns sent through CRM:

| Metric | Description |
|---|---|
| Open Rate | % of recipients who opened the email |
| Click Rate | % of recipients who clicked a link |
| Reply Rate | % of recipients who replied |
| Unsubscribe Rate | % who opted out |
| Leads Created | Leads generated from campaign replies or form completions |
| Deals Influenced | Open or Won deals where the contact received the campaign |
| Revenue Influenced | Value of those deals |

Compare campaigns to identify which messaging, subject lines, and offers resonate best.

---

## 7. AI Score Distribution Report

**CRM → Reports → AI Scores**

Shows how lead and deal quality is distributed across your pipeline:

| Component | Description |
|---|---|
| Score histogram | Bar chart of lead counts by score band (0–10, 11–20, ..., 91–100) |
| High-score response time | % of leads scoring > 70 that were assigned within 24 hours |
| Score vs outcome | Correlation between AI score and Win rate |
| Unscored leads | Leads that have not yet been scored (need more data) |

Use the high-score response time metric to ensure your fastest follow-up goes to your hottest leads.

---

## 8. Lost Deal Analysis

**CRM → Reports → Lost Deals**

Examines why deals are lost and where in the pipeline they exit:

| Metric | Description |
|---|---|
| Loss reasons | Breakdown by reason (Price, Competitor, Timing, No Budget, etc.) |
| Loss by stage | Which stage deals most commonly exit at |
| Loss by rep | Which reps have the highest loss rate (coaching indicator) |
| Loss by deal size | Whether large or small deals are lost more frequently |
| Loss by industry | Whether certain verticals are harder to close |

Loss reasons are set when marking a deal as Lost. Ensure your team fills in the reason field consistently — garbage-in means the report is not useful.

> **Tip:** Review the Lost Deal Analysis monthly with your team — the patterns often reveal product gaps or pricing issues, not just sales execution.

---

## 9. Custom Date Range

All CRM reports support a custom date range picker in the top bar. Pre-set options:

- This Week / Last Week
- This Month / Last Month
- This Quarter / Last Quarter
- This Year / Last Year
- Custom Range (any start and end date)

Reports default to the current month on load.

---

## 10. Exporting Reports

Every report table has an **Export** button (top right of the table). Exports are delivered as CSV files, compatible with Excel and Google Sheets.

For scheduled exports, contact your Super Admin to set up a recurring report email via **Settings → Automation → Scheduled Reports**.

---

## Quick Reference

| Report | Path |
|---|---|
| Dashboard | CRM → Dashboard |
| Pipeline report | CRM → Reports → Pipeline |
| Lead source report | CRM → Reports → Lead Sources |
| Rep performance | CRM → Reports → Rep Performance |
| Activity report | CRM → Reports → Activities |
| Campaign performance | CRM → Reports → Campaigns |
| AI score distribution | CRM → Reports → AI Scores |
| Lost deal analysis | CRM → Reports → Lost Deals |

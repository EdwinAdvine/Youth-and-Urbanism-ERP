---
title: "Leave Requests & Approvals"
slug: leave-requests-approvals
category: hr-payroll
article_type: guide
module: hr
tags: [leave, approvals, annual-leave, sick-leave]
sort_order: 2
is_pinned: false
excerpt: "How employees request leave and managers approve or reject requests."
---

# Leave Requests & Approvals

Urban Vibes Dynamics's leave management system covers the full cycle: employee request → manager approval → automatic balance update → payroll synchronisation. This article covers both the employee and manager perspectives, plus HR Admin configuration.

## Leave Types Supported

Out of the box, Urban Vibes Dynamics ships with the following leave types aligned to Kenyan labour law and common organisational practice:

| Leave Type | Default Days | Notes |
|---|---|---|
| Annual Leave | 21 working days/year | Accrued monthly |
| Sick Leave | 14 days/year | Requires medical certificate after 3 consecutive days |
| Maternity Leave | 90 days | Per Employment Act Cap 226 |
| Paternity Leave | 3 days | Discretionary (not statutory in Kenya) |
| Unpaid Leave | Unlimited | Does not affect leave balance; deducted from pay |
| Compassionate Leave | 3 days | Bereavement of immediate family |

HR Admins can add custom leave types under **HR → Settings → Leave Types**.

## Employee: Submitting a Leave Request

1. Navigate to **HR → Leave** in the sidebar.
2. Click **New Leave Request**.
3. Select the **Leave Type** from the dropdown.
4. Set the **Start Date** and **End Date**. The system automatically excludes weekends and public holidays (Kenya public holiday calendar is pre-loaded) and shows the number of working days being requested.
5. Add a **Reason / Comment** (optional for annual leave; required for sick or unpaid leave per your company policy).
6. Attach supporting documentation if required (e.g., a medical certificate for sick leave longer than 3 days).
7. Click **Submit for Approval**.

The employee's leave balance panel on the right shows current balances before and after the requested deduction, so there are no surprises. If the requested days exceed the available balance, the system will warn the employee but will still allow submission — the manager can decide whether to grant leave in advance (to be offset against future accruals) or reject.

After submission, the employee sees the request listed under **HR → Leave → My Requests** with a status of **Pending**.

## Manager: Approving or Rejecting

When a team member submits a leave request, the assigned manager receives:

- An in-app notification (bell icon, top navigation bar).
- An email notification to their work inbox.

To review:

1. Open the notification, or go to **HR → Leave → Approval Queue**.
2. The request shows the employee name, leave type, dates, days count, and remaining balance.
3. Review any attached documents.
4. Click **Approve** or **Reject**.
5. Add a **Comment** — particularly important when rejecting, so the employee understands the reason. Rejected requests with no comment are flagged as poor management practice in the system audit log.

Once actioned:

- The employee receives an email notification of the decision.
- If approved, the leave balance is immediately deducted.
- The approved leave appears on the shared team calendar (if Calendar integration is enabled).
- If the leave falls within an already-processed payroll period, HR Admin is alerted to manually adjust the payrun.

## HR Admin: Configuring Leave Rules

Navigate to **HR → Settings → Leave Configuration**:

- **Accrual Rules**: Define how leave accrues. Example: 21 days per year = 1.75 days accrued per month. Select whether accrual is at the start of the month or end.
- **Carryover Limits**: Set how many unused days roll into the next leave year (e.g., max 10 days carryover). Days beyond the limit are forfeited at year-end.
- **Proration**: For employees who join mid-year, Urban Vibes Dynamics can automatically prorate the annual leave entitlement based on the start date.
- **Negative Balance**: Toggle whether employees can request leave beyond their balance (advance leave).
- **Approval Chains**: You can configure two-level approval (Line Manager → HR Admin) for leave requests longer than a specified number of days (e.g., any leave over 10 days requires HR Admin final approval).

## Leave Balance Reports

HR Admins can generate a full leave balance report under **HR → Reports → Leave Balances**. This shows each employee's entitlement, days taken, and days remaining — exportable to CSV or PDF. This report is essential before processing payroll and before the end of the leave year to identify carryover eligibility.

> **Tip:** Encourage employees to plan annual leave in advance. Urban Vibes Dynamics's team calendar view (HR → Leave → Team Calendar) lets managers see who is on leave in any given week, making it easier to approve without leaving teams understaffed.

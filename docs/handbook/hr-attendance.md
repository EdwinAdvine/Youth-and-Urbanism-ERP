---
title: "Attendance Tracking"
slug: attendance-tracking
category: hr-payroll
article_type: guide
module: hr
tags: [attendance, clock-in, timesheets, overtime]
sort_order: 3
is_pinned: false
excerpt: "Track employee clock-in/out, absences, and late arrivals across your organisation."
---

# Attendance Tracking

Urban Vibes Dynamics's attendance module gives HR a real-time view of who is present, absent, or late — and feeds that data directly into payroll so you are not manually reconciling spreadsheets at the end of the month.

## Accessing Attendance

Navigate to **HR → Attendance**. The default view is today's attendance log showing a row for every active employee with their status: **Present**, **Absent**, **Late**, or **On Leave**.

## Recording Attendance

### Manual Entry

For organisations without biometric hardware, attendance can be entered manually by an HR officer or supervisor:

1. Go to **HR → Attendance → Daily Log**.
2. Select the date from the date picker.
3. For each employee, enter the **Clock In** time and **Clock Out** time in 24-hour format (e.g., 08:05 and 17:30).
4. The system calculates the total hours worked automatically.
5. Click **Save Log** to confirm. Entries can be edited up to 48 hours after the date; after that, only HR Admins can make corrections.

### Biometric / Time Clock Integration

If your organisation uses a biometric attendance device (fingerprint or card-swipe), Urban Vibes Dynamics can sync records automatically. Contact your system administrator to configure the device endpoint under **Settings → Integrations → Biometric Device**. Once connected, clock-in and clock-out events are pushed to Urban Vibes Dynamics in real time and appear in the daily log without manual input.

## Attendance Statuses

| Status | Meaning |
|---|---|
| Present | Clocked in on time (within grace period) |
| Late | Clocked in after the grace period threshold |
| Absent | No clock-in recorded and not on approved leave |
| On Leave | Matches an approved leave request for that date |
| Half Day | Clocked in for fewer hours than half the shift |

HR Admins configure the grace period and shift hours under **HR → Settings → Attendance Policy**. A common setup is an 8-hour workday (08:00–17:00) with a 15-minute grace period.

## Attendance Reports

### Daily Report

**HR → Attendance → Reports → Daily Summary** shows a snapshot of the entire organisation for a selected date: total present, total absent, total late, total on leave. Click any status pill to drill into the list of employees.

### Monthly Summary

**HR → Attendance → Reports → Monthly Summary** shows, for each employee over a calendar month:

- Total working days
- Days present
- Days absent
- Days late (and cumulative late minutes)
- Days on leave

This report is the primary input for payroll processing. HR downloads or reviews it before approving a payroll run to ensure that unpaid absences are flagged.

### Export

Both the daily and monthly reports can be exported to CSV or PDF via the **Export** button (top-right of the report page).

## Overtime Tracking

When an employee's clock-out time exceeds the standard shift end, Urban Vibes Dynamics records the extra hours as overtime. The overtime rate multiplier is configured in **HR → Settings → Payroll Policy** (e.g., 1.5x for standard overtime, 2.0x for public holiday work). Overtime hours feed into the payroll engine and are displayed as a separate line item on the payslip.

Managers must approve overtime entries before they are locked into payroll. Pending overtime approvals appear in **HR → Attendance → Overtime Approvals**.

## Absence Management

Unapproved absences (where no leave request exists and no clock-in was recorded) are automatically flagged in red on the daily log. HR receives a daily digest email listing all flagged absences at the end of each working day. These must be resolved — either by recording the correct attendance, attaching a leave request retroactively, or marking as unauthorised absence — before the monthly payroll run is finalised.

> **Tip:** Run the **Monthly Summary** report a few days before closing payroll. Resolve all absent and late flags first. A clean attendance record prevents payroll corrections and employee disputes over short-payment.

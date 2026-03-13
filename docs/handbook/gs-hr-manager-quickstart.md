---
title: HR Manager Quick Start
slug: hr-manager-quick-start
category: getting-started
article_type: quickstart
module: hr
tags: [hr, employees, leave, payroll, departments]
sort_order: 4
is_pinned: false
excerpt: Set up HR: add employees, configure leave policies, and run your first payroll.
---

# HR Manager Quick Start

This guide walks an HR Manager through the essential setup tasks: creating the organisational structure, adding employee records, configuring leave policies, and processing a payroll run.

---

## Navigating HR

Click **HR** in the left sidebar. The module sections are:

- **Dashboard** — headcount, upcoming anniversaries, leave calendar (`/hr`)
- **Employees** — employee records and profiles (`/hr/employees`)
- **Departments** — org chart and department management (`/hr/departments`)
- **Leave** — leave types, balances, requests, and approvals (`/hr/leave`)
- **Payroll** — payroll runs, payslips, and salary components (`/hr/payroll`)
- **Recruitment** — job postings and applicant tracking (`/hr/recruitment`)
- **Performance** — goals, reviews, and check-ins (`/hr/performance`)

---

## Step 1 — Create a Department

Before adding employees, set up at least one department.

1. Go to **HR → Departments** and click **+ New Department**.
2. Enter:
   - **Department Name** (e.g. "Engineering", "Sales", "Operations")
   - **Manager** — assign an existing user or leave blank to fill later
   - **Parent Department** — for nested org structures
3. Click **Save**.

Repeat for each department in your organisation.

---

## Step 2 — Add an Employee Record

1. Go to **HR → Employees → + New Employee**.
2. Fill in the **Personal** tab:
   - Full name, email, phone, date of birth, national ID / passport number
3. Fill in the **Employment** tab:
   - **Job Title**, **Department**, **Employee Type** (Full-time, Part-time, Contract)
   - **Start Date**, **Line Manager**
   - **Work Email** — used for system login if this employee also has a User account
4. Fill in the **Compensation** tab:
   - **Salary** (annual or monthly), **Currency**, **Pay Frequency**
5. Click **Save**.

> **Link to User account:** If this employee should log in to Urban Vibes Dynamics, go to **Admin → Users** and link their user account to this employee record via the **Employee** field. This enables features like self-service leave requests.

---

## Step 3 — Configure Leave Types and Balances

1. Go to **HR → Leave → Leave Types** and click **+ New Leave Type**.
2. Configure:
   - **Name** (e.g. "Annual Leave", "Sick Leave", "Parental Leave")
   - **Days per Year** — the default entitlement
   - **Carry Over** — maximum unused days that roll into the next year (0 = no carry-over)
   - **Requires Approval** — toggle on for leave types that need manager sign-off
   - **Paid / Unpaid** toggle
3. Click **Save**.

To assign balances to employees individually:
1. Open an employee record → **Leave** tab.
2. Click **Adjust Balance** next to any leave type.
3. Enter the opening balance (useful for employees joining mid-year) and click **Save**.

---

## Step 4 — Approve a Leave Request

Employees submit leave requests from their own dashboards. You will receive an in-app notification and an email.

1. Go to **HR → Leave → Requests** and filter by **Pending Approval**.
2. Click on a request to review the dates, leave type, and employee notes.
3. Check the **Leave Calendar** panel on the right to see who else is off during that period.
4. Click **Approve** or **Reject** (with an optional reason).

The employee receives an email notification of the decision and their leave balance is automatically updated on approval.

---

## Step 5 — Run Payroll

1. Go to **HR → Payroll → + New Payroll Run**.
2. Select:
   - **Pay Period** (e.g. March 2026)
   - **Pay Group** — All Employees, or a specific department
3. Urban Vibes Dynamics pre-fills each employee's salary, deductions (tax, pension, statutory deductions), and any approved expense reimbursements for the period.
4. Review the payroll summary table. Click **Edit** on any row to adjust a specific employee's figures.
5. When satisfied, click **Finalise** and then **Approve**.
6. Click **Generate Payslips** — each employee receives a PDF payslip by email and can also view it at `/hr/payslips`.

> **Finance integration:** Approving a payroll run automatically creates a journal entry in Finance for the total payroll expense, debit Salaries Expense / credit Bank.

---

## What is Next

- **Performance reviews:** Go to **HR → Performance** to create review cycles and assign goals.
- **Recruitment:** Post a job opening at **HR → Recruitment → + New Job** — applications come in and track through a hiring pipeline similar to CRM deals.
- **Reports:** **HR → Reports** gives you headcount trend, leave utilisation, and payroll cost breakdowns — exportable to CSV or viewable in the Analytics module.

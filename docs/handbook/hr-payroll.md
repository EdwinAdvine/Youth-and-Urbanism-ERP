---
title: "Running Payroll"
slug: running-payroll
category: hr-payroll
article_type: guide
module: hr
tags: [payroll, PAYE, NHIF, NSSF, housing-levy, Kenya]
sort_order: 4
is_pinned: false
excerpt: "Calculate and process monthly payroll with Kenya statutory deductions (PAYE, NHIF, NSSF)."
---

# Running Payroll

Urban Vibes Dynamics's payroll engine is built around Kenyan statutory requirements. Each payroll run calculates PAYE, NHIF, NSSF (Tier I & II), and Housing Levy automatically based on each employee's gross salary. No spreadsheets, no manual tax tables.

## Before You Run Payroll

Complete these checks before starting a new payroll run:

1. **Attendance is finalised** — all absent days and overtime are approved and locked in HR → Attendance.
2. **Salary changes are applied** — any promotions or contract amendments have been saved on the employee record.
3. **New employees are set up** — employees who joined mid-month have a start date set (payroll will prorate automatically).
4. **Leave without pay is recorded** — any unpaid leave is reflected in the attendance log so the system can deduct correctly.

## Creating a New Payroll Run

1. Navigate to **HR → Payroll → New Run**.
2. Select the **Pay Period** (e.g., March 2026).
3. Select the **Employee Group** — All Employees, a specific department, or a custom group (e.g., Management, Field Staff).
4. Click **Generate Payroll**. The engine processes each employee's pay.

## How the Deductions Are Calculated

For each employee, Urban Vibes Dynamics computes the following in sequence:

### 1. Gross Salary
The monthly gross as entered on the employee record, plus any approved overtime pay and allowances (house allowance, transport allowance). If the employee joined mid-month, gross pay is prorated: `(Gross ÷ Working Days in Month) × Days Worked`.

### 2. PAYE (Pay As You Earn)
PAYE is calculated on taxable income using the current Kenya Revenue Authority (KRA) tiered brackets:

| Taxable Income (KES/month) | Rate |
|---|---|
| Up to 24,000 | 10% |
| 24,001 – 32,333 | 25% |
| Above 32,333 | 30% |

The system applies the **personal relief** of KES 2,400 per month automatically, reducing the PAYE payable. The result matches what you would compute on KRA's PAYE worksheet. Urban Vibes Dynamics updates the tax brackets in Settings whenever KRA announces changes; your Super Admin can adjust the brackets under **HR → Settings → Tax Brackets**.

### 3. NHIF (National Hospital Insurance Fund)
NHIF contributions follow the income-based sliding scale set by the NHIF Act. The contribution is deducted from the employee's gross salary. The employer's matching contribution (where applicable per your policy) is shown as a separate employer cost line.

### 4. NSSF (National Social Security Fund)
Under the NSSF Act 2013 (Tier I + Tier II):
- **Tier I**: 6% of the Lower Earnings Limit (LEL), capped at KES 2,160 (employee) + KES 2,160 (employer).
- **Tier II**: 6% of pensionable earnings above the LEL, up to the Upper Earnings Limit (UEL). Shared equally between employee and employer.

Urban Vibes Dynamics tracks both tiers and shows them as separate lines on the payslip.

### 5. Housing Levy (Affordable Housing Levy)
1.5% of gross salary, deducted from the employee. The employer matches 1.5%. Both are displayed on the payslip.

### 6. Net Salary
`Net = Gross − PAYE − NHIF (employee) − NSSF Tier I & II (employee) − Housing Levy (employee) − Any other deductions (e.g., SACCO loan repayments)`

## Reviewing the Payroll Run

After generation, the payroll run opens in **Review Mode**. You will see:

- A summary table: all employees, their gross, each deduction line, and net pay.
- A **Totals Row** at the bottom: total payroll cost, total employer statutory contributions, total net payable to employees.
- Individual rows are colour-coded: green (normal), amber (has a note — e.g., pro-rated), red (error — missing KRA PIN, zero gross, etc.).

Click any employee's row to see a full payslip preview. Make corrections on the employee record if needed, then click **Regenerate** to refresh the run.

## Approving the Run

When you are satisfied:

1. Click **Approve Payroll Run**.
2. Confirm in the dialogue.
3. The system automatically:
   - Locks the run (no further edits).
   - Creates a **journal entry** in Finance: Salary Expense debit, Payroll Payable credit, individual statutory liability accounts credited (PAYE Payable, NHIF Payable, NSSF Payable, Housing Levy Payable).
   - Sends each employee their payslip by email (PDF attachment).

## Exporting Payslips and Reports

- **Individual Payslips**: HR → Payroll → [Run] → Download All Payslips (ZIP of individual PDFs).
- **Bank Payment File**: Export a CSV in your bank's bulk payment format listing employee names, account numbers, and net pay amounts.
- **Statutory Returns**: Export the PAYE return file (P9A format), NHIF schedule, and NSSF schedule ready for upload to the respective portals.

> **Tip:** Run payroll by the 25th of each month to give yourself time to export the PAYE return and remit to KRA by the 9th of the following month — the statutory deadline to avoid penalties.

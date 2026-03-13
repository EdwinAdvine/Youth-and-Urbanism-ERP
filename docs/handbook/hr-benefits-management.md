---
title: Employee Benefits & Deductions
slug: hr-benefits-management
category: hr-payroll
article_type: guide
module: hr
tags: [benefits, deductions, allowances, payroll, compensation]
sort_order: 10
is_pinned: false
excerpt: Configure employee benefits, allowances, and recurring deductions applied during payroll.
---

# Employee Benefits & Deductions

Urban Vibes Dynamics's payroll engine supports a full range of taxable allowances, non-taxable benefits, and recurring deductions. Everything configured here flows automatically into each payroll run and appears itemised on the employee's payslip.

---

## 1. Benefit & Deduction Types

Urban Vibes Dynamics recognises three categories:

| Category | Examples | Taxable? |
|---|---|---|
| Taxable allowances | Housing allowance, transport (above threshold), acting allowance | Yes — added to gross before PAYE |
| Non-taxable allowances | Medical reimbursement (within KRA limits), transport up to KES 2,000/month | No — excluded from PAYE calculation |
| Recurring deductions | SACCO loan repayment, staff welfare fund, union dues | N/A — post-tax deductions |

---

## 2. Creating a Benefit or Deduction Type

Go to **HR → Payroll Settings → Benefit Types → New**.

| Field | Description |
|---|---|
| Name | e.g., Housing Allowance, SACCO Loan |
| Category | Allowance or Deduction |
| Taxable | Yes / No |
| Calculation Method | Fixed amount or % of basic salary |
| Default Amount | Pre-filled default; overridable per employee |

Save the type. It now appears in the list when assigning to employees.

---

## 3. Assigning a Benefit or Deduction to an Employee

1. Open the employee record: **HR → Employees → [Employee Name]**
2. Go to the **Compensation** tab
3. Click **Add Benefit / Deduction**
4. Select the type, enter the amount (override the default if needed), and set the effective date
5. Save — the item is active from the next payroll run that falls on or after the effective date

To remove or end a benefit, click it and set an **End Date**. It will stop applying after that date.

---

## 4. Kenya-Specific Notes

Urban Vibes Dynamics applies KRA rules automatically when the taxable flag is set correctly:

- **Transport allowance** up to **KES 2,000/month** is non-taxable. Configure this as a non-taxable allowance; amounts above KES 2,000 should be split into a separate taxable allowance.
- **Medical insurance premiums** are non-taxable if paid to a registered insurer. When creating the benefit type, enter the insurer's name in the Notes field — Urban Vibes Dynamics will flag the item if the type is accidentally set as taxable.
- **NSSF contributions** are statutory and configured separately under **HR → Payroll Settings → Statutory Deductions**.

> **Tip:** Mark medical insurance as non-taxable and enter the insurer's name — Urban Vibes Dynamics will flag it if the type would normally be taxable.

---

## 5. NHIF Employer Contribution

NHIF has both employee and employer portions. To configure:

1. **HR → Payroll Settings → Benefit Types → New**
2. Name: `NHIF Employer Contribution`
3. Category: Deduction (from employer cost perspective) — Type: Employer Contribution
4. Set as a fixed statutory table (Urban Vibes Dynamics includes the NHIF tier table by default)
5. Assign to all eligible employees via Bulk Assign (see section 8)

The employee NHIF deduction is handled under Statutory Deductions. The employer NHIF cost is tracked separately for labour cost reporting.

---

## 6. Loan Deductions

To set up a staff loan repayment:

1. Go to **HR → Payroll → Loans → New Loan**
2. Fill in: Employee, Loan Amount, Monthly Instalment, Start Date
3. Save — Urban Vibes Dynamics automatically calculates the number of instalments and tracks the outstanding balance
4. Each payroll run deducts the monthly instalment until the balance reaches zero, then stops automatically
5. View the repayment schedule and outstanding balance on the loan record at any time
6. Early repayment: edit the loan record and set **Settled Date** to stop further deductions

Loan deductions appear on the payslip under "Deductions" with the outstanding balance shown.

---

## 7. How Benefits Appear on the Payslip

Payslips show a full itemised breakdown:

```
EARNINGS
  Basic Salary             KES 80,000
  Housing Allowance        KES 20,000   [Taxable]
  Transport Allowance      KES  2,000   [Non-taxable]
  Medical Insurance        KES  5,000   [Non-taxable]
  ─────────────────────────────────────
  Gross Taxable            KES 100,000

DEDUCTIONS
  PAYE                     KES 22,500
  NSSF                     KES  2,160
  NHIF                     KES  1,700
  SACCO Loan               KES  5,000
  ─────────────────────────────────────
  Total Deductions         KES 31,360

NET PAY                    KES 68,640
```

Employees can view and download their payslips from the **Employee Self-Service** portal.

---

## 8. Bulk-Applying a Benefit

To apply a benefit to a group of employees at once:

1. Go to **HR → Benefits → Bulk Assign**
2. Select the benefit/deduction type
3. Filter employees by: Employment Type (permanent, contract, casual), Department, or Location
4. Set the amount and effective date
5. Preview the affected employee list, then click **Apply**

Example: apply a KES 1,500 meal allowance to all permanent staff from the start of next month.

---

## Quick Reference

| Action | Path |
|---|---|
| Create benefit/deduction type | HR → Payroll Settings → Benefit Types → New |
| Assign to an employee | HR → Employees → [Name] → Compensation tab |
| Set up a loan | HR → Payroll → Loans → New Loan |
| Bulk assign | HR → Benefits → Bulk Assign |
| View payslip | Employee Self-Service → Payslips |
| Statutory deductions | HR → Payroll Settings → Statutory Deductions |

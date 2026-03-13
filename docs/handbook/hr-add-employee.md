---
title: "Adding & Managing Employees"
slug: adding-managing-employees
category: hr-payroll
article_type: guide
module: hr
tags: [employees, onboarding, departments, roles]
sort_order: 1
is_pinned: false
excerpt: "Create employee records, assign departments, and set up employment details."
---

# Adding & Managing Employees

Every person on your payroll or in your organisation must first exist as an employee record in Urban Vibes Dynamics. This record is the single source of truth for HR, Payroll, Attendance, Performance, and Leave — so getting it right from the start saves reconciliation work later.

## Navigating to the Employee Form

Go to **HR → Employees** in the left sidebar. Click **New Employee** (top-right button). The form opens with four tabbed sections: Personal, Employment, Documents, and Access.

## Personal Information

Fill in the following on the **Personal** tab:

- **Full Name** — legal name as it appears on the national ID or passport.
- **Date of Birth** — required for NHIF age-bracket calculations and statutory reporting.
- **Gender** — Male / Female / Other.
- **National ID / Passport Number** — Kenya National ID for citizens; passport number for expatriates or foreign nationals.
- **KRA PIN** — mandatory for PAYE deductions. Employees without a KRA PIN cannot be processed through payroll until one is registered at the KRA iTax portal.
- **Phone Number & Personal Email** — used for payslip delivery and system notifications.
- **Physical Address** — county and sub-county (required for some statutory forms).
- **Emergency Contact** — name, relationship, and phone number. This information is visible only to HR Admins.

## Employment Details

Switch to the **Employment** tab:

- **Employment Type** — choose Full-time, Part-time, or Contract. Contract employees can have an end date set, and the system will send a renewal reminder 30 days before expiry.
- **Department** — select from your configured departments (e.g., Sales, Finance, Operations). If the department does not exist, an HR Admin can add it under HR → Settings → Departments before continuing.
- **Job Title** — free-text field. Keep naming consistent (e.g., "Accounts Assistant" not "Accts Asst") to make reporting clean.
- **Direct Manager / Supervisor** — drives the approval workflow for leaves and timesheets.
- **Start Date** — the first working day. Payroll is prorated based on this date if the employee joins mid-month.
- **Gross Salary (KES)** — the monthly gross pay before any deductions. This feeds directly into the payroll engine.
- **Bank Name & Account Number** — for payslip and eventual direct-debit integration.
- **NHIF Number / NSSF Number** — statutory membership numbers. If the employee is new to the workforce, these can be registered and filled in within the first month.

## Uploading Documents

On the **Documents** tab, upload scanned copies of:

- National ID (front and back) or Passport
- Signed employment contract
- Academic certificates (optional but recommended)
- Any other onboarding documents required by your HR policy

All uploads are stored securely in Urban Vibes Dynamics's Drive (MinIO storage). Supported formats: PDF, JPG, PNG. Maximum file size per upload: 10 MB.

## Assigning System Access

The **Access** tab determines what the employee can do inside Urban Vibes Dynamics:

- **Role** — assign one of the pre-built roles (e.g., Standard User, Finance User, HR Admin) or a custom RBAC role created by your Super Admin.
- **System Email** — the work email address that will be used for internal messaging and notifications.
- Toggle **Send Welcome Email** to automatically dispatch login credentials once you save.

## Saving the Record

Click **Save Employee**. The system:

1. Creates the employee record and generates a unique Employee ID (e.g., EMP-00042).
2. Creates a user account if system access was granted.
3. Adds the employee to the selected department's headcount.
4. Sends the welcome email (if toggled on).

## Editing an Existing Employee

To update an employee's details later — such as a salary change, promotion, or department transfer — go to **HR → Employees**, find the employee using the search bar or department filter, and click their name to open the record. Make your changes and click **Save**. All changes are timestamped in an audit log visible to HR Admins.

> **Tip:** When an employee resigns or is terminated, do not delete their record. Instead, use the **Archive Employee** action (three-dot menu on the employee card). Archived employees no longer appear in active lists but their historical data — payroll, attendance, leave — is fully preserved for statutory compliance.

# HR & Payroll Module

> Employee lifecycle management, leave, attendance, payroll, and people analytics.

## Overview

The HR module manages the complete employee lifecycle from recruitment (ATS) through onboarding, day-to-day management (leave, attendance, scheduling), performance management (goals, reviews), learning & development (LMS), and payroll with Kenya statutory compliance.

**Who uses it:** HR Admins, Managers, all Employees (self-service)
**Requires:** HR App Admin for full access; employees access their own records

---

## Features

- **Employee Management** — profiles, org chart, department/team hierarchy
- **Applicant Tracking (ATS)** — job postings, application pipeline, AI resume screening
- **Onboarding** — automated onboarding checklists and task assignments
- **Leave Management** — leave requests, approvals, accrual policies, leave calendar
- **Attendance** — check-in/check-out, timesheet approval, overtime tracking
- **Shift Scheduling** — shift templates, rostering, shift swap requests
- **Payroll** — pay runs with Kenya statutory deductions (NHIF, NSSF, PAYE)
- **Goals & OKRs** — personal and team goals with check-ins and progress tracking
- **Performance Reviews** — 360° review cycles, competency frameworks
- **Compensation Planning** — salary bands, benchmarking, raise workflows
- **Learning Management (LMS)** — courses, certifications, mandatory training tracking
- **People Analytics** — attrition risk, headcount, compensation analysis
- **Manager Dashboard** — team overview: leave, attendance, goals, pending actions
- **AI Intelligence** — resume screening, attrition prediction, skills gap analysis
- **Skills & Competencies** — employee skill profiles, training recommendations
- **Audit Trail** — full change history on all HR records

---

## Architecture

### Key Files

| File | Description |
|------|-------------|
| `backend/app/api/v1/hr.py` | Core CRUD: employees, departments, leave, attendance |
| `backend/app/api/v1/hr_ai_intelligence.py` | AI-powered HR insights and predictions |
| `backend/app/api/v1/hr_ats.py` | Applicant tracking: jobs, applications, pipeline |
| `backend/app/api/v1/hr_audit.py` | HR change audit trail |
| `backend/app/api/v1/hr_compensation.py` | Salary management and compensation planning |
| `backend/app/api/v1/hr_engagement.py` | Employee engagement surveys and pulse checks |
| `backend/app/api/v1/hr_goals.py` | Goals, OKRs, and check-ins |
| `backend/app/api/v1/hr_lms.py` | Learning management: courses, enrollments |
| `backend/app/api/v1/hr_manager_dashboard.py` | Manager-specific team overview |
| `backend/app/api/v1/hr_onboarding_ext.py` | Extended onboarding workflows |
| `backend/app/api/v1/hr_people_analytics.py` | Headcount, attrition, and compensation reports |
| `backend/app/api/v1/hr_scheduling.py` | Shift scheduling and rostering |
| `backend/app/api/v1/hr_skills.py` | Employee skills and competency profiles |
| `backend/app/api/v1/hr_workflows.py` | HR approval workflows |
| `backend/app/api/v1/payroll_ext.py` | Extended payroll: runs, payslips, statutory |
| `backend/app/models/hr.py` | HR SQLAlchemy models |
| `frontend/src/features/hr/` | HR frontend pages |
| `frontend/src/api/hr.ts` | HR API client hooks |

---

## Data Models

| Model | Table | Description |
|-------|-------|-------------|
| `Employee` | `hr_employees` | Employee record (linked to User) |
| `Department` | `hr_departments` | Organizational unit |
| `LeaveRequest` | `hr_leave_requests` | Leave application |
| `LeaveType` | `hr_leave_types` | Leave categories (annual, sick, maternity, etc.) |
| `AttendanceRecord` | `hr_attendance` | Daily check-in/check-out records |
| `PayRun` | `hr_pay_runs` | Monthly payroll run |
| `Payslip` | `hr_payslips` | Individual employee payslip |
| `HRGoal` | `hr_goals` | Employee or team goal |
| `JobPosting` | `hr_job_postings` | Open position |
| `Application` | `hr_applications` | Job application |

---

## Workflows

### Leave Request Flow

```
Employee submits request
        ↓
Manager reviews (approved / rejected)
        ↓
HR Admin reviews (for extended leave)
        ↓
Calendar blocked (Out of Office) + email notification sent
        ↓
Payroll adjusted (unpaid leave deducted automatically)
```

### Payroll Flow

```
1. HR Admin opens Pay Runs → New Pay Run
2. Select pay period (month/year)
3. System imports: attendance, approved leave, overtime
4. Statutory deductions calculated:
   - PAYE (income tax, progressive rates)
   - NHIF (health insurance, tiered by gross salary)
   - NSSF (pension, 6% employee + 6% employer)
5. HR Admin reviews and adjusts any exceptions
6. Approve → payslips generated and emailed to employees
7. Finance integration: payroll journal entry created
```

### ATS Pipeline

```
Job Posted → Applications Received → AI Screening → Shortlisted
          → Interview Scheduled → Offer → Hired → Onboarding
```

---

## Kenya Payroll Compliance

| Deduction | Rate | Notes |
|-----------|------|-------|
| PAYE | Progressive (10%–30%) | Based on KRA tax bands |
| NHIF | KES 150–1,700/month | Tiered by gross salary |
| NSSF | 6% employee + 6% employer | Capped at pensionable pay |
| Housing Levy | 1.5% | Deducted from gross |

---

## Cross-Module Integrations

| Module | Integration |
|--------|-------------|
| Calendar | Approved leave blocks calendar as "Out of Office" |
| Finance | Pay run creates payroll journal entry |
| Manufacturing | HR operators assigned to work stations |
| Projects | Employees assignable to project tasks |
| CRM | Employee contact info available for CRM contacts |

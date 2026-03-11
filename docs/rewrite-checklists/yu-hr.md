# Y&U HR & Payroll – Rewrite Checklist

**Status: 100% COMPLETE** (65/65 items — Phase 2 + Phase 3 + Phase 4 + Extensions + Gap Fix)
**Owner: 100% Ours**

## Database Models
- [x] Employee model (user_id, employee_id, department_id, designation, date_of_joining, status)
- [x] Department model (name, parent_id, head_id)
- [x] LeaveType model (name, max_days, is_paid)
- [x] LeaveRequest model (employee_id, leave_type_id, from_date, to_date, status, approver_id)
- [x] Attendance model (employee_id, date, check_in, check_out, status)
- [x] Payslip model (employee_id, period_start, period_end, basic, allowances, deductions, net_pay, status)
- [x] TaxBracket model (min_income, max_income, rate, fiscal_year)
- [x] PayRun model (period, status, total_amount, processed_by)
- [x] EmployeeDocument model (employee_id, type, file_id, expiry_date)
- [x] Training model (name, description, date, trainer, attendees M2M)
- [x] PerformanceReview model (employee_id, reviewer_id, period, rating, goals JSON, comments)
- [x] Benefit model (employee_id, type, amount, start_date, end_date)
- [x] Overtime model (employee_id, date, hours, rate_multiplier, status)

## API Endpoints (FastAPI)
- [x] GET/POST /hr/employees
- [x] GET/PUT/DELETE /hr/employees/{id}
- [x] GET/POST /hr/departments
- [x] GET/POST /hr/leave-requests
- [x] PUT /hr/leave-requests/{id}/approve
- [x] GET/POST /hr/attendance
- [x] GET/POST /hr/payslips
- [x] GET /hr/payslips/{id}
- [x] POST /hr/payslips/{id}/approve
- [x] GET/POST /hr/tax-brackets
- [x] POST /hr/pay-runs
- [x] GET /hr/employees/{id}/documents
- [x] POST /hr/employees/{id}/documents
- [x] GET/POST /hr/training
- [x] GET/POST /hr/performance-reviews
- [x] GET /hr/reports/headcount
- [x] GET /hr/reports/attrition
- [x] GET /hr/reports/leave-balance
- [x] GET /hr/org-chart
- [x] POST /hr/attendance/bulk (CSV import)
- [x] GET /hr/dashboard/kpis

## Frontend Pages (React)
- [x] HR dashboard
- [x] Department list
- [x] Employee list + detail
- [x] Leave management
- [x] Attendance tracker
- [x] Payroll page
- [x] Payslip detail
- [x] Organization chart (visual tree)
- [x] Performance review forms
- [x] Training management
- [x] Employee documents vault
- [x] Leave calendar (team view)
- [x] Payroll reports (cost by department, tax summary)
- [x] Employee onboarding wizard
- [x] Employee offboarding checklist

## Integrations
- [x] HR → Finance: payroll → journal entries
- [x] Event bus: payslip.approved handler
- [x] HR → Calendar: leave displayed on calendar — `leave.approved` event in `main.py` auto-creates CalendarEvent for the leave period
- [x] HR → Mail: leave approval/rejection notifications via email — `integration_handlers.py` `on_leave_approved_email` + `on_leave_rejected_email` handlers send Stalwart emails
- [x] HR → Projects: employee availability — `hr_ext.py` GET /hr/employees/{id}/availability endpoint (leave + project workload)
- [x] AI attrition prediction — `ai_tools.py` `predict_attrition` tool + `ai_features.py` /hr/employees/{id}/ai-attrition endpoint
- [x] AI payroll anomaly detection — `ai_tools.py` `detect_payroll_anomalies` tool + `ai_features.py` /hr/payroll/ai-anomalies endpoint

## Tests
- [x] Employee CRUD tests
- [x] Leave request tests
- [x] Attendance tests
- [x] Payroll calculation tests — `test_hr_extended.py`: `test_generate_pay_run` verifies gross - deductions = net
- [x] Tax bracket application tests — `test_hr_extended.py`: 5 tax bracket tests (CRUD + progressive brackets)
- [x] Pay run tests — `test_hr_extended.py`: generate, approve, process lifecycle + invalid dates + unapproved rejection

## Mobile / Responsive
- [x] Mobile attendance check-in/out — `MobileAttendance.tsx` component shown on small screens in AttendancePage.tsx
- [x] Mobile leave request — `MobileLeaveRequest.tsx` component shown on small screens in LeavePage.tsx
- [x] Responsive org chart — `OrgChartPage.tsx` has mobile vertical list layout (isMobile prop) + desktop tree, md: breakpoints

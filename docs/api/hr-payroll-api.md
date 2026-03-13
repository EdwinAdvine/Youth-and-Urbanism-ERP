# HR & Payroll — API Reference

> Auto-generated from FastAPI router files. Do not edit manually.

> Re-generate with: `python scripts/generate-api-docs.py`


**Total endpoints:** 292


## Contents

- [hr.py](#hr) (27 endpoints)
- [hr_ai_intelligence.py](#hr-ai-intelligence) (17 endpoints)
- [hr_ats.py](#hr-ats) (27 endpoints)
- [hr_audit.py](#hr-audit) (3 endpoints)
- [hr_compensation.py](#hr-compensation) (22 endpoints)
- [hr_engagement.py](#hr-engagement) (16 endpoints)
- [hr_ext.py](#hr-ext) (28 endpoints)
- [hr_goals.py](#hr-goals) (23 endpoints)
- [hr_import.py](#hr-import) (7 endpoints)
- [hr_lms.py](#hr-lms) (24 endpoints)
- [hr_manager_dashboard.py](#hr-manager-dashboard) (9 endpoints)
- [hr_onboarding_ext.py](#hr-onboarding-ext) (18 endpoints)
- [hr_people_analytics.py](#hr-people-analytics) (15 endpoints)
- [hr_scheduling.py](#hr-scheduling) (15 endpoints)
- [hr_skills.py](#hr-skills) (13 endpoints)
- [hr_workflows.py](#hr-workflows) (15 endpoints)
- [payroll_ext.py](#payroll-ext) (13 endpoints)

---

## hr.py

HR & Payroll API — CRUD for departments, employees, leave requests, and attendance.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/departments` | `list_departments` | — |
| `POST` | `/departments` | `create_department` | — |
| `PUT` | `/departments/{department_id}` | `update_department` | — |
| `DELETE` | `/departments/{department_id}` | `delete_department` | — |
| `GET` | `/employees/me` | `get_my_employee_profile` | — |
| `GET` | `/employees` | `list_employees` | — |
| `POST` | `/employees` | `create_employee` | — |
| `GET` | `/employees/{employee_id}` | `get_employee` | — |
| `PUT` | `/employees/{employee_id}` | `update_employee` | — |
| `GET` | `/leave-requests` | `list_leave_requests` | — |
| `POST` | `/leave-requests` | `create_leave_request` | — |
| `PUT` | `/leave-requests/{request_id}/approve` | `approve_leave_request` | — |
| `PUT` | `/leave-requests/{request_id}/reject` | `reject_leave_request` | — |
| `GET` | `/leave-balance/{employee_id}` | `get_leave_balance` | — |
| `GET` | `/attendance` | `list_attendance` | — |
| `POST` | `/attendance/check-in` | `check_in` | — |
| `PUT` | `/attendance/check-out` | `check_out` | — |
| `GET` | `/dashboard/stats` | `hr_dashboard` | — |
| `GET` | `/salary-structures` | `list_salary_structures` | — |
| `POST` | `/salary-structures` | `create_salary_structure` | — |
| `PUT` | `/salary-structures/{structure_id}` | `update_salary_structure` | — |
| `DELETE` | `/salary-structures/{structure_id}` | `delete_salary_structure` | — |
| `GET` | `/payslips` | `list_payslips` | — |
| `POST` | `/payslips/generate` | `generate_payslips` | — |
| `POST` | `/payslips/{payslip_id}/approve` | `approve_payslip` | — |
| `POST` | `/payslips/{payslip_id}/mark-paid` | `mark_payslip_paid` | — |
| `GET` | `/employees/export` | `export_employees` | Download all employees as a CSV file. |

### `GET /departments`

**Function:** `list_departments` (line 172)

**Parameters:** `is_active`

**Auth:** `current_user`


### `POST /departments`

**Function:** `create_department` (line 200)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `PUT /departments/{department_id}`

**Function:** `update_department` (line 219)

**Parameters:** `department_id`, `payload`, `_admin`

**Auth:** `current_user`


### `DELETE /departments/{department_id}`

**Function:** `delete_department` (line 243)

**Parameters:** `department_id`, `_admin`

**Auth:** `current_user`


### `GET /employees/me`

**Function:** `get_my_employee_profile` (line 261)

**Auth:** `current_user`


### `GET /employees`

**Function:** `list_employees` (line 280)

**Parameters:** `department_id`, `is_active`, `employment_type`, `page`, `limit`

**Auth:** `current_user`


### `POST /employees`

**Function:** `create_employee` (line 319)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `GET /employees/{employee_id}`

**Function:** `get_employee` (line 356)

**Parameters:** `employee_id`

**Auth:** `current_user`


### `PUT /employees/{employee_id}`

**Function:** `update_employee` (line 373)

**Parameters:** `employee_id`, `payload`, `_admin`

**Auth:** `current_user`


### `GET /leave-requests`

**Function:** `list_leave_requests` (line 401)

**Parameters:** `status_filter`, `page`, `limit`

**Auth:** `current_user`


### `POST /leave-requests`

**Function:** `create_leave_request` (line 447)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /leave-requests/{request_id}/approve`

**Function:** `approve_leave_request` (line 482)

**Parameters:** `request_id`, `_admin`

**Auth:** `current_user`


### `PUT /leave-requests/{request_id}/reject`

**Function:** `reject_leave_request` (line 518)

**Parameters:** `request_id`, `_admin`

**Auth:** `current_user`


### `GET /leave-balance/{employee_id}`

**Function:** `get_leave_balance` (line 551)

**Parameters:** `employee_id`

**Auth:** `current_user`


### `GET /attendance`

**Function:** `list_attendance` (line 594)

**Parameters:** `employee_id`, `start_date`, `end_date`, `page`, `limit`

**Auth:** `current_user`


### `POST /attendance/check-in`

**Function:** `check_in` (line 633)

**Auth:** `current_user`


### `PUT /attendance/check-out`

**Function:** `check_out` (line 677)

**Auth:** `current_user`


### `GET /dashboard/stats`

**Function:** `hr_dashboard` (line 723)

**Auth:** `current_user`


### `GET /salary-structures`

**Function:** `list_salary_structures` (line 827)

**Auth:** `current_user`


### `POST /salary-structures`

**Function:** `create_salary_structure` (line 846)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `PUT /salary-structures/{structure_id}`

**Function:** `update_salary_structure` (line 865)

**Parameters:** `structure_id`, `payload`, `_admin`

**Auth:** `current_user`


### `DELETE /salary-structures/{structure_id}`

**Function:** `delete_salary_structure` (line 889)

**Parameters:** `structure_id`, `_admin`

**Auth:** `current_user`


### `GET /payslips`

**Function:** `list_payslips` (line 915)

**Parameters:** `status_filter`, `period_start`, `period_end`, `employee_id`, `page`, `limit`

**Auth:** `current_user`


### `POST /payslips/generate`

**Function:** `generate_payslips` (line 957)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `POST /payslips/{payslip_id}/approve`

**Function:** `approve_payslip` (line 1052)

**Parameters:** `payslip_id`, `_admin`

**Auth:** `current_user`


### `POST /payslips/{payslip_id}/mark-paid`

**Function:** `mark_payslip_paid` (line 1086)

**Parameters:** `payslip_id`, `_admin`

**Auth:** `current_user`


### `GET /employees/export`

**Function:** `export_employees` (line 1118)

Download all employees as a CSV file.

**Auth:** `current_user`


---

## hr_ai_intelligence.py

HR AI Intelligence — Skills Ontology, Flight Risk, Burnout, Chatbot, Workforce Planning.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/ai/skills-ontology` | `list_skills_ontology` | List all skill ontology nodes with optional parent_id filter and search. |
| `POST` | `/ai/skills-ontology` | `create_skill_ontology` | Create a skill ontology node (admin only). |
| `GET` | `/ai/skills-ontology/tree` | `skills_ontology_tree` | Full skills ontology tree, grouped by category. |
| `GET` | `/ai/skills-ontology/{skill_id}` | `get_skill_ontology` | Get a skill ontology node with its direct children. |
| `PUT` | `/ai/skills-ontology/{skill_id}` | `update_skill_ontology` | Update a skill ontology node (admin only). |
| `DELETE` | `/ai/skills-ontology/{skill_id}` | `delete_skill_ontology` | Soft-delete a skill ontology node (admin only, sets is_active=False). |
| `POST` | `/ai/flight-risk/calculate/{employee_id}` | `calculate_employee_flight_risk` | Calculate and persist flight risk score for an employee. |
| `GET` | `/ai/flight-risk/scores` | `list_flight_risk_scores` | List all flight risk scores (admin/manager), with optional risk_level filter. |
| `GET` | `/ai/flight-risk/scores/{employee_id}` | `get_employee_flight_risk_score` | Get the latest flight risk score for a specific employee. |
| `GET` | `/ai/flight-risk/team-summary` | `flight_risk_team_summary` | Aggregated team flight risk summary statistics. |
| `POST` | `/ai/burnout/calculate/{employee_id}` | `calculate_employee_burnout` | Calculate and persist burnout risk indicators for an employee. |
| `GET` | `/ai/burnout/indicators` | `list_burnout_indicators` | List burnout indicators (admin only), with optional risk_level filter. |
| `GET` | `/ai/burnout/indicators/{employee_id}` | `get_employee_burnout_indicator` | Get the latest burnout indicator for a specific employee. |
| `POST` | `/ai/hr-chatbot/query` | `hr_chatbot_query` | HR policy/data chatbot powered by AI. |
| `GET` | `/ai/workforce-planning/scenarios` | `list_workforce_planning_scenarios` | List workforce planning scenarios. |
| `POST` | `/ai/workforce-planning/scenarios` | `create_workforce_planning_scenario` | Create a workforce planning scenario with auto-calculated cost projections. |
| `GET` | `/ai/workforce-planning/scenarios/{scenario_id}` | `get_workforce_planning_scenario` | Get a workforce planning scenario with detailed projections. |

### `GET /ai/skills-ontology`

**Function:** `list_skills_ontology` (line 156)

List all skill ontology nodes with optional parent_id filter and search.

**Parameters:** `parent_id`, `q`, `page`, `limit`

**Auth:** `current_user`


### `POST /ai/skills-ontology`

**Function:** `create_skill_ontology` (line 193)

Create a skill ontology node (admin only).

**Parameters:** `body`, `_admin`

**Auth:** `current_user`


### `GET /ai/skills-ontology/tree`

**Function:** `skills_ontology_tree` (line 224)

Full skills ontology tree, grouped by category.

**Auth:** `current_user`


### `GET /ai/skills-ontology/{skill_id}`

**Function:** `get_skill_ontology` (line 259)

Get a skill ontology node with its direct children.

**Parameters:** `skill_id`

**Auth:** `current_user`


### `PUT /ai/skills-ontology/{skill_id}`

**Function:** `update_skill_ontology` (line 282)

Update a skill ontology node (admin only).

**Parameters:** `skill_id`, `body`, `_admin`

**Auth:** `current_user`


### `DELETE /ai/skills-ontology/{skill_id}`

**Function:** `delete_skill_ontology` (line 307)

Soft-delete a skill ontology node (admin only, sets is_active=False).

**Parameters:** `skill_id`, `_admin`

**Auth:** `current_user`


### `POST /ai/flight-risk/calculate/{employee_id}`

**Function:** `calculate_employee_flight_risk` (line 331)

Calculate and persist flight risk score for an employee.

**Parameters:** `employee_id`, `_admin`

**Auth:** `current_user`


### `GET /ai/flight-risk/scores`

**Function:** `list_flight_risk_scores` (line 401)

List all flight risk scores (admin/manager), with optional risk_level filter.

**Parameters:** `_admin`, `risk_level`, `page`, `limit`

**Auth:** `current_user`


### `GET /ai/flight-risk/scores/{employee_id}`

**Function:** `get_employee_flight_risk_score` (line 432)

Get the latest flight risk score for a specific employee.

**Parameters:** `employee_id`

**Auth:** `current_user`


### `GET /ai/flight-risk/team-summary`

**Function:** `flight_risk_team_summary` (line 454)

Aggregated team flight risk summary statistics.

**Parameters:** `_admin`

**Auth:** `current_user`


### `POST /ai/burnout/calculate/{employee_id}`

**Function:** `calculate_employee_burnout` (line 506)

Calculate and persist burnout risk indicators for an employee.

**Parameters:** `employee_id`, `_admin`

**Auth:** `current_user`


### `GET /ai/burnout/indicators`

**Function:** `list_burnout_indicators` (line 586)

List burnout indicators (admin only), with optional risk_level filter.

**Parameters:** `_admin`, `risk_level`, `page`, `limit`

**Auth:** `current_user`


### `GET /ai/burnout/indicators/{employee_id}`

**Function:** `get_employee_burnout_indicator` (line 617)

Get the latest burnout indicator for a specific employee.

**Parameters:** `employee_id`

**Auth:** `current_user`


### `POST /ai/hr-chatbot/query`

**Function:** `hr_chatbot_query` (line 649)

HR policy/data chatbot powered by AI.

**Parameters:** `body`

**Auth:** `current_user`


### `GET /ai/workforce-planning/scenarios`

**Function:** `list_workforce_planning_scenarios` (line 692)

List workforce planning scenarios.

**Parameters:** `_admin`, `fiscal_year`, `page`, `limit`

**Auth:** `current_user`


### `POST /ai/workforce-planning/scenarios`

**Function:** `create_workforce_planning_scenario` (line 727)

Create a workforce planning scenario with auto-calculated cost projections.

**Parameters:** `body`, `_admin`

**Auth:** `current_user`


### `GET /ai/workforce-planning/scenarios/{scenario_id}`

**Function:** `get_workforce_planning_scenario` (line 778)

Get a workforce planning scenario with detailed projections.

**Parameters:** `scenario_id`, `_admin`

**Auth:** `current_user`


---

## hr_ats.py

HR ATS API — Applicant Tracking System: requisitions, candidates, applications, interviews.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/requisitions` | `list_requisitions` | — |
| `POST` | `/requisitions` | `create_requisition` | — |
| `GET` | `/requisitions/{req_id}` | `get_requisition` | — |
| `PUT` | `/requisitions/{req_id}` | `update_requisition` | — |
| `DELETE` | `/requisitions/{req_id}` | `cancel_requisition` | — |
| `POST` | `/requisitions/{req_id}/publish` | `publish_requisition` | — |
| `POST` | `/requisitions/{req_id}/close` | `close_requisition` | — |
| `GET` | `/requisitions/{req_id}/pipeline` | `get_requisition_pipeline` | — |
| `GET` | `/candidates` | `list_candidates` | — |
| `POST` | `/candidates` | `create_candidate` | — |
| `GET` | `/candidates/{cand_id}` | `get_candidate` | — |
| `PUT` | `/candidates/{cand_id}` | `update_candidate` | — |
| `POST` | `/candidates/{cand_id}/blacklist` | `blacklist_candidate` | — |
| `POST` | `/candidates/ai-screen` | `ai_screen_candidate` | — |
| `GET` | `/applications` | `list_applications` | — |
| `POST` | `/applications` | `create_application` | — |
| `GET` | `/applications/{app_id}` | `get_application` | — |
| `PUT` | `/applications/{app_id}/stage` | `update_application_stage` | — |
| `PUT` | `/applications/{app_id}/assign` | `assign_application` | — |
| `PUT` | `/applications/{app_id}/offer` | `set_application_offer` | — |
| `GET` | `/interviews` | `list_interviews` | — |
| `POST` | `/interviews` | `create_interview` | — |
| `GET` | `/interviews/{int_id}` | `get_interview` | — |
| `PUT` | `/interviews/{int_id}/feedback` | `submit_interview_feedback` | — |
| `DELETE` | `/interviews/{int_id}` | `cancel_interview` | — |
| `GET` | `/ats/dashboard` | `ats_dashboard` | — |
| `GET` | `/ats/diversity` | `ats_diversity` | — |

### `GET /requisitions`

**Function:** `list_requisitions` (line 220)

**Parameters:** `req_status`, `department_id`, `hiring_manager_id`, `search`, `page`, `limit`

**Auth:** `current_user`


### `POST /requisitions`

**Function:** `create_requisition` (line 271)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `GET /requisitions/{req_id}`

**Function:** `get_requisition` (line 308)

**Parameters:** `req_id`

**Auth:** `current_user`


### `PUT /requisitions/{req_id}`

**Function:** `update_requisition` (line 328)

**Parameters:** `req_id`, `payload`, `_admin`

**Auth:** `current_user`


### `DELETE /requisitions/{req_id}`

**Function:** `cancel_requisition` (line 374)

**Parameters:** `req_id`, `_admin`

**Auth:** `current_user`


### `POST /requisitions/{req_id}/publish`

**Function:** `publish_requisition` (line 389)

**Parameters:** `req_id`, `_admin`

**Auth:** `current_user`


### `POST /requisitions/{req_id}/close`

**Function:** `close_requisition` (line 413)

**Parameters:** `req_id`, `_admin`

**Auth:** `current_user`


### `GET /requisitions/{req_id}/pipeline`

**Function:** `get_requisition_pipeline` (line 439)

**Parameters:** `req_id`

**Auth:** `current_user`


### `GET /candidates`

**Function:** `list_candidates` (line 483)

**Parameters:** `search`, `source`, `is_blacklisted`, `page`, `limit`

**Auth:** `current_user`


### `POST /candidates`

**Function:** `create_candidate` (line 532)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `GET /candidates/{cand_id}`

**Function:** `get_candidate` (line 566)

**Parameters:** `cand_id`

**Auth:** `current_user`


### `PUT /candidates/{cand_id}`

**Function:** `update_candidate` (line 588)

**Parameters:** `cand_id`, `payload`, `_admin`

**Auth:** `current_user`


### `POST /candidates/{cand_id}/blacklist`

**Function:** `blacklist_candidate` (line 614)

**Parameters:** `cand_id`, `_admin`

**Auth:** `current_user`


### `POST /candidates/ai-screen`

**Function:** `ai_screen_candidate` (line 636)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `GET /applications`

**Function:** `list_applications` (line 672)

**Parameters:** `requisition_id`, `stage`, `assigned_to`, `page`, `limit`

**Auth:** `current_user`


### `POST /applications`

**Function:** `create_application` (line 714)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /applications/{app_id}`

**Function:** `get_application` (line 767)

**Parameters:** `app_id`

**Auth:** `current_user`


### `PUT /applications/{app_id}/stage`

**Function:** `update_application_stage` (line 793)

**Parameters:** `app_id`, `payload`, `_admin`

**Auth:** `current_user`


### `PUT /applications/{app_id}/assign`

**Function:** `assign_application` (line 837)

**Parameters:** `app_id`, `payload`, `_admin`

**Auth:** `current_user`


### `PUT /applications/{app_id}/offer`

**Function:** `set_application_offer` (line 855)

**Parameters:** `app_id`, `payload`, `_admin`

**Auth:** `current_user`


### `GET /interviews`

**Function:** `list_interviews` (line 897)

**Parameters:** `application_id`, `interview_status`, `page`, `limit`

**Auth:** `current_user`


### `POST /interviews`

**Function:** `create_interview` (line 936)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `GET /interviews/{int_id}`

**Function:** `get_interview` (line 988)

**Parameters:** `int_id`

**Auth:** `current_user`


### `PUT /interviews/{int_id}/feedback`

**Function:** `submit_interview_feedback` (line 1000)

**Parameters:** `int_id`, `payload`, `_admin`

**Auth:** `current_user`


### `DELETE /interviews/{int_id}`

**Function:** `cancel_interview` (line 1044)

**Parameters:** `int_id`, `_admin`

**Auth:** `current_user`


### `GET /ats/dashboard`

**Function:** `ats_dashboard` (line 1068)

**Auth:** `current_user`


### `GET /ats/diversity`

**Function:** `ats_diversity` (line 1134)

**Auth:** `current_user`


---

## hr_audit.py

HR Audit API — field-level change tracking and sensitive access logs.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/audit/changes` | `list_audit_changes` | Query audit trail of field-level changes on HR records. |
| `GET` | `/audit/changes/{record_id}` | `get_record_changes` | Get full change history for a specific HR record. |
| `GET` | `/audit/sensitive-access` | `sensitive_access_log` | Query access log for sensitive HR fields (salary, SSN, etc.). |

### `GET /audit/changes`

**Function:** `list_audit_changes` (line 39)

Query audit trail of field-level changes on HR records.

**Parameters:** `_admin`, `table_name`, `record_id`, `field_name`, `changed_by`, `start_date`, `end_date`, `page`, `limit`

**Auth:** `current_user`


### `GET /audit/changes/{record_id}`

**Function:** `get_record_changes` (line 85)

Get full change history for a specific HR record.

**Parameters:** `record_id`, `_admin`

**Auth:** `current_user`


### `GET /audit/sensitive-access`

**Function:** `sensitive_access_log` (line 102)

Query access log for sensitive HR fields (salary, SSN, etc.).

**Parameters:** `_admin`, `start_date`, `end_date`, `page`, `limit`

**Auth:** `current_user`


---

## hr_compensation.py

HR Compensation API — bands, merit increases, bonuses, equity grants.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/compensation/bands` | `list_compensation_bands` | List compensation bands with optional filters. |
| `POST` | `/compensation/bands` | `create_compensation_band` | Create a compensation band (admin). |
| `PUT` | `/compensation/bands/{band_id}` | `update_compensation_band` | Update a compensation band (admin). |
| `DELETE` | `/compensation/bands/{band_id}` | `delete_compensation_band` | Soft-delete a compensation band (admin). |
| `GET` | `/compensation/bands/analysis` | `compensation_band_analysis` | Compare employee salaries against compensation bands. Returns employees outsi... |
| `GET` | `/merit/budget-pools` | `list_merit_budget_pools` | List merit budget pools with optional filters. |
| `POST` | `/merit/budget-pools` | `create_merit_budget_pool` | Create a merit budget pool (admin). |
| `PUT` | `/merit/budget-pools/{pool_id}` | `update_merit_budget_pool` | Update a merit budget pool (admin). |
| `GET` | `/merit/increases` | `list_merit_increases` | List merit increases with pagination and filters. |
| `POST` | `/merit/increases` | `propose_merit_increase` | Propose a merit increase (admin). Auto-calculates increase_percentage from cu... |
| `PUT` | `/merit/increases/{increase_id}/approve` | `approve_merit_increase` | Approve a proposed merit increase (admin). Updates budget pool allocated_amount. |
| `PUT` | `/merit/increases/{increase_id}/reject` | `reject_merit_increase` | Reject a proposed merit increase (admin). |
| `PUT` | `/merit/increases/{increase_id}/apply` | `apply_merit_increase` | Apply an approved merit increase to Employee.salary (admin). Publishes employ... |
| `GET` | `/bonuses` | `list_bonuses` | List bonuses with pagination and filters. |
| `POST` | `/bonuses` | `create_bonus` | Create a bonus (admin). |
| `PUT` | `/bonuses/{bonus_id}/approve` | `approve_bonus` | Approve a bonus (admin). Publishes bonus.approved event. |
| `PUT` | `/bonuses/{bonus_id}/pay` | `pay_bonus` | Mark a bonus as paid (admin). |
| `GET` | `/equity-grants` | `list_equity_grants` | List equity grants with optional filters. |
| `POST` | `/equity-grants` | `create_equity_grant` | Create an equity grant (admin). |
| `PUT` | `/equity-grants/{grant_id}` | `update_equity_grant` | Update an equity grant (admin). |
| `GET` | `/equity-grants/{grant_id}/vesting-schedule` | `get_vesting_schedule` | Calculate vesting timeline based on the grant's vesting_schedule JSON. |
| `PUT` | `/equity-grants/{grant_id}/vest` | `vest_equity_grant` | Process a vesting event: update vested_shares (admin). |

### `GET /compensation/bands`

**Function:** `list_compensation_bands` (line 228)

List compensation bands with optional filters.

**Parameters:** `job_level`, `job_family`, `country_code`, `is_active`

**Auth:** `current_user`


### `POST /compensation/bands`

**Function:** `create_compensation_band` (line 255)

Create a compensation band (admin).

**Parameters:** `data`, `_admin`

**Response model:** `CompensationBandOut`

**Auth:** `current_user`


### `PUT /compensation/bands/{band_id}`

**Function:** `update_compensation_band` (line 270)

Update a compensation band (admin).

**Parameters:** `band_id`, `data`, `_admin`

**Response model:** `CompensationBandOut`

**Auth:** `current_user`


### `DELETE /compensation/bands/{band_id}`

**Function:** `delete_compensation_band` (line 289)

Soft-delete a compensation band (admin).

**Parameters:** `band_id`, `_admin`

**Auth:** `current_user`


### `GET /compensation/bands/analysis`

**Function:** `compensation_band_analysis` (line 305)

Compare employee salaries against compensation bands. Returns employees outside range.

**Parameters:** `_admin`

**Auth:** `current_user`


### `GET /merit/budget-pools`

**Function:** `list_merit_budget_pools` (line 382)

List merit budget pools with optional filters.

**Parameters:** `fiscal_year`, `department_id`, `status`

**Auth:** `current_user`


### `POST /merit/budget-pools`

**Function:** `create_merit_budget_pool` (line 406)

Create a merit budget pool (admin).

**Parameters:** `data`, `_admin`

**Response model:** `MeritBudgetPoolOut`

**Auth:** `current_user`


### `PUT /merit/budget-pools/{pool_id}`

**Function:** `update_merit_budget_pool` (line 424)

Update a merit budget pool (admin).

**Parameters:** `pool_id`, `data`, `_admin`

**Response model:** `MeritBudgetPoolOut`

**Auth:** `current_user`


### `GET /merit/increases`

**Function:** `list_merit_increases` (line 446)

List merit increases with pagination and filters.

**Parameters:** `employee_id`, `status`, `increase_type`, `page`, `limit`

**Auth:** `current_user`


### `POST /merit/increases`

**Function:** `propose_merit_increase` (line 484)

Propose a merit increase (admin). Auto-calculates increase_percentage from current employee salary.

**Parameters:** `data`, `_admin`

**Response model:** `MeritIncreaseOut`

**Auth:** `current_user`


### `PUT /merit/increases/{increase_id}/approve`

**Function:** `approve_merit_increase` (line 521)

Approve a proposed merit increase (admin). Updates budget pool allocated_amount.

**Parameters:** `increase_id`, `_admin`

**Response model:** `MeritIncreaseOut`

**Auth:** `current_user`


### `PUT /merit/increases/{increase_id}/reject`

**Function:** `reject_merit_increase` (line 550)

Reject a proposed merit increase (admin).

**Parameters:** `increase_id`, `_admin`

**Response model:** `MeritIncreaseOut`

**Auth:** `current_user`


### `PUT /merit/increases/{increase_id}/apply`

**Function:** `apply_merit_increase` (line 571)

Apply an approved merit increase to Employee.salary (admin). Publishes employee.salary_changed event and logs in activity timeline.

**Parameters:** `increase_id`, `_admin`

**Response model:** `MeritIncreaseOut`

**Auth:** `current_user`


### `GET /bonuses`

**Function:** `list_bonuses` (line 633)

List bonuses with pagination and filters.

**Parameters:** `employee_id`, `bonus_type`, `status`, `page`, `limit`

**Auth:** `current_user`


### `POST /bonuses`

**Function:** `create_bonus` (line 671)

Create a bonus (admin).

**Parameters:** `data`, `_admin`

**Response model:** `BonusOut`

**Auth:** `current_user`


### `PUT /bonuses/{bonus_id}/approve`

**Function:** `approve_bonus` (line 690)

Approve a bonus (admin). Publishes bonus.approved event.

**Parameters:** `bonus_id`, `_admin`

**Response model:** `BonusOut`

**Auth:** `current_user`


### `PUT /bonuses/{bonus_id}/pay`

**Function:** `pay_bonus` (line 723)

Mark a bonus as paid (admin).

**Parameters:** `bonus_id`, `_admin`

**Response model:** `BonusOut`

**Auth:** `current_user`


### `GET /equity-grants`

**Function:** `list_equity_grants` (line 747)

List equity grants with optional filters.

**Parameters:** `employee_id`, `grant_type`, `status`

**Auth:** `current_user`


### `POST /equity-grants`

**Function:** `create_equity_grant` (line 772)

Create an equity grant (admin).

**Parameters:** `data`, `_admin`

**Response model:** `EquityGrantOut`

**Auth:** `current_user`


### `PUT /equity-grants/{grant_id}`

**Function:** `update_equity_grant` (line 791)

Update an equity grant (admin).

**Parameters:** `grant_id`, `data`, `_admin`

**Response model:** `EquityGrantOut`

**Auth:** `current_user`


### `GET /equity-grants/{grant_id}/vesting-schedule`

**Function:** `get_vesting_schedule` (line 810)

Calculate vesting timeline based on the grant's vesting_schedule JSON.

**Parameters:** `grant_id`

**Auth:** `current_user`


### `PUT /equity-grants/{grant_id}/vest`

**Function:** `vest_equity_grant` (line 884)

Process a vesting event: update vested_shares (admin).

**Parameters:** `grant_id`, `shares_to_vest`, `_admin`

**Response model:** `EquityGrantOut`

**Auth:** `current_user`


---

## hr_engagement.py

HR Employee Engagement API — Surveys (eNPS / pulse / exit) + Recognition.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/surveys` | `list_surveys` | Admins see all surveys. |
| `POST` | `/surveys` | `create_survey` | — |
| `GET` | `/surveys/enps-trend` | `enps_trend` | Returns one eNPS data point per closed eNPS survey over the last 12 months, |
| `GET` | `/surveys/{survey_id}` | `get_survey` | Returns survey detail.  If is_anonymous, respondent_id is stripped from |
| `PUT` | `/surveys/{survey_id}` | `update_survey` | — |
| `DELETE` | `/surveys/{survey_id}` | `delete_survey` | — |
| `POST` | `/surveys/{survey_id}/launch` | `launch_survey` | — |
| `POST` | `/surveys/{survey_id}/close` | `close_survey` | — |
| `POST` | `/surveys/{survey_id}/respond` | `respond_to_survey` | Submit a response for an active survey. |
| `GET` | `/surveys/{survey_id}/results` | `survey_results` | Returns: |
| `GET` | `/recognitions/leaderboard` | `recognition_leaderboard` | Returns top 10 employees ranked by total recognition points received in the |
| `GET` | `/recognitions` | `list_recognitions` | Public feed: non-admins see only is_public=True recognitions. |
| `POST` | `/recognitions` | `give_recognition` | — |
| `GET` | `/recognitions/{rec_id}` | `get_recognition` | — |
| `DELETE` | `/recognitions/{rec_id}` | `delete_recognition` | — |
| `GET` | `/employees/{emp_id}/recognition-summary` | `employee_recognition_summary` | Returns: |

### `GET /surveys`

**Function:** `list_surveys` (line 130)

Admins see all surveys.
Regular users see only surveys in *active* status (surveys they can take).

**Parameters:** `survey_type`, `status_filter`, `page`, `limit`

**Auth:** `current_user`


### `POST /surveys`

**Function:** `create_survey` (line 180)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `GET /surveys/enps-trend`

**Function:** `enps_trend` (line 198)

Returns one eNPS data point per closed eNPS survey over the last 12 months,
ordered chronologically.

**Auth:** `current_user`


### `GET /surveys/{survey_id}`

**Function:** `get_survey` (line 260)

Returns survey detail.  If is_anonymous, respondent_id is stripped from
all response objects returned alongside the survey metadata.

**Parameters:** `survey_id`

**Auth:** `current_user`


### `PUT /surveys/{survey_id}`

**Function:** `update_survey` (line 289)

**Parameters:** `survey_id`, `payload`, `_admin`

**Auth:** `current_user`


### `DELETE /surveys/{survey_id}`

**Function:** `delete_survey` (line 317)

**Parameters:** `survey_id`, `_admin`

**Auth:** `current_user`


### `POST /surveys/{survey_id}/launch`

**Function:** `launch_survey` (line 337)

**Parameters:** `survey_id`, `_admin`

**Auth:** `current_user`


### `POST /surveys/{survey_id}/close`

**Function:** `close_survey` (line 374)

**Parameters:** `survey_id`, `_admin`

**Auth:** `current_user`


### `POST /surveys/{survey_id}/respond`

**Function:** `respond_to_survey` (line 399)

Submit a response for an active survey.

- If is_anonymous: respondent_id is set to None regardless of caller.
- If not anonymous: respondent_id is resolved from current user's employee profile.
- Extracts NPS score from answers if an "nps" key is present.
- Publishes engagement.survey_response_submitted event.
- Sentiment analysis is queued asynchronously (not blocking this response).

**Parameters:** `survey_id`, `payload`

**Auth:** `current_user`


### `GET /surveys/{survey_id}/results`

**Function:** `survey_results` (line 484)

Returns:
- Per-question breakdown (value frequencies / avg for numeric questions)
- Average sentiment_score across all responses
- NPS score: (promoters − detractors) / total × 100
- Response rate: responses / target_count (target_count from target_audience or all active employees)
- If survey is_anonymous: no respondent_id information is included

**Parameters:** `survey_id`, `_admin`

**Auth:** `current_user`


### `GET /recognitions/leaderboard`

**Function:** `recognition_leaderboard` (line 630)

Returns top 10 employees ranked by total recognition points received in the
current calendar month.

**Auth:** `current_user`


### `GET /recognitions`

**Function:** `list_recognitions` (line 673)

Public feed: non-admins see only is_public=True recognitions.
Admins see all.

**Parameters:** `to_employee_id`, `from_employee_id`, `recognition_type`, `page`, `limit`

**Auth:** `current_user`


### `POST /recognitions`

**Function:** `give_recognition` (line 725)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /recognitions/{rec_id}`

**Function:** `get_recognition` (line 777)

**Parameters:** `rec_id`

**Auth:** `current_user`


### `DELETE /recognitions/{rec_id}`

**Function:** `delete_recognition` (line 803)

**Parameters:** `rec_id`

**Auth:** `current_user`


### `GET /employees/{emp_id}/recognition-summary`

**Function:** `employee_recognition_summary` (line 828)

Returns:
- total recognitions received
- breakdown by recognition_type
- top badges earned (by frequency)
- total points accumulated

**Parameters:** `emp_id`

**Auth:** `current_user`


---

## hr_ext.py

HR Extensions API — documents, training, performance, benefits, overtime, reports, org chart.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/employees/{employee_id}/documents` | `list_employee_documents` | — |
| `POST` | `/employees/{employee_id}/documents` | `create_employee_document` | — |
| `DELETE` | `/employees/{employee_id}/documents/{doc_id}` | `delete_employee_document` | — |
| `GET` | `/training` | `list_trainings` | — |
| `POST` | `/training` | `create_training` | — |
| `GET` | `/training/{training_id}` | `get_training` | — |
| `PUT` | `/training/{training_id}` | `update_training` | — |
| `POST` | `/training/{training_id}/attendees` | `add_training_attendee` | — |
| `GET` | `/training/{training_id}/attendees` | `list_training_attendees` | — |
| `GET` | `/performance-reviews` | `list_performance_reviews` | — |
| `POST` | `/performance-reviews` | `create_performance_review` | — |
| `GET` | `/performance-reviews/{review_id}` | `get_performance_review` | — |
| `PUT` | `/performance-reviews/{review_id}` | `update_performance_review` | — |
| `GET` | `/reports/headcount` | `report_headcount` | — |
| `GET` | `/reports/attrition` | `report_attrition` | — |
| `GET` | `/reports/leave-balance` | `report_leave_balance` | — |
| `GET` | `/org-chart` | `org_chart` | — |
| `POST` | `/attendance/bulk` | `bulk_import_attendance` | — |
| `GET` | `/employees/{employee_id}/availability` | `employee_availability` | HR→Projects: check leave calendar and current project workload for an employee. |
| `GET` | `/dashboard/kpis` | `dashboard_kpis` | — |
| `GET` | `/benefits` | `list_benefits` | — |
| `POST` | `/benefits` | `create_benefit` | — |
| `GET` | `/benefits/{benefit_id}` | `get_benefit` | — |
| `PUT` | `/benefits/{benefit_id}` | `update_benefit` | — |
| `GET` | `/overtime` | `list_overtime` | — |
| `POST` | `/overtime` | `create_overtime` | — |
| `PUT` | `/overtime/{overtime_id}/approve` | `approve_overtime` | — |
| `PUT` | `/overtime/{overtime_id}/reject` | `reject_overtime` | — |

### `GET /employees/{employee_id}/documents`

**Function:** `list_employee_documents` (line 243)

**Parameters:** `employee_id`

**Auth:** `current_user`


### `POST /employees/{employee_id}/documents`

**Function:** `create_employee_document` (line 270)

**Parameters:** `employee_id`, `payload`, `_admin`

**Auth:** `current_user`


### `DELETE /employees/{employee_id}/documents/{doc_id}`

**Function:** `delete_employee_document` (line 306)

**Parameters:** `employee_id`, `doc_id`, `_admin`

**Auth:** `current_user`


### `GET /training`

**Function:** `list_trainings` (line 332)

**Parameters:** `training_status`, `page`, `limit`

**Auth:** `current_user`


### `POST /training`

**Function:** `create_training` (line 363)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `GET /training/{training_id}`

**Function:** `get_training` (line 391)

**Parameters:** `training_id`

**Auth:** `current_user`


### `PUT /training/{training_id}`

**Function:** `update_training` (line 403)

**Parameters:** `training_id`, `payload`, `_admin`

**Auth:** `current_user`


### `POST /training/{training_id}/attendees`

**Function:** `add_training_attendee` (line 427)

**Parameters:** `training_id`, `payload`, `_admin`

**Auth:** `current_user`


### `GET /training/{training_id}/attendees`

**Function:** `list_training_attendees` (line 472)

**Parameters:** `training_id`

**Auth:** `current_user`


### `GET /performance-reviews`

**Function:** `list_performance_reviews` (line 500)

**Parameters:** `employee_id`, `review_status`, `page`, `limit`

**Auth:** `current_user`


### `POST /performance-reviews`

**Function:** `create_performance_review` (line 534)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `GET /performance-reviews/{review_id}`

**Function:** `get_performance_review` (line 562)

**Parameters:** `review_id`

**Auth:** `current_user`


### `PUT /performance-reviews/{review_id}`

**Function:** `update_performance_review` (line 574)

**Parameters:** `review_id`, `payload`, `_admin`

**Auth:** `current_user`


### `GET /reports/headcount`

**Function:** `report_headcount` (line 596)

**Parameters:** `_admin`

**Auth:** `current_user`


### `GET /reports/attrition`

**Function:** `report_attrition` (line 621)

**Parameters:** `year`, `_admin`

**Auth:** `current_user`


### `GET /reports/leave-balance`

**Function:** `report_leave_balance` (line 658)

**Parameters:** `_admin`

**Auth:** `current_user`


### `GET /org-chart`

**Function:** `org_chart` (line 708)

**Auth:** `current_user`


### `POST /attendance/bulk`

**Function:** `bulk_import_attendance` (line 790)

**Parameters:** `file`, `_admin`

**Auth:** `current_user`


### `GET /employees/{employee_id}/availability`

**Function:** `employee_availability` (line 901)

HR→Projects: check leave calendar and current project workload for an employee.

**Parameters:** `employee_id`, `start_date`, `end_date`

**Auth:** `current_user`


### `GET /dashboard/kpis`

**Function:** `dashboard_kpis` (line 1015)

**Auth:** `current_user`


### `GET /benefits`

**Function:** `list_benefits` (line 1074)

**Parameters:** `employee_id`, `benefit_type`, `is_active`, `page`, `limit`

**Auth:** `current_user`


### `POST /benefits`

**Function:** `create_benefit` (line 1111)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `GET /benefits/{benefit_id}`

**Function:** `get_benefit` (line 1142)

**Parameters:** `benefit_id`

**Auth:** `current_user`


### `PUT /benefits/{benefit_id}`

**Function:** `update_benefit` (line 1154)

**Parameters:** `benefit_id`, `payload`, `_admin`

**Auth:** `current_user`


### `GET /overtime`

**Function:** `list_overtime` (line 1176)

**Parameters:** `employee_id`, `overtime_status`, `page`, `limit`

**Auth:** `current_user`


### `POST /overtime`

**Function:** `create_overtime` (line 1210)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `PUT /overtime/{overtime_id}/approve`

**Function:** `approve_overtime` (line 1235)

**Parameters:** `overtime_id`, `_admin`

**Auth:** `current_user`


### `PUT /overtime/{overtime_id}/reject`

**Function:** `reject_overtime` (line 1268)

**Parameters:** `overtime_id`, `_admin`

**Auth:** `current_user`


---

## hr_goals.py

HR Goals, OKR, Continuous Feedback & 360 Review Cycles API.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/goals` | `list_goals` | — |
| `POST` | `/goals` | `create_goal` | — |
| `PUT` | `/goals/{goal_id}` | `update_goal` | — |
| `DELETE` | `/goals/{goal_id}` | `delete_goal` | — |
| `GET` | `/goals/tree` | `goal_tree` | — |
| `GET` | `/goals/dashboard` | `goal_dashboard` | — |
| `GET` | `/goals/{goal_id}` | `get_goal` | — |
| `POST` | `/goals/{goal_id}/updates` | `create_goal_update` | — |
| `GET` | `/goals/{goal_id}/updates` | `list_goal_updates` | — |
| `GET` | `/feedback` | `list_feedback_received` | — |
| `POST` | `/feedback` | `create_feedback` | — |
| `GET` | `/feedback/given` | `list_feedback_given` | — |
| `GET` | `/feedback/summary/{employee_id}` | `feedback_summary` | — |
| `GET` | `/review-cycles` | `list_review_cycles` | — |
| `POST` | `/review-cycles` | `create_review_cycle` | — |
| `PUT` | `/review-cycles/{cycle_id}` | `update_review_cycle` | — |
| `POST` | `/review-cycles/{cycle_id}/launch` | `launch_review_cycle` | — |
| `PUT` | `/review-cycles/{cycle_id}/advance` | `advance_review_cycle` | — |
| `GET` | `/review-cycles/{cycle_id}/assignments` | `list_cycle_assignments` | — |
| `GET` | `/review-assignments/mine` | `my_review_assignments` | — |
| `PUT` | `/review-assignments/{assignment_id}` | `submit_review_assignment` | — |
| `GET` | `/review-assignments/{assignment_id}` | `get_review_assignment` | — |
| `GET` | `/employees/{employee_id}/idp` | `employee_idp` | — |

### `GET /goals`

**Function:** `list_goals` (line 225)

**Parameters:** `goal_type`, `owner_type`, `owner_id`, `status_filter`, `review_period`, `page`, `limit`

**Auth:** `current_user`


### `POST /goals`

**Function:** `create_goal` (line 272)

**Parameters:** `payload`

**Auth:** `current_user`


### `PUT /goals/{goal_id}`

**Function:** `update_goal` (line 285)

**Parameters:** `goal_id`, `payload`

**Auth:** `current_user`


### `DELETE /goals/{goal_id}`

**Function:** `delete_goal` (line 304)

**Parameters:** `goal_id`

**Auth:** `current_user`


### `GET /goals/tree`

**Function:** `goal_tree` (line 319)

**Auth:** `current_user`


### `GET /goals/dashboard`

**Function:** `goal_dashboard` (line 369)

**Auth:** `current_user`


### `GET /goals/{goal_id}`

**Function:** `get_goal` (line 443)

**Parameters:** `goal_id`

**Auth:** `current_user`


### `POST /goals/{goal_id}/updates`

**Function:** `create_goal_update` (line 468)

**Parameters:** `goal_id`, `payload`

**Auth:** `current_user`


### `GET /goals/{goal_id}/updates`

**Function:** `list_goal_updates` (line 508)

**Parameters:** `goal_id`, `page`, `limit`

**Auth:** `current_user`


### `GET /feedback`

**Function:** `list_feedback_received` (line 544)

**Parameters:** `page`, `limit`

**Auth:** `current_user`


### `POST /feedback`

**Function:** `create_feedback` (line 580)

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /feedback/given`

**Function:** `list_feedback_given` (line 616)

**Parameters:** `page`, `limit`

**Auth:** `current_user`


### `GET /feedback/summary/{employee_id}`

**Function:** `feedback_summary` (line 651)

**Parameters:** `employee_id`, `_admin`

**Auth:** `current_user`


### `GET /review-cycles`

**Function:** `list_review_cycles` (line 706)

**Parameters:** `status_filter`, `cycle_type`, `page`, `limit`

**Auth:** `current_user`


### `POST /review-cycles`

**Function:** `create_review_cycle` (line 748)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `PUT /review-cycles/{cycle_id}`

**Function:** `update_review_cycle` (line 765)

**Parameters:** `cycle_id`, `payload`, `_admin`

**Auth:** `current_user`


### `POST /review-cycles/{cycle_id}/launch`

**Function:** `launch_review_cycle` (line 788)

**Parameters:** `cycle_id`, `_admin`

**Auth:** `current_user`


### `PUT /review-cycles/{cycle_id}/advance`

**Function:** `advance_review_cycle` (line 912)

**Parameters:** `cycle_id`, `_admin`

**Auth:** `current_user`


### `GET /review-cycles/{cycle_id}/assignments`

**Function:** `list_cycle_assignments` (line 940)

**Parameters:** `cycle_id`, `review_type`, `status_filter`, `page`, `limit`

**Auth:** `current_user`


### `GET /review-assignments/mine`

**Function:** `my_review_assignments` (line 988)

**Parameters:** `page`, `limit`

**Auth:** `current_user`


### `PUT /review-assignments/{assignment_id}`

**Function:** `submit_review_assignment` (line 1031)

**Parameters:** `assignment_id`, `payload`

**Auth:** `current_user`


### `GET /review-assignments/{assignment_id}`

**Function:** `get_review_assignment` (line 1066)

**Parameters:** `assignment_id`

**Auth:** `current_user`


### `GET /employees/{employee_id}/idp`

**Function:** `employee_idp` (line 1086)

**Parameters:** `employee_id`

**Auth:** `current_user`


---

## hr_import.py

HR Bulk Import API — CSV/JSON imports for Rippling, BambooHR, HiBob, ADP formats.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `POST` | `/import/employees/csv` | `import_employees_csv` | — |
| `POST` | `/import/employees/json` | `import_employees_json` | — |
| `POST` | `/import/format/rippling` | `import_rippling` | — |
| `POST` | `/import/format/bamboohr` | `import_bamboohr` | — |
| `POST` | `/import/format/hibob` | `import_hibob` | — |
| `POST` | `/import/format/adp` | `import_adp` | — |
| `GET` | `/import/template/csv` | `download_csv_template` | — |

### `POST /import/employees/csv`

**Function:** `import_employees_csv` (line 208)

**Parameters:** `file`, `_admin`

**Auth:** `current_user`


### `POST /import/employees/json`

**Function:** `import_employees_json` (line 264)

**Parameters:** `file`, `_admin`

**Auth:** `current_user`


### `POST /import/format/rippling`

**Function:** `import_rippling` (line 324)

**Parameters:** `file`, `_admin`

**Auth:** `current_user`


### `POST /import/format/bamboohr`

**Function:** `import_bamboohr` (line 411)

**Parameters:** `file`, `_admin`

**Auth:** `current_user`


### `POST /import/format/hibob`

**Function:** `import_hibob` (line 493)

**Parameters:** `file`, `_admin`

**Auth:** `current_user`


### `POST /import/format/adp`

**Function:** `import_adp` (line 592)

**Parameters:** `file`, `_admin`

**Auth:** `current_user`


### `GET /import/template/csv`

**Function:** `download_csv_template` (line 702)

**Auth:** `current_user`


---

## hr_lms.py

HR LMS (Learning Management System) — Courses, Modules, Enrollments, Certifications.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/courses` | `list_courses` | List courses with optional filters. Paginated. |
| `POST` | `/courses` | `create_course` | Create a new LMS course (HR admin only). |
| `GET` | `/courses/recommended` | `recommended_courses` | Return published courses not yet enrolled in by the current user, ordered by ... |
| `GET` | `/courses/{course_id}` | `get_course` | Get course detail including modules and enrollment count. |
| `PUT` | `/courses/{course_id}` | `update_course` | Update a course (HR admin only). |
| `DELETE` | `/courses/{course_id}` | `delete_course` | Delete a course. Rejected if active enrollments exist. |
| `POST` | `/courses/{course_id}/publish` | `publish_course` | Publish a course (set is_published=True). |
| `GET` | `/courses/{course_id}/leaderboard` | `course_leaderboard` | Top 10 completers for a course ranked by quiz_score descending. |
| `GET` | `/courses/{course_id}/modules` | `list_course_modules` | List all modules for a course in order. |
| `POST` | `/courses/{course_id}/modules` | `create_course_module` | Add a module to a course (HR admin only). |
| `PUT` | `/courses/{course_id}/modules/{mod_id}` | `update_course_module` | Update a course module (HR admin only). |
| `DELETE` | `/courses/{course_id}/modules/{mod_id}` | `delete_course_module` | Delete a course module (HR admin only). |
| `GET` | `/enrollments` | `list_enrollments` | List enrollments. Admins see all; regular users see only their own. |
| `POST` | `/enrollments` | `create_enrollment` | Enroll an employee in a course. |
| `GET` | `/enrollments/{enr_id}` | `get_enrollment` | Get enrollment detail. |
| `PUT` | `/enrollments/{enr_id}/progress` | `update_enrollment_progress` | Update enrollment progress when a learner completes a module. |
| `GET` | `/employees/{emp_id}/learning-path` | `employee_learning_path` | Return all enrollments + recommended (unenrolled published) courses for an em... |
| `GET` | `/lms/dashboard` | `lms_dashboard` | LMS summary stats: total courses, enrolled employees, completions this month,... |
| `GET` | `/certifications` | `list_certifications` | List certifications with optional filters. Paginated. |
| `POST` | `/certifications` | `create_certification` | Create a certification record (HR admin only). Can be LMS-linked or manual. |
| `GET` | `/certifications/expiring` | `expiring_certifications` | List all certifications expiring within the next N days (default 30). |
| `GET` | `/certifications/{cert_id}` | `get_certification` | Get a single certification record. |
| `PUT` | `/certifications/{cert_id}` | `update_certification` | Update a certification (HR admin only). |
| `DELETE` | `/certifications/{cert_id}` | `delete_certification` | Delete a certification record (HR admin only). |

### `GET /courses`

**Function:** `list_courses` (line 232)

List courses with optional filters. Paginated.

**Parameters:** `category`, `level`, `is_mandatory`, `is_published`, `search`, `page`, `limit`

**Auth:** `current_user`


### `POST /courses`

**Function:** `create_course` (line 276)

Create a new LMS course (HR admin only).

**Parameters:** `body`, `_admin`

**Auth:** `current_user`


### `GET /courses/recommended`

**Function:** `recommended_courses` (line 304)

Return published courses not yet enrolled in by the current user, ordered by is_mandatory desc.

**Auth:** `current_user`


### `GET /courses/{course_id}`

**Function:** `get_course` (line 347)

Get course detail including modules and enrollment count.

**Parameters:** `course_id`

**Auth:** `current_user`


### `PUT /courses/{course_id}`

**Function:** `update_course` (line 378)

Update a course (HR admin only).

**Parameters:** `course_id`, `body`, `_admin`

**Auth:** `current_user`


### `DELETE /courses/{course_id}`

**Function:** `delete_course` (line 397)

Delete a course. Rejected if active enrollments exist.

**Parameters:** `course_id`, `_admin`

**Auth:** `current_user`


### `POST /courses/{course_id}/publish`

**Function:** `publish_course` (line 427)

Publish a course (set is_published=True).

**Parameters:** `course_id`, `_admin`

**Auth:** `current_user`


### `GET /courses/{course_id}/leaderboard`

**Function:** `course_leaderboard` (line 455)

Top 10 completers for a course ranked by quiz_score descending.

**Parameters:** `course_id`

**Auth:** `current_user`


### `GET /courses/{course_id}/modules`

**Function:** `list_course_modules` (line 496)

List all modules for a course in order.

**Parameters:** `course_id`

**Auth:** `current_user`


### `POST /courses/{course_id}/modules`

**Function:** `create_course_module` (line 514)

Add a module to a course (HR admin only).

**Parameters:** `course_id`, `body`, `_admin`

**Auth:** `current_user`


### `PUT /courses/{course_id}/modules/{mod_id}`

**Function:** `update_course_module` (line 542)

Update a course module (HR admin only).

**Parameters:** `course_id`, `mod_id`, `body`, `_admin`

**Auth:** `current_user`


### `DELETE /courses/{course_id}/modules/{mod_id}`

**Function:** `delete_course_module` (line 569)

Delete a course module (HR admin only).

**Parameters:** `course_id`, `mod_id`, `_admin`

**Auth:** `current_user`


### `GET /enrollments`

**Function:** `list_enrollments` (line 594)

List enrollments. Admins see all; regular users see only their own.

**Parameters:** `course_id`, `employee_id`, `enrollment_status`, `page`, `limit`

**Auth:** `current_user`


### `POST /enrollments`

**Function:** `create_enrollment` (line 637)

Enroll an employee in a course.

- Admins can specify any employee_id.
- Regular users enroll themselves (employee_id derived from their user record).

**Parameters:** `body`

**Auth:** `current_user`


### `GET /enrollments/{enr_id}`

**Function:** `get_enrollment` (line 711)

Get enrollment detail.

**Parameters:** `enr_id`

**Auth:** `current_user`


### `PUT /enrollments/{enr_id}/progress`

**Function:** `update_enrollment_progress` (line 729)

Update enrollment progress when a learner completes a module.

- Marks the module as completed.
- Recalculates progress_pct based on required modules.
- If quiz_answers provided and all required modules done, computes quiz_score.
- Sets status=completed or failed based on pass_score; publishes lms.course_completed.

**Parameters:** `enr_id`, `body`

**Auth:** `current_user`


### `GET /employees/{emp_id}/learning-path`

**Function:** `employee_learning_path` (line 857)

Return all enrollments + recommended (unenrolled published) courses for an employee.

**Parameters:** `emp_id`

**Auth:** `current_user`


### `GET /lms/dashboard`

**Function:** `lms_dashboard` (line 903)

LMS summary stats: total courses, enrolled employees, completions this month, etc.

**Parameters:** `_admin`

**Auth:** `current_user`


### `GET /certifications`

**Function:** `list_certifications` (line 975)

List certifications with optional filters. Paginated.

**Parameters:** `employee_id`, `expiring_soon`, `page`, `limit`

**Auth:** `current_user`


### `POST /certifications`

**Function:** `create_certification` (line 1016)

Create a certification record (HR admin only). Can be LMS-linked or manual.

**Parameters:** `body`, `_admin`

**Auth:** `current_user`


### `GET /certifications/expiring`

**Function:** `expiring_certifications` (line 1051)

List all certifications expiring within the next N days (default 30).

**Parameters:** `_admin`, `days`

**Auth:** `current_user`


### `GET /certifications/{cert_id}`

**Function:** `get_certification` (line 1082)

Get a single certification record.

**Parameters:** `cert_id`

**Auth:** `current_user`


### `PUT /certifications/{cert_id}`

**Function:** `update_certification` (line 1096)

Update a certification (HR admin only).

**Parameters:** `cert_id`, `body`, `_admin`

**Auth:** `current_user`


### `DELETE /certifications/{cert_id}`

**Function:** `delete_certification` (line 1126)

Delete a certification record (HR admin only).

**Parameters:** `cert_id`, `_admin`

**Auth:** `current_user`


---

## hr_manager_dashboard.py

HR Manager Dashboard API — team insights, delegation, and manager self-service.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/manager/team` | `get_team` | Get the current manager's direct reports with summary info. |
| `GET` | `/manager/team/performance` | `team_performance` | Aggregate performance stats for the manager's team. |
| `GET` | `/manager/team/leave` | `team_leave` | Show who is on leave today and upcoming leave requests. |
| `GET` | `/manager/team/attendance` | `team_attendance` | Show attendance status for the manager's team. |
| `GET` | `/manager/team/goals` | `team_goals` | Aggregate goal progress for the manager's team. |
| `GET` | `/manager/team/engagement` | `team_engagement` | Quick engagement snapshot based on feedback activity. |
| `POST` | `/manager/delegation` | `create_delegation` | Delegate approval authority to another team member. |
| `GET` | `/manager/delegation` | `list_delegations` | List active delegations for the current manager. |
| `DELETE` | `/manager/delegation/{delegation_id}` | `revoke_delegation` | Revoke an active delegation. |

### `GET /manager/team`

**Function:** `get_team` (line 96)

Get the current manager's direct reports with summary info.

**Auth:** `current_user`


### `GET /manager/team/performance`

**Function:** `team_performance` (line 124)

Aggregate performance stats for the manager's team.

**Parameters:** `period`

**Auth:** `current_user`


### `GET /manager/team/leave`

**Function:** `team_leave` (line 170)

Show who is on leave today and upcoming leave requests.

**Auth:** `current_user`


### `GET /manager/team/attendance`

**Function:** `team_attendance` (line 228)

Show attendance status for the manager's team.

**Parameters:** `target_date`

**Auth:** `current_user`


### `GET /manager/team/goals`

**Function:** `team_goals` (line 278)

Aggregate goal progress for the manager's team.

**Parameters:** `review_period`

**Auth:** `current_user`


### `GET /manager/team/engagement`

**Function:** `team_engagement` (line 315)

Quick engagement snapshot based on feedback activity.

**Auth:** `current_user`


### `POST /manager/delegation`

**Function:** `create_delegation` (line 357)

Delegate approval authority to another team member.
Note: Stored as metadata on the manager's employee record.

**Parameters:** `payload`

**Auth:** `current_user`


### `GET /manager/delegation`

**Function:** `list_delegations` (line 397)

List active delegations for the current manager.

**Auth:** `current_user`


### `DELETE /manager/delegation/{delegation_id}`

**Function:** `revoke_delegation` (line 413)

Revoke an active delegation.

**Parameters:** `delegation_id`

**Auth:** `current_user`


---

## hr_onboarding_ext.py

HR Enhanced Onboarding/Offboarding API — templates, tasks, buddy system, progress, exit.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/onboarding/templates` | `list_templates` | — |
| `POST` | `/onboarding/templates` | `create_template` | — |
| `GET` | `/onboarding/templates/{tmpl_id}` | `get_template` | — |
| `PUT` | `/onboarding/templates/{tmpl_id}` | `update_template` | — |
| `DELETE` | `/onboarding/templates/{tmpl_id}` | `delete_template` | — |
| `GET` | `/onboarding/tasks` | `list_tasks` | — |
| `POST` | `/onboarding/tasks` | `create_task` | — |
| `GET` | `/onboarding/employees/{emp_id}/tasks` | `get_employee_tasks` | — |
| `PUT` | `/onboarding/tasks/{task_id}/status` | `update_task_status` | — |
| `POST` | `/onboarding/employees/{emp_id}/start` | `start_onboarding` | — |
| `POST` | `/onboarding/employees/{emp_id}/offboard` | `start_offboarding` | — |
| `GET` | `/onboarding/buddies` | `list_buddies` | — |
| `POST` | `/onboarding/buddies` | `assign_buddy` | — |
| `DELETE` | `/onboarding/buddies/{buddy_id}` | `deactivate_buddy` | — |
| `GET` | `/onboarding/employees/{emp_id}/progress` | `get_employee_progress` | — |
| `GET` | `/onboarding/dashboard` | `onboarding_dashboard` | — |
| `POST` | `/onboarding/employees/{emp_id}/exit-interview` | `submit_exit_interview` | — |
| `GET` | `/onboarding/employees/{emp_id}/exit-interview` | `get_exit_interview` | — |

### `GET /onboarding/templates`

**Function:** `list_templates` (line 158)

**Parameters:** `template_type`, `department_id`, `is_active`, `skip`, `limit`

**Auth:** `current_user`


### `POST /onboarding/templates`

**Function:** `create_template` (line 197)

**Parameters:** `body`, `_admin`

**Auth:** `current_user`


### `GET /onboarding/templates/{tmpl_id}`

**Function:** `get_template` (line 236)

**Parameters:** `tmpl_id`

**Auth:** `current_user`


### `PUT /onboarding/templates/{tmpl_id}`

**Function:** `update_template` (line 254)

**Parameters:** `tmpl_id`, `body`, `_admin`

**Auth:** `current_user`


### `DELETE /onboarding/templates/{tmpl_id}`

**Function:** `delete_template` (line 281)

**Parameters:** `tmpl_id`, `_admin`

**Auth:** `current_user`


### `GET /onboarding/tasks`

**Function:** `list_tasks` (line 309)

**Parameters:** `employee_id`, `task_type`, `status_filter`, `skip`, `limit`

**Auth:** `current_user`


### `POST /onboarding/tasks`

**Function:** `create_task` (line 352)

**Parameters:** `body`, `_admin`

**Auth:** `current_user`


### `GET /onboarding/employees/{emp_id}/tasks`

**Function:** `get_employee_tasks` (line 385)

**Parameters:** `emp_id`, `task_type`

**Auth:** `current_user`


### `PUT /onboarding/tasks/{task_id}/status`

**Function:** `update_task_status` (line 414)

**Parameters:** `task_id`, `body`

**Auth:** `current_user`


### `POST /onboarding/employees/{emp_id}/start`

**Function:** `start_onboarding` (line 486)

**Parameters:** `emp_id`, `body`, `_admin`

**Auth:** `current_user`


### `POST /onboarding/employees/{emp_id}/offboard`

**Function:** `start_offboarding` (line 553)

**Parameters:** `emp_id`, `body`, `_admin`

**Auth:** `current_user`


### `GET /onboarding/buddies`

**Function:** `list_buddies` (line 658)

**Parameters:** `is_active`, `skip`, `limit`

**Auth:** `current_user`


### `POST /onboarding/buddies`

**Function:** `assign_buddy` (line 684)

**Parameters:** `body`, `_admin`

**Auth:** `current_user`


### `DELETE /onboarding/buddies/{buddy_id}`

**Function:** `deactivate_buddy` (line 734)

**Parameters:** `buddy_id`, `_admin`

**Auth:** `current_user`


### `GET /onboarding/employees/{emp_id}/progress`

**Function:** `get_employee_progress` (line 761)

**Parameters:** `emp_id`, `task_type`

**Auth:** `current_user`


### `GET /onboarding/dashboard`

**Function:** `onboarding_dashboard` (line 817)

**Parameters:** `_admin`

**Auth:** `current_user`


### `POST /onboarding/employees/{emp_id}/exit-interview`

**Function:** `submit_exit_interview` (line 899)

**Parameters:** `emp_id`, `body`, `_admin`

**Auth:** `current_user`


### `GET /onboarding/employees/{emp_id}/exit-interview`

**Function:** `get_exit_interview` (line 945)

**Parameters:** `emp_id`

**Auth:** `current_user`


---

## hr_people_analytics.py

HR People Analytics — Custom Dashboards, DEI, Predictive Reports, Cost Modeling.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/analytics/dashboards` | `list_dashboards` | List dashboards owned by the current user plus any shared dashboards. |
| `POST` | `/analytics/dashboards` | `create_dashboard` | Create a new analytics dashboard. |
| `GET` | `/analytics/dashboards/{dashboard_id}` | `get_dashboard` | Get a dashboard with its widget layout. |
| `PUT` | `/analytics/dashboards/{dashboard_id}` | `update_dashboard` | Update a dashboard (owner or admin only). |
| `DELETE` | `/analytics/dashboards/{dashboard_id}` | `delete_dashboard` | Delete a dashboard (owner or admin only). |
| `POST` | `/analytics/dashboards/{dashboard_id}/widgets` | `add_widget_to_dashboard` | Add a widget to a dashboard's layout. |
| `DELETE` | `/analytics/dashboards/{dashboard_id}/widgets/{widget_id}` | `remove_widget_from_dashboard` | Remove a widget from a dashboard's layout. |
| `GET` | `/analytics/dei/overview` | `dei_overview` | Org-wide DEI snapshot: gender distribution, department breakdown, leadership ... |
| `GET` | `/analytics/predictive/attrition-risk` | `predictive_attrition_risk` | List employees with elevated attrition risk based on latest FlightRiskScores. |
| `GET` | `/analytics/predictive/hiring-demand` | `predictive_hiring_demand` | Project next-quarter hiring demand based on growth scenarios and open requisi... |
| `GET` | `/analytics/cost/headcount` | `cost_headcount` | Headcount by department with salary totals and estimated benefit costs. |
| `GET` | `/analytics/cost/compensation-analysis` | `compensation_analysis` | Compare employee salaries against compensation bands for their job level. |
| `POST` | `/analytics/cost/scenario-model` | `cost_scenario_model` | Project total people cost under a headcount/salary growth scenario. |
| `GET` | `/analytics/export/headcount-report` | `export_headcount_report` | CSV export of headcount and salary cost data by department. |
| `GET` | `/analytics/export/dei-report` | `export_dei_report` | CSV export of DEI metrics: gender distribution by department. |

### `GET /analytics/dashboards`

**Function:** `list_dashboards` (line 105)

List dashboards owned by the current user plus any shared dashboards.

**Parameters:** `page`, `limit`

**Auth:** `current_user`


### `POST /analytics/dashboards`

**Function:** `create_dashboard` (line 142)

Create a new analytics dashboard.

**Parameters:** `body`

**Auth:** `current_user`


### `GET /analytics/dashboards/{dashboard_id}`

**Function:** `get_dashboard` (line 164)

Get a dashboard with its widget layout.

**Parameters:** `dashboard_id`

**Auth:** `current_user`


### `PUT /analytics/dashboards/{dashboard_id}`

**Function:** `update_dashboard` (line 184)

Update a dashboard (owner or admin only).

**Parameters:** `dashboard_id`, `body`

**Auth:** `current_user`


### `DELETE /analytics/dashboards/{dashboard_id}`

**Function:** `delete_dashboard` (line 210)

Delete a dashboard (owner or admin only).

**Parameters:** `dashboard_id`

**Auth:** `current_user`


### `POST /analytics/dashboards/{dashboard_id}/widgets`

**Function:** `add_widget_to_dashboard` (line 226)

Add a widget to a dashboard's layout.

**Parameters:** `dashboard_id`, `body`

**Auth:** `current_user`


### `DELETE /analytics/dashboards/{dashboard_id}/widgets/{widget_id}`

**Function:** `remove_widget_from_dashboard` (line 260)

Remove a widget from a dashboard's layout.

**Parameters:** `dashboard_id`, `widget_id`

**Auth:** `current_user`


### `GET /analytics/dei/overview`

**Function:** `dei_overview` (line 295)

Org-wide DEI snapshot: gender distribution, department breakdown, leadership diversity.

**Parameters:** `_admin`

**Auth:** `current_user`


### `GET /analytics/predictive/attrition-risk`

**Function:** `predictive_attrition_risk` (line 395)

List employees with elevated attrition risk based on latest FlightRiskScores.

**Parameters:** `_admin`, `risk_level`, `page`, `limit`

**Auth:** `current_user`


### `GET /analytics/predictive/hiring-demand`

**Function:** `predictive_hiring_demand` (line 465)

Project next-quarter hiring demand based on growth scenarios and open requisitions.

**Parameters:** `_admin`

**Auth:** `current_user`


### `GET /analytics/cost/headcount`

**Function:** `cost_headcount` (line 551)

Headcount by department with salary totals and estimated benefit costs.

**Parameters:** `_admin`

**Auth:** `current_user`


### `GET /analytics/cost/compensation-analysis`

**Function:** `compensation_analysis` (line 602)

Compare employee salaries against compensation bands for their job level.

**Parameters:** `_admin`

**Auth:** `current_user`


### `POST /analytics/cost/scenario-model`

**Function:** `cost_scenario_model` (line 678)

Project total people cost under a headcount/salary growth scenario.

**Parameters:** `body`, `_admin`

**Auth:** `current_user`


### `GET /analytics/export/headcount-report`

**Function:** `export_headcount_report` (line 759)

CSV export of headcount and salary cost data by department.

**Parameters:** `_admin`

**Auth:** `current_user`


### `GET /analytics/export/dei-report`

**Function:** `export_dei_report` (line 807)

CSV export of DEI metrics: gender distribution by department.

**Parameters:** `_admin`

**Auth:** `current_user`


---

## hr_scheduling.py

HR Scheduling API — shift templates, assignments, holiday calendar, overtime alerts.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/shifts/templates` | `list_shift_templates` | List all active shift templates. |
| `POST` | `/shifts/templates` | `create_shift_template` | Create a new shift template (admin). |
| `PUT` | `/shifts/templates/{template_id}` | `update_shift_template` | Update an existing shift template (admin). |
| `DELETE` | `/shifts/templates/{template_id}` | `delete_shift_template` | Soft-delete a shift template (admin). |
| `GET` | `/shifts/assignments` | `list_shift_assignments` | List shift assignments with filters and pagination. |
| `POST` | `/shifts/assignments` | `create_shift_assignment` | Assign a single shift to an employee (admin). |
| `POST` | `/shifts/assignments/bulk` | `bulk_create_shift_assignments` | Bulk-assign shifts for a rotation period (admin). |
| `PUT` | `/shifts/assignments/{assignment_id}` | `update_shift_assignment` | Update a shift assignment (admin). |
| `POST` | `/shifts/assignments/{assignment_id}/swap` | `swap_shift_assignment` | Request a shift swap with another employee. |
| `GET` | `/shifts/calendar` | `shift_calendar` | Calendar view of shift assignments grouped by date with employee info. |
| `GET` | `/holidays` | `list_holidays` | List holidays, optionally filtered by country and year. |
| `POST` | `/holidays` | `create_holiday` | Create a holiday entry (admin). |
| `PUT` | `/holidays/{holiday_id}` | `update_holiday` | Update a holiday entry (admin). |
| `DELETE` | `/holidays/{holiday_id}` | `delete_holiday` | Delete a holiday entry (admin). |
| `GET` | `/overtime/alerts` | `overtime_alerts` | Employees approaching or exceeding overtime threshold in recent period. |

### `GET /shifts/templates`

**Function:** `list_shift_templates` (line 177)

List all active shift templates.

**Auth:** `user`


### `POST /shifts/templates`

**Function:** `create_shift_template` (line 194)

Create a new shift template (admin).

**Parameters:** `payload`

**Response model:** `ShiftTemplateOut`

**Auth:** `user`


### `PUT /shifts/templates/{template_id}`

**Function:** `update_shift_template` (line 212)

Update an existing shift template (admin).

**Parameters:** `template_id`, `payload`

**Response model:** `ShiftTemplateOut`

**Auth:** `user`


### `DELETE /shifts/templates/{template_id}`

**Function:** `delete_shift_template` (line 239)

Soft-delete a shift template (admin).

**Parameters:** `template_id`

**Auth:** `user`


### `GET /shifts/assignments`

**Function:** `list_shift_assignments` (line 260)

List shift assignments with filters and pagination.

**Parameters:** `employee_id`, `start_date`, `end_date`, `shift_status`, `page`, `limit`

**Auth:** `user`


### `POST /shifts/assignments`

**Function:** `create_shift_assignment` (line 312)

Assign a single shift to an employee (admin).

**Parameters:** `payload`

**Response model:** `ShiftAssignmentOut`

**Auth:** `user`


### `POST /shifts/assignments/bulk`

**Function:** `bulk_create_shift_assignments` (line 359)

Bulk-assign shifts for a rotation period (admin).

**Parameters:** `payload`

**Auth:** `user`


### `PUT /shifts/assignments/{assignment_id}`

**Function:** `update_shift_assignment` (line 410)

Update a shift assignment (admin).

**Parameters:** `assignment_id`, `payload`

**Response model:** `ShiftAssignmentOut`

**Auth:** `user`


### `POST /shifts/assignments/{assignment_id}/swap`

**Function:** `swap_shift_assignment` (line 436)

Request a shift swap with another employee.

**Parameters:** `assignment_id`, `payload`

**Response model:** `ShiftAssignmentOut`

**Auth:** `user`


### `GET /shifts/calendar`

**Function:** `shift_calendar` (line 470)

Calendar view of shift assignments grouped by date with employee info.

**Parameters:** `start_date`, `end_date`, `department_id`

**Auth:** `user`


### `GET /holidays`

**Function:** `list_holidays` (line 511)

List holidays, optionally filtered by country and year.

**Parameters:** `country_code`, `year`, `page`, `limit`

**Auth:** `user`


### `POST /holidays`

**Function:** `create_holiday` (line 560)

Create a holiday entry (admin).

**Parameters:** `payload`

**Response model:** `HolidayCalendarOut`

**Auth:** `user`


### `PUT /holidays/{holiday_id}`

**Function:** `update_holiday` (line 578)

Update a holiday entry (admin).

**Parameters:** `holiday_id`, `payload`

**Response model:** `HolidayCalendarOut`

**Auth:** `user`


### `DELETE /holidays/{holiday_id}`

**Function:** `delete_holiday` (line 605)

Delete a holiday entry (admin).

**Parameters:** `holiday_id`

**Auth:** `user`


### `GET /overtime/alerts`

**Function:** `overtime_alerts` (line 626)

Employees approaching or exceeding overtime threshold in recent period.

**Parameters:** `threshold_hours`, `period_days`

**Auth:** `user`


---

## hr_skills.py

HR Skills, Succession Plans, Employee Timeline & Document Versions API.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/employees/{employee_id}/skills` | `list_employee_skills` | List all skills for an employee. |
| `POST` | `/employees/{employee_id}/skills` | `add_employee_skill` | Add a skill to an employee (admin or self). |
| `PUT` | `/employees/{employee_id}/skills/{skill_id}` | `update_employee_skill` | Update a skill for an employee. |
| `DELETE` | `/employees/{employee_id}/skills/{skill_id}` | `delete_employee_skill` | Remove a skill from an employee. |
| `GET` | `/skills/matrix` | `skills_matrix` | Org-wide skills matrix — aggregated skill data. |
| `GET` | `/skills/gap-analysis/{department_id}` | `skills_gap_analysis` | Skills gap analysis for a department. |
| `GET` | `/succession-plans` | `list_succession_plans` | List all succession plans (admin only). |
| `POST` | `/succession-plans` | `create_succession_plan` | Create a succession plan (admin only). |
| `PUT` | `/succession-plans/{plan_id}` | `update_succession_plan` | Update a succession plan (admin only). |
| `DELETE` | `/succession-plans/{plan_id}` | `delete_succession_plan` | Delete a succession plan (admin only). |
| `GET` | `/employees/{employee_id}/timeline` | `employee_timeline` | Paginated activity log for an employee. |
| `GET` | `/employees/{employee_id}/documents/{doc_id}/versions` | `list_document_versions` | List all versions for an employee document. |
| `POST` | `/employees/{employee_id}/documents/{doc_id}/versions` | `create_document_version` | Upload a new version for an employee document (auto-increment version_number). |

### `GET /employees/{employee_id}/skills`

**Function:** `list_employee_skills` (line 160)

List all skills for an employee.

**Parameters:** `employee_id`

**Auth:** `current_user`


### `POST /employees/{employee_id}/skills`

**Function:** `add_employee_skill` (line 176)

Add a skill to an employee (admin or self).

**Parameters:** `employee_id`, `body`

**Auth:** `current_user`


### `PUT /employees/{employee_id}/skills/{skill_id}`

**Function:** `update_employee_skill` (line 216)

Update a skill for an employee.

**Parameters:** `employee_id`, `skill_id`, `body`

**Auth:** `current_user`


### `DELETE /employees/{employee_id}/skills/{skill_id}`

**Function:** `delete_employee_skill` (line 243)

Remove a skill from an employee.

**Parameters:** `employee_id`, `skill_id`

**Auth:** `current_user`


### `GET /skills/matrix`

**Function:** `skills_matrix` (line 267)

Org-wide skills matrix — aggregated skill data.

**Parameters:** `department_id`, `category`, `skill_name`

**Auth:** `current_user`


### `GET /skills/gap-analysis/{department_id}`

**Function:** `skills_gap_analysis` (line 312)

Skills gap analysis for a department.

Compares current skills distribution in the department vs the org-wide
average to identify gaps.

**Parameters:** `department_id`

**Auth:** `current_user`


### `GET /succession-plans`

**Function:** `list_succession_plans` (line 401)

List all succession plans (admin only).

**Parameters:** `_admin`, `department_id`, `priority`, `readiness`, `page`, `limit`

**Auth:** `current_user`


### `POST /succession-plans`

**Function:** `create_succession_plan` (line 440)

Create a succession plan (admin only).

**Parameters:** `body`, `_admin`

**Auth:** `current_user`


### `PUT /succession-plans/{plan_id}`

**Function:** `update_succession_plan` (line 464)

Update a succession plan (admin only).

**Parameters:** `plan_id`, `body`, `_admin`

**Auth:** `current_user`


### `DELETE /succession-plans/{plan_id}`

**Function:** `delete_succession_plan` (line 489)

Delete a succession plan (admin only).

**Parameters:** `plan_id`, `_admin`

**Auth:** `current_user`


### `GET /employees/{employee_id}/timeline`

**Function:** `employee_timeline` (line 511)

Paginated activity log for an employee.

**Parameters:** `employee_id`, `activity_type`, `source_module`, `page`, `limit`

**Auth:** `current_user`


### `GET /employees/{employee_id}/documents/{doc_id}/versions`

**Function:** `list_document_versions` (line 550)

List all versions for an employee document.

**Parameters:** `employee_id`, `doc_id`

**Auth:** `current_user`


### `POST /employees/{employee_id}/documents/{doc_id}/versions`

**Function:** `create_document_version` (line 580)

Upload a new version for an employee document (auto-increment version_number).

**Parameters:** `employee_id`, `doc_id`, `body`

**Auth:** `current_user`


---

## hr_workflows.py

HR Workflow Automation — visual workflow builder, executor, approvals.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/workflows` | `list_workflows` | List workflows with optional filters. |
| `POST` | `/workflows` | `create_workflow` | Create a new workflow. |
| `GET` | `/workflows/{workflow_id}` | `get_workflow` | Get workflow detail with execution stats. |
| `PUT` | `/workflows/{workflow_id}` | `update_workflow` | Update workflow — only if no active executions. |
| `DELETE` | `/workflows/{workflow_id}` | `delete_workflow` | Delete workflow — only if no executions exist. |
| `PATCH` | `/workflows/{workflow_id}/toggle` | `toggle_workflow` | Toggle is_active on a workflow. |
| `POST` | `/workflows/{workflow_id}/trigger` | `trigger_workflow` | Manually trigger a workflow execution. |
| `GET` | `/workflows/executions` | `list_executions` | List all workflow executions. |
| `GET` | `/workflows/executions/{execution_id}` | `get_execution` | Get execution detail. |
| `GET` | `/workflows/approvals/pending` | `list_pending_approvals` | List pending approvals for the current user. |
| `POST` | `/workflows/approvals/{approval_id}/decide` | `decide_approval` | Approve or reject a pending workflow approval step. |
| `GET` | `/workflows/templates` | `list_templates` | List workflow templates. |
| `POST` | `/workflows/templates/{template_id}/instantiate` | `instantiate_template` | Create a new workflow from a template. |
| `GET` | `/workflows/templates/library` | `get_template_library` | Return a hardcoded library of common HR workflow templates. |
| `GET` | `/workflows/analytics/summary` | `workflow_analytics_summary` | Workflow analytics summary. |

### `GET /workflows`

**Function:** `list_workflows` (line 135)

List workflows with optional filters.

**Parameters:** `is_active`, `category`, `is_template`, `page`, `limit`

**Auth:** `current_user`


### `POST /workflows`

**Function:** `create_workflow` (line 175)

Create a new workflow.

**Parameters:** `body`, `_admin`

**Auth:** `current_user`


### `GET /workflows/{workflow_id}`

**Function:** `get_workflow` (line 202)

Get workflow detail with execution stats.

**Parameters:** `workflow_id`

**Auth:** `current_user`


### `PUT /workflows/{workflow_id}`

**Function:** `update_workflow` (line 224)

Update workflow — only if no active executions.

**Parameters:** `workflow_id`, `body`, `_admin`

**Auth:** `current_user`


### `DELETE /workflows/{workflow_id}`

**Function:** `delete_workflow` (line 256)

Delete workflow — only if no executions exist.

**Parameters:** `workflow_id`, `_admin`

**Auth:** `current_user`


### `PATCH /workflows/{workflow_id}/toggle`

**Function:** `toggle_workflow` (line 281)

Toggle is_active on a workflow.

**Parameters:** `workflow_id`, `_admin`

**Auth:** `current_user`


### `POST /workflows/{workflow_id}/trigger`

**Function:** `trigger_workflow` (line 305)

Manually trigger a workflow execution.

**Parameters:** `workflow_id`, `body`

**Auth:** `current_user`


### `GET /workflows/executions`

**Function:** `list_executions` (line 361)

List all workflow executions.

**Parameters:** `workflow_id`, `exec_status`, `page`, `limit`

**Auth:** `current_user`


### `GET /workflows/executions/{execution_id}`

**Function:** `get_execution` (line 401)

Get execution detail.

**Parameters:** `execution_id`

**Auth:** `current_user`


### `GET /workflows/approvals/pending`

**Function:** `list_pending_approvals` (line 434)

List pending approvals for the current user.

**Auth:** `current_user`


### `POST /workflows/approvals/{approval_id}/decide`

**Function:** `decide_approval` (line 481)

Approve or reject a pending workflow approval step.

**Parameters:** `approval_id`, `body`

**Auth:** `current_user`


### `GET /workflows/templates`

**Function:** `list_templates` (line 553)

List workflow templates.

**Parameters:** `page`, `limit`

**Auth:** `current_user`


### `POST /workflows/templates/{template_id}/instantiate`

**Function:** `instantiate_template` (line 573)

Create a new workflow from a template.

**Parameters:** `template_id`, `body`

**Auth:** `current_user`


### `GET /workflows/templates/library`

**Function:** `get_template_library` (line 607)

Return a hardcoded library of common HR workflow templates.

**Auth:** `current_user`


### `GET /workflows/analytics/summary`

**Function:** `workflow_analytics_summary` (line 769)

Workflow analytics summary.

**Auth:** `current_user`


---

## payroll_ext.py

Payroll Extensions API — Tax Brackets, Statutory Deductions, Pay Runs.


| Method | Path | Function | Description |
|--------|------|----------|-------------|
| `GET` | `/tax-brackets` | `list_tax_brackets` | — |
| `POST` | `/tax-brackets` | `create_tax_bracket` | — |
| `PUT` | `/tax-brackets/{bracket_id}` | `update_tax_bracket` | — |
| `DELETE` | `/tax-brackets/{bracket_id}` | `delete_tax_bracket` | — |
| `GET` | `/statutory-deductions` | `list_statutory_deductions` | — |
| `POST` | `/statutory-deductions` | `create_statutory_deduction` | — |
| `PUT` | `/statutory-deductions/{deduction_id}` | `update_statutory_deduction` | — |
| `DELETE` | `/statutory-deductions/{deduction_id}` | `delete_statutory_deduction` | — |
| `POST` | `/pay-runs/generate` | `generate_pay_run` | — |
| `GET` | `/pay-runs` | `list_pay_runs` | — |
| `GET` | `/pay-runs/{pay_run_id}` | `get_pay_run` | — |
| `PUT` | `/pay-runs/{pay_run_id}/approve` | `approve_pay_run` | — |
| `PUT` | `/pay-runs/{pay_run_id}/process` | `process_pay_run` | — |

### `GET /tax-brackets`

**Function:** `list_tax_brackets` (line 105)

**Parameters:** `country_code`

**Auth:** `current_user`


### `POST /tax-brackets`

**Function:** `create_tax_bracket` (line 122)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `PUT /tax-brackets/{bracket_id}`

**Function:** `update_tax_bracket` (line 143)

**Parameters:** `bracket_id`, `payload`, `_admin`

**Auth:** `current_user`


### `DELETE /tax-brackets/{bracket_id}`

**Function:** `delete_tax_bracket` (line 161)

**Parameters:** `bracket_id`, `_admin`

**Auth:** `current_user`


### `GET /statutory-deductions`

**Function:** `list_statutory_deductions` (line 178)

**Parameters:** `country_code`, `is_active`

**Auth:** `current_user`


### `POST /statutory-deductions`

**Function:** `create_statutory_deduction` (line 198)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `PUT /statutory-deductions/{deduction_id}`

**Function:** `update_statutory_deduction` (line 219)

**Parameters:** `deduction_id`, `payload`, `_admin`

**Auth:** `current_user`


### `DELETE /statutory-deductions/{deduction_id}`

**Function:** `delete_statutory_deduction` (line 237)

**Parameters:** `deduction_id`, `_admin`

**Auth:** `current_user`


### `POST /pay-runs/generate`

**Function:** `generate_pay_run` (line 254)

**Parameters:** `payload`, `_admin`

**Auth:** `current_user`


### `GET /pay-runs`

**Function:** `list_pay_runs` (line 375)

**Parameters:** `status_filter`

**Auth:** `current_user`


### `GET /pay-runs/{pay_run_id}`

**Function:** `get_pay_run` (line 392)

**Parameters:** `pay_run_id`

**Auth:** `current_user`


### `PUT /pay-runs/{pay_run_id}/approve`

**Function:** `approve_pay_run` (line 428)

**Parameters:** `pay_run_id`, `_admin`

**Auth:** `current_user`


### `PUT /pay-runs/{pay_run_id}/process`

**Function:** `process_pay_run` (line 471)

**Parameters:** `pay_run_id`, `_admin`

**Auth:** `current_user`


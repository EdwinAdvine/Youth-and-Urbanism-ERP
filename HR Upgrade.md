Ready for review
Select text to add comments on the plan
HR Module Mega-Upgrade Plan
Context
The Urban ERP HR module already has solid infrastructure — 14 models, ~96 endpoints, 21 frontend pages. This upgrade transforms it from a basic HRIS into an enterprise-grade HR platform combining Rippling's automation, Workday's AI intelligence, and HiBob's employee experience. The upgrade adds 40 new models, ~235 endpoints, and 47 frontend pages across 3 phases.

PHASE 1 — Extend Existing Code (Highest Value)
Skills, Compensation, Scheduling, Goals/OKR, Manager Dashboard, Audit

New Models (18) → backend/app/models/hr_phase1.py
Model	Table	Key Fields
EmployeeSkill	hr_employee_skills	employee_id, skill_name, category, proficiency_level (1-5), years_experience, verified_by
EmployeeSuccessionPlan	hr_succession_plans	position_title, department_id, current_holder_id, successor_id, readiness, priority
EmployeeActivityLog	hr_employee_activity_log	employee_id, activity_type, title, source_module, source_id, occurred_at
DocumentVersion	hr_document_versions	document_id, version_number, file_id, file_name, change_notes, uploaded_by
CompensationBand	hr_compensation_bands	job_level, job_family, currency, min/mid/max_salary, country_code, effective_from
MeritBudgetPool	hr_merit_budget_pools	name, department_id, fiscal_year, total_budget, allocated_amount, status
MeritIncrease	hr_merit_increases	employee_id, review_id, current/proposed_salary, increase_percentage, type, status
Bonus	hr_bonuses	employee_id, bonus_type, amount, reason, review_id, status (proposed→approved→paid)
EquityGrant	hr_equity_grants	employee_id, grant_type (option/rsu/espp), shares, strike_price, vesting_schedule (JSON)
ShiftTemplate	hr_shift_templates	name, start_time, end_time, break_duration, is_overnight, color
ShiftAssignment	hr_shift_assignments	employee_id, shift_template_id, assignment_date, status, swap_with_id
HolidayCalendar	hr_holiday_calendars	name, country_code, holiday_date, is_recurring, is_half_day
Goal	hr_goals	title, goal_type (company/team/individual), owner_id, parent_id, target/current_value, status
GoalUpdate	hr_goal_updates	goal_id, previous_value, new_value, comment, updated_by
ContinuousFeedback	hr_continuous_feedback	from/to_employee_id, feedback_type, content, is_anonymous, visibility
ReviewCycle	hr_review_cycles	name, cycle_type (annual/360), deadlines per review type, status, department_ids
ReviewAssignment	hr_review_assignments	cycle_id, reviewee_id, reviewer_id, review_type (self/peer/manager), rating, status
AuditFieldChange	hr_audit_field_changes	table_name, record_id, field_name, old/new_value, changed_by, ip_address
New Backend Routers (6) → ~85 endpoints
backend/app/api/v1/hr_skills.py (~13 endpoints)

Employee skills CRUD, skills matrix, gap analysis, succession plans CRUD, employee timeline, document versions
backend/app/api/v1/hr_compensation.py (~22 endpoints)

Compensation bands CRUD + analysis, merit budget pools, merit increases (propose/approve/apply), bonuses (create/approve/pay), equity grants + vesting
backend/app/api/v1/hr_scheduling.py (~15 endpoints)

Shift templates CRUD, shift assignments + bulk + swap, shift calendar, holidays CRUD, overtime alerts
backend/app/api/v1/hr_goals.py (~23 endpoints)

Goals CRUD + OKR tree hierarchy, goal updates, continuous feedback (give/receive/summary), review cycles (create/launch/advance), review assignments (list/submit)
backend/app/api/v1/hr_audit.py (~3 endpoints)

Query field-level changes, record history, sensitive access log
backend/app/api/v1/hr_manager_dashboard.py (~9 endpoints)

Team overview, performance, leave, attendance, goals, delegation management
New Frontend Pages (14) → frontend/src/features/hr/
Page	Description
SkillsMatrixPage.tsx	Org-wide skills matrix with department filters
SuccessionPlanningPage.tsx	Succession plans CRUD with readiness indicators
CompensationBandsPage.tsx	Compensation bands management
MeritPlanningPage.tsx	Merit increases + budget pool tracking
BonusManagementPage.tsx	Bonus proposals and approval workflow
EquityGrantsPage.tsx	Stock options/RSU vesting tracker
ShiftSchedulingPage.tsx	Shift templates + calendar-based assignment
HolidayCalendarPage.tsx	Country-specific holiday management
GoalsPage.tsx	OKR tree view (company→team→individual)
FeedbackPage.tsx	Continuous peer feedback
ReviewCyclesPage.tsx	360° review cycle management
ManagerDashboardPage.tsx	Team insights for managers
AuditLogPage.tsx	HR field-level audit trail viewer
EmployeeTimeline.tsx	Activity timeline component (tab in EmployeeDetail)
Files to Modify
backend/app/api/v1/__init__.py — register 6 new routers
backend/app/models/hr.py — add relationships to Employee for new models
backend/app/main.py — add event handlers for activity log
frontend/src/App.tsx — add ~14 new lazy routes
frontend/src/features/hr/EmployeeDetail.tsx — add skills, timeline, compensation, goals tabs
frontend/src/features/hr/HRDashboard.tsx — add navigation to new pages
New API Client
frontend/src/api/hr_phase1.ts — TanStack Query hooks for all Phase 1 endpoints
Migration
backend/alembic/versions/xxx_hr_phase1_upgrade.py — 18 new tables
New Events
employee.skill_added, employee.salary_changed, bonus.approved, shift.assigned, goal.completed, review_cycle.launched, feedback.received
PHASE 2 — New Systems (ATS, Engagement, LMS)
Talent Acquisition, Enhanced Onboarding, Learning Management, Employee Engagement, Data Import

New Models (14) → backend/app/models/hr_phase2.py
Model	Table	Purpose
JobRequisition	hr_job_requisitions	Job postings with approval workflow, skills_required (JSON)
Candidate	hr_candidates	Candidate profiles with AI-extracted skills, resume storage
CandidateApplication	hr_candidate_applications	Pipeline stages (applied→screening→interview→offer→hired), AI match score
Interview	hr_interviews	Interview scheduling linked to Calendar + Jitsi meetings
OnboardingTemplate	hr_onboarding_templates	Reusable onboarding task templates by department
OnboardingTask	hr_onboarding_tasks	Individual onboarding/offboarding checklist items with assignees
BuddyAssignment	hr_buddy_assignments	New hire buddy matching
Course	hr_courses	LMS course catalog with categories, prerequisites, skills_taught
CourseModule	hr_course_modules	Course content (video/doc/quiz) with MinIO file storage
CourseEnrollment	hr_course_enrollments	Employee progress tracking, quiz scores, certificates
Certification	hr_certifications	Certification tracking with expiry reminders
Survey	hr_surveys	Survey builder with question types (Likert/NPS/open/multi-choice)
SurveyResponse	hr_survey_responses	Responses with AI sentiment scoring
Recognition	hr_recognitions	Shout-outs, badges, kudos with points
New Backend Routers (5) + Services (2) → ~90 endpoints
hr_ats.py (~25 endpoints) — Requisitions, candidates, applications, interviews, AI screening, pipeline viz, D&I analytics
hr_onboarding_ext.py (~18 endpoints) — Templates, tasks, buddies, provisioning, progress, offboarding, exit interviews, knowledge transfer
hr_lms.py (~24 endpoints) — Courses, modules, enrollments, quizzes, certifications, AI-recommended paths, leaderboard
hr_engagement.py (~16 endpoints) — Surveys, responses, sentiment analysis, eNPS, recognition CRUD, feed, leaderboard
hr_import.py (~7 endpoints) — CSV/JSON import for Rippling, BambooHR, HiBob, ADP formats
AI Services
backend/app/services/hr_ai_screening.py — Resume screening + skills matching via Ollama (Celery task)
backend/app/services/hr_sentiment.py — Survey sentiment analysis via Ollama
New Frontend Pages (20) in subdirectories
ATS (features/hr/ats/): RequisitionsPage, RequisitionDetail, CandidatesPage, CandidateDetail, PipelineBoard (Kanban), InterviewScheduler, ATSDashboard

LMS (features/hr/lms/): CourseCatalogPage, CourseDetailPage, CourseBuilderPage, LearningDashboard, CertificationsPage

Engagement (features/hr/engagement/): SurveyBuilderPage, SurveyResponsePage, SurveyResultsPage, RecognitionFeedPage, EngagementDashboard

Other: OnboardingTemplatesPage, OnboardingTrackerPage, ImportPage

Cross-Module Integrations
ATS → Calendar (interview scheduling), Meetings/Jitsi (video interviews), Mail (invitations/offers), ONLYOFFICE (offer letter templates)
Onboarding → Projects (knowledge transfer tasks)
LMS → MinIO (video streaming), Skills (course completion updates skills), Performance Reviews (completions feed reviews)
Engagement → Notifications (survey distribution, recognition alerts)
PHASE 3 — Advanced AI, Workflow Engine, Analytics
New Models (8) → backend/app/models/hr_phase3.py
Model	Table	Purpose
SkillOntology	hr_skill_ontology	Hierarchical skills taxonomy with aliases
FlightRiskScore	hr_flight_risk_scores	AI-calculated risk scores with factor breakdown
BurnoutIndicator	hr_burnout_indicators	Hours, leave patterns, sentiment → burnout risk
Workflow	hr_workflows	No-code workflow definitions (trigger + steps JSON)
WorkflowExecution	hr_workflow_executions	Running workflow instances with step results
WorkflowApproval	hr_workflow_approvals	Approval steps within workflows
AnalyticsDashboard	hr_analytics_dashboards	Custom dashboard layouts with widget configs
WorkforcePlanningScenario	hr_workforce_scenarios	What-if headcount/budget simulations
New Backend Routers (3) + Services (4) → ~60 endpoints
hr_ai_intelligence.py (~17 endpoints) — Skills ontology, flight risk, burnout detection, HR chatbot, AI suggested ratings, workforce simulations
hr_workflows.py (~15 endpoints) — Workflow CRUD, manual trigger, execution tracking, approval inbox, templates
hr_people_analytics.py (~15 endpoints) — Custom dashboards, DEI metrics, predictive reports, cost modeling, benchmarks, export
AI Services
hr_flight_risk.py — Tenure, satisfaction, market data → risk score via Ollama
hr_burnout.py — Hours, leave, consecutive days, sentiment → burnout risk
hr_skills_inference.py — Infer skills from project activity, CRM deals, training
hr_workflow_engine.py — Workflow step executor with condition evaluation
New Frontend Pages (13) in subdirectories
AI (features/hr/ai/): FlightRiskDashboard, BurnoutAlerts, SkillsOntologyPage, HRChatbot, WorkforcePlanningPage

Workflows (features/hr/workflows/): WorkflowBuilderPage (use reactflow library), WorkflowListPage, WorkflowExecutionPage, WorkflowApprovals

Analytics (features/hr/analytics/): CustomDashboardBuilder, DEIDashboard, PredictiveReports, CostModelingPage

6 New AI Tools for ai_tools.py
hr_flight_risk_check, hr_burnout_check, hr_skills_gap_report, hr_workforce_simulate, hr_suggest_rating, hr_policy_query
Totals
Metric	Phase 1	Phase 2	Phase 3	Grand Total
New Models	18	14	8	40
New Endpoints	~85	~90	~60	~235
New Frontend Pages	14	20	13	47
New Backend Files	8	10	10	28
New Frontend Files	16	23	16	55
Migrations	1	1	1	3
New Events	7	12	5	24
Total New Files	~30	~37	~30	~97
Post-upgrade totals: ~54 models, ~331 endpoints, ~68 frontend pages

Key Dependencies
Phase 1 first: Skills Matrix + Goals are prerequisites for Phase 2 LMS and Phase 3 AI
CompensationBands (P1) needed by ATS requisitions (P2)
Review Cycles + Feedback (P1) feed Phase 3 AI suggested ratings
Phase 2 surveys provide sentiment data for Phase 3 burnout detection
Technical Notes
Audit field tracking: use @event.listens_for(Session, "before_flush") SQLAlchemy pattern
AI resume screening (P2): must be Celery async task, not synchronous
Workflow builder (P3): use reactflow React library for visual drag-and-drop
Video streaming (P2 LMS): MinIO presigned URLs with range request support
Anonymous surveys (P2): store respondent_id but never expose in API responses when is_anonymous=True
Verification Plan
After each phase:

Run alembic upgrade head to apply migration
Run docker compose up -d --build to rebuild
Test each new endpoint via Swagger at http://localhost:8010/docs
Navigate frontend pages at http://localhost:3010/hr/*
Verify cross-module events fire correctly (check Calendar, Notifications)
Test AI features with Ollama running (http://localhost:11435)
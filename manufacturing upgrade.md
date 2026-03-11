Ready for review
Select text to add comments on the plan
Manufacturing Module Enterprise Upgrade Plan
Context
The existing Manufacturing module has 10 models, ~1950 lines of API, and 16 frontend pages covering basic BOM, Work Orders, Workstations, Quality Checks, Routing, Scrap, and Maintenance. This plan upgrades it to enterprise-grade by borrowing best features from SAP S/4HANA (compliance, scale), Epicor Kinetic (flexibility, shop-floor UX), and Siemens Opcenter (MES, AI execution). The upgrade adds ~20 new models, 7 new API files, ~25 new frontend pages, and deep cross-module integrations.

Phase 1: Core Enhancements (BOM, Work Order, Quality, Traceability)
1A. BOM Enhancements — ECOs, Phantom Items, Substitutions
Models (add to backend/app/models/manufacturing.py):

EngineeringChangeOrder (mfg_engineering_change_orders) — ECO number, BOM FK, status workflow (draft→submitted→under_review→approved→rejected→implemented), requested_by/approved_by user FKs, impact_analysis, reason
ECOApproval (mfg_eco_approvals) — ECO FK, approver FK, decision (pending/approved/rejected), sequence
MaterialSubstitution (mfg_material_substitutions) — BOMItem FK, substitute_item FK (→inventory_items), priority, conversion_factor, valid_from/until dates
Modifications:

BOMItem: add is_phantom (Boolean, default False)
BOMItem: add substitutions relationship → MaterialSubstitution
New API file: backend/app/api/v1/manufacturing_eco.py

POST/GET/PUT /manufacturing/eco — CRUD
POST /manufacturing/eco/{id}/submit — submit for approval
POST /manufacturing/eco/{id}/approve — approve/reject
POST /manufacturing/eco/{id}/implement — create new BOM version from ECO
GET /manufacturing/bom/{id}/versions — list all BOM versions
POST/GET/DELETE /manufacturing/bom-items/{id}/substitutions — manage substitutes
Events: eco.submitted, eco.approved, eco.implemented

Frontend (in frontend/src/features/manufacturing/):

ECOListPage.tsx — list with status filters
ECODetail.tsx — detail + approval workflow + before/after BOM comparison
ECOCreateDialog.tsx — create from BOM
MaterialSubstitutionsPanel.tsx — panel on BOMDetail
API client: frontend/src/api/manufacturing_eco.ts

1B. Work Order Enhancements — Variance, Backflush, Rework
Models:

WorkOrderVariance (mfg_wo_variances) — WO FK, variance_type (material/labor/time), planned/actual/variance values
ReworkOrder (mfg_rework_orders) — rework_number, parent WO FK, child WO FK, QC FK, reason, quantity, rework_cost
Modifications:

WorkOrder: add consumption_mode (String, default "manual" — manual/backflush)
WorkOrder: add parent_wo_id (FK mfg_work_orders.id, nullable)
WorkOrder: add total_overhead_cost (Numeric14,2, default 0)
New endpoints (add to existing manufacturing.py):

GET /manufacturing/work-orders/{id}/variance — calculate variance analysis
POST /manufacturing/work-orders/{id}/backflush — auto-consume materials on completion
POST /manufacturing/work-orders/{id}/rework — create rework order from failed QC
GET/GET /manufacturing/rework-orders — list/detail rework orders
Frontend:

VarianceAnalysis.tsx — tab on WorkOrderDetail: planned vs actual breakdown
ReworkOrdersPage.tsx — list and manage rework orders
1C. Quality Management — Inspection Plans, NCR, CAPA, SPC
Models:

InspectionPlan (mfg_inspection_plans) — plan_number, name, BOM FK (nullable), routing_step FK (nullable), version
InspectionPlanItem (mfg_inspection_plan_items) — plan FK, sequence, parameter_name, measurement_type, target/lower/upper limits, is_critical, sample_size
NonConformanceReport (mfg_non_conformance_reports) — ncr_number, WO FK, QC FK, item FK, supplier FK (→sc_suppliers), severity, status workflow, disposition (rework/scrap/use_as_is/return), root_cause, resolution
CAPA (mfg_capa) — capa_number, NCR FK, type (corrective/preventive), root_cause_analysis, corrective/preventive actions, status, due_date, effectiveness_verified
SPCDataPoint (mfg_spc_data_points) — inspection_plan_item FK, WO FK, measured_value, sample_number, is_out_of_control
New API file: backend/app/api/v1/manufacturing_quality.py

CRUD for inspection plans + items
CRUD for NCRs + resolve workflow
CRUD for CAPAs + verify endpoint
POST SPC data points + GET control chart data
GET supplier quality scorecard (links NCRs to SC supplier)
Events: ncr.created, capa.due_soon (Celery beat)

Frontend:

InspectionPlansPage.tsx, InspectionPlanDetail.tsx
NCRListPage.tsx, NCRDetail.tsx
CAPAListPage.tsx, CAPADetail.tsx
SPCChart.tsx — X-bar/R control charts (recharts)
SupplierQualityScorecard.tsx
API client: frontend/src/api/manufacturing_quality.ts

1D. Traceability & Genealogy
Models:

LotSerialTrack (mfg_lot_serial_tracks) — tracking_number, type (lot/serial), item FK, WO FK, parent_tracking FK (self-referential for genealogy), quantity, status, manufactured/expiry dates, supplier FK, GRN FK
TraceabilityEvent (mfg_traceability_events) — lot_serial FK, event_type (created/consumed/produced/inspected/shipped/recalled), WO FK, reference_type/id, timestamp
ElectronicBatchRecord (mfg_batch_records) — batch_number, WO FK, BOM FK, status, material_verification JSON, process_parameters JSON, quality_results JSON, electronic_signature, approved_by/at
New API file: backend/app/api/v1/manufacturing_trace.py

POST/GET lots, GET lot detail
GET forward/backward trace, GET genealogy tree
POST traceability events
CRUD batch records + approve endpoint
Frontend:

LotTrackingPage.tsx, LotDetail.tsx
TraceabilityView.tsx — forward/backward trace visualization
GenealogyTree.tsx — interactive parent-child tree
BatchRecordPage.tsx — view + approval
API client: frontend/src/api/manufacturing_trace.ts

Phase 1 Migration
Single Alembic migration: mfg_phase1_eco_quality_trace

13 new tables + 5 column additions to existing tables
Phase 2: Planning & Scheduling + Equipment + Labor
2A. Advanced Production Planning & Scheduling
Models:

ProductionScenario (mfg_production_scenarios) — name, status, parameters JSON, results JSON
CapacitySlot (mfg_capacity_slots) — workstation FK, date, shift, total/allocated minutes, WO FK, status
ScheduleEntry (mfg_schedule_entries) — WO FK, routing_step FK, workstation FK, scheduled/actual start/end, status, scenario FK
New API file: backend/app/api/v1/manufacturing_planning.py

POST finite capacity scheduling (runs scheduler algorithm)
GET Gantt data, PUT schedule entry (drag-drop)
GET workstation capacity, GET rough-cut capacity
CRUD scenarios + POST run scenario
New service: backend/app/services/mfg_scheduler.py

Priority-based forward scheduling with constraint propagation
Handles setup times, maintenance windows, shift boundaries
Frontend:

GanttScheduler.tsx — interactive drag-and-drop Gantt
CapacityDashboard.tsx — workstation utilization heatmap
RoughCutPlanning.tsx — demand vs capacity
ScenarioPlanner.tsx, ScenarioCompare.tsx
API client: frontend/src/api/manufacturing_planning.ts

2B. Equipment & Maintenance
Models:

AssetRegister (mfg_assets) — asset_code, workstation FK, type, manufacturer, serial, purchase_date/cost, warranty, status, total_operating_hours, specifications JSON
DowntimeRecord (mfg_downtime_records) — workstation FK, asset FK, WO FK, downtime_type (planned/unplanned/changeover), category, start/end time, root_cause, resolution
MaintenanceWorkOrder (mfg_maintenance_work_orders) — mwo_number, asset FK, schedule FK, maintenance_type, trigger_type/value, status, parts_used JSON, labor/parts cost
Modifications:

MaintenanceSchedule: add trigger_type, trigger_threshold, asset_id
WorkStation: add current_status (running/idle/maintenance/breakdown)
New API file: backend/app/api/v1/manufacturing_equipment.py

CRUD assets + history, CRUD downtime + Pareto analysis
CRUD maintenance work orders + complete
GET enhanced OEE (availability/performance/quality breakdown)
Frontend:

AssetRegisterPage.tsx, AssetDetail.tsx
DowntimeTracker.tsx, DowntimeAnalysis.tsx (Pareto chart)
MaintenanceWorkOrdersPage.tsx
OEEDetailedReport.tsx
API client: frontend/src/api/manufacturing_equipment.ts

2C. Labor & Workforce
Models:

OperatorSkill (mfg_operator_skills) — employee FK (→hr_employees), skill_name, proficiency_level, certification_number, certified/expiry dates
CrewAssignment (mfg_crew_assignments) — WO FK, workstation FK, employee FK, shift, date, start/end time, role, hours_worked
Modifications:

RoutingStep: add required_skill, min_operators
New API file: backend/app/api/v1/manufacturing_labor.py

CRUD operator skills, GET skills matrix, GET expiring certifications
CRUD crew assignments, POST log hours, POST push timesheet → HR
Cross-module: mfg.timesheet.push event → creates HR attendance/overtime records

Frontend:

SkillsMatrixPage.tsx, CrewSchedulingPage.tsx, CertificationTracker.tsx
API client: frontend/src/api/manufacturing_labor.ts

Phase 2 Migration
Migration: mfg_phase2_planning_equipment_labor — 8 new tables + 6 column additions

Phase 3: MES + AI Intelligence + CPQ
3A. Shop Floor Execution / MES
Modifications:

RoutingStep: add work_instructions (Text), instruction_media (JSON), barcode_scan_required (Boolean)
Models:

IoTDataPoint (mfg_iot_data_points) — workstation FK, asset FK, metric_name, metric_value, unit, timestamp, WO FK, source
New endpoints (add to manufacturing_ext.py):

GET/PUT routing step instructions
POST barcode scan (resolve to WO/lot/item)
POST IoT data ingestion (bulk), GET IoT data by workstation
GET production board (all active WOs with live status)
WebSocket /manufacturing/ws/production-board — live updates
Frontend:

DigitalWorkInstructions.tsx, BarcodeScannerModal.tsx (html5-qrcode)
ProductionBoard.tsx — real-time board
IoTDashboard.tsx
3B. Manufacturing Intelligence & AI
New API file: backend/app/api/v1/manufacturing_ai.py

GET bottleneck analysis (SQL-based: WO queue times, workstation utilization)
GET quality risk prediction (SPC trends + NCR frequency analysis)
GET schedule optimization suggestions (rule-based recommendations)
GET executive summary (Ollama-powered NL summary of KPIs)
GET executive dashboard (drill-down with CRM deal + Project links)
New AI tools (add to backend/app/services/ai_tools.py):

mfg_get_production_status, mfg_analyze_quality_trends, mfg_check_material_availability, mfg_schedule_work_order, mfg_get_oee_summary
Frontend:

BottleneckAnalysis.tsx, QualityRiskDashboard.tsx
ScheduleSuggestions.tsx, ExecutiveSummary.tsx
API client: frontend/src/api/manufacturing_ai.ts

3C. CPQ Product Configurator
Models:

ConfiguratorRule (mfg_configurator_rules) — name, BOM FK, rule_type (include/exclude/substitute/quantity_adjust), condition JSON, action JSON, priority
ConfiguratorSession (mfg_configurator_sessions) — session_code, base_bom FK, selections JSON, computed_bom_items JSON, computed_cost, status, finalized_bom FK
New endpoints (add to manufacturing_ext.py):

POST start CPQ session, POST apply selection, GET session state, POST finalize → generate BOM
CRUD configurator rules
Frontend:

ProductConfigurator.tsx — interactive CPQ with live cost preview
ConfiguratorRulesAdmin.tsx
Phase 3 Migration
Migration: mfg_phase3_mes_ai_cpq — 3 new tables + 3 column additions

Files to Create/Modify
New Backend Files (7)
File	Phase
backend/app/api/v1/manufacturing_eco.py	1
backend/app/api/v1/manufacturing_quality.py	1
backend/app/api/v1/manufacturing_trace.py	1
backend/app/api/v1/manufacturing_planning.py	2
backend/app/api/v1/manufacturing_equipment.py	2
backend/app/api/v1/manufacturing_labor.py	2
backend/app/api/v1/manufacturing_ai.py	3
backend/app/services/mfg_scheduler.py	2
Modified Backend Files
File	Changes
backend/app/models/manufacturing.py	~20 new model classes, modify BOMItem/WorkOrder/RoutingStep/MaintenanceSchedule
backend/app/api/v1/__init__.py	Register 7 new routers under /manufacturing prefix
backend/app/api/v1/manufacturing.py	Add backflush/variance/rework endpoints
backend/app/api/v1/manufacturing_ext.py	Add MES/IoT/CPQ endpoints
backend/app/core/integration_handlers.py	Add ECO, NCR, CAPA, timesheet event handlers
backend/app/services/ai_tools.py	Add 5 manufacturing AI tools
backend/app/tasks/celery_app.py	Add CAPA due date checker beat task
New Frontend Files (~25 pages + 7 API clients)
All pages in frontend/src/features/manufacturing/, API clients in frontend/src/api/manufacturing_*.ts

Frontend Route Registration
Add ~15 new routes to frontend/src/App.tsx under /manufacturing/*

Cross-Module Integration Summary
From → To	Mechanism	Detail
Quality → Supply Chain	API query	Supplier quality scorecard queries NCRs + sc_supplier_ratings
Traceability → Supply Chain	FK	LotSerialTrack links to sc_goods_received_notes
ECO → BOM	Business logic	Implementing ECO creates new BOM version
Labor → HR	Event	mfg.timesheet.push creates HR attendance/overtime
AI → CRM/Projects	API query	Executive dashboard links WOs to deals/projects
WO → Finance	Event handler	wo.completed creates journal entry for production costs
Phase Dependencies
Phase 1A/1B/1C/1D (parallel within phase) → Phase 2A/2B/2C (mostly parallel) → Phase 3A/3B/3C
Phase 2A depends on 1B (consumption_mode)
Phase 2B depends on 1C (NCR for quality-based maintenance triggers)
Phase 3A depends on 2B (assets for IoT linking)
Phase 3B depends on 1C (SPC data) + 2B (downtime data)
Verification
Migration: docker compose exec backend alembic upgrade head — all tables created without errors
ECO workflow: Create ECO → submit → approve → implement → verify new BOM version exists
Quality flow: Create inspection plan → run QC → create NCR → create CAPA → verify → close
Traceability: Create lot → consume in WO → produce new lot → verify forward/backward trace
Scheduling: Create WOs with routing → run scheduler → verify Gantt data (non-overlapping)
OEE: Record downtime → verify OEE calculation (availability × performance × quality)
AI: Call bottleneck/quality-risk/executive-summary endpoints → verify reasonable output
CPQ: Start session → select options → verify BOM recalculation → finalize
Cross-module: Complete WO → verify Finance journal entry + HR timesheet created
Frontend: Navigate all new routes, verify data loads and forms submit correctly
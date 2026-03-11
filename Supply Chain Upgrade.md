Ready for review
Select text to add comments on the plan
Supply Chain Module Upgrade Plan
Context
The existing Supply Chain module has 12 models, 41 endpoints, and 16 frontend pages covering basic procurement (suppliers, requisitions, GRN, shipments, returns, quality inspections, ratings, contracts). This upgrade adds enterprise-grade demand planning, S&OP, control tower visibility, RFx procurement, inventory optimization, workflow automation, logistics, risk management, and AI agents — borrowing best practices from Oracle SCM, Blue Yonder, and Kinaxis.

MVP (Core) — Sprints 1-3
New Backend Model Files
Create /backend/app/models/supplychain_planning.py (~7 models)

Model	Table	Key Fields
DemandForecast	sc_demand_forecasts	item_id (FK inventory), warehouse_id, forecast_date, period_type, predicted_quantity, confidence_lower/upper, method, scenario_id, source_data (JSON), created_by
ForecastScenario	sc_forecast_scenarios	name, description, status, assumptions (JSON), created_by
DemandSignal	sc_demand_signals	signal_type, item_id, source_module, source_id, impact_quantity, impact_start/end_date, confidence, metadata_json
SalesOperationsPlan	sc_sop_plans	title, cycle_type, period_start/end, status (draft→approved), demand/supply_summary (JSON), approved_by, approved_at
SupplyPlan	sc_supply_plans	sop_id, forecast_scenario_id, status, plan_horizon_days → has SupplyPlanLines
SupplyPlanLine	sc_supply_plan_lines	plan_id, item_id, supplier_id, planned_order/delivery_date, planned_quantity, estimated_cost, status
CapacityPlan	sc_capacity_plans	sop_id, resource_type, resource_id, period_start/end, available/required_capacity, utilization_pct, constraints (JSON)
Create /backend/app/models/supplychain_ops.py (~14 models)

Model	Table	Purpose
ControlTowerAlert	sc_control_tower_alerts	Delay/stockout/quality/cost alerts with severity & assignment
SupplyChainKPI	sc_kpis	OTIF, lead times, inventory turns, fill rate per period
SupplyChainEvent	sc_events	Timestamped SC event log for timeline view
RFx	sc_rfx	RFQ/RFP/RFI with items, invited suppliers, deadline
RFxResponse	sc_rfx_responses	Supplier quotes with pricing, lead time, scoring
SupplierRisk	sc_supplier_risks	Financial/geopolitical/ESG risks per supplier
ReplenishmentRule	sc_replenishment_rules	Min/max, reorder point, auto-PO rules per item/warehouse
SafetyStockConfig	sc_safety_stock_configs	Static or dynamic safety stock with service level targets
StockHealthScore	sc_stock_health_scores	Slow-moving/obsolete/overstock classification per item
WorkflowTemplate	sc_workflow_templates	Trigger event → ordered steps (JSON) for cross-app automation
WorkflowRun	sc_workflow_runs	Execution instance of a template
WorkflowStep	sc_workflow_steps	Individual step status within a run
ComplianceRecord	sc_compliance_records	Regulatory/ISO/customs compliance per entity
ESGMetric	sc_esg_metrics	Carbon/water/waste/labor metrics per supplier/period
New Backend API Routes
Create /backend/app/api/v1/supplychain_planning.py — prefix /supply-chain/ (~22 endpoints)

Demand: GET/POST /forecasts, POST /forecasts/generate, POST /forecasts/what-if, GET/POST /forecast-scenarios, GET/POST /demand-signals
S&OP: GET/POST /sop-plans, GET/PUT /sop-plans/{id}, POST /sop-plans/{id}/approve
Supply Plans: GET /supply-plans, POST /supply-plans/generate, GET /supply-plans/{id}, PUT /supply-plans/{id}/lines/{line_id}, POST /supply-plans/{id}/execute
Capacity: GET/POST /capacity-plans
Create /backend/app/api/v1/supplychain_ops.py — prefix /supply-chain/ (~48 endpoints)

Control Tower: GET /control-tower/dashboard, GET/POST/PUT /control-tower/alerts, GET/POST /control-tower/kpis, GET /control-tower/events, GET /control-tower/health
RFx: GET/POST /rfx, GET/PUT /rfx/{id}, POST /rfx/{id}/publish|close|award, GET/POST /rfx/{id}/responses, PUT /rfx/{id}/responses/{rid}/score
Supplier Risk: GET/POST /supplier-risks
Replenishment: GET/POST/PUT/DELETE /replenishment-rules, POST /replenishment-rules/check
Safety Stock: GET /safety-stock, POST /safety-stock/calculate, PUT /safety-stock/{id}
Stock Health: GET /stock-health, POST /stock-health/analyze
Workflows: GET/POST/PUT/DELETE /workflows/templates, GET /workflows/runs, GET /workflows/runs/{id}, POST /workflows/trigger, POST /workflows/runs/{id}/cancel
Compliance: GET/POST/PUT /compliance, GET/POST /esg-metrics, GET /esg-metrics/summary
Analytics: GET /analytics/cost-to-serve|carbon-footprint|risk-heatmap|ai-summary
Modify /backend/app/api/v1/__init__.py — register 2 new routers

Event Handlers & Celery Tasks
Modify /backend/app/core/integration_handlers.py — 9 new handlers:

supplychain.forecast.generated, supplychain.sop.approved, supplychain.supply_plan.executed
supplychain.rfx.published, supplychain.rfx.awarded, supplychain.alert.created
supplychain.replenishment.triggered, inventory.stock_below_reorder, crm.deal.won (demand signal)
Modify /backend/app/tasks/celery_app.py — 6 new periodic tasks:

sc_calculate_kpis (daily), sc_stock_health_analysis (daily), sc_replenishment_check (every 4h)
sc_safety_stock_recalc (weekly), sc_demand_forecast_refresh (daily), sc_contract_expiry_check (daily)
Alembic Migration (MVP)
Create n4h5i6j7k8l9_sc_planning_and_ops_models.py — 21 new tables with indexes on FKs, status, and date columns.

Frontend — API Clients
Create /frontend/src/api/supplychain_planning.ts — types + TanStack Query hooks for demand/S&OP/supply plan models Create /frontend/src/api/supplychain_ops.ts — types + hooks for control tower, RFx, replenishment, workflows, compliance, ESG

Frontend — 17 New Pages
All under /frontend/src/features/supplychain/:

Page	Route	Description
DemandForecastPage	/supply-chain/demand-forecasts	List forecasts, generate, filter by item/scenario
ForecastScenariosPage	/supply-chain/forecast-scenarios	What-if scenario modeling
SOPPlanPage	/supply-chain/sop	S&OP cycle list + create
SOPPlanDetail	/supply-chain/sop/:id	Demand vs supply view, capacity charts
SupplyPlanPage	/supply-chain/supply-plans	List supply plans, generate from forecast
SupplyPlanDetail	/supply-chain/supply-plans/:id	Plan lines, execute → POs
ControlTowerDashboard	/supply-chain/control-tower	Real-time KPIs, alert feed, health gauge
AlertsPage	/supply-chain/alerts	Alert list with severity/status filters
RFxPage	/supply-chain/rfx	RFQ/RFP list, create, publish
RFxDetail	/supply-chain/rfx/:id	Responses, scoring, award
SupplierRiskPage	/supply-chain/supplier-risks	Risk matrix by supplier
ReplenishmentRulesPage	/supply-chain/replenishment	Rule CRUD, trigger check
StockHealthPage	/supply-chain/stock-health	Slow-moving/obsolete dashboard
WorkflowsPage	/supply-chain/workflows	Template CRUD, run history
WorkflowRunDetail	/supply-chain/workflows/:id	Step-by-step execution view
CompliancePage	/supply-chain/compliance	Compliance + ESG metrics
SCAnalyticsPage	/supply-chain/analytics	Cost-to-serve, carbon, risk heatmap
Modify App.tsx (17 new lazy routes), Sidebar.tsx (9 new nav items under Supply Chain)

AI Tools
Modify /backend/app/services/ai_tools.py — 12 new tools:

auto_approve: get_demand_forecast, get_sc_kpis, get_stock_health, get_supplier_risk_profile, get_sc_alerts, get_rfx_status
warn: generate_demand_forecast, trigger_replenishment_check, calculate_safety_stock
require_approval: execute_supply_plan, auto_create_po_from_replenishment, award_rfx
Phase 2 (Advanced) — Sprints 4-6
New Models
Create /backend/app/models/supplychain_logistics.py — 6 models:

Carrier, Route, TransportOrder, FreightCost, DockSchedule, YardSlot
Create /backend/app/models/supplychain_advanced.py — 6 models:

RiskAssessment, RiskScenario, MitigationPlan, ProductionSchedule, MRPRun, MRPLine
New Routes
Create /backend/app/api/v1/supplychain_logistics.py (18 endpoints) — transport orders, carriers, routes, freight audit, dock/yard scheduling Create /backend/app/api/v1/supplychain_risk.py (14 endpoints) — risk assessments, scenario simulation, MRP runs, production schedules

Alembic Migration (Phase 2)
Create o5i6j7k8l9m0_sc_logistics_and_advanced_models.py — 12 new tables

Phase 2 Frontend Pages (~8 new)
TransportOrdersPage, CarriersPage, RoutePlannerPage, FreightAuditPage
RiskAssessmentsPage, ScenarioSimulationPage, MRPRunPage, ProductionSchedulePage
Phase 2 AI Tools (~7 new)
auto_replan_disruption, reroute_shipment, predict_delivery_eta, run_mrp_analysis, detect_supply_risk, optimize_route, auto_generate_po_from_forecast
Critical Files Reference
File	Action
backend/app/models/supplychain.py	READ ONLY — existing 12 models, FKs referenced by new models
backend/app/models/supplychain_planning.py	CREATE — 7 demand/S&OP models
backend/app/models/supplychain_ops.py	CREATE — 14 ops models
backend/app/models/supplychain_logistics.py	CREATE (Phase 2) — 6 logistics models
backend/app/models/supplychain_advanced.py	CREATE (Phase 2) — 6 risk/MRP models
backend/app/api/v1/supplychain_planning.py	CREATE — ~22 endpoints
backend/app/api/v1/supplychain_ops.py	CREATE — ~48 endpoints
backend/app/api/v1/supplychain_logistics.py	CREATE (Phase 2) — ~18 endpoints
backend/app/api/v1/supplychain_risk.py	CREATE (Phase 2) — ~14 endpoints
backend/app/api/v1/__init__.py	MODIFY — register new routers
backend/app/core/integration_handlers.py	MODIFY — add 9 event handlers
backend/app/tasks/celery_app.py	MODIFY — add 6 periodic tasks
backend/app/services/ai_tools.py	MODIFY — add 12+ AI tools
frontend/src/api/supplychain_planning.ts	CREATE — API hooks
frontend/src/api/supplychain_ops.ts	CREATE — API hooks
frontend/src/features/supplychain/ (17 files)	CREATE — new pages
frontend/src/App.tsx	MODIFY — 17 new routes
frontend/src/components/layout/Sidebar.tsx	MODIFY — 9 new nav items
Reusable Existing Code
backend/app/models/base.py — UUIDPrimaryKeyMixin, TimestampMixin, Base
backend/app/core/deps.py — CurrentUser, DBSession, require_app_admin
backend/app/core/events.py — event_bus.publish/on pattern
frontend/src/api/client.ts — Axios instance
frontend/src/api/supplychain.ts / supplychain_ext.ts — existing pattern to follow
All existing supplychain pages — component patterns (search, pagination, modals, tabs)
Verification
docker compose exec backend alembic upgrade head — migrations apply cleanly
docker compose exec backend pytest tests/test_supplychain_planning.py tests/test_supplychain_ops.py -v
Swagger at http://localhost:8010/docs — verify new endpoints under SC Planning/Operations tags
Navigate all 17 new frontend routes — pages load without errors
Create a GRN → verify supplychain.goods_received still fires (regression)
celery call tasks.sc_calculate_kpis — verify KPI calculation runs
AI sidebar: test get_demand_forecast and get_sc_kpis tools
Ready for review
Select text to add comments on the plan
Y&U Analytics — Power BI Killer Upgrade Plan
Context
Y&U Analytics currently has a solid foundation: 100+ API endpoints, 42 dashboards across 12 modules, 9 chart types, a dashboard builder, SQL/visual query editor, report scheduler, and data alerts — all running direct PostgreSQL queries with zero external dependencies. However, it lacks the interactive intelligence, data modeling, AI copilot, and enterprise polish that Power BI 2026 Enterprise delivers. This plan upgrades Y&U Analytics from "functional internal reporting" to "the most powerful ERP-native BI platform in the world" — where every insight turns into action across Finance, CRM, HR, Support, Calendar, Docs, and every other Era module.

1. GAP ANALYSIS
#	Power BI Feature	Status	What Exists	What's Missing	How We Beat Power BI
1	Data Connectivity & Gateways	Partial	Direct PG queries across 65+ models, 10 hardcoded data sources in dashboard builder, ad-hoc SQL execution	No external connectors (CSV/Excel upload, REST API, DB federation), no schema introspection UI, no connection management	Zero-config connectivity — every ERP module is a pre-registered semantic data source. "Company Health" auto-joins Finance+HR+CRM. No gateway setup needed.
2	Data Transformation (Power Query)	No	Raw SQL only, visual query builder generates basic SELECT	No step-by-step data shaping, no column transforms, no pivot/unpivot, no materialized prep cache	ERP-aware transforms — "Join with customer data" is one click (auto-infers FK). "Add department" auto-joins HR. Power Query needs manual column matching.
3	Advanced Data Modeling (DAX)	No	Flat SQL, hardcoded KPI queries in analytics_ext.py	No semantic model, no relationships, no measures, no calculated columns, no formula engine, no time intelligence	Auto-generated models from SQLAlchemy introspection. Custom formula engine (30 DAX-like functions compiled to SQL). Relationships auto-discovered from FKs.
4	Rich Visualizations	Partial	8 chart components (Recharts): Line, Bar, Pie, Gauge, Funnel, Heatmap, KPICard, DataTable + custom SVG mini-charts	No scatter, waterfall, treemap, Sankey, radar, candlestick, map, decomposition tree, key influencers, combo chart. No conditional formatting. Limited interactivity.	Migrate to Apache ECharts (50+ types, GPU-accelerated). Every chart auto-annotates anomalies and explains WHY data looks that way using ERP context.
5	Interactive Dashboards	Partial	Dashboard CRUD, 3-column grid layout, widget library sidebar	No cross-filtering, no drill-through, no bookmarks, no slicer/filter pane, no drag-and-drop (fixed positions), no undo/redo	Drill-through lands in live ERP pages (not another report). Click "Acme Corp" revenue bar → CRM contact page with deals, invoices, tickets. react-grid-layout for drag-and-drop.
6	AI Copilot & Auto-Insights	Minimal	query_data AI tool (keyword→SQL, no LLM), generate_report (keyword-based). Urban Bad AI exists but NOT wired to analytics.	No NL-to-SQL via LLM, no copilot chat in analytics, no anomaly detection, no forecasting, no smart narratives, no auto-insights	Business Context Copilot — multi-agent system investigates across ALL modules. "Why did profit drop?" checks Finance + CRM + HR + Supply Chain simultaneously.
7	Scorecards & KPIs with Goals	Partial	Module KPIs for 7 modules, threshold alerts, executive summary	No goal/target definition, no variance tracking, no scorecard hierarchy, no traffic-light indicators, no goal cascading	Goals auto-track from live ERP data. Set "Q1 Revenue: KSh 5M" → auto-tracks from invoices. "Hire 10 engineers" → tracks from HR. Always live, never stale.
8	Sharing & Collaboration	Basic	is_shared boolean on dashboards, owner-based access	No workspaces, no RLS, no sensitivity labels, no commenting, no granular sharing (user/role level)	RLS auto-derived from RBAC — Sales Rep sees only their deals, Finance Admin sees all. No manual security table needed. Comments with @mentions on any widget.
9	Scheduled Refresh & Streaming	Basic	Celery beat for reports, cron scheduling. All queries on-demand, no caching.	No query result caching, no incremental refresh, no real-time WebSocket streaming, no freshness indicators	True real-time via EventBus — POS transaction completes → revenue KPI updates in <1s via WebSocket. Three-tier caching (Redis/materialized views/browser).
10	Mobile	Partial	Responsive grid, touch-friendly sizes, print CSS	No swipe pagination, no offline caching, no push notifications, no mobile-optimized chart sizes	Mobile + ERP actions — see overdue invoices spike? Tap to send reminders directly from mobile dashboard. Power BI mobile is read-only.
11	Export Options	Partial	CSV (client-side), PDF/XLSX (backend Celery), email delivery	No PPTX export, no full dashboard PDF snapshot, no embedded chart emails, no export templates	Export includes ERP context — finance PDF includes chart + top 10 underlying transactions. HR export includes org chart. Add PPTX via python-pptx.
12	Usage Analytics	No	Basic module record counts only	No dashboard view tracking, no query performance logs, no user engagement analytics, no slow query identification	Meta-analytics correlate with ERP activity — "Finance dashboard usage spikes 3x during month-end close." Auto-suggest scheduling.
13	Security & Compliance	Basic	JWT auth, read-only SQL validation, RBAC, security headers	No audit trail for analytics, no DLP, no data lineage, no sensitivity labels	Compliance is automatic — finance dashboards auto-classify confidential. Salary data export triggers audit + HR notification. Kenya-specific KRA/NHIF/NSSF auto-reports.
14	Embed & API Access	No	Internal REST API only	No embed tokens, no iframe viewer, no public share links, no external API keys	Embedded dashboards include live ERP actions — partner portal embed lets partners place orders from the dashboard.
15	Version History & Sandbox	No	updated_at timestamp only	No version history, no draft/published states, no sandbox queries, no change tracking	Version diffs show exactly what changed ("Added revenue widget, changed filter from 6mo to 12mo"). Draft mode for safe editing.
2. MODERN AI-ERA ENHANCEMENTS
Data Connectivity & Modeling
Auto-Generated Semantic Models — On every Alembic migration, auto-regenerate the semantic model from SQLAlchemy introspection. New tables instantly appear as data sources with correct relationships and labels. Zero manual modeling.
Cross-Module Data Fusion — Single queries transparently join across modules: "Customers with overdue invoices AND open support tickets" joins CRM+Finance+Support in one optimized query.
Predictive Data Suggestions — Select "Revenue by Month" and AI pre-generates 6 related suggestions: "Revenue by Customer," "Revenue vs Expenses," "Revenue YoY," "Revenue Forecast (3mo)," "Revenue by Product," "Revenue Anomalies."
Visualizations & Dashboards
Narrative Charts — Every chart has "Tell me about this" button generating a 2-3 sentence NL summary with statistical observations via Ollama.
Anomaly Overlay — Toggle an anomaly layer on any time-series chart highlighting statistical outliers with ERP-attributed causes.
Action Charts — Charts have contextual ERP action buttons. "Overdue Invoices" chart → "Send Reminders." "Low Stock" chart → "Create Purchase Orders." "Flight Risk Employees" → "Schedule 1-on-1."
AI Insights & Copilot
Agentic Dashboard Builder — "Build me an executive dashboard for Q1 review" → multi-agent system creates complete dashboard (KPIs, charts, layout, narratives, weekly email) in 30 seconds.
Proactive Insights Engine — Nightly scan of all KPIs for anomalies (z-score), trend reversals, cross-module correlations. Surfaces findings via notifications without user action.
Conversational Drill-Down — "Show me revenue" → chart → "Why did it drop in March?" → investigates invoices → "3 invoices totaling KSh 2.1M went overdue. Show customers?" → list with one-click email reminders.
Sharing & Collaboration
Role-Aware Default Dashboards — Sales Manager logs in → sees their pipeline, team performance, revenue targets pre-filtered. New hires get relevant dashboard on day one.
Collaborative Analysis Threads — Slack-like threads attached to any chart widget. Tag colleagues, share findings, discuss. Linked to dashboard version for historical context.
ERP Integrations
Event-Triggered Dashboards — Large deal closes → auto-generate contextual dashboard showing impact on Q1 revenue, cash flow, and capacity planning.
What-If Simulator — "What if we increase prices 10%?" uses actual ERP data (product prices, sales volumes, costs) to project real outcomes.
Compliance Autopilot — Auto-generate Kenya KRA iTax, NHIF/NSSF, VAT returns from live double-entry accounting data.
Security & Performance
AI Access Anomaly Detection — Monitor who accesses what data, flag unusual patterns: "Marketing user accessed full salary report 3x this week."
Automatic Query Optimization — Detect slow widget queries, suggest indexes or materialized views, auto-create them with admin approval.
3. PHASED 6-MONTH ROADMAP
Phase 1: Foundation (Weeks 1-8) — "Analytics That Just Works"
Weeks 1-2: Schema & Data Layer
 Build /api/v1/analytics/schema endpoint — introspect information_schema, return tables/columns/types/FKs grouped by module
New file: backend/app/api/v1/analytics_schema.py
 Build SemanticModel SQLAlchemy model (analytics_semantic_models table): id, name, tables JSON, relationships JSON, measures JSON, owner_id
Extend: backend/app/models/analytics.py
 Auto-generate default semantic models for all 7 modules from SQLAlchemy model inspection
New file: backend/app/services/analytics_modeling.py
 Add Redis caching layer for widget queries (configurable TTL, default 5min)
New file: backend/app/services/analytics_cache.py
 Build DataTransformPipeline model — ordered steps (filter, rename, aggregate, pivot, join, calculated column) stored as JSON, executed as chained CTEs
Extend: backend/app/models/analytics.py
Weeks 3-4: Chart Library Upgrade
 Add echarts-for-react + apache-echarts to frontend
 Build universal ChartRenderer component — takes widget config + data, renders ECharts
New file: frontend/src/components/charts/ChartRenderer.tsx
 Add 15+ new chart types: scatter, waterfall, treemap, Sankey, radar, candlestick, sparkline, bullet, map (leaflet), decomposition tree, key influencers, box plot, histogram, combo, ribbon
 Build conditional formatting engine — rules in widget settings, applied at render
 Migrate all 8 prebuilt module dashboards to ChartRenderer
 Keep Recharts KPICard for simple inline sparklines
Weeks 5-6: Interactive Dashboards
 Add react-grid-layout for drag-and-drop dashboard builder
Modify: frontend/src/features/analytics/DashboardBuilderPage.tsx
 Build DashboardFilterContext — React context holding active filter selections, propagated to all widget queries
New file: frontend/src/features/analytics/context/DashboardFilterContext.tsx
 Build global slicer/filter pane component
 Add DashboardBookmark model + CRUD + UI (save/restore filter states)
Extend: backend/app/models/analytics.py
 Add undo/redo to dashboard builder (Zustand temporal middleware)
 Build drill-through navigation — click data point → navigate to detail/ERP page with filters
Weeks 7-8: Basic Copilot Q&A
 Build AnalyticsCopilotService — NL question + context → Ollama generates SQL → validate → execute → return data + NL summary
New file: backend/app/services/analytics_copilot.py
 Build CopilotPanel component — text input at top of every dashboard, results as temporary widget
New file: frontend/src/features/analytics/components/CopilotPanel.tsx
 Replace keyword-based query_data and generate_report AI tools with LLM-powered Copilot service
Modify: backend/app/services/ai_tools.py (lines ~4535-4650)
 Add schema context injection for Ollama prompts (table names, columns, sample values, relationships)
Phase 1 Deliverables: 20+ chart types, drag-and-drop dashboards, cross-filtering, bookmarks, drill-through, basic NL Q&A, Redis caching, schema introspection, semantic models

Phase 2: Intelligence (Months 3-4) — "Analytics That Thinks"
Weeks 9-10: AI Visuals & Smart Narratives
 Build SmartNarrative component — "Tell me about this" button on every chart, Ollama-generated summary
 Build AnomalyDetector service — z-score anomaly detection on time-series, highlight on charts
New file: backend/app/services/analytics_anomaly.py
 Build TrendForecaster service — linear regression + seasonal decomposition (statsmodels)
New file: backend/app/services/analytics_forecast.py
 Build "Key Influencers" visual — correlation analysis identifying which dimensions most affect a target metric
 Add anomaly overlay toggle to all time-series charts
Weeks 11-12: Deep ERP Drill-Through & Transform Editor
 Implement cross-module drill paths: Revenue chart → Invoice list → Customer detail → Deal history → Support tickets
 Build drill-through configuration UI per widget
 Add tooltip pages — hover on data point → mini-dashboard popover
 Build visual Transform Editor UI — step-by-step data shaping with live 50-row preview
New file: frontend/src/features/analytics/TransformEditorPage.tsx
 Implement ERP-aware join suggestions (auto-detect FK relationships)
Weeks 13-14: Mobile & Real-Time Streaming
 Build mobile-optimized dashboard viewer — single-column stack, swipe pagination
 Add PWA manifest + service worker for offline dashboard caching
 Build WebSocket endpoint /api/v1/analytics/ws/dashboard/{id} — push widget updates via Redis EventBus
Extend: backend/app/api/v1/analytics_ext.py
 Implement incremental cache refresh via Celery beat (configurable 1min/5min/15min/hourly)
 Add data freshness badges on widgets ("Updated 2 min ago")
 Push notifications via Web Push API for data alerts
Weeks 15-16: Scorecards & Advanced Alerts
 Build models: Scorecard, Goal, GoalCheckIn + CRUD endpoints
Extend: backend/app/models/analytics.py
 Build scorecard dashboard page — OKR-style goal tree with traffic-light indicators
New file: frontend/src/features/analytics/ScorecardsPage.tsx
 Goals auto-populate actuals from live ERP data (revenue from invoices, headcount from HR, etc.)
 Extend DataAlert — support variance-from-goal, percent-change, moving-average-deviation conditions
 Alert notifications: email + in-app + WebSocket push
Phase 2 Deliverables: AI narratives, anomaly detection, forecasting, key influencers, ERP drill-through, tooltip pages, mobile PWA, real-time streaming, scorecards, goal tracking, advanced alerts

Phase 3: Domination (Months 5-6) — "Analytics That Acts"
Weeks 17-18: Agentic Copilot
 Wire Urban Bad AI multi-agent system into analytics
Orchestrator receives analytics questions
Researcher queries across modules for root causes
Verifier validates statistical significance
Executor creates dashboards, alerts, reports, triggers ERP actions
Modify: backend/app/services/agent_orchestrator.py
 Build "Agentic Dashboard Builder" — NL description → complete dashboard in 30 seconds
 Build "Proactive Insights" Celery task — nightly KPI scan for anomalies, trend changes, correlations
New file: backend/app/tasks/analytics_insights.py
New model: AnalyticsInsight in backend/app/models/analytics.py
 Build Action Charts — contextual ERP action buttons on chart visualizations
Weeks 19-20: Security & Compliance
 Build RLS engine: DashboardRLS model, filter injection into widget queries based on user role
 Build AnalyticsAuditLog model — log all query executions, dashboard views, exports
 Build data lineage tracking — source tables/columns/transforms per widget, displayed as lineage graph
 Add sensitivity_level field on Dashboard (public/internal/confidential/restricted)
 Build DashboardShare model — granular sharing with specific users/roles/apps with view/edit/admin permissions
 Build compliance report templates — Kenya KRA iTax, NHIF/NSSF, VAT returns
Weeks 21-22: Embed, Export, Version History
 Build EmbedToken model + /embed/dashboard/{token} stripped-down viewer
 Dashboard PDF export via Playwright headless screenshot
 PPTX export via python-pptx (one widget per slide)
 Scheduled email with inline chart images (ECharts server-side rendering)
 Build DashboardVersion model — auto-save on publish, diff view, rollback
 Draft/published workflow for dashboards
Weeks 23-24: Meta-Analytics & Enterprise Polish
 Build AnalyticsUsageLog model + tracking middleware
 Build "Meta Analytics" admin dashboard — popularity, performance, engagement
 Build "What-If Simulator" — parameter-based scenario modeling with actual ERP data
 Performance optimization — query plan analysis, automatic index suggestions, materialized view creation
 Custom formula engine — 30 DAX-like functions via lark-parser, compiled to PostgreSQL SQL
New file: backend/app/services/analytics_formula_engine.py
Functions: SUM, COUNT, AVG, MIN, MAX, CALCULATE, FILTER, RELATED, DATEADD, TOTALYTD, SAMEPERIODLASTYEAR, DIVIDE, IF, SWITCH, FORMAT, YEAR, MONTH, DAY, NOW, TODAY, CONCATENATE, RANKX, TOPN, DISTINCTCOUNT, COUNTROWS, ISBLANK, COALESCE, DATEDIFF, EOMONTH
 End-to-end testing, Alembic migrations, documentation
Phase 3 Deliverables: Multi-agent Copilot, proactive insights, action charts, RLS, audit logging, data lineage, embed API, PPTX/PDF export, version history, meta-analytics, what-if simulator, formula engine, compliance autopilot

4. TECH STACK RECOMMENDATIONS
Layer	Technology	Rationale
Visualization	Apache ECharts (echarts-for-react v3)	50+ chart types, GPU-accelerated canvas, 100K+ point performance, themes, i18n. Keep Recharts for inline sparklines only.
Dashboard Layout	react-grid-layout	Battle-tested drag-and-drop grid. Used by Grafana. Responsive breakpoints, serializable layout.
OLAP Engine	PostgreSQL 16 + materialized views (Phase 1-2), DuckDB sidecar (Phase 3 if needed)	PG handles millions of rows with proper indexing. DuckDB adds columnar analytics without infrastructure overhead.
Real-Time Streaming	Redis PubSub + FastAPI WebSocket (existing)	Already have both. ERP event → Redis channel → WebSocket push. No Kafka needed at this scale.
AI/LLM	Ollama (llama3.1:8b for NL-to-SQL, llama3.1:70b for narratives) + OpenAI/Anthropic fallback	Already deployed as urban-erp-ollama. Existing AI service abstraction supports multi-provider.
Formula Engine	lark-parser (Python)	Lightweight PEG parser. Compile DAX-like expressions to PostgreSQL SQL. 30 functions cover 95% of use cases.
Caching	Three-tier: Redis L1 (1-5min TTL) → PG materialized views (hourly/daily) → TanStack Query browser cache (60s stale)	Progressive freshness. Redis invalidated by ERP events.
PDF/PPTX Export	Playwright (dashboard screenshots) + python-pptx (slide generation)	Playwright renders full dashboard as pixel-perfect PDF. python-pptx is the standard for PPTX generation.
Forecasting	statsmodels (Python)	Lightweight, no GPU needed. Linear regression + seasonal decomposition for time-series.
Geospatial	Leaflet (react-leaflet)	Lightweight map library. OpenStreetMap tiles (free, self-hostable).
Auth	Existing JWT + RBAC	Extend with RLS filter injection and embed tokens. No new auth infrastructure.
5. FIVE BOLD "Y&U ANALYTICS-ONLY" DIFFERENTIATORS
1. Live ERP Drill-Through — Analytics IS the ERP
Click any data point on any chart and land directly in the live operational ERP page. Revenue bar for "Acme Corp" → CRM contact page with deal pipeline, open invoices, support tickets, communication history. Take action immediately. Power BI can only drill to another report page — Y&U drills into the live system.

2. Zero-Config Intelligence — Every Module Gets Analytics Free
Add a new ERP module → analytics auto-discovers tables, generates KPIs, creates a default dashboard. No manual dataset creation, no relationship setup, no measure authoring. Power BI requires hours of setup per data source. Y&U provides instant analytics for every module with zero configuration.

3. Business Context Copilot — AI That Understands Your Entire Business
Ask "Why did profit drop?" and the multi-agent system investigates across ALL modules simultaneously: revenue trends (Finance), cost increases (Journal Entries), deal losses (CRM), employee departures (HR), supply chain delays (Inventory), production issues (Manufacturing). Returns a unified explanation with evidence from each source. Power BI Copilot only sees columns in the current dataset.

4. Action Charts — Visualizations That Do Things
Every chart supports contextual ERP actions. "Overdue Invoices" chart → "Send Payment Reminders." "Low Stock" chart → "Create Purchase Orders." "Flight Risk Employees" → "Schedule 1-on-1 Meeting." "Cash Flow Dip" → "Create Calendar Event with CFO." The dashboard is an operational command center. Power BI is strictly read-only.

5. Compliance Autopilot — Regulatory Reports That Write Themselves
Auto-generate country-specific compliance reports from live, verified, double-entry accounting data: Kenya KRA iTax returns, NHIF/NSSF contributions, VAT returns, trial balance for auditors, aged receivables for bank covenants. Power BI can visualize compliance data but cannot generate legally-formatted reports from a verified accounting system because it doesn't own the source of truth.

Critical Files Reference
Backend — Modify
backend/app/api/v1/analytics_ext.py (978 lines) — Core analytics API, extend with schema, RLS, caching, WebSocket, embed
backend/app/models/analytics.py (127 lines) — Add SemanticModel, Scorecard, Goal, DashboardVersion, DashboardRLS, AuditLog, EmbedToken, AnalyticsInsight
backend/app/services/ai_tools.py — Replace keyword-based query_data/generate_report with LLM-powered Copilot
backend/app/services/agent_orchestrator.py — Wire multi-agent system into analytics
backend/app/tasks/celery_app.py — Add analytics cache refresh, proactive insights tasks
Backend — New Files
backend/app/api/v1/analytics_schema.py — Schema introspection endpoint
backend/app/services/analytics_copilot.py — NL-to-SQL Copilot service
backend/app/services/analytics_cache.py — Redis caching layer
backend/app/services/analytics_modeling.py — Auto semantic model generation
backend/app/services/analytics_anomaly.py — Anomaly detection service
backend/app/services/analytics_forecast.py — Time-series forecasting
backend/app/services/analytics_formula_engine.py — DAX-like formula compiler
backend/app/tasks/analytics_insights.py — Proactive insights Celery task
Frontend — Modify
frontend/src/features/analytics/DashboardBuilderPage.tsx (19.3KB) — Rewrite with react-grid-layout, ECharts, cross-filtering
frontend/src/features/analytics/AnalyticsPage.tsx (23.9KB) — Integrate Copilot panel, action charts
frontend/src/features/analytics/QueryBuilderPage.tsx (15.8KB) — Add transform editor, semantic model browser
frontend/src/components/charts/ (8 files) — Add ChartRenderer, migrate to ECharts
Frontend — New Files
frontend/src/components/charts/ChartRenderer.tsx — Universal ECharts renderer
frontend/src/features/analytics/context/DashboardFilterContext.tsx — Cross-filtering context
frontend/src/features/analytics/components/CopilotPanel.tsx — NL Q&A panel
frontend/src/features/analytics/components/SmartNarrative.tsx — AI chart narrative
frontend/src/features/analytics/components/ActionButtons.tsx — ERP action buttons on charts
frontend/src/features/analytics/ScorecardsPage.tsx — Goal tracking UI
frontend/src/features/analytics/TransformEditorPage.tsx — Visual data transform editor
frontend/src/features/analytics/EmbedViewer.tsx — Stripped-down embed view
Verification Plan
Phase 1 Testing
Schema endpoint returns all ERP tables with correct relationships
ECharts renders all 20+ chart types with sample data
Drag-and-drop dashboard builder saves/loads layout correctly
Cross-filtering: click bar in Chart A → Chart B filters to matching data
Copilot Q&A: "Show me revenue by month" → generates correct SQL → renders chart + summary
Redis cache hit/miss verified via response headers
Phase 2 Testing
Anomaly detector correctly flags z-score > 2 data points
Forecaster produces reasonable 3-month projections on historical revenue data
Drill-through navigates from chart → ERP page with correct filters
WebSocket streams live updates when new invoice created
Mobile PWA works offline with cached dashboard
Scorecards auto-update actuals from live ERP data
Phase 3 Testing
"Build me a Q1 dashboard" via Copilot → complete dashboard with correct KPIs
Proactive insights Celery task detects known test anomaly
RLS: Sales Rep sees only their data, Admin sees all
Embed token grants read-only access to specific dashboard
PPTX export produces valid file with all dashboard widgets
Formula engine: TOTALYTD(SUM(revenue)) compiles to correct PostgreSQL SQL
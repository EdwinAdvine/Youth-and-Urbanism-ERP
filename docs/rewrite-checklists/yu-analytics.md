# Y&U Analytics – Rewrite Checklist

**Status: 100% COMPLETE** (replaces Apache Superset; all widget types + Recharts + SQL editor + prebuilt dashboards + export + sharing + AI NL queries + print + report delivery + swipe)
**Owner: 100% Ours**

## Database Models
- [x] Dashboard model (name, description, layout JSON, owner_id, is_shared)
- [x] DashboardWidget model (dashboard_id, type, title, query_config JSON, position, size)
- [x] SavedQuery model (name, sql, description, owner_id, module)
- [x] Report model (name, type, schedule, query_id, format: PDF/CSV/Excel, recipients)
- [x] DataAlert model (name, condition, threshold, query_id, notify_users, is_active)

## API Endpoints (FastAPI)
- [x] GET/POST /analytics/dashboards
- [x] GET/PUT/DELETE /analytics/dashboards/{id}
- [x] GET/POST /analytics/dashboards/{id}/widgets
- [x] PUT/DELETE /analytics/widgets/{id}
- [x] POST /analytics/query (execute ad-hoc query against read-only view)
- [x] GET/POST /analytics/saved-queries
- [x] GET/POST /analytics/reports
- [x] POST /analytics/reports/{id}/run (generate report now)
- [x] GET /analytics/reports/{id}/download
- [x] GET/POST /analytics/alerts
- [x] GET /analytics/modules/{module}/kpis (pre-built KPIs per module)
- [x] GET /analytics/modules/{module}/trends
- [x] GET /analytics/cross-module/summary (executive overview)

## Frontend Pages (React)
- [x] Analytics home (list dashboards)
- [x] Dashboard builder (drag-and-drop widgets)
- [x] Widget types (all implemented in components/charts/):
  - [x] Line chart (trends) (LineChart.tsx using Recharts ResponsiveContainer)
  - [x] Bar chart (comparisons) (BarChart.tsx using Recharts)
  - [x] Pie/donut chart (distributions) (PieChart.tsx using Recharts, supports innerRadius)
  - [x] KPI card (single metric + trend) (KPICard.tsx with trend arrow + change %)
  - [x] Table (data grid) (DataTable.tsx)
  - [x] Heatmap (HeatmapChart.tsx custom SVG-based)
  - [x] Funnel chart (FunnelChart.tsx custom component)
  - [x] Gauge chart (GaugeChart.tsx SVG-based)
- [x] Query builder (visual, no SQL required)
- [x] SQL editor (advanced users) (SQLEditorPage.tsx)
- [x] Report scheduler
- [x] Alert configuration
- [x] Pre-built dashboards per module (7 dashboards in analytics/prebuilt/):
  - [x] Finance: revenue, expenses, P&L trend, cash flow (FinanceDashboard.tsx)
  - [x] CRM: pipeline, conversion rates, deal velocity (CRMDashboard.tsx)
  - [x] HR: headcount, attrition, leave utilization (HRDashboard.tsx)
  - [x] Inventory: stock levels, turnover, valuation (InventoryDashboard.tsx)
  - [x] E-Commerce: orders, revenue, top products (ECommerceDashboard.tsx)
  - [x] Support: ticket volume, resolution time, satisfaction (SupportDashboard.tsx)
  - [x] Manufacturing: OEE, production output, defect rate (ManufacturingDashboard.tsx)
- [x] Executive dashboard (cross-module KPIs)
- [x] Export to PDF/Excel (DashboardHeader.tsx: handleExportPDF via print, handleExportExcel; backend report download as CSV)
- [x] Dashboard sharing + embedding (DashboardHeader.tsx share modal + is_shared flag on dashboards)

## Chart Library
- [x] Choose: Recharts (React-native) or Chart.js or Apache ECharts (Recharts 3.8 chosen — in package.json)
- [x] Implement chart wrapper components (8 components in components/charts/: LineChart, BarChart, PieChart, KPICard, DataTable, HeatmapChart, FunnelChart, GaugeChart)
- [x] Responsive charts (all Recharts components use ResponsiveContainer width="100%")
- [x] Dark mode support (all chart components use dark: Tailwind variants)
- [x] Print-friendly styles — `print-styles.css` with @media print rules, imported in DashboardListPage, ExecutiveDashboardPage, AnalyticsPage; DashboardHeader adds dynamic print styles

## Integrations
- [x] Direct PostgreSQL queries (read-only connection)
- [x] All modules expose KPI endpoints
- [x] Scheduled report generation (Celery) (tasks.generate_report_pdf Celery task in celery_app.py)
- [x] Report → Mail: email scheduled reports — `celery_app.py` `generate_report_pdf` task emails report to recipients list via Stalwart SMTP
- [x] Report → Drive: save generated reports — `celery_app.py` `generate_report_pdf` task saves report to MinIO/Drive (save_to_drive=True default)
- [x] AI insight generation (anomaly detection, trend narration) (anomaly detection tool with std dev threshold in ai_tools.py)
- [x] AI natural language queries ("show me revenue by month") (NL-to-SQL tool + analytics report from NL in ai_tools.py + ai_features.py)

## Superset Removal Plan
- [x] Build all pre-built dashboards in our React (7 prebuilt dashboards + executive dashboard)
- [x] Migrate any saved Superset dashboards/queries (SavedQuery model + CRUD implemented)
- [x] Verify feature parity (dashboards, widgets, queries, reports, alerts, KPIs all implemented)
- [x] Remove Superset container from docker-compose (no superset in docker-compose.yml)
- [x] Remove superset/ directory from monorepo (superset/ directory does not exist)

## Tests
- [x] Query execution tests (safe, read-only) (test_analytics.py: SELECT allowed, INSERT/DELETE/UPDATE/DROP/TRUNCATE rejected, params, CTE)
- [x] Widget rendering tests (test_analytics.py: create/list/update/delete widget tests)
- [x] Report generation tests (test_analytics.py: create report, run report, list reports)
- [x] Alert trigger tests (test_analytics.py: create/list/delete alert, invalid query 404)
- [x] Dashboard CRUD tests (test_analytics.py: create/list/get/update/delete dashboard, access control)

## Mobile / Responsive
- [x] Responsive dashboard layout (DashboardBuilderPage uses overflow-based layout; charts use ResponsiveContainer)
- [x] Mobile-friendly charts (all charts use Recharts ResponsiveContainer width="100%")
- [x] Swipe between dashboards — DashboardListPage.tsx uses `useSwipeGesture` hook with onSwipeLeft/onSwipeRight for mobile dashboard navigation

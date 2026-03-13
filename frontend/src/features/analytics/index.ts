export { default as AlertConfigPage } from './AlertConfigPage';
export { default as AnalyticsPage } from './AnalyticsPage';
export { default as DashboardBuilderPage } from './DashboardBuilderPage';
export { default as DashboardListPage } from './DashboardListPage';
export { default as ExecutiveDashboardPage } from './ExecutiveDashboardPage';
export { default as PrebuiltDashboardsPage } from './PrebuiltDashboardsPage';
export { default as QueryBuilderPage } from './QueryBuilderPage';
export { default as ReportSchedulerPage } from './ReportSchedulerPage';
export { default as SQLEditorPage } from './SQLEditorPage';

// Phase 1 — Analytics upgrade exports
export { DashboardFilterProvider, useDashboardFilters } from './context/DashboardFilterContext';
export {
  DRILL_ROUTES,
  useDrillThrough,
  useChartDrillThrough,
  DrillThroughBreadcrumb,
  DrillThroughPopup,
  encodeDrillFilters,
  decodeDrillFilters,
} from './components/DrillThroughManager';

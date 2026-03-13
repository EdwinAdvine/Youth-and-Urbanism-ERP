import { lazy, Suspense, ReactNode } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { Spinner, ToastProvider } from './components/ui'
import { getPostLoginRoute } from './utils/getPostLoginRoute'
import ErrorBoundary from './components/ErrorBoundary'
// ─── Eager imports (always needed, no lazy loading) ──────────────────────────

import AppShell from './components/layout/AppShell'
import HomePage from './features/home/HomePage'
import LoginPage from './features/auth/LoginPage'

// ─── Preloadable lazy imports (sidebar-linked dashboards — prefetch on hover) ─

import {
  FinanceDashboard,
  HRDashboard,
  CRMDashboard,
  ProjectsPage,
  InventoryDashboard,
  SupplyChainDashboard,
  ManufacturingDashboard,
  POSDashboard,
  EcommerceDashboard,
  SupportDashboard,
  MailPage,
  CalendarPage,
  TeamsPage,
  DocsPage,
  DrivePage,
  NotesPage,
  AnalyticsPage,
  FormsPage,
  AdminDashboard,
  SettingsPage,
} from './utils/preloadableRoutes'

// ─── Standard lazy imports (sub-pages within modules) ────────────────────────

const UsersPage           = lazy(() => import('./features/admin/UsersPage'))
const RolesPage           = lazy(() => import('./features/admin/RolesPage'))
const AppAdminsPage       = lazy(() => import('./features/admin/AppAdminsPage'))
const AIConfigPage        = lazy(() => import('./features/admin/AIConfigPage'))
const AuditLogsPage       = lazy(() => import('./features/admin/AuditLogsPage'))
const AppAdminDashboard   = lazy(() => import('./features/admin/AppAdminDashboard'))
const MyModulesPage       = lazy(() => import('./features/admin/MyModulesPage'))
const BulkImportPage      = lazy(() => import('./features/admin/BulkImportPage'))
const LicensePage         = lazy(() => import('./features/admin/LicensePage'))
const SSOConfigPage       = lazy(() => import('./features/admin/SSOConfigPage'))
const BackupsPage         = lazy(() => import('./features/admin/BackupsPage'))
const MailConfigPage      = lazy(() => import('./features/admin/MailConfigPage'))
const DriveConfigPage     = lazy(() => import('./features/admin/DriveConfigPage'))
const DocsConfigPage      = lazy(() => import('./features/admin/DocsConfigPage'))
const UserAppAccessPage   = lazy(() => import('./features/admin/UserAppAccessPage'))
const PermissionMatrixPage = lazy(() => import('./features/admin/PermissionMatrixPage'))
const TemplateGalleryPage = lazy(() => import('./features/docs/TemplateGalleryPage'))
const DocsAnalyticsPage   = lazy(() => import('./features/docs/DocsAnalyticsPage'))
const MeetingsConfigPage = lazy(() => import('./features/admin/MeetingsConfigPage'))
const PerformanceDashboard = lazy(() => import('./features/admin/PerformanceDashboard'))
const SecurityDashboard   = lazy(() => import('./features/admin/SecurityDashboard'))
const ParityDashboard     = lazy(() => import('./features/admin/ParityDashboard'))
const SecurityPage        = lazy(() => import('./features/settings/SecurityPage'))
const ChangelogPage       = lazy(() => import('./features/settings/ChangelogPage'))

const FormBuilder      = lazy(() => import('./features/forms/FormBuilder'))
const FormResponses    = lazy(() => import('./features/forms/FormResponses'))
const FormSubmit       = lazy(() => import('./features/forms/FormSubmit'))
const PublicFormPage   = lazy(() => import('./features/forms/PublicFormPage'))

// Handbook
const HandbookPage           = lazy(() => import('./features/handbook/HandbookPage'))
const HandbookArticlePage    = lazy(() => import('./features/handbook/ArticlePage'))
const HandbookCategoryPage   = lazy(() => import('./features/handbook/CategoryPage'))
const HandbookSearchPage     = lazy(() => import('./features/handbook/SearchPage'))
const HandbookGettingStarted = lazy(() => import('./features/handbook/GettingStartedPage'))
const HandbookAdminPage      = lazy(() => import('./features/handbook/HandbookAdminPage'))
const HandbookArticleEditor  = lazy(() => import('./features/handbook/ArticleEditor'))
const HandbookCategoryManager = lazy(() => import('./features/handbook/CategoryManager'))
const HandbookAnalyticsPage  = lazy(() => import('./features/handbook/HandbookAnalytics'))

const ProjectBoard     = lazy(() => import('./features/projects/ProjectBoard'))
const TimeLogReport    = lazy(() => import('./features/projects/TimeLogReport'))

// Finance sub-pages
const AccountsPage     = lazy(() => import('./features/finance/AccountsPage'))
const InvoicesPage     = lazy(() => import('./features/finance/InvoicesPage'))
const InvoiceDetail    = lazy(() => import('./features/finance/InvoiceDetail'))
const PaymentsPage     = lazy(() => import('./features/finance/PaymentsPage'))
const JournalPage      = lazy(() => import('./features/finance/JournalPage'))
const FinanceReportsPage = lazy(() => import('./features/finance/ReportsPage'))
const BudgetPage       = lazy(() => import('./features/finance/BudgetPage'))
const TaxConfigPage    = lazy(() => import('./features/finance/TaxConfigPage'))
const CurrencyPage     = lazy(() => import('./features/finance/CurrencyPage'))
const BankReconciliationPage = lazy(() => import('./features/finance/BankReconciliationPage'))
const PnLReport        = lazy(() => import('./features/finance/PnLReport'))
const BalanceSheetPage = lazy(() => import('./features/finance/BalanceSheetPage'))
const RecurringInvoicesPage = lazy(() => import('./features/finance/RecurringInvoicesPage'))
const ExpensesPage     = lazy(() => import('./features/finance/ExpensesPage'))
const VendorBillsPage  = lazy(() => import('./features/finance/VendorBillsPage'))
const FixedAssetsPage  = lazy(() => import('./features/finance/FixedAssetsPage'))
const CashFlowPage     = lazy(() => import('./features/finance/CashFlowPage'))
const AgedReportPage   = lazy(() => import('./features/finance/AgedReportPage'))
const FinanceKPIsPage  = lazy(() => import('./features/finance/FinanceKPIsPage'))
// Finance Phase 2A — AI-era upgrades
const EstimatesPage        = lazy(() => import('./features/finance/EstimatesPage'))
const WorkflowRulesPage    = lazy(() => import('./features/finance/WorkflowRulesPage'))
const FinanceAIPage        = lazy(() => import('./features/finance/FinanceAIPage'))
const RevenueStreamsPage    = lazy(() => import('./features/finance/RevenueStreamsPage'))
const JobCostingPage       = lazy(() => import('./features/finance/JobCostingPage'))
const ComplianceCalendarPage = lazy(() => import('./features/finance/ComplianceCalendarPage'))
const CustomFieldsAdmin    = lazy(() => import('./features/finance/CustomFieldsAdmin'))
const DimensionsAdmin          = lazy(() => import('./features/finance/DimensionsAdmin'))
const FinanceDashboardBuilder  = lazy(() => import('./features/finance/FinanceDashboardBuilder'))
const ReportBuilderPage        = lazy(() => import('./features/finance/ReportBuilderPage'))

// HR sub-pages
const DepartmentsPage  = lazy(() => import('./features/hr/DepartmentsPage'))
const EmployeesPage    = lazy(() => import('./features/hr/EmployeesPage'))
const EmployeeDetail   = lazy(() => import('./features/hr/EmployeeDetail'))
const LeavePage        = lazy(() => import('./features/hr/LeavePage'))
const AttendancePage   = lazy(() => import('./features/hr/AttendancePage'))
const PayrollPage      = lazy(() => import('./features/hr/PayrollPage'))
const PayslipDetail    = lazy(() => import('./features/hr/PayslipDetail'))
const TaxBracketsPage  = lazy(() => import('./features/hr/TaxBracketsPage'))
const PayRunPage       = lazy(() => import('./features/hr/PayRunPage'))
const OrgChartPage     = lazy(() => import('./features/hr/OrgChartPage'))
const PerformanceReviewsPage = lazy(() => import('./features/hr/PerformanceReviewsPage'))
const TrainingPage     = lazy(() => import('./features/hr/TrainingPage'))
const EmployeeDocumentsPage = lazy(() => import('./features/hr/EmployeeDocumentsPage'))
const LeaveCalendarPage = lazy(() => import('./features/hr/LeaveCalendarPage'))
const PayrollReportsPage = lazy(() => import('./features/hr/PayrollReportsPage'))
const OnboardingPage   = lazy(() => import('./features/hr/OnboardingPage'))
const OffboardingPage  = lazy(() => import('./features/hr/OffboardingPage'))

// HR Phase 2 pages — ATS
const ATSDashboard        = lazy(() => import('./features/hr/ats/ATSDashboard'))
const RequisitionsAtsPage = lazy(() => import('./features/hr/ats/RequisitionsPage'))
const RequisitionDetail2  = lazy(() => import('./features/hr/ats/RequisitionDetail'))
const CandidatesPage      = lazy(() => import('./features/hr/ats/CandidatesPage'))
const CandidateDetail     = lazy(() => import('./features/hr/ats/CandidateDetail'))
const PipelineBoard       = lazy(() => import('./features/hr/ats/PipelineBoard'))
const InterviewScheduler  = lazy(() => import('./features/hr/ats/InterviewScheduler'))
// HR Phase 2 pages — LMS
const CourseCatalogPage   = lazy(() => import('./features/hr/lms/CourseCatalogPage'))
const CourseDetailPage    = lazy(() => import('./features/hr/lms/CourseDetailPage'))
const CourseBuilderPage   = lazy(() => import('./features/hr/lms/CourseBuilderPage'))
const LearningDashboard   = lazy(() => import('./features/hr/lms/LearningDashboard'))
const CertificationsPage  = lazy(() => import('./features/hr/lms/CertificationsPage'))
// HR Phase 2 pages — Engagement
const SurveyBuilderPage   = lazy(() => import('./features/hr/engagement/SurveyBuilderPage'))
const SurveyResponsePage  = lazy(() => import('./features/hr/engagement/SurveyResponsePage'))
const SurveyResultsPage   = lazy(() => import('./features/hr/engagement/SurveyResultsPage'))
const RecognitionFeedPage = lazy(() => import('./features/hr/engagement/RecognitionFeedPage'))
const EngagementDashboard = lazy(() => import('./features/hr/engagement/EngagementDashboard'))
// HR Phase 2 pages — Onboarding & Import
const OnboardingTemplatesPage = lazy(() => import('./features/hr/OnboardingTemplatesPage'))
const OnboardingTrackerPage   = lazy(() => import('./features/hr/OnboardingTrackerPage'))
const HRImportPage            = lazy(() => import('./features/hr/ImportPage'))
// HR Phase 3 pages — AI Intelligence
const FlightRiskDashboard     = lazy(() => import('./features/hr/ai/FlightRiskDashboard'))
const BurnoutAlerts           = lazy(() => import('./features/hr/ai/BurnoutAlerts'))
const SkillsOntologyPage      = lazy(() => import('./features/hr/ai/SkillsOntologyPage'))
const HRChatbot               = lazy(() => import('./features/hr/ai/HRChatbot'))
const WorkforcePlanningPage   = lazy(() => import('./features/hr/ai/WorkforcePlanningPage'))
// HR Phase 3 pages — Workflows
const HRWorkflowListPage      = lazy(() => import('./features/hr/workflows/WorkflowListPage'))
const WorkflowBuilderPage     = lazy(() => import('./features/hr/workflows/WorkflowBuilderPage'))
const WorkflowExecutionPage   = lazy(() => import('./features/hr/workflows/WorkflowExecutionPage'))
const WorkflowApprovals       = lazy(() => import('./features/hr/workflows/WorkflowApprovals'))
// HR Phase 3 pages — Analytics
const CustomDashboardBuilder  = lazy(() => import('./features/hr/analytics/CustomDashboardBuilder'))
const DEIDashboard            = lazy(() => import('./features/hr/analytics/DEIDashboard'))
const PredictiveReports       = lazy(() => import('./features/hr/analytics/PredictiveReports'))
const CostModelingPage        = lazy(() => import('./features/hr/analytics/CostModelingPage'))

// HR Phase 1 pages
const HRSkillsMatrixPage = lazy(() => import('./features/hr/SkillsMatrixPage'))
const SuccessionPlanningPage = lazy(() => import('./features/hr/SuccessionPlanningPage'))
const CompensationBandsPage = lazy(() => import('./features/hr/CompensationBandsPage'))
const MeritPlanningPage = lazy(() => import('./features/hr/MeritPlanningPage'))
const BonusManagementPage = lazy(() => import('./features/hr/BonusManagementPage'))
const EquityGrantsPage = lazy(() => import('./features/hr/EquityGrantsPage'))
const ShiftSchedulingPage = lazy(() => import('./features/hr/ShiftSchedulingPage'))
const HolidayCalendarPage = lazy(() => import('./features/hr/HolidayCalendarPage'))
const GoalsPage = lazy(() => import('./features/hr/GoalsPage'))
const FeedbackPage = lazy(() => import('./features/hr/FeedbackPage'))
const ReviewCyclesPage = lazy(() => import('./features/hr/ReviewCyclesPage'))
const ManagerDashboardPage = lazy(() => import('./features/hr/ManagerDashboardPage'))
const AuditLogPage = lazy(() => import('./features/hr/AuditLogPage'))

// CRM sub-pages
const ContactsPage     = lazy(() => import('./features/crm/ContactsPage'))
const ContactDetail    = lazy(() => import('./features/crm/ContactDetail'))
const LeadsPage        = lazy(() => import('./features/crm/LeadsPage'))
const PipelinePage     = lazy(() => import('./features/crm/PipelinePage'))
const DealsPage        = lazy(() => import('./features/crm/DealsPage'))
const CampaignsPage    = lazy(() => import('./features/crm/CampaignsPage'))
const CampaignAnalyticsPage = lazy(() => import('./features/crm/CampaignAnalyticsPage'))
const QuotesPage       = lazy(() => import('./features/crm/QuotesPage'))
const ContactTimelinePage = lazy(() => import('./features/crm/ContactTimelinePage'))
const SalesForecastPage = lazy(() => import('./features/crm/SalesForecastPage'))
const PipelineAnalyticsPage = lazy(() => import('./features/crm/PipelineAnalyticsPage'))
const ContactImportPage = lazy(() => import('./features/crm/ContactImportPage'))
const CRMTicketsPage   = lazy(() => import('./features/crm/TicketsPage'))
// CRM MVP upgrade pages
const Contact360Page        = lazy(() => import('./features/crm/Contact360Page'))
const DuplicatesPage        = lazy(() => import('./features/crm/DuplicatesPage'))
const CRMCustomFieldsPage   = lazy(() => import('./features/crm/CustomFieldsPage'))
const LeadScoringPage       = lazy(() => import('./features/crm/LeadScoringPage'))
const SequencesPage         = lazy(() => import('./features/crm/SequencesPage'))
const SequenceBuilderPage   = lazy(() => import('./features/crm/SequenceBuilderPage'))
const CRMTemplatesPage      = lazy(() => import('./features/crm/TemplatesPage'))
const CRMActivitiesPage     = lazy(() => import('./features/crm/ActivitiesPage'))
const PipelinesSettingsPage = lazy(() => import('./features/crm/PipelinesSettingsPage'))
// CRM Phase 2 pages — Marketing
const EmailCampaignBuilder  = lazy(() => import('./features/crm/EmailCampaignBuilder'))
const ABTestSetup           = lazy(() => import('./features/crm/ABTestSetup'))
const SegmentBuilder        = lazy(() => import('./features/crm/SegmentBuilder'))
const ContentCalendarPage   = lazy(() => import('./features/crm/ContentCalendarPage'))
// CRM Phase 2 pages — Service Hub
const ConversationInbox     = lazy(() => import('./features/crm/ConversationInbox'))
const CRMKnowledgeBasePage  = lazy(() => import('./features/crm/KnowledgeBasePage'))
const SLAPoliciesPage       = lazy(() => import('./features/crm/SLAPoliciesPage'))
// CRM Phase 2 pages — Automations & Reports
const CRMWorkflowListPage   = lazy(() => import('./features/crm/WorkflowListPage'))
const WorkflowCanvasPage    = lazy(() => import('./features/crm/WorkflowCanvasPage'))
const CRMDashboardBuilderPage = lazy(() => import('./features/crm/DashboardBuilderPage'))
const FunnelReportPage      = lazy(() => import('./features/crm/FunnelReportPage'))
const CohortReportPage      = lazy(() => import('./features/crm/CohortReportPage'))
const LeaderboardPage       = lazy(() => import('./features/crm/LeaderboardPage'))
// CRM Phase 3 pages — AI Agents, Custom Objects, Collaboration, Audit
const AIAgentConfigPage     = lazy(() => import('./features/crm/AIAgentConfigPage'))
const AIAgentRunsPage       = lazy(() => import('./features/crm/AIAgentRunsPage'))
const CustomObjectListPage  = lazy(() => import('./features/crm/CustomObjectListPage'))
const CustomObjectRecordsPage = lazy(() => import('./features/crm/CustomObjectRecordsPage'))
const CustomObjectFormBuilder = lazy(() => import('./features/crm/CustomObjectFormBuilder'))
const CRMAuditLogPage       = lazy(() => import('./features/crm/AuditLogPage'))

// Inventory sub-pages
const ItemsPage           = lazy(() => import('./features/inventory/ItemsPage'))
const WarehousesPage      = lazy(() => import('./features/inventory/WarehousesPage'))
const StockMovementsPage  = lazy(() => import('./features/inventory/StockMovementsPage'))
const PurchaseOrdersPage  = lazy(() => import('./features/inventory/PurchaseOrdersPage'))
const PODetailPage        = lazy(() => import('./features/inventory/PODetailPage'))
const ReorderAlertsPage   = lazy(() => import('./features/inventory/ReorderAlertsPage'))
const InvSuppliersPage    = lazy(() => import('./features/inventory/SuppliersPage'))
const StockAdjustmentPage = lazy(() => import('./features/inventory/StockAdjustmentPage'))
const PhysicalCountPage   = lazy(() => import('./features/inventory/PhysicalCountPage'))
const ItemHistoryPage     = lazy(() => import('./features/inventory/ItemHistoryPage'))
const ValuationReportPage = lazy(() => import('./features/inventory/ValuationReportPage'))
const TurnoverReportPage  = lazy(() => import('./features/inventory/TurnoverReportPage'))
const ItemVariantsPage    = lazy(() => import('./features/inventory/ItemVariantsPage'))
const BatchTrackingPage   = lazy(() => import('./features/inventory/BatchTrackingPage'))

// Manufacturing sub-pages
const BOMListPage             = lazy(() => import('./features/manufacturing/BOMListPage'))
const BOMDetailPage           = lazy(() => import('./features/manufacturing/BOMDetail'))
const WorkStationsPage        = lazy(() => import('./features/manufacturing/WorkStationsPage'))
const WorkOrdersPage          = lazy(() => import('./features/manufacturing/WorkOrdersPage'))
const WorkOrderDetailPage     = lazy(() => import('./features/manufacturing/WorkOrderDetail'))
const QualityChecksPage       = lazy(() => import('./features/manufacturing/QualityChecksPage'))
const RoutingPage         = lazy(() => import('./features/manufacturing/RoutingPage'))
const ScrapPage           = lazy(() => import('./features/manufacturing/ScrapPage'))
const MaintenancePage     = lazy(() => import('./features/manufacturing/MaintenancePage'))
const ProductionPlanPage  = lazy(() => import('./features/manufacturing/ProductionPlanPage'))
const MfgKPIsPage         = lazy(() => import('./features/manufacturing/MfgKPIsPage'))
const ProductionTrackingPage = lazy(() => import('./features/manufacturing/ProductionTracking'))
const MobileProductionEntry = lazy(() => import('./features/manufacturing/MobileProductionEntry'))
const WorkstationTablet     = lazy(() => import('./features/manufacturing/WorkstationTablet'))
const ECOListPage           = lazy(() => import('./features/manufacturing/ECOListPage'))
const ECODetailPage         = lazy(() => import('./features/manufacturing/ECODetail'))
const InspectionPlansPage   = lazy(() => import('./features/manufacturing/InspectionPlansPage'))
const InspectionPlanDetailPage = lazy(() => import('./features/manufacturing/InspectionPlanDetail'))
const NCRListPage           = lazy(() => import('./features/manufacturing/NCRListPage'))
const NCRDetailPage         = lazy(() => import('./features/manufacturing/NCRDetail'))
const CAPAListPage          = lazy(() => import('./features/manufacturing/CAPAListPage'))
const CAPADetailPage        = lazy(() => import('./features/manufacturing/CAPADetail'))
const LotTrackingPage       = lazy(() => import('./features/manufacturing/LotTrackingPage'))
const TraceabilityViewPage  = lazy(() => import('./features/manufacturing/TraceabilityView'))
const GenealogyTreePage     = lazy(() => import('./features/manufacturing/GenealogyTree'))
const BatchRecordPage       = lazy(() => import('./features/manufacturing/BatchRecordPage'))
const ReworkOrdersPage      = lazy(() => import('./features/manufacturing/ReworkOrdersPage'))
// Phase 2: Planning, Equipment, Labor
const GanttSchedulerPage    = lazy(() => import('./features/manufacturing/GanttScheduler'))
const CapacityDashboardPage = lazy(() => import('./features/manufacturing/CapacityDashboard'))
const ScenarioPlannerPage   = lazy(() => import('./features/manufacturing/ScenarioPlanner'))
const AssetRegisterPage     = lazy(() => import('./features/manufacturing/AssetRegisterPage'))
const AssetDetailPage       = lazy(() => import('./features/manufacturing/AssetDetail'))
const DowntimeTrackerPage   = lazy(() => import('./features/manufacturing/DowntimeTracker'))
const DowntimeAnalysisPage  = lazy(() => import('./features/manufacturing/DowntimeAnalysis'))
const MaintenanceMWOPage    = lazy(() => import('./features/manufacturing/MaintenanceWorkOrdersPage'))
const OEEReportPage         = lazy(() => import('./features/manufacturing/OEEDetailedReport'))
const MfgSkillsMatrixPage   = lazy(() => import('./features/manufacturing/SkillsMatrixPage'))
const CertTrackerPage       = lazy(() => import('./features/manufacturing/CertificationTracker'))
const CrewSchedulingPage    = lazy(() => import('./features/manufacturing/CrewSchedulingPage'))
// Phase 3 — MES + AI + CPQ
const ProductionBoardPage        = lazy(() => import('./features/manufacturing/ProductionBoard'))
const IoTDashboardPage           = lazy(() => import('./features/manufacturing/IoTDashboard'))
const DigitalWorkInstructionsPage = lazy(() => import('./features/manufacturing/DigitalWorkInstructions'))
const BottleneckAnalysisPage     = lazy(() => import('./features/manufacturing/BottleneckAnalysis'))
const QualityRiskDashboardPage   = lazy(() => import('./features/manufacturing/QualityRiskDashboard'))
const ScheduleSuggestionsPage    = lazy(() => import('./features/manufacturing/ScheduleSuggestions'))
const ExecutiveSummaryPage       = lazy(() => import('./features/manufacturing/ExecutiveSummary'))
const ProductConfiguratorPage    = lazy(() => import('./features/manufacturing/ProductConfigurator'))
const ConfiguratorRulesAdminPage = lazy(() => import('./features/manufacturing/ConfiguratorRulesAdmin'))

// Supply Chain sub-pages
const SuppliersPage        = lazy(() => import('./features/supplychain/SuppliersPage'))
const RequisitionsPage     = lazy(() => import('./features/supplychain/RequisitionsPage'))
const SupplierDetailPage   = lazy(() => import('./features/supplychain/SupplierDetail'))
const GRNPage              = lazy(() => import('./features/supplychain/GRNPage'))
const SCReturnsPage        = lazy(() => import('./features/supplychain/ReturnsPage'))
const RequisitionDetail    = lazy(() => import('./features/supplychain/RequisitionDetail'))
const GRNDetail            = lazy(() => import('./features/supplychain/GRNDetail'))
const ReturnDetail         = lazy(() => import('./features/supplychain/ReturnDetail'))
const ShipmentTrackingPage  = lazy(() => import('./features/supplychain/ShipmentTrackingPage'))
const QualityInspectionPage = lazy(() => import('./features/supplychain/QualityInspectionPage'))
const SupplierRatingsPage   = lazy(() => import('./features/supplychain/SupplierRatingsPage'))
const ContractsPage         = lazy(() => import('./features/supplychain/ContractsPage'))
const SCPerformancePage     = lazy(() => import('./features/supplychain/PerformancePage'))
const MobileGoodsReceipt    = lazy(() => import('./features/supplychain/MobileGoodsReceipt'))
const MobileQualityInspection = lazy(() => import('./features/supplychain/MobileQualityInspection'))

// Supply Chain Planning & Ops sub-pages
const DemandForecastPage     = lazy(() => import('./features/supplychain/DemandForecastPage'))
const ForecastScenariosPage  = lazy(() => import('./features/supplychain/ForecastScenariosPage'))
const SOPPlanPage            = lazy(() => import('./features/supplychain/SOPPlanPage'))
const SOPPlanDetail          = lazy(() => import('./features/supplychain/SOPPlanDetail'))
const SupplyPlanPage         = lazy(() => import('./features/supplychain/SupplyPlanPage'))
const SupplyPlanDetail       = lazy(() => import('./features/supplychain/SupplyPlanDetail'))
const ControlTowerDashboard  = lazy(() => import('./features/supplychain/ControlTowerDashboard'))
const SCAlertPage            = lazy(() => import('./features/supplychain/AlertsPage'))
const RFxPage                = lazy(() => import('./features/supplychain/RFxPage'))
const RFxDetail              = lazy(() => import('./features/supplychain/RFxDetail'))
const SupplierRiskPage       = lazy(() => import('./features/supplychain/SupplierRiskPage'))
const ReplenishmentRulesPage = lazy(() => import('./features/supplychain/ReplenishmentRulesPage'))
const StockHealthPage        = lazy(() => import('./features/supplychain/StockHealthPage'))
const WorkflowsPage          = lazy(() => import('./features/supplychain/WorkflowsPage'))
const WorkflowRunDetail      = lazy(() => import('./features/supplychain/WorkflowRunDetail'))
const CompliancePage         = lazy(() => import('./features/supplychain/CompliancePage'))
const SCAnalyticsPage        = lazy(() => import('./features/supplychain/SCAnalyticsPage'))

// Supply Chain Phase 2 sub-pages
const TransportOrdersPage    = lazy(() => import('./features/supplychain/TransportOrdersPage'))
const CarriersPage           = lazy(() => import('./features/supplychain/CarriersPage'))
const RoutePlannerPage       = lazy(() => import('./features/supplychain/RoutePlannerPage'))
const FreightAuditPage       = lazy(() => import('./features/supplychain/FreightAuditPage'))
const RiskAssessmentsPage    = lazy(() => import('./features/supplychain/RiskAssessmentsPage'))
const ScenarioSimulationPage = lazy(() => import('./features/supplychain/ScenarioSimulationPage'))
const MRPRunPage             = lazy(() => import('./features/supplychain/MRPRunPage'))
const ProductionSchedulePage = lazy(() => import('./features/supplychain/ProductionSchedulePage'))

// POS sub-pages
const POSTerminal          = lazy(() => import('./features/pos/POSTerminal'))
const POSSessions          = lazy(() => import('./features/pos/POSSessions'))
const POSSessionDetail     = lazy(() => import('./features/pos/POSSessionDetail'))
const POSReceiptView       = lazy(() => import('./features/pos/POSReceiptView'))
const POSRegister          = lazy(() => import('./features/pos/POSRegister'))
const TerminalsPage        = lazy(() => import('./features/pos/TerminalsPage'))
const DiscountsPage        = lazy(() => import('./features/pos/DiscountsPage'))
const CashManagementPage   = lazy(() => import('./features/pos/CashManagementPage'))
const DailySalesPage       = lazy(() => import('./features/pos/DailySalesPage'))
const CashierReportPage    = lazy(() => import('./features/pos/CashierReportPage'))
const MobilePayment        = lazy(() => import('./features/pos/MobilePayment'))
const HeldTransactions     = lazy(() => import('./features/pos/HeldTransactions'))
const BundlesPage          = lazy(() => import('./features/pos/BundlesPage'))
const ModifierGroupsPage   = lazy(() => import('./features/pos/ModifierGroupsPage'))
const XZReadingPage        = lazy(() => import('./features/pos/XZReadingPage'))
const ProfitabilityDashboard = lazy(() => import('./features/pos/ProfitabilityDashboard'))
const CommissionRulesPage  = lazy(() => import('./features/pos/CommissionRulesPage'))
const CommissionReportPage = lazy(() => import('./features/pos/CommissionReportPage'))
const Customer360Panel     = lazy(() => import('./features/pos/Customer360Panel'))
const GiftCardsPage        = lazy(() => import('./features/pos/GiftCardsPage'))
const StoreCreditLookup    = lazy(() => import('./features/pos/StoreCreditLookup'))
const PickupOrdersPage     = lazy(() => import('./features/pos/PickupOrdersPage'))
const PickupOrderDetail    = lazy(() => import('./features/pos/PickupOrderDetail'))
const HardwareSettings     = lazy(() => import('./features/pos/HardwareSettings'))

// KDS sub-pages
const KDSDisplay           = lazy(() => import('./features/kds/KDSDisplay'))
const KDSStationManager    = lazy(() => import('./features/kds/KDSStationManager'))

// Loyalty sub-pages
const LoyaltyDashboard     = lazy(() => import('./features/loyalty/LoyaltyDashboard'))
const MemberLookup         = lazy(() => import('./features/loyalty/MemberLookup'))
const RewardsPage          = lazy(() => import('./features/loyalty/RewardsPage'))

// Phase 4 — Customer Display
const CustomerDisplay      = lazy(() => import('./features/pos/CustomerDisplay'))

// E-Commerce sub-pages
const EcomCategoryManagerPage = lazy(() => import('./features/ecommerce/CategoryManagerPage'))
const EcomStorefrontThemeEditor = lazy(() => import('./features/ecommerce/StorefrontThemeEditor'))
const EcomStoresPage      = lazy(() => import('./features/ecommerce/StoresPage'))
const EcomProductsPage    = lazy(() => import('./features/ecommerce/ProductsPage'))
const EcomProductForm     = lazy(() => import('./features/ecommerce/ProductForm'))
const EcomOrdersPage      = lazy(() => import('./features/ecommerce/OrdersPage'))
const EcomOrderDetail     = lazy(() => import('./features/ecommerce/OrderDetail'))
const EcomCustomersPage   = lazy(() => import('./features/ecommerce/CustomersPage'))
const EcomCouponsPage     = lazy(() => import('./features/ecommerce/CouponsPage'))
const EcomFlashSalesPage  = lazy(() => import('./features/ecommerce/FlashSalesPage'))
const EcomShippingPage    = lazy(() => import('./features/ecommerce/ShippingPage'))
const EcomReviewsPage     = lazy(() => import('./features/ecommerce/ReviewsPage'))
const EcomCartPage        = lazy(() => import('./features/ecommerce/CartPage'))
const EcomCheckoutPage    = lazy(() => import('./features/ecommerce/CheckoutPage'))
const EcomCatalogPage     = lazy(() => import('./features/ecommerce/CatalogPage'))
const EcomSalesReportPage = lazy(() => import('./features/ecommerce/SalesReportPage'))
// E-Commerce Phase 2 — B2B, Loyalty, Abandoned Carts, Subscriptions
const EcomB2BPortal            = lazy(() => import('./features/ecommerce/B2BPortal'))
const EcomB2BDashboard         = lazy(() => import('./features/ecommerce/B2BDashboard'))
const EcomQuoteDetail          = lazy(() => import('./features/ecommerce/QuoteDetail'))
const EcomLoyaltyDashboard     = lazy(() => import('./features/ecommerce/LoyaltyDashboard'))
const EcomLoyaltyAccount       = lazy(() => import('./features/ecommerce/LoyaltyAccount'))
const EcomAbandonedCartsPage   = lazy(() => import('./features/ecommerce/AbandonedCartsPage'))
const EcomSubscriptionManagement = lazy(() => import('./features/ecommerce/SubscriptionManagement'))
const EcomSubscriptionsAdmin   = lazy(() => import('./features/ecommerce/SubscriptionsAdmin'))
// E-Commerce Phase 3 — Bundles, Import, Analytics, Blog
const EcomBundlesPage          = lazy(() => import('./features/ecommerce/BundlesPage'))
const EcomImportPage           = lazy(() => import('./features/ecommerce/ImportPage'))
const EcomAdvancedAnalyticsPage = lazy(() => import('./features/ecommerce/AdvancedAnalyticsPage'))
const EcomBlogAdminPage        = lazy(() => import('./features/ecommerce/BlogAdminPage'))
const EcomBlogPostEditor       = lazy(() => import('./features/ecommerce/BlogPostEditor'))

// Support sub-pages
const TicketsPage         = lazy(() => import('./features/support/TicketsPage'))
const TicketDetailPage    = lazy(() => import('./features/support/TicketDetail'))
const CategoriesPage      = lazy(() => import('./features/support/CategoriesPage'))

// Storefront (public-facing)
const StorefrontLayout    = lazy(() => import('./features/storefront/StorefrontLayout'))
const CatalogPage         = lazy(() => import('./features/storefront/CatalogPage'))
const ProductDetailSF     = lazy(() => import('./features/storefront/ProductDetailPage'))
const CartPage            = lazy(() => import('./features/storefront/CartPage'))
const CheckoutPage        = lazy(() => import('./features/storefront/CheckoutPage'))
const CustomerAuthPage    = lazy(() => import('./features/storefront/CustomerAuthPage'))
const CustomerOrdersPage  = lazy(() => import('./features/storefront/CustomerOrdersPage'))
const CustomerOrderDetail = lazy(() => import('./features/storefront/CustomerOrderDetailPage'))

// Public share page
const PublicSharePage     = lazy(() => import('./features/drive/PublicSharePage'))
// Public booking embed page
const BookingEmbed        = lazy(() => import('./features/calendar/BookingEmbed'))
const SLAConfigPage       = lazy(() => import('./features/support/SLAConfigPage'))
const CannedResponsesPage = lazy(() => import('./features/support/CannedResponsesPage'))
const SatisfactionPage    = lazy(() => import('./features/support/SatisfactionPage'))
const KBEditorPage        = lazy(() => import('./features/support/KBEditorPage'))
const KBPublicPage        = lazy(() => import('./features/support/KBPublicPage'))
const SupportKPIsPage     = lazy(() => import('./features/support/SupportKPIsPage'))
const RoutingRulesPage    = lazy(() => import('./features/support/RoutingRulesPage'))

// Support Phase 1 — Live Chat, Templates, Views, Time Tracking, Audit, Inbound Email
const LiveChatDashboard   = lazy(() => import('./features/support/LiveChatDashboard'))
const LiveChatWindow      = lazy(() => import('./features/support/LiveChatWindow'))
const SavedViewsPage      = lazy(() => import('./features/support/SavedViewsPage'))
const TicketTemplatesPage = lazy(() => import('./features/support/TicketTemplatesPage'))
const InboundEmailConfig  = lazy(() => import('./features/support/InboundEmailConfig'))
// Support Phase 2 — Automations, Portal, Forum, Omnichannel, Escalation, AI Copilot
const AutomationList      = lazy(() => import('./features/support/AutomationList'))
const AutomationBuilder   = lazy(() => import('./features/support/AutomationBuilder'))
const ForumPage           = lazy(() => import('./features/support/ForumPage'))
const ForumPostDetail     = lazy(() => import('./features/support/ForumPostDetail'))
const OmnichannelConfigPage = lazy(() => import('./features/support/OmnichannelConfigPage'))
const SLAEscalationConfig = lazy(() => import('./features/support/SLAEscalationConfig'))
const AICopilotPanel      = lazy(() => import('./features/support/AICopilotPanel'))
const CustomerPortalLogin = lazy(() => import('./features/support/CustomerPortalLogin'))
const CustomerPortalTickets = lazy(() => import('./features/support/CustomerPortalTickets'))
// Support Phase 3 — Analytics, Proactive, Voice, Skills, Sandboxes, Customer Health
const AnalyticsOverview   = lazy(() => import('./features/support/AnalyticsOverview'))
const AnalyticsAgents     = lazy(() => import('./features/support/AnalyticsAgents'))
const AnalyticsAIImpact   = lazy(() => import('./features/support/AnalyticsAIImpact'))
const ProactiveRulesPage  = lazy(() => import('./features/support/ProactiveRulesPage'))
const VoiceCallPage       = lazy(() => import('./features/support/VoiceCallPage'))
const CallDetailPage      = lazy(() => import('./features/support/CallDetailPage'))
const AgentSkillsPage     = lazy(() => import('./features/support/AgentSkillsPage'))
const AgentSchedulePage   = lazy(() => import('./features/support/AgentSchedulePage'))
const SandboxPage         = lazy(() => import('./features/support/SandboxPage'))
const CustomerHealthDashboard = lazy(() => import('./features/support/CustomerHealthDashboard'))

// Settings, Profile, Notifications
const ProfilePage         = lazy(() => import('./features/profile/ProfilePage'))
const NotificationsPage   = lazy(() => import('./features/notifications/NotificationsPage'))

// Projects enhancements
const GanttPage            = lazy(() => import('./features/projects/GanttPage'))
const MilestonesPage       = lazy(() => import('./features/projects/MilestonesPage'))
const BurndownPage         = lazy(() => import('./features/projects/BurndownPage'))
const ProjectDashboard     = lazy(() => import('./features/projects/ProjectDashboard'))
const WorkloadPage         = lazy(() => import('./features/projects/WorkloadPage'))
const TemplatesPage        = lazy(() => import('./features/projects/TemplatesPage'))
const ProjectIntegrations  = lazy(() => import('./features/projects/ProjectIntegrations'))
const ProjectListView      = lazy(() => import('./features/projects/ListView'))
const ProjectCalendarView  = lazy(() => import('./features/projects/CalendarView'))
const ProjectBacklogView   = lazy(() => import('./features/projects/BacklogView'))
const ProjectAutomations   = lazy(() => import('./features/projects/AutomationsList'))
const ProjectRecurring     = lazy(() => import('./features/projects/RecurringTaskConfig'))
const CustomFieldsManager  = lazy(() => import('./features/projects/CustomFieldsManager'))

// Analytics enhancements
const DashboardListPage       = lazy(() => import('./features/analytics/DashboardListPage'))
const AnalyticsDashboardBuilderPage = lazy(() => import('./features/analytics/DashboardBuilderPage'))
const QueryBuilderPage        = lazy(() => import('./features/analytics/QueryBuilderPage'))
const ReportSchedulerPage     = lazy(() => import('./features/analytics/ReportSchedulerPage'))
const AlertConfigPage         = lazy(() => import('./features/analytics/AlertConfigPage'))
const ExecutiveDashboardPage  = lazy(() => import('./features/analytics/ExecutiveDashboardPage'))
const SQLEditorPage           = lazy(() => import('./features/analytics/SQLEditorPage'))
const PrebuiltDashboardsPage  = lazy(() => import('./features/analytics/PrebuiltDashboardsPage'))
const PrebuiltFinanceDash     = lazy(() => import('./features/analytics/prebuilt/FinanceDashboard'))
const PrebuiltCRMDash         = lazy(() => import('./features/analytics/prebuilt/CRMDashboard'))
const PrebuiltHRDash          = lazy(() => import('./features/analytics/prebuilt/HRDashboard'))
const PrebuiltInventoryDash   = lazy(() => import('./features/analytics/prebuilt/InventoryDashboard'))
const PrebuiltECommerceDash   = lazy(() => import('./features/analytics/prebuilt/ECommerceDashboard'))
const PrebuiltSupportDash     = lazy(() => import('./features/analytics/prebuilt/SupportDashboard'))
const PrebuiltManufacturingDash = lazy(() => import('./features/analytics/prebuilt/ManufacturingDashboard'))
const ScorecardsPage          = lazy(() => import('./features/analytics/ScorecardsPage'))
const EmbedViewer             = lazy(() => import('./features/analytics/EmbedViewer'))
const MetaAnalyticsPage       = lazy(() => import('./features/analytics/MetaAnalyticsPage'))
const WhatIfSimulatorPage     = lazy(() => import('./features/analytics/WhatIfSimulatorPage'))
const TransformEditorPage     = lazy(() => import('./features/analytics/TransformEditorPage'))

// AI enhancements
const ConversationHistoryPage = lazy(() => import('./features/ai/ConversationHistoryPage'))
const PromptTemplatesPage     = lazy(() => import('./features/ai/PromptTemplatesPage'))
const AIKnowledgeBasePage     = lazy(() => import('./features/ai/KnowledgeBasePage'))
const AIUsageDashboardPage    = lazy(() => import('./features/ai/UsageDashboardPage'))

// ─── Guards ───────────────────────────────────────────────────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const location = useLocation()
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <>{children}</>
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  if (isAuthenticated && user) {
    return <Navigate to={getPostLoginRoute(user)} replace />
  }
  return <>{children}</>
}

function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user || user.role !== 'superadmin') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user || (user.role !== 'superadmin' && user.role !== 'admin')) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

// ─── Placeholder pages (stubs for modules not yet built) ──────────────────────

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center text-4xl mb-4">🚧</div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
      <p className="text-gray-500 dark:text-gray-400 mt-2">This module is under development. Coming soon!</p>
    </div>
  )
}

// ─── Per-route Suspense wrapper ──────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Spinner size="lg" />
    </div>
  )
}

function S({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <>
      <ToastProvider />
      <ErrorBoundary>
      <Suspense fallback={null}>
        <Routes>
          {/* Public */}
          <Route
            path="/login"
            element={
              <RequireGuest>
                <LoginPage />
              </RequireGuest>
            }
          />

          {/* Public storefront */}
          <Route path="/store/:storeSlug" element={<S><StorefrontLayout /></S>}>
            <Route index element={<S><CatalogPage /></S>} />
            <Route path="product/:productId" element={<S><ProductDetailSF /></S>} />
            <Route path="cart" element={<S><CartPage /></S>} />
            <Route path="checkout" element={<S><CheckoutPage /></S>} />
            <Route path="login" element={<S><CustomerAuthPage /></S>} />
            <Route path="orders" element={<S><CustomerOrdersPage /></S>} />
            <Route path="orders/:orderId" element={<S><CustomerOrderDetail /></S>} />
          </Route>

          {/* Public share link */}
          <Route path="/share/:link" element={<S><PublicSharePage /></S>} />

          {/* Public booking page — no auth required */}
          <Route path="/book/:slug" element={<S><BookingEmbed /></S>} />

          {/* POS Customer-Facing Display (full-screen, outside AppShell) */}
          <Route path="/pos/customer-display" element={<RequireAuth><S><CustomerDisplay /></S></RequireAuth>} />

          {/* Protected app shell */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            {/* Home / Urban Board */}
            <Route index element={<HomePage />} />

            {/* Finance */}
            <Route path="finance" element={<S><FinanceDashboard /></S>} />
            <Route path="finance/accounts" element={<S><AccountsPage /></S>} />
            <Route path="finance/invoices" element={<S><InvoicesPage /></S>} />
            <Route path="finance/invoices/:id" element={<S><InvoiceDetail /></S>} />
            <Route path="finance/payments" element={<S><PaymentsPage /></S>} />
            <Route path="finance/journal" element={<S><JournalPage /></S>} />
            <Route path="finance/reports" element={<S><FinanceReportsPage /></S>} />
            <Route path="finance/budgets" element={<S><BudgetPage /></S>} />
            <Route path="finance/tax-config" element={<S><TaxConfigPage /></S>} />
            <Route path="finance/currencies" element={<S><CurrencyPage /></S>} />
            <Route path="finance/bank-reconciliation" element={<S><BankReconciliationPage /></S>} />
            <Route path="finance/pnl" element={<S><PnLReport /></S>} />
            <Route path="finance/balance-sheet" element={<S><BalanceSheetPage /></S>} />
            <Route path="finance/recurring-invoices" element={<S><RecurringInvoicesPage /></S>} />
            <Route path="finance/expenses" element={<S><ExpensesPage /></S>} />
            <Route path="finance/vendor-bills" element={<S><VendorBillsPage /></S>} />
            <Route path="finance/fixed-assets" element={<S><FixedAssetsPage /></S>} />
            <Route path="finance/cash-flow" element={<S><CashFlowPage /></S>} />
            <Route path="finance/aged-report" element={<S><AgedReportPage /></S>} />
            <Route path="finance/kpis" element={<S><FinanceKPIsPage /></S>} />
            {/* Finance Phase 2A — AI-era upgrades */}
            <Route path="finance/estimates" element={<S><EstimatesPage /></S>} />
            <Route path="finance/workflow-rules" element={<S><WorkflowRulesPage /></S>} />
            <Route path="finance/ai" element={<S><FinanceAIPage /></S>} />
            <Route path="finance/revenue-streams" element={<S><RevenueStreamsPage /></S>} />
            <Route path="finance/job-costing" element={<S><JobCostingPage /></S>} />
            <Route path="finance/compliance-calendar" element={<S><ComplianceCalendarPage /></S>} />
            <Route path="finance/custom-fields" element={<S><CustomFieldsAdmin /></S>} />
            <Route path="finance/dimensions" element={<S><DimensionsAdmin /></S>} />
            <Route path="finance/dashboard-builder" element={<S><FinanceDashboardBuilder /></S>} />
            <Route path="finance/report-builder" element={<S><ReportBuilderPage /></S>} />
            <Route path="hr" element={<S><HRDashboard /></S>} />
            <Route path="hr/departments" element={<S><DepartmentsPage /></S>} />
            <Route path="hr/employees" element={<S><EmployeesPage /></S>} />
            <Route path="hr/employees/:id" element={<S><EmployeeDetail /></S>} />
            <Route path="hr/leave" element={<S><LeavePage /></S>} />
            <Route path="hr/attendance" element={<S><AttendancePage /></S>} />
            <Route path="hr/payroll" element={<S><PayrollPage /></S>} />
            <Route path="hr/payslips/:id" element={<S><PayslipDetail /></S>} />
            <Route path="hr/tax-brackets" element={<S><TaxBracketsPage /></S>} />
            <Route path="hr/pay-runs" element={<S><PayRunPage /></S>} />
            <Route path="hr/org-chart" element={<S><OrgChartPage /></S>} />
            <Route path="hr/performance-reviews" element={<S><PerformanceReviewsPage /></S>} />
            <Route path="hr/training" element={<S><TrainingPage /></S>} />
            <Route path="hr/documents" element={<S><EmployeeDocumentsPage /></S>} />
            <Route path="hr/leave-calendar" element={<S><LeaveCalendarPage /></S>} />
            <Route path="hr/payroll-reports" element={<S><PayrollReportsPage /></S>} />
            <Route path="hr/onboarding" element={<S><OnboardingPage /></S>} />
            <Route path="hr/offboarding" element={<S><OffboardingPage /></S>} />
            <Route path="hr/skills-matrix" element={<S><HRSkillsMatrixPage /></S>} />
            <Route path="hr/succession-planning" element={<S><SuccessionPlanningPage /></S>} />
            <Route path="hr/compensation-bands" element={<S><CompensationBandsPage /></S>} />
            <Route path="hr/merit-planning" element={<S><MeritPlanningPage /></S>} />
            <Route path="hr/bonuses" element={<S><BonusManagementPage /></S>} />
            <Route path="hr/equity-grants" element={<S><EquityGrantsPage /></S>} />
            <Route path="hr/shift-scheduling" element={<S><ShiftSchedulingPage /></S>} />
            <Route path="hr/holiday-calendar" element={<S><HolidayCalendarPage /></S>} />
            <Route path="hr/goals" element={<S><GoalsPage /></S>} />
            <Route path="hr/feedback" element={<S><FeedbackPage /></S>} />
            <Route path="hr/review-cycles" element={<S><ReviewCyclesPage /></S>} />
            <Route path="hr/manager-dashboard" element={<S><ManagerDashboardPage /></S>} />
            <Route path="hr/audit-log" element={<S><AuditLogPage /></S>} />
            {/* HR Phase 2 — ATS */}
            <Route path="hr/ats" element={<S><ATSDashboard /></S>} />
            <Route path="hr/ats/requisitions" element={<S><RequisitionsAtsPage /></S>} />
            <Route path="hr/ats/requisitions/:id" element={<S><RequisitionDetail2 /></S>} />
            <Route path="hr/ats/requisitions/:id/pipeline" element={<S><PipelineBoard /></S>} />
            <Route path="hr/ats/candidates" element={<S><CandidatesPage /></S>} />
            <Route path="hr/ats/candidates/:id" element={<S><CandidateDetail /></S>} />
            <Route path="hr/ats/interviews" element={<S><InterviewScheduler /></S>} />
            {/* HR Phase 2 — LMS */}
            <Route path="hr/learning" element={<S><LearningDashboard /></S>} />
            <Route path="hr/courses" element={<S><CourseCatalogPage /></S>} />
            <Route path="hr/courses/new" element={<S><CourseBuilderPage /></S>} />
            <Route path="hr/courses/:id" element={<S><CourseDetailPage /></S>} />
            <Route path="hr/courses/:id/edit" element={<S><CourseBuilderPage /></S>} />
            <Route path="hr/certifications" element={<S><CertificationsPage /></S>} />
            {/* HR Phase 2 — Engagement */}
            <Route path="hr/engagement" element={<S><EngagementDashboard /></S>} />
            <Route path="hr/surveys/new" element={<S><SurveyBuilderPage /></S>} />
            <Route path="hr/surveys/:id/edit" element={<S><SurveyBuilderPage /></S>} />
            <Route path="hr/surveys/:id/respond" element={<S><SurveyResponsePage /></S>} />
            <Route path="hr/surveys/:id/results" element={<S><SurveyResultsPage /></S>} />
            <Route path="hr/recognition" element={<S><RecognitionFeedPage /></S>} />
            {/* HR Phase 2 — Onboarding & Import */}
            <Route path="hr/onboarding-templates" element={<S><OnboardingTemplatesPage /></S>} />
            <Route path="hr/onboarding-tracker" element={<S><OnboardingTrackerPage /></S>} />
            <Route path="hr/import" element={<S><HRImportPage /></S>} />
            {/* HR Phase 3 — AI Intelligence */}
            <Route path="hr/ai/flight-risk" element={<S><FlightRiskDashboard /></S>} />
            <Route path="hr/ai/burnout" element={<S><BurnoutAlerts /></S>} />
            <Route path="hr/ai/skills-ontology" element={<S><SkillsOntologyPage /></S>} />
            <Route path="hr/ai/chatbot" element={<S><HRChatbot /></S>} />
            <Route path="hr/ai/workforce-planning" element={<S><WorkforcePlanningPage /></S>} />
            {/* HR Phase 3 — Workflows */}
            <Route path="hr/workflows" element={<S><HRWorkflowListPage /></S>} />
            <Route path="hr/workflows/builder" element={<S><WorkflowBuilderPage /></S>} />
            <Route path="hr/workflows/:id/edit" element={<S><WorkflowBuilderPage /></S>} />
            <Route path="hr/workflows/executions" element={<S><WorkflowExecutionPage /></S>} />
            <Route path="hr/workflows/approvals" element={<S><WorkflowApprovals /></S>} />
            {/* HR Phase 3 — People Analytics */}
            <Route path="hr/analytics" element={<S><CustomDashboardBuilder /></S>} />
            <Route path="hr/analytics/dei" element={<S><DEIDashboard /></S>} />
            <Route path="hr/analytics/predictive" element={<S><PredictiveReports /></S>} />
            <Route path="hr/analytics/cost" element={<S><CostModelingPage /></S>} />
            <Route path="crm" element={<S><CRMDashboard /></S>} />
            <Route path="crm/contacts" element={<S><ContactsPage /></S>} />
            <Route path="crm/contacts/:id" element={<S><ContactDetail /></S>} />
            <Route path="crm/leads" element={<S><LeadsPage /></S>} />
            <Route path="crm/pipeline" element={<S><PipelinePage /></S>} />
            <Route path="crm/deals" element={<S><DealsPage /></S>} />
            <Route path="crm/campaigns" element={<S><CampaignsPage /></S>} />
            <Route path="crm/campaigns/:id/analytics" element={<S><CampaignAnalyticsPage /></S>} />
            <Route path="crm/quotes" element={<S><QuotesPage /></S>} />
            <Route path="crm/contacts/:id/timeline" element={<S><ContactTimelinePage /></S>} />
            <Route path="crm/sales-forecast" element={<S><SalesForecastPage /></S>} />
            <Route path="crm/pipeline-analytics" element={<S><PipelineAnalyticsPage /></S>} />
            <Route path="crm/contacts/import" element={<S><ContactImportPage /></S>} />
            <Route path="crm/tickets" element={<S><CRMTicketsPage /></S>} />
            {/* CRM MVP upgrade routes */}
            <Route path="crm/contacts/:id/360" element={<S><Contact360Page /></S>} />
            <Route path="crm/duplicates" element={<S><DuplicatesPage /></S>} />
            <Route path="crm/custom-fields" element={<S><CRMCustomFieldsPage /></S>} />
            <Route path="crm/lead-scoring" element={<S><LeadScoringPage /></S>} />
            <Route path="crm/sequences" element={<S><SequencesPage /></S>} />
            <Route path="crm/sequences/:id" element={<S><SequenceBuilderPage /></S>} />
            <Route path="crm/templates" element={<S><CRMTemplatesPage /></S>} />
            <Route path="crm/activities" element={<S><CRMActivitiesPage /></S>} />
            <Route path="crm/pipelines/settings" element={<S><PipelinesSettingsPage /></S>} />
            {/* CRM Phase 2 — Marketing */}
            <Route path="crm/campaigns/:id/email-builder" element={<S><EmailCampaignBuilder /></S>} />
            <Route path="crm/ab-test" element={<S><ABTestSetup /></S>} />
            <Route path="crm/segments" element={<S><SegmentBuilder /></S>} />
            <Route path="crm/content-calendar" element={<S><ContentCalendarPage /></S>} />
            {/* CRM Phase 2 — Service Hub */}
            <Route path="crm/conversations" element={<S><ConversationInbox /></S>} />
            <Route path="crm/knowledge-base" element={<S><CRMKnowledgeBasePage /></S>} />
            <Route path="crm/sla-policies" element={<S><SLAPoliciesPage /></S>} />
            {/* CRM Phase 2 — Automations & Reports */}
            <Route path="crm/workflows" element={<S><CRMWorkflowListPage /></S>} />
            <Route path="crm/workflows/:id/canvas" element={<S><WorkflowCanvasPage /></S>} />
            <Route path="crm/dashboard-builder" element={<S><CRMDashboardBuilderPage /></S>} />
            <Route path="crm/reports/funnel" element={<S><FunnelReportPage /></S>} />
            <Route path="crm/reports/cohort" element={<S><CohortReportPage /></S>} />
            <Route path="crm/leaderboard" element={<S><LeaderboardPage /></S>} />
            {/* CRM Phase 3 — AI Agents, Custom Objects, Audit */}
            <Route path="crm/ai-agents" element={<S><AIAgentConfigPage /></S>} />
            <Route path="crm/ai-agents/:id/runs" element={<S><AIAgentRunsPage /></S>} />
            <Route path="crm/custom-objects" element={<S><CustomObjectListPage /></S>} />
            <Route path="crm/custom-objects/:id/records" element={<S><CustomObjectRecordsPage /></S>} />
            <Route path="crm/custom-objects/:id/form-builder" element={<S><CustomObjectFormBuilder /></S>} />
            <Route path="crm/audit-log" element={<S><CRMAuditLogPage /></S>} />
            <Route path="projects" element={<S><ProjectsPage /></S>} />
            <Route path="projects/:id" element={<S><ProjectBoard /></S>} />
            <Route path="projects/:id/time-report" element={<S><TimeLogReport /></S>} />
            <Route path="projects/:id/gantt" element={<S><GanttPage /></S>} />
            <Route path="projects/:id/milestones" element={<S><MilestonesPage /></S>} />
            <Route path="projects/:id/burndown" element={<S><BurndownPage /></S>} />
            <Route path="projects/:id/dashboard" element={<S><ProjectDashboard /></S>} />
            <Route path="projects/workload" element={<S><WorkloadPage /></S>} />
            <Route path="projects/templates" element={<S><TemplatesPage /></S>} />
            <Route path="projects/:id/integrations" element={<S><ProjectIntegrations /></S>} />
            <Route path="projects/:id/list" element={<S><ProjectListView /></S>} />
            <Route path="projects/:id/calendar" element={<S><ProjectCalendarView /></S>} />
            <Route path="projects/:id/backlog" element={<S><ProjectBacklogView /></S>} />
            <Route path="projects/:id/automations" element={<S><ProjectAutomations /></S>} />
            <Route path="projects/:id/recurring" element={<S><ProjectRecurring /></S>} />
            <Route path="projects/:id/custom-fields" element={<S><CustomFieldsManager /></S>} />
            {/* Inventory */}
            <Route path="inventory" element={<S><InventoryDashboard /></S>} />
            <Route path="inventory/items" element={<S><ItemsPage /></S>} />
            <Route path="inventory/warehouses" element={<S><WarehousesPage /></S>} />
            <Route path="inventory/stock-movements" element={<S><StockMovementsPage /></S>} />
            <Route path="inventory/purchase-orders" element={<S><PurchaseOrdersPage /></S>} />
            <Route path="inventory/purchase-orders/:id" element={<S><PODetailPage /></S>} />
            <Route path="inventory/reorder-alerts" element={<S><ReorderAlertsPage /></S>} />
            <Route path="inventory/suppliers" element={<S><InvSuppliersPage /></S>} />
            <Route path="inventory/stock-adjustments" element={<S><StockAdjustmentPage /></S>} />
            <Route path="inventory/physical-count" element={<S><PhysicalCountPage /></S>} />
            <Route path="inventory/items/:id/history" element={<S><ItemHistoryPage /></S>} />
            <Route path="inventory/valuation" element={<S><ValuationReportPage /></S>} />
            <Route path="inventory/turnover" element={<S><TurnoverReportPage /></S>} />
            <Route path="inventory/items/:id/variants" element={<S><ItemVariantsPage /></S>} />
            <Route path="inventory/batch-tracking" element={<S><BatchTrackingPage /></S>} />
            {/* Supply Chain */}
            <Route path="supply-chain" element={<S><SupplyChainDashboard /></S>} />
            <Route path="supply-chain/suppliers" element={<S><SuppliersPage /></S>} />
            <Route path="supply-chain/requisitions" element={<S><RequisitionsPage /></S>} />
            <Route path="supply-chain/suppliers/:id" element={<S><SupplierDetailPage /></S>} />
            <Route path="supply-chain/requisitions/:id" element={<S><RequisitionDetail /></S>} />
            <Route path="supply-chain/grn" element={<S><GRNPage /></S>} />
            <Route path="supply-chain/grn/:id" element={<S><GRNDetail /></S>} />
            <Route path="supply-chain/returns" element={<S><SCReturnsPage /></S>} />
            <Route path="supply-chain/returns/:id" element={<S><ReturnDetail /></S>} />
            <Route path="supply-chain/shipments" element={<S><ShipmentTrackingPage /></S>} />
            <Route path="supply-chain/quality-inspections" element={<S><QualityInspectionPage /></S>} />
            <Route path="supply-chain/ratings" element={<S><SupplierRatingsPage /></S>} />
            <Route path="supply-chain/contracts" element={<S><ContractsPage /></S>} />
            <Route path="supply-chain/performance" element={<S><SCPerformancePage /></S>} />
            <Route path="supply-chain/mobile-goods-receipt" element={<S><MobileGoodsReceipt /></S>} />
            <Route path="supply-chain/mobile-quality-inspection" element={<S><MobileQualityInspection /></S>} />
            {/* Supply Chain Planning & Ops */}
            <Route path="supply-chain/demand-forecasts" element={<S><DemandForecastPage /></S>} />
            <Route path="supply-chain/forecast-scenarios" element={<S><ForecastScenariosPage /></S>} />
            <Route path="supply-chain/sop" element={<S><SOPPlanPage /></S>} />
            <Route path="supply-chain/sop/:id" element={<S><SOPPlanDetail /></S>} />
            <Route path="supply-chain/supply-plans" element={<S><SupplyPlanPage /></S>} />
            <Route path="supply-chain/supply-plans/:id" element={<S><SupplyPlanDetail /></S>} />
            <Route path="supply-chain/control-tower" element={<S><ControlTowerDashboard /></S>} />
            <Route path="supply-chain/alerts" element={<S><SCAlertPage /></S>} />
            <Route path="supply-chain/rfx" element={<S><RFxPage /></S>} />
            <Route path="supply-chain/rfx/:id" element={<S><RFxDetail /></S>} />
            <Route path="supply-chain/supplier-risks" element={<S><SupplierRiskPage /></S>} />
            <Route path="supply-chain/replenishment" element={<S><ReplenishmentRulesPage /></S>} />
            <Route path="supply-chain/stock-health" element={<S><StockHealthPage /></S>} />
            <Route path="supply-chain/workflows" element={<S><WorkflowsPage /></S>} />
            <Route path="supply-chain/workflows/:id" element={<S><WorkflowRunDetail /></S>} />
            <Route path="supply-chain/compliance" element={<S><CompliancePage /></S>} />
            <Route path="supply-chain/analytics" element={<S><SCAnalyticsPage /></S>} />
            {/* Supply Chain Phase 2 */}
            <Route path="supply-chain/transport-orders" element={<S><TransportOrdersPage /></S>} />
            <Route path="supply-chain/carriers" element={<S><CarriersPage /></S>} />
            <Route path="supply-chain/route-planner" element={<S><RoutePlannerPage /></S>} />
            <Route path="supply-chain/freight-audit" element={<S><FreightAuditPage /></S>} />
            <Route path="supply-chain/risk" element={<S><RiskAssessmentsPage /></S>} />
            <Route path="supply-chain/scenarios" element={<S><ScenarioSimulationPage /></S>} />
            <Route path="supply-chain/mrp" element={<S><MRPRunPage /></S>} />
            <Route path="supply-chain/production-schedule" element={<S><ProductionSchedulePage /></S>} />
            {/* Manufacturing */}
            <Route path="manufacturing" element={<S><ManufacturingDashboard /></S>} />
            <Route path="manufacturing/bom" element={<S><BOMListPage /></S>} />
            <Route path="manufacturing/bom/:id" element={<S><BOMDetailPage /></S>} />
            <Route path="manufacturing/workstations" element={<S><WorkStationsPage /></S>} />
            <Route path="manufacturing/work-orders" element={<S><WorkOrdersPage /></S>} />
            <Route path="manufacturing/work-orders/:id" element={<S><WorkOrderDetailPage /></S>} />
            <Route path="manufacturing/quality-checks" element={<S><QualityChecksPage /></S>} />
            <Route path="manufacturing/routing" element={<S><RoutingPage /></S>} />
            <Route path="manufacturing/scrap" element={<S><ScrapPage /></S>} />
            <Route path="manufacturing/maintenance" element={<S><MaintenancePage /></S>} />
            <Route path="manufacturing/production-plan" element={<S><ProductionPlanPage /></S>} />
            <Route path="manufacturing/kpis" element={<S><MfgKPIsPage /></S>} />
            <Route path="manufacturing/production-tracking" element={<S><ProductionTrackingPage /></S>} />
            <Route path="manufacturing/mobile-production" element={<S><MobileProductionEntry /></S>} />
            <Route path="manufacturing/workstation-dashboard" element={<S><WorkstationTablet /></S>} />
            <Route path="manufacturing/eco" element={<S><ECOListPage /></S>} />
            <Route path="manufacturing/eco/:ecoId" element={<S><ECODetailPage /></S>} />
            <Route path="manufacturing/inspection-plans" element={<S><InspectionPlansPage /></S>} />
            <Route path="manufacturing/inspection-plans/:planId" element={<S><InspectionPlanDetailPage /></S>} />
            <Route path="manufacturing/ncr" element={<S><NCRListPage /></S>} />
            <Route path="manufacturing/ncr/:ncrId" element={<S><NCRDetailPage /></S>} />
            <Route path="manufacturing/capa" element={<S><CAPAListPage /></S>} />
            <Route path="manufacturing/capa/:capaId" element={<S><CAPADetailPage /></S>} />
            <Route path="manufacturing/lots" element={<S><LotTrackingPage /></S>} />
            <Route path="manufacturing/lots/:lotId" element={<S><TraceabilityViewPage /></S>} />
            <Route path="manufacturing/lots/:lotId/genealogy" element={<S><GenealogyTreePage /></S>} />
            <Route path="manufacturing/batch-records" element={<S><BatchRecordPage /></S>} />
            <Route path="manufacturing/rework-orders" element={<S><ReworkOrdersPage /></S>} />
            {/* Phase 2: Planning, Equipment, Labor */}
            <Route path="manufacturing/schedule" element={<S><GanttSchedulerPage /></S>} />
            <Route path="manufacturing/capacity" element={<S><CapacityDashboardPage /></S>} />
            <Route path="manufacturing/scenarios" element={<S><ScenarioPlannerPage /></S>} />
            <Route path="manufacturing/assets" element={<S><AssetRegisterPage /></S>} />
            <Route path="manufacturing/assets/:assetId" element={<S><AssetDetailPage /></S>} />
            <Route path="manufacturing/downtime" element={<S><DowntimeTrackerPage /></S>} />
            <Route path="manufacturing/downtime/analysis" element={<S><DowntimeAnalysisPage /></S>} />
            <Route path="manufacturing/maintenance-work-orders" element={<S><MaintenanceMWOPage /></S>} />
            <Route path="manufacturing/oee" element={<S><OEEReportPage /></S>} />
            <Route path="manufacturing/skills" element={<S><MfgSkillsMatrixPage /></S>} />
            <Route path="manufacturing/certifications" element={<S><CertTrackerPage /></S>} />
            <Route path="manufacturing/crew" element={<S><CrewSchedulingPage /></S>} />
            <Route path="manufacturing/production-board" element={<S><ProductionBoardPage /></S>} />
            <Route path="manufacturing/iot" element={<S><IoTDashboardPage /></S>} />
            <Route path="manufacturing/work-instructions/:routingId" element={<S><DigitalWorkInstructionsPage /></S>} />
            <Route path="manufacturing/ai/bottlenecks" element={<S><BottleneckAnalysisPage /></S>} />
            <Route path="manufacturing/ai/quality-risk" element={<S><QualityRiskDashboardPage /></S>} />
            <Route path="manufacturing/ai/suggestions" element={<S><ScheduleSuggestionsPage /></S>} />
            <Route path="manufacturing/ai/executive" element={<S><ExecutiveSummaryPage /></S>} />
            <Route path="manufacturing/configurator" element={<S><ProductConfiguratorPage /></S>} />
            <Route path="manufacturing/configurator/rules" element={<S><ConfiguratorRulesAdminPage /></S>} />
            {/* POS */}
            <Route path="pos" element={<S><POSDashboard /></S>} />
            <Route path="pos/terminal" element={<S><POSTerminal /></S>} />
            <Route path="pos/sessions" element={<S><POSSessions /></S>} />
            <Route path="pos/sessions/:id" element={<S><POSSessionDetail /></S>} />
            <Route path="pos/receipt/:id" element={<S><POSReceiptView /></S>} />
            <Route path="pos/register" element={<S><POSRegister /></S>} />
            <Route path="pos/terminals" element={<S><TerminalsPage /></S>} />
            <Route path="pos/discounts" element={<S><DiscountsPage /></S>} />
            <Route path="pos/cash-management" element={<S><CashManagementPage /></S>} />
            <Route path="pos/daily-sales" element={<S><DailySalesPage /></S>} />
            <Route path="pos/cashier-report" element={<S><CashierReportPage /></S>} />
            <Route path="pos/mobile-payment" element={<S><MobilePayment total={0} lines={[]} /></S>} />
            <Route path="pos/held-transactions" element={<S><HeldTransactions /></S>} />
            <Route path="pos/bundles" element={<S><BundlesPage /></S>} />
            <Route path="pos/modifier-groups" element={<S><ModifierGroupsPage /></S>} />
            <Route path="pos/xz-readings" element={<S><XZReadingPage /></S>} />
            <Route path="pos/profitability" element={<S><ProfitabilityDashboard /></S>} />
            <Route path="pos/commission-rules" element={<S><CommissionRulesPage /></S>} />
            <Route path="pos/commission-report" element={<S><CommissionReportPage /></S>} />
            <Route path="pos/customer-360/:customerId" element={<S><Customer360Panel /></S>} />
            <Route path="pos/gift-cards" element={<S><GiftCardsPage /></S>} />
            <Route path="pos/store-credit" element={<S><StoreCreditLookup /></S>} />
            <Route path="pos/pickup-orders" element={<S><PickupOrdersPage /></S>} />
            <Route path="pos/pickup-orders/:id" element={<S><PickupOrderDetail /></S>} />
            <Route path="pos/hardware-settings" element={<S><HardwareSettings /></S>} />
            {/* KDS */}
            <Route path="kds" element={<S><KDSDisplay /></S>} />
            <Route path="kds/stations" element={<S><KDSStationManager /></S>} />
            {/* Loyalty */}
            <Route path="loyalty" element={<S><LoyaltyDashboard /></S>} />
            <Route path="loyalty/members" element={<S><MemberLookup /></S>} />
            <Route path="loyalty/programs/:programId/rewards" element={<S><RewardsPage /></S>} />
            {/* E-Commerce */}
            <Route path="ecommerce" element={<S><EcommerceDashboard /></S>} />
            <Route path="ecommerce/stores" element={<S><EcomStoresPage /></S>} />
            <Route path="ecommerce/products" element={<S><EcomProductsPage /></S>} />
            <Route path="ecommerce/products/new" element={<S><EcomProductForm /></S>} />
            <Route path="ecommerce/products/:id/edit" element={<S><EcomProductForm /></S>} />
            <Route path="ecommerce/orders" element={<S><EcomOrdersPage /></S>} />
            <Route path="ecommerce/orders/:id" element={<S><EcomOrderDetail /></S>} />
            <Route path="ecommerce/customers" element={<S><EcomCustomersPage /></S>} />
            <Route path="ecommerce/coupons" element={<S><EcomCouponsPage /></S>} />
            <Route path="ecommerce/flash-sales" element={<S><EcomFlashSalesPage /></S>} />
            <Route path="ecommerce/shipping" element={<S><EcomShippingPage /></S>} />
            <Route path="ecommerce/reviews" element={<S><EcomReviewsPage /></S>} />
            <Route path="ecommerce/cart" element={<S><EcomCartPage /></S>} />
            <Route path="ecommerce/checkout" element={<S><EcomCheckoutPage /></S>} />
            <Route path="ecommerce/catalog" element={<S><EcomCatalogPage /></S>} />
            <Route path="ecommerce/sales-report" element={<S><EcomSalesReportPage /></S>} />
            <Route path="ecommerce/categories" element={<S><EcomCategoryManagerPage /></S>} />
            <Route path="ecommerce/theme-editor" element={<S><EcomStorefrontThemeEditor /></S>} />
            {/* E-Commerce Phase 2 — B2B, Loyalty, Abandoned Carts, Subscriptions */}
            <Route path="ecommerce/b2b" element={<S><EcomB2BPortal /></S>} />
            <Route path="ecommerce/b2b/dashboard" element={<S><EcomB2BDashboard /></S>} />
            <Route path="ecommerce/b2b/quotes/:id" element={<S><EcomQuoteDetail /></S>} />
            <Route path="ecommerce/loyalty-program" element={<S><EcomLoyaltyDashboard /></S>} />
            <Route path="ecommerce/loyalty-account" element={<S><EcomLoyaltyAccount /></S>} />
            <Route path="ecommerce/abandoned-carts" element={<S><EcomAbandonedCartsPage /></S>} />
            <Route path="ecommerce/subscriptions" element={<S><EcomSubscriptionManagement /></S>} />
            <Route path="ecommerce/subscriptions/admin" element={<S><EcomSubscriptionsAdmin /></S>} />
            {/* E-Commerce Phase 3 — Bundles, Import, Analytics, Blog */}
            <Route path="ecommerce/bundles" element={<S><EcomBundlesPage /></S>} />
            <Route path="ecommerce/import" element={<S><EcomImportPage /></S>} />
            <Route path="ecommerce/analytics" element={<S><EcomAdvancedAnalyticsPage /></S>} />
            <Route path="ecommerce/blog" element={<S><EcomBlogAdminPage /></S>} />
            <Route path="ecommerce/blog/new" element={<S><EcomBlogPostEditor /></S>} />
            <Route path="ecommerce/blog/:id/edit" element={<S><EcomBlogPostEditor /></S>} />
            {/* Support / Customer Center */}
            <Route path="support" element={<S><SupportDashboard /></S>} />
            <Route path="support/tickets" element={<S><TicketsPage /></S>} />
            <Route path="support/tickets/:id" element={<S><TicketDetailPage /></S>} />
            <Route path="support/categories" element={<S><CategoriesPage /></S>} />
            <Route path="support/sla" element={<S><SLAConfigPage /></S>} />
            <Route path="support/canned-responses" element={<S><CannedResponsesPage /></S>} />
            <Route path="support/satisfaction" element={<S><SatisfactionPage /></S>} />
            <Route path="support/kb/editor" element={<S><KBEditorPage /></S>} />
            <Route path="support/kb" element={<S><KBPublicPage /></S>} />
            <Route path="support/kpis" element={<S><SupportKPIsPage /></S>} />
            <Route path="support/routing-rules" element={<S><RoutingRulesPage /></S>} />
            <Route path="support/live-chat" element={<S><LiveChatDashboard /></S>} />
            <Route path="support/live-chat/:id" element={<S><LiveChatWindow /></S>} />
            <Route path="support/views" element={<S><SavedViewsPage /></S>} />
            <Route path="support/templates" element={<S><TicketTemplatesPage /></S>} />
            <Route path="support/inbound-email" element={<S><InboundEmailConfig /></S>} />
            {/* Support Phase 2 */}
            <Route path="support/automations" element={<S><AutomationList /></S>} />
            <Route path="support/automations/new" element={<S><AutomationBuilder /></S>} />
            <Route path="support/automations/:id" element={<S><AutomationBuilder /></S>} />
            <Route path="support/forum" element={<S><ForumPage /></S>} />
            <Route path="support/forum/:postId" element={<S><ForumPostDetail /></S>} />
            <Route path="support/omnichannel" element={<S><OmnichannelConfigPage /></S>} />
            <Route path="support/sla/:slaPolicyId/escalation" element={<S><SLAEscalationConfig /></S>} />
            <Route path="support/ai-copilot" element={<S><AICopilotPanel /></S>} />
            <Route path="portal/login" element={<CustomerPortalLogin />} />
            <Route path="portal/tickets" element={<CustomerPortalTickets />} />
            {/* Support Phase 3 */}
            <Route path="support/analytics" element={<S><AnalyticsOverview /></S>} />
            <Route path="support/analytics/agents" element={<S><AnalyticsAgents /></S>} />
            <Route path="support/analytics/ai-impact" element={<S><AnalyticsAIImpact /></S>} />
            <Route path="support/proactive-rules" element={<S><ProactiveRulesPage /></S>} />
            <Route path="support/voice" element={<S><VoiceCallPage /></S>} />
            <Route path="support/voice/:callId" element={<S><CallDetailPage /></S>} />
            <Route path="support/agent-skills" element={<S><AgentSkillsPage /></S>} />
            <Route path="support/agent-schedule" element={<S><AgentSchedulePage /></S>} />
            <Route path="support/sandboxes" element={<S><SandboxPage /></S>} />
            <Route path="support/customer-health" element={<S><CustomerHealthDashboard /></S>} />
            <Route path="settings/*" element={<S><SettingsPage /></S>} />
            <Route path="settings/security" element={<S><SecurityPage /></S>} />
            <Route path="settings/changelog" element={<S><ChangelogPage /></S>} />
            <Route path="profile" element={<S><ProfilePage /></S>} />
            <Route path="notifications" element={<S><NotificationsPage /></S>} />

            {/* Phase 1 service pages */}
            <Route path="mail/*" element={<S><MailPage /></S>} />
            <Route path="calendar/*" element={<S><CalendarPage /></S>} />
            <Route path="docs/templates" element={<S><TemplateGalleryPage /></S>} />
            <Route path="docs/analytics" element={<S><DocsAnalyticsPage /></S>} />
            <Route path="docs/mine" element={<S><DocsPage /></S>} />
            <Route path="docs/shared" element={<S><DocsPage /></S>} />
            <Route path="docs/recent" element={<S><DocsPage /></S>} />
            <Route path="docs/*" element={<S><DocsPage /></S>} />
            <Route path="notes/*" element={<S><NotesPage /></S>} />
            <Route path="drive/*" element={<S><DrivePage /></S>} />
            <Route path="analytics/dashboards" element={<S><DashboardListPage /></S>} />
            <Route path="analytics/dashboards/:id/builder" element={<S><AnalyticsDashboardBuilderPage /></S>} />
            <Route path="analytics/query-builder" element={<S><QueryBuilderPage /></S>} />
            <Route path="analytics/sql-editor" element={<S><SQLEditorPage /></S>} />
            <Route path="analytics/reports" element={<S><ReportSchedulerPage /></S>} />
            <Route path="analytics/alerts" element={<S><AlertConfigPage /></S>} />
            <Route path="analytics/executive" element={<S><ExecutiveDashboardPage /></S>} />
            <Route path="analytics/prebuilt" element={<S><PrebuiltDashboardsPage /></S>} />
            <Route path="analytics/prebuilt/finance" element={<S><PrebuiltFinanceDash /></S>} />
            <Route path="analytics/prebuilt/crm" element={<S><PrebuiltCRMDash /></S>} />
            <Route path="analytics/prebuilt/hr" element={<S><PrebuiltHRDash /></S>} />
            <Route path="analytics/prebuilt/inventory" element={<S><PrebuiltInventoryDash /></S>} />
            <Route path="analytics/prebuilt/ecommerce" element={<S><PrebuiltECommerceDash /></S>} />
            <Route path="analytics/prebuilt/support" element={<S><PrebuiltSupportDash /></S>} />
            <Route path="analytics/prebuilt/manufacturing" element={<S><PrebuiltManufacturingDash /></S>} />
            <Route path="analytics/scorecards" element={<S><ScorecardsPage /></S>} />
            <Route path="analytics/meta" element={<S><MetaAnalyticsPage /></S>} />
            <Route path="analytics/whatif" element={<S><WhatIfSimulatorPage /></S>} />
            <Route path="analytics/transforms" element={<S><TransformEditorPage /></S>} />
            <Route path="analytics/*" element={<S><AnalyticsPage /></S>} />
            <Route path="teams/*" element={<S><TeamsPage /></S>} />

            {/* Forms */}
            <Route path="forms" element={<S><FormsPage /></S>} />
            <Route path="forms/:id/edit" element={<S><FormBuilder /></S>} />
            <Route path="forms/:id/responses" element={<S><FormResponses /></S>} />
            <Route path="forms/:id/submit" element={<S><FormSubmit /></S>} />

            {/* Handbook */}
            <Route path="handbook" element={<S><HandbookPage /></S>} />
            <Route path="handbook/getting-started" element={<S><HandbookGettingStarted /></S>} />
            <Route path="handbook/search" element={<S><HandbookSearchPage /></S>} />
            <Route path="handbook/category/:slug" element={<S><HandbookCategoryPage /></S>} />
            <Route path="handbook/articles/:slug" element={<S><HandbookArticlePage /></S>} />
            <Route path="handbook/admin" element={<RequireAdmin><S><HandbookAdminPage /></S></RequireAdmin>} />
            <Route path="handbook/admin/articles/new" element={<RequireAdmin><S><HandbookArticleEditor /></S></RequireAdmin>} />
            <Route path="handbook/admin/articles/:id/edit" element={<RequireAdmin><S><HandbookArticleEditor /></S></RequireAdmin>} />
            <Route path="handbook/admin/categories" element={<RequireAdmin><S><HandbookCategoryManager /></S></RequireAdmin>} />
            <Route path="handbook/admin/analytics" element={<RequireAdmin><S><HandbookAnalyticsPage /></S></RequireAdmin>} />

            {/* Admin section */}
            <Route
              path="admin"
              element={
                <RequireSuperAdmin>
                  <S><AdminDashboard /></S>
                </RequireSuperAdmin>
              }
            />
            <Route
              path="admin/users"
              element={
                <RequireSuperAdmin>
                  <S><UsersPage /></S>
                </RequireSuperAdmin>
              }
            />
            <Route
              path="admin/roles"
              element={
                <RequireSuperAdmin>
                  <S><RolesPage /></S>
                </RequireSuperAdmin>
              }
            />
            <Route
              path="admin/app-admins"
              element={
                <RequireSuperAdmin>
                  <S><AppAdminsPage /></S>
                </RequireSuperAdmin>
              }
            />
            <Route
              path="admin/users/:userId/access"
              element={
                <RequireSuperAdmin>
                  <S><UserAppAccessPage /></S>
                </RequireSuperAdmin>
              }
            />
            <Route
              path="admin/permission-matrix"
              element={
                <RequireSuperAdmin>
                  <S><PermissionMatrixPage /></S>
                </RequireSuperAdmin>
              }
            />
            <Route
              path="admin/ai-config"
              element={
                <RequireSuperAdmin>
                  <S><AIConfigPage /></S>
                </RequireSuperAdmin>
              }
            />
            <Route
              path="admin/audit-logs"
              element={
                <RequireSuperAdmin>
                  <S><AuditLogsPage /></S>
                </RequireSuperAdmin>
              }
            />
            <Route
              path="admin/my-modules"
              element={
                <RequireAdmin>
                  <S><MyModulesPage /></S>
                </RequireAdmin>
              }
            />
            <Route
              path="admin/users/import"
              element={
                <RequireSuperAdmin>
                  <S><BulkImportPage /></S>
                </RequireSuperAdmin>
              }
            />
            <Route
              path="admin/license"
              element={
                <RequireSuperAdmin>
                  <S><LicensePage /></S>
                </RequireSuperAdmin>
              }
            />
            <Route
              path="admin/sso"
              element={
                <RequireSuperAdmin>
                  <S><SSOConfigPage /></S>
                </RequireSuperAdmin>
              }
            />
            <Route
              path="admin/backups"
              element={
                <RequireSuperAdmin>
                  <S><BackupsPage /></S>
                </RequireSuperAdmin>
              }
            />
            <Route
              path="admin/mail-config"
              element={
                <RequireSuperAdmin>
                  <S><MailConfigPage /></S>
                </RequireSuperAdmin>
              }
            />
            <Route
              path="admin/drive-config"
              element={
                <RequireSuperAdmin>
                  <S><DriveConfigPage /></S>
                </RequireSuperAdmin>
              }
            />
            <Route
              path="admin/docs-config"
              element={
                <RequireSuperAdmin>
                  <S><DocsConfigPage /></S>
                </RequireSuperAdmin>
              }
            />
            <Route
              path="admin/meetings-config"
              element={
                <RequireSuperAdmin>
                  <S><MeetingsConfigPage /></S>
                </RequireSuperAdmin>
              }
            />
            <Route
              path="admin/performance"
              element={
                <RequireSuperAdmin>
                  <S><PerformanceDashboard /></S>
                </RequireSuperAdmin>
              }
            />
            <Route
              path="admin/security"
              element={
                <RequireSuperAdmin>
                  <S><SecurityDashboard /></S>
                </RequireSuperAdmin>
              }
            />
            <Route
              path="admin/parity"
              element={
                <RequireSuperAdmin>
                  <S><ParityDashboard /></S>
                </RequireSuperAdmin>
              }
            />
            <Route
              path="admin/apps/:appName"
              element={
                <RequireAdmin>
                  <S><AppAdminDashboard /></S>
                </RequireAdmin>
              }
            />

            {/* AI Management */}
            <Route path="ai/history" element={<S><ConversationHistoryPage /></S>} />
            <Route path="ai/templates" element={<S><PromptTemplatesPage /></S>} />
            <Route path="ai/knowledge-base" element={<S><AIKnowledgeBasePage /></S>} />
            <Route path="ai/usage" element={<S><AIUsageDashboardPage /></S>} />

            {/* 404 within app */}
            <Route path="*" element={<ComingSoon title="Page Not Found" />} />
          </Route>

          {/* Public Form — unauthenticated */}
          <Route path="/forms/public/:shareToken" element={<PublicFormPage />} />

          {/* Public embed viewer — no auth required */}
          <Route path="/embed/dashboard/:token" element={<S><EmbedViewer /></S>} />

          {/* Top-level redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </>
  )
}

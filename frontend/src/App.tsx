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

const UsersPage        = lazy(() => import('./features/admin/UsersPage'))
const RolesPage        = lazy(() => import('./features/admin/RolesPage'))
const AppAdminsPage    = lazy(() => import('./features/admin/AppAdminsPage'))
const AIConfigPage     = lazy(() => import('./features/admin/AIConfigPage'))
const AuditLogsPage    = lazy(() => import('./features/admin/AuditLogsPage'))
const AppAdminDashboard = lazy(() => import('./features/admin/AppAdminDashboard'))
const MyModulesPage    = lazy(() => import('./features/admin/MyModulesPage'))
const BulkImportPage   = lazy(() => import('./features/admin/BulkImportPage'))
const LicensePage      = lazy(() => import('./features/admin/LicensePage'))
const SSOConfigPage    = lazy(() => import('./features/admin/SSOConfigPage'))
const BackupsPage      = lazy(() => import('./features/admin/BackupsPage'))
const MailConfigPage   = lazy(() => import('./features/admin/MailConfigPage'))
const DriveConfigPage  = lazy(() => import('./features/admin/DriveConfigPage'))
const DocsConfigPage   = lazy(() => import('./features/admin/DocsConfigPage'))
const MeetingsConfigPage = lazy(() => import('./features/admin/MeetingsConfigPage'))

const FormBuilder      = lazy(() => import('./features/forms/FormBuilder'))
const FormResponses    = lazy(() => import('./features/forms/FormResponses'))
const FormSubmit       = lazy(() => import('./features/forms/FormSubmit'))

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
const EcomShippingPage    = lazy(() => import('./features/ecommerce/ShippingPage'))
const EcomReviewsPage     = lazy(() => import('./features/ecommerce/ReviewsPage'))
const EcomCartPage        = lazy(() => import('./features/ecommerce/CartPage'))
const EcomCheckoutPage    = lazy(() => import('./features/ecommerce/CheckoutPage'))
const EcomCatalogPage     = lazy(() => import('./features/ecommerce/CatalogPage'))
const EcomSalesReportPage = lazy(() => import('./features/ecommerce/SalesReportPage'))

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
const SLAConfigPage       = lazy(() => import('./features/support/SLAConfigPage'))
const CannedResponsesPage = lazy(() => import('./features/support/CannedResponsesPage'))
const SatisfactionPage    = lazy(() => import('./features/support/SatisfactionPage'))
const KBEditorPage        = lazy(() => import('./features/support/KBEditorPage'))
const KBPublicPage        = lazy(() => import('./features/support/KBPublicPage'))
const SupportKPIsPage     = lazy(() => import('./features/support/SupportKPIsPage'))
const RoutingRulesPage    = lazy(() => import('./features/support/RoutingRulesPage'))

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

// Analytics enhancements
const DashboardListPage       = lazy(() => import('./features/analytics/DashboardListPage'))
const DashboardBuilderPage    = lazy(() => import('./features/analytics/DashboardBuilderPage'))
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

// AI enhancements
const ConversationHistoryPage = lazy(() => import('./features/ai/ConversationHistoryPage'))
const PromptTemplatesPage     = lazy(() => import('./features/ai/PromptTemplatesPage'))
const KnowledgeBasePage       = lazy(() => import('./features/ai/KnowledgeBasePage'))
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
            <Route path="ecommerce/shipping" element={<S><EcomShippingPage /></S>} />
            <Route path="ecommerce/reviews" element={<S><EcomReviewsPage /></S>} />
            <Route path="ecommerce/cart" element={<S><EcomCartPage /></S>} />
            <Route path="ecommerce/checkout" element={<S><EcomCheckoutPage /></S>} />
            <Route path="ecommerce/catalog" element={<S><EcomCatalogPage /></S>} />
            <Route path="ecommerce/sales-report" element={<S><EcomSalesReportPage /></S>} />
            <Route path="ecommerce/categories" element={<S><EcomCategoryManagerPage /></S>} />
            <Route path="ecommerce/theme-editor" element={<S><EcomStorefrontThemeEditor /></S>} />
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
            <Route path="settings/*" element={<S><SettingsPage /></S>} />
            <Route path="profile" element={<S><ProfilePage /></S>} />
            <Route path="notifications" element={<S><NotificationsPage /></S>} />

            {/* Phase 1 service pages */}
            <Route path="mail/*" element={<S><MailPage /></S>} />
            <Route path="calendar/*" element={<S><CalendarPage /></S>} />
            <Route path="docs/*" element={<S><DocsPage /></S>} />
            <Route path="notes/*" element={<S><NotesPage /></S>} />
            <Route path="drive/*" element={<S><DrivePage /></S>} />
            <Route path="analytics/dashboards" element={<S><DashboardListPage /></S>} />
            <Route path="analytics/dashboards/:id/builder" element={<S><DashboardBuilderPage /></S>} />
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
            <Route path="ai/knowledge-base" element={<S><KnowledgeBasePage /></S>} />
            <Route path="ai/usage" element={<S><AIUsageDashboardPage /></S>} />

            {/* 404 within app */}
            <Route path="*" element={<ComingSoon title="Page Not Found" />} />
          </Route>

          {/* Top-level redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </>
  )
}

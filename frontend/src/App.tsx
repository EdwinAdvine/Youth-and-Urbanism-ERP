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

const FormBuilder      = lazy(() => import('./features/forms/FormBuilder'))
const FormResponses    = lazy(() => import('./features/forms/FormResponses'))
const FormSubmit       = lazy(() => import('./features/forms/FormSubmit'))

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

// CRM sub-pages
const ContactsPage     = lazy(() => import('./features/crm/ContactsPage'))
const ContactDetail    = lazy(() => import('./features/crm/ContactDetail'))
const LeadsPage        = lazy(() => import('./features/crm/LeadsPage'))
const PipelinePage     = lazy(() => import('./features/crm/PipelinePage'))
const DealsPage        = lazy(() => import('./features/crm/DealsPage'))

// Inventory sub-pages
const ItemsPage           = lazy(() => import('./features/inventory/ItemsPage'))
const WarehousesPage      = lazy(() => import('./features/inventory/WarehousesPage'))
const StockMovementsPage  = lazy(() => import('./features/inventory/StockMovementsPage'))
const PurchaseOrdersPage  = lazy(() => import('./features/inventory/PurchaseOrdersPage'))
const PODetailPage        = lazy(() => import('./features/inventory/PODetailPage'))
const ReorderAlertsPage   = lazy(() => import('./features/inventory/ReorderAlertsPage'))

// Manufacturing sub-pages
const BOMListPage             = lazy(() => import('./features/manufacturing/BOMListPage'))
const BOMDetailPage           = lazy(() => import('./features/manufacturing/BOMDetail'))
const WorkStationsPage        = lazy(() => import('./features/manufacturing/WorkStationsPage'))
const WorkOrdersPage          = lazy(() => import('./features/manufacturing/WorkOrdersPage'))
const WorkOrderDetailPage     = lazy(() => import('./features/manufacturing/WorkOrderDetail'))
const QualityChecksPage       = lazy(() => import('./features/manufacturing/QualityChecksPage'))

// Supply Chain sub-pages
const SuppliersPage        = lazy(() => import('./features/supplychain/SuppliersPage'))
const RequisitionsPage     = lazy(() => import('./features/supplychain/RequisitionsPage'))
const SupplierDetailPage   = lazy(() => import('./features/supplychain/SupplierDetail'))
const GRNPage              = lazy(() => import('./features/supplychain/GRNPage'))
const SCReturnsPage        = lazy(() => import('./features/supplychain/ReturnsPage'))
const RequisitionDetail    = lazy(() => import('./features/supplychain/RequisitionDetail'))
const GRNDetail            = lazy(() => import('./features/supplychain/GRNDetail'))
const ReturnDetail         = lazy(() => import('./features/supplychain/ReturnDetail'))

// POS sub-pages
const POSTerminal          = lazy(() => import('./features/pos/POSTerminal'))
const POSSessions          = lazy(() => import('./features/pos/POSSessions'))
const POSSessionDetail     = lazy(() => import('./features/pos/POSSessionDetail'))
const POSReceiptView       = lazy(() => import('./features/pos/POSReceiptView'))

// E-Commerce sub-pages
const EcomStoresPage      = lazy(() => import('./features/ecommerce/StoresPage'))
const EcomProductsPage    = lazy(() => import('./features/ecommerce/ProductsPage'))
const EcomProductForm     = lazy(() => import('./features/ecommerce/ProductForm'))
const EcomOrdersPage      = lazy(() => import('./features/ecommerce/OrdersPage'))
const EcomOrderDetail     = lazy(() => import('./features/ecommerce/OrderDetail'))
const EcomCustomersPage   = lazy(() => import('./features/ecommerce/CustomersPage'))

// Support sub-pages
const TicketsPage         = lazy(() => import('./features/support/TicketsPage'))
const TicketDetailPage    = lazy(() => import('./features/support/TicketDetail'))

// Settings, Profile, Notifications
const ProfilePage         = lazy(() => import('./features/profile/ProfilePage'))
const NotificationsPage   = lazy(() => import('./features/notifications/NotificationsPage'))

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
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="text-gray-500 mt-2">This module is under development. Coming soon!</p>
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
            <Route path="crm" element={<S><CRMDashboard /></S>} />
            <Route path="crm/contacts" element={<S><ContactsPage /></S>} />
            <Route path="crm/contacts/:id" element={<S><ContactDetail /></S>} />
            <Route path="crm/leads" element={<S><LeadsPage /></S>} />
            <Route path="crm/pipeline" element={<S><PipelinePage /></S>} />
            <Route path="crm/deals" element={<S><DealsPage /></S>} />
            <Route path="projects" element={<S><ProjectsPage /></S>} />
            <Route path="projects/:id" element={<S><ProjectBoard /></S>} />
            <Route path="projects/:id/time-report" element={<S><TimeLogReport /></S>} />
            {/* Inventory */}
            <Route path="inventory" element={<S><InventoryDashboard /></S>} />
            <Route path="inventory/items" element={<S><ItemsPage /></S>} />
            <Route path="inventory/warehouses" element={<S><WarehousesPage /></S>} />
            <Route path="inventory/stock-movements" element={<S><StockMovementsPage /></S>} />
            <Route path="inventory/purchase-orders" element={<S><PurchaseOrdersPage /></S>} />
            <Route path="inventory/purchase-orders/:id" element={<S><PODetailPage /></S>} />
            <Route path="inventory/reorder-alerts" element={<S><ReorderAlertsPage /></S>} />
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
            {/* Manufacturing */}
            <Route path="manufacturing" element={<S><ManufacturingDashboard /></S>} />
            <Route path="manufacturing/bom" element={<S><BOMListPage /></S>} />
            <Route path="manufacturing/bom/:id" element={<S><BOMDetailPage /></S>} />
            <Route path="manufacturing/workstations" element={<S><WorkStationsPage /></S>} />
            <Route path="manufacturing/work-orders" element={<S><WorkOrdersPage /></S>} />
            <Route path="manufacturing/work-orders/:id" element={<S><WorkOrderDetailPage /></S>} />
            <Route path="manufacturing/quality-checks" element={<S><QualityChecksPage /></S>} />
            {/* POS */}
            <Route path="pos" element={<S><POSDashboard /></S>} />
            <Route path="pos/terminal" element={<S><POSTerminal /></S>} />
            <Route path="pos/sessions" element={<S><POSSessions /></S>} />
            <Route path="pos/sessions/:id" element={<S><POSSessionDetail /></S>} />
            <Route path="pos/receipt/:id" element={<S><POSReceiptView /></S>} />
            {/* E-Commerce */}
            <Route path="ecommerce" element={<S><EcommerceDashboard /></S>} />
            <Route path="ecommerce/stores" element={<S><EcomStoresPage /></S>} />
            <Route path="ecommerce/products" element={<S><EcomProductsPage /></S>} />
            <Route path="ecommerce/products/new" element={<S><EcomProductForm /></S>} />
            <Route path="ecommerce/products/:id/edit" element={<S><EcomProductForm /></S>} />
            <Route path="ecommerce/orders" element={<S><EcomOrdersPage /></S>} />
            <Route path="ecommerce/orders/:id" element={<S><EcomOrderDetail /></S>} />
            <Route path="ecommerce/customers" element={<S><EcomCustomersPage /></S>} />
            {/* Support / Customer Center */}
            <Route path="support" element={<S><SupportDashboard /></S>} />
            <Route path="support/tickets" element={<S><TicketsPage /></S>} />
            <Route path="support/tickets/:id" element={<S><TicketDetailPage /></S>} />
            <Route path="settings/*" element={<S><SettingsPage /></S>} />
            <Route path="profile" element={<S><ProfilePage /></S>} />
            <Route path="notifications" element={<S><NotificationsPage /></S>} />

            {/* Phase 1 service pages */}
            <Route path="mail/*" element={<S><MailPage /></S>} />
            <Route path="calendar/*" element={<S><CalendarPage /></S>} />
            <Route path="docs/*" element={<S><DocsPage /></S>} />
            <Route path="notes/*" element={<S><NotesPage /></S>} />
            <Route path="drive/*" element={<S><DrivePage /></S>} />
            <Route path="analytics/*" element={<S><AnalyticsPage /></S>} />
            <Route path="teams/*" element={<S><TeamsPage /></S>} />

            {/* Forms */}
            <Route path="forms" element={<S><FormsPage /></S>} />
            <Route path="forms/:id/edit" element={<S><FormBuilder /></S>} />
            <Route path="forms/:id/responses" element={<S><FormResponses /></S>} />
            <Route path="forms/:id/submit" element={<S><FormSubmit /></S>} />

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
              path="admin/apps/:appName"
              element={
                <RequireAdmin>
                  <S><AppAdminDashboard /></S>
                </RequireAdmin>
              }
            />

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

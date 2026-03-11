import type { PreloadableComponent } from './lazyWithPreload'
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
} from './preloadableRoutes'

const preloadMap: Record<string, PreloadableComponent> = {
  '/finance': FinanceDashboard,
  '/hr': HRDashboard,
  '/crm': CRMDashboard,
  '/projects': ProjectsPage,
  '/inventory': InventoryDashboard,
  '/supply-chain': SupplyChainDashboard,
  '/manufacturing': ManufacturingDashboard,
  '/pos': POSDashboard,
  '/ecommerce': EcommerceDashboard,
  '/support': SupportDashboard,
  '/mail': MailPage,
  '/calendar': CalendarPage,
  '/teams': TeamsPage,
  '/docs': DocsPage,
  '/drive': DrivePage,
  '/notes': NotesPage,
  '/analytics': AnalyticsPage,
  '/forms': FormsPage,
  '/admin': AdminDashboard,
  '/settings': SettingsPage,
}

export function preloadRoute(href: string) {
  const component = preloadMap[href]
  if (component) {
    component.preload()
  }
}

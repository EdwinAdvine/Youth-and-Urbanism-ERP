/**
 * Entity-to-queryKey mapping for SSE-driven cache invalidation.
 *
 * When the backend publishes a data change event via SSE, the frontend
 * uses this map to determine which TanStack Query caches to invalidate.
 *
 * Backend publishes: { entity: "invoice", action: "created", id: "..." }
 * Frontend invalidates: queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] })
 */

export type EntityType =
  | 'invoice' | 'payment' | 'journal_entry' | 'expense' | 'account'
  | 'contact' | 'opportunity' | 'crm_activity'
  | 'task' | 'project'
  | 'ticket' | 'ticket_comment'
  | 'calendar_event'
  | 'meeting'
  | 'note' | 'notebook'
  | 'drive_file' | 'drive_folder'
  | 'inventory_item' | 'stock_movement'
  | 'pos_transaction' | 'pos_order'
  | 'ecom_order' | 'ecom_product'
  | 'employee' | 'leave_request' | 'payroll'
  | 'supply_chain_po' | 'grn'
  | 'notification'
  | 'user' | 'role'

/** Map from backend entity type → TanStack Query key prefix to invalidate */
export const ENTITY_QUERY_MAP: Record<string, readonly string[]> = {
  // Finance
  invoice:           ['finance', 'invoices'],
  payment:           ['finance', 'payments'],
  journal_entry:     ['finance', 'journal-entries'],
  expense:           ['finance', 'expenses'],
  account:           ['finance', 'accounts'],

  // CRM
  contact:           ['crm', 'contacts'],
  opportunity:       ['crm', 'opportunities'],
  crm_activity:      ['crm', 'activities'],

  // Projects
  task:              ['projects', 'tasks'],
  project:           ['projects'],

  // Support
  ticket:            ['support', 'tickets'],
  ticket_comment:    ['support', 'tickets'],

  // Calendar
  calendar_event:    ['calendar', 'events'],

  // Meetings
  meeting:           ['meetings'],

  // Notes
  note:              ['notes'],
  notebook:          ['notebooks'],

  // Drive
  drive_file:        ['drive', 'files'],
  drive_folder:      ['drive', 'folders'],

  // Inventory
  inventory_item:    ['inventory', 'items'],
  stock_movement:    ['inventory', 'movements'],

  // POS
  pos_transaction:   ['pos', 'transactions'],
  pos_order:         ['pos', 'orders'],

  // E-Commerce
  ecom_order:        ['ecommerce', 'orders'],
  ecom_product:      ['ecommerce', 'products'],

  // HR
  employee:          ['hr', 'employees'],
  leave_request:     ['hr', 'leaves'],
  payroll:           ['hr', 'payroll'],

  // Supply Chain
  supply_chain_po:   ['supply-chain', 'purchase-orders'],
  grn:               ['supply-chain', 'grns'],

  // System
  notification:      ['notifications'],
  user:              ['users'],
  role:              ['roles'],
} as const

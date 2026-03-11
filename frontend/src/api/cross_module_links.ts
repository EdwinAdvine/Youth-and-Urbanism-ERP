import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LinkedContact {
  id: string
  contact_type: string
  first_name: string | null
  last_name: string | null
  company_name: string | null
  email: string | null
  phone: string | null
  source: string | null
}

export interface PurchaseHistoryTransaction {
  id: string
  transaction_number: string
  total: string
  date: string
  status: string
}

export interface PurchaseHistory {
  contact_id: string
  contact_name: string
  total_transactions: number
  total_spent: string
  transactions: PurchaseHistoryTransaction[]
}

export interface CostBreakdown {
  work_order_id: string
  wo_number: string
  status: string
  planned_quantity: number
  completed_quantity: number
  material_costs: Array<{
    item_id: string
    item_name: string
    quantity: string
    unit_cost: string
    total_cost: string
  }>
  total_material_cost: string
  labor_details: Array<{
    operation: string
    workstation: string
    duration_minutes: number
    hourly_rate: string
    cost: string
  }>
  total_labor_cost: string
  overhead_rate: string
  overhead_cost: string
  total_production_cost: string
  unit_cost: string
}

export interface WorkOrderOperator {
  employee_id: string
  employee_number: string
  name: string
  job_title: string | null
  department_id: string | null
  is_active: boolean
}

// ─── API Calls ────────────────────────────────────────────────────────────────

// 1. Support -> CRM: Link ticket to contact
export const linkTicketToContact = (ticketId: string, contactId: string) =>
  apiClient.post(`/support/tickets/${ticketId}/link-contact`, { contact_id: contactId }).then(r => r.data)

export const getTicketLinkedContact = (ticketId: string) =>
  apiClient.get(`/support/tickets/${ticketId}/linked-contact`).then(r => r.data)

// 2. Support -> Projects: Escalate to task
export const escalateTicketToTask = (ticketId: string, projectId: string, priority = 'medium') =>
  apiClient.post(`/support/tickets/${ticketId}/escalate-to-task`, { project_id: projectId, priority }).then(r => r.data)

// 3. POS -> CRM: Purchase history
export const getContactPurchaseHistory = (contactId: string, limit = 20) =>
  apiClient.get<PurchaseHistory>(`/crm/contacts/${contactId}/purchase-history`, { params: { limit } }).then(r => r.data)

// 4. POS -> Mail: Email receipt
export const emailPosReceipt = (txnId: string, email: string) =>
  apiClient.post(`/pos/transactions/${txnId}/email-receipt`, { email }).then(r => r.data)

// 5. E-Commerce -> Supply Chain: Create procurement
export const createProcurementFromOrder = (orderId: string, notes?: string) =>
  apiClient.post(`/ecommerce/orders/${orderId}/create-procurement`, { notes }).then(r => r.data)

// 7. Manufacturing -> Finance: Cost breakdown
export const getWorkOrderCostBreakdown = (woId: string) =>
  apiClient.get<CostBreakdown>(`/manufacturing/work-orders/${woId}/cost-breakdown`).then(r => r.data)

// 8. Manufacturing -> Supply Chain: Material requisition
export const requestMaterialsForWorkOrder = (woId: string) =>
  apiClient.post(`/manufacturing/work-orders/${woId}/request-materials`).then(r => r.data)

// 9. Manufacturing -> HR: Operator scheduling
export const assignOperatorsToWorkOrder = (woId: string, employeeIds: string[]) =>
  apiClient.post(`/manufacturing/work-orders/${woId}/assign-operators`, { employee_ids: employeeIds }).then(r => r.data)

export const getWorkOrderOperators = (woId: string) =>
  apiClient.get(`/manufacturing/work-orders/${woId}/operators`).then(r => r.data)

// ─── React Query Hooks ────────────────────────────────────────────────────────

export function useTicketLinkedContact(ticketId: string) {
  return useQuery({
    queryKey: ['ticket-linked-contact', ticketId],
    queryFn: () => getTicketLinkedContact(ticketId),
    enabled: !!ticketId,
  })
}

export function useLinkTicketToContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketId, contactId }: { ticketId: string; contactId: string }) =>
      linkTicketToContact(ticketId, contactId),
    onSuccess: (_, { ticketId }) => {
      qc.invalidateQueries({ queryKey: ['ticket-linked-contact', ticketId] })
    },
  })
}

export function useEscalateTicketToTask() {
  return useMutation({
    mutationFn: ({ ticketId, projectId, priority }: { ticketId: string; projectId: string; priority?: string }) =>
      escalateTicketToTask(ticketId, projectId, priority),
  })
}

export function useContactPurchaseHistory(contactId: string, limit = 20) {
  return useQuery({
    queryKey: ['contact-purchase-history', contactId, limit],
    queryFn: () => getContactPurchaseHistory(contactId, limit),
    enabled: !!contactId,
  })
}

export function useEmailPosReceipt() {
  return useMutation({
    mutationFn: ({ txnId, email }: { txnId: string; email: string }) =>
      emailPosReceipt(txnId, email),
  })
}

export function useCreateProcurementFromOrder() {
  return useMutation({
    mutationFn: ({ orderId, notes }: { orderId: string; notes?: string }) =>
      createProcurementFromOrder(orderId, notes),
  })
}

export function useWorkOrderCostBreakdown(woId: string) {
  return useQuery({
    queryKey: ['wo-cost-breakdown', woId],
    queryFn: () => getWorkOrderCostBreakdown(woId),
    enabled: !!woId,
  })
}

export function useRequestMaterials() {
  return useMutation({
    mutationFn: (woId: string) => requestMaterialsForWorkOrder(woId),
  })
}

export function useAssignOperators() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ woId, employeeIds }: { woId: string; employeeIds: string[] }) =>
      assignOperatorsToWorkOrder(woId, employeeIds),
    onSuccess: (_, { woId }) => {
      qc.invalidateQueries({ queryKey: ['wo-operators', woId] })
    },
  })
}

export function useWorkOrderOperators(woId: string) {
  return useQuery({
    queryKey: ['wo-operators', woId],
    queryFn: () => getWorkOrderOperators(woId),
    enabled: !!woId,
  })
}

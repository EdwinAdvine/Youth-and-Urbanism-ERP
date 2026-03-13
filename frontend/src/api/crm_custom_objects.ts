/**
 * CRM Custom Objects API client — user-defined entity types and their records.
 *
 * Exports TanStack Query hooks and Axios helper functions for the CRM custom
 * objects feature. All requests go through `client.ts` (Axios instance with
 * auth interceptors). Backend prefix: `/api/v1/crm`.
 *
 * Key exports:
 *   - useCustomObjects() — list all custom object definitions
 *   - useCreateCustomObject() / useUpdateCustomObject() / useDeleteCustomObject() — definition mutations
 *   - useCustomObjectRecords() — list records for a given definition
 *   - useCreateCustomObjectRecord() / useUpdateCustomObjectRecord() — record mutations
 *   - useCustomObjectRelationships() / useCreateRelationship() — link records to CRM entities
 *
 * Note: field schema (CustomObjectField[]) is stored as JSON on each definition.
 * Records hold arbitrary key/value data conforming to that schema.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomObjectField {
  name: string
  label: string
  type: string
  required?: boolean
  options?: string[]
  default_value?: unknown
}

export interface CustomObjectDefinition {
  id: string
  name: string
  label: string
  plural_label: string
  description: string | null
  icon: string | null
  fields: CustomObjectField[] | null
  relationships: Record<string, unknown>[] | null
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface CustomObjectRecord {
  id: string
  definition_id: string
  data: Record<string, unknown> | null
  owner_id: string
  created_at: string
  updated_at: string
}

export interface CustomObjectRelationship {
  id: string
  record_id: string
  related_entity_type: string
  related_entity_id: string
  relationship_type: string
}

// ─── API Functions ────────────────────────────────────────────────────────────

const getCustomObjects = (params?: Record<string, unknown>) =>
  apiClient.get('/crm/custom-objects', { params }).then((r) => r.data)

const createCustomObject = (data: Partial<CustomObjectDefinition>) =>
  apiClient.post('/crm/custom-objects', data).then((r) => r.data)

const getCustomObject = (id: string) =>
  apiClient.get(`/crm/custom-objects/${id}`).then((r) => r.data)

const updateCustomObject = ({ id, ...data }: Partial<CustomObjectDefinition> & { id: string }) =>
  apiClient.put(`/crm/custom-objects/${id}`, data).then((r) => r.data)

const deleteCustomObject = (id: string) =>
  apiClient.delete(`/crm/custom-objects/${id}`).then((r) => r.data)

const getCustomObjectRecords = (objectId: string, params?: Record<string, unknown>) =>
  apiClient.get(`/crm/custom-objects/${objectId}/records`, { params }).then((r) => r.data)

const createRecord = ({ objectId, ...data }: Partial<CustomObjectRecord> & { objectId: string }) =>
  apiClient.post(`/crm/custom-objects/${objectId}/records`, data).then((r) => r.data)

const getCustomObjectRecord = (objectId: string, recordId: string) =>
  apiClient.get(`/crm/custom-objects/${objectId}/records/${recordId}`).then((r) => r.data)

const updateRecord = ({
  objectId,
  recordId,
  ...data
}: Partial<CustomObjectRecord> & { objectId: string; recordId: string }) =>
  apiClient.put(`/crm/custom-objects/${objectId}/records/${recordId}`, data).then((r) => r.data)

const deleteRecord = ({ objectId, recordId }: { objectId: string; recordId: string }) =>
  apiClient.delete(`/crm/custom-objects/${objectId}/records/${recordId}`).then((r) => r.data)

const addRelationship = ({
  objectId,
  recordId,
  ...data
}: Partial<CustomObjectRelationship> & { objectId: string; recordId: string }) =>
  apiClient
    .post(`/crm/custom-objects/${objectId}/records/${recordId}/relationships`, data)
    .then((r) => r.data)

const deleteRelationship = ({
  objectId,
  recordId,
  relationshipId,
}: {
  objectId: string
  recordId: string
  relationshipId: string
}) =>
  apiClient
    .delete(`/crm/custom-objects/${objectId}/records/${recordId}/relationships/${relationshipId}`)
    .then((r) => r.data)

// ─── Hooks ────────────────────────────────────────────────────────────────────

export const useCustomObjects = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['crm-custom-objects', params],
    queryFn: () => getCustomObjects(params),
  })

export const useCreateCustomObject = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createCustomObject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-custom-objects'] }),
  })
}

export const useCustomObject = (id: string) =>
  useQuery({
    queryKey: ['crm-custom-objects', id],
    queryFn: () => getCustomObject(id),
    enabled: !!id,
  })

export const useUpdateCustomObject = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateCustomObject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-custom-objects'] }),
  })
}

export const useDeleteCustomObject = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteCustomObject,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-custom-objects'] }),
  })
}

export const useCustomObjectRecords = (objectId: string, params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['crm-custom-object-records', objectId, params],
    queryFn: () => getCustomObjectRecords(objectId, params),
    enabled: !!objectId,
  })

export const useCreateRecord = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createRecord,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-custom-object-records'] }),
  })
}

export const useCustomObjectRecord = (objectId: string, recordId: string) =>
  useQuery({
    queryKey: ['crm-custom-object-records', objectId, recordId],
    queryFn: () => getCustomObjectRecord(objectId, recordId),
    enabled: !!objectId && !!recordId,
  })

export const useUpdateRecord = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateRecord,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-custom-object-records'] }),
  })
}

export const useDeleteRecord = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteRecord,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-custom-object-records'] }),
  })
}

export const useAddRelationship = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: addRelationship,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-custom-object-records'] }),
  })
}

export const useDeleteRelationship = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteRelationship,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm-custom-object-records'] }),
  })
}

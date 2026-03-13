import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from './client'

export interface Backup {
  filename: string
  size_bytes: number
  last_modified: string
}

export interface BackupStatus {
  mode: string
  pgbackrest_available: boolean
  last_backup_age_seconds?: number
  last_backup_type?: string
  stanzas?: unknown[]
}

export interface PITRInfo {
  earliest?: string
  latest?: string
  backup_count: number
  archive_available: boolean
}

export function useBackups() {
  return useQuery({
    queryKey: ['admin', 'backups'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ backups: Backup[] }>('/backups')
      return data.backups
    },
  })
}

export function useBackupStatus() {
  return useQuery({
    queryKey: ['admin', 'backups', 'status'],
    queryFn: async () => {
      const { data } = await apiClient.get<BackupStatus>('/backups/status')
      return data
    },
  })
}

export function usePITRInfo() {
  return useQuery({
    queryKey: ['admin', 'backups', 'pitr'],
    queryFn: async () => {
      const { data } = await apiClient.get<PITRInfo>('/backups/pitr-info')
      return data
    },
  })
}

export function useCreateBackup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ status: string; filename: string }>('/backups')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'backups'] }),
  })
}

export function useDeleteBackup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (filename: string) => {
      await apiClient.delete(`/backups/${encodeURIComponent(filename)}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'backups'] }),
  })
}

export function useVerifyBackup() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ status: string; task_id: string; message: string }>('/backups/verify')
      return data
    },
  })
}

export function usePITRRestore() {
  return useMutation({
    mutationFn: async (payload: { target_time: string; confirm: boolean }) => {
      const { data } = await apiClient.post<{ status: string; task_id: string; message: string }>('/backups/pitr-restore', payload)
      return data
    },
  })
}

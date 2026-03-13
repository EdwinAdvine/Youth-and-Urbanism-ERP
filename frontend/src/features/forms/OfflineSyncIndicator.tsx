import { useState, useEffect } from 'react'
import { countPendingDrafts } from './offline-store'
import apiClient from '@/api/client'

interface OfflineSyncIndicatorProps {
  formId?: string
  className?: string
}

export default function OfflineSyncIndicator({ formId, className = '' }: OfflineSyncIndicatorProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    const refresh = async () => {
      const count = await countPendingDrafts(formId)
      setPendingCount(count)
    }
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [formId])

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0 && formId) {
      setSyncing(true)
      import('./offline-store').then(async ({ getPendingDrafts, markDraftSynced }) => {
        try {
          const drafts = await getPendingDrafts(formId)
          await apiClient.post(`/forms/${formId}/responses/bulk-sync`, {
            drafts: drafts.map(d => ({ answers: d.answers, device_id: d.deviceId, offline_created_at: d.createdAt }))
          })
          for (const d of drafts) {
            if (d.id !== undefined) await markDraftSynced(d.id)
          }
          setPendingCount(0)
        } catch {
          // Sync failed — will retry next time
        } finally {
          setSyncing(false)
        }
      })
    }
  }, [isOnline, formId])

  if (isOnline && pendingCount === 0 && !syncing) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <div className="w-2 h-2 rounded-full bg-[#6fd943]" />
        <span className="text-[11px] text-gray-500 dark:text-gray-400">Online</span>
      </div>
    )
  }

  if (syncing) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <svg className="w-3 h-3 text-[#3ec9d6] animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-[11px] text-[#3ec9d6]">Syncing {pendingCount} draft{pendingCount !== 1 ? 's' : ''}...</span>
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <div className="w-2 h-2 rounded-full bg-[#ffa21d] animate-pulse" />
        <span className="text-[11px] text-[#ffa21d]">
          Offline{pendingCount > 0 ? ` — ${pendingCount} draft${pendingCount !== 1 ? 's' : ''} pending` : ''}
        </span>
      </div>
    )
  }

  return null
}

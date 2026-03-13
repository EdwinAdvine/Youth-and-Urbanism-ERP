/**
 * BookmarkPanel — save and restore named dashboard filter states.
 *
 * Appears as a dropdown button in the dashboard builder header.
 * Each bookmark captures the current DashboardFilterContext state.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import { useDashboardFilters } from '../context/DashboardFilterContext'

interface Bookmark {
  id: string
  name: string
  filter_state: Record<string, unknown>
  visual_states: Record<string, unknown>
  is_default: boolean
  created_at: string
}

function useBookmarks(dashboardId: string) {
  return useQuery<Bookmark[]>({
    queryKey: ['analytics', 'bookmarks', dashboardId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/analytics/dashboards/${dashboardId}/bookmarks`)
      return data
    },
    enabled: !!dashboardId,
  })
}

function useCreateBookmark(dashboardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; filter_state: Record<string, unknown>; is_default?: boolean }) => {
      const { data } = await apiClient.post(`/analytics/dashboards/${dashboardId}/bookmarks`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics', 'bookmarks', dashboardId] }),
  })
}

function useDeleteBookmark(dashboardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (bookmarkId: string) => {
      await apiClient.delete(`/analytics/dashboards/${dashboardId}/bookmarks/${bookmarkId}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics', 'bookmarks', dashboardId] }),
  })
}

interface BookmarkPanelProps {
  dashboardId: string
}

export default function BookmarkPanel({ dashboardId }: BookmarkPanelProps) {
  const [open, setOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)

  const { data: bookmarks = [], isLoading } = useBookmarks(dashboardId)
  const createBookmark = useCreateBookmark(dashboardId)
  const deleteBookmark = useDeleteBookmark(dashboardId)

  const { activeFilters, globalDateRange, setGlobalDateRange, addFilter, clearFilters } = useDashboardFilters()

  const handleSave = async () => {
    if (!saveName.trim()) return
    const filter_state: Record<string, unknown> = {
      filters: activeFilters,
      globalDateRange,
    }
    await createBookmark.mutateAsync({ name: saveName.trim(), filter_state })
    setSaveName('')
    setShowSaveForm(false)
  }

  const handleRestore = (bookmark: Bookmark) => {
    const state = bookmark.filter_state as { filters?: Parameters<typeof addFilter>[0][]; globalDateRange?: typeof globalDateRange }
    clearFilters()
    state.filters?.forEach(f => addFilter(f))
    if (state.globalDateRange) setGlobalDateRange(state.globalDateRange)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
          open
            ? 'bg-[#51459d]/10 border-[#51459d] text-[#51459d]'
            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
        title="Bookmarks"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        Bookmarks
        {bookmarks.length > 0 && (
          <span className="bg-[#51459d] text-white rounded-full px-1.5 text-[9px]">{bookmarks.length}</span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-64 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Saved Views</span>
              <button
                onClick={() => setShowSaveForm(!showSaveForm)}
                className="text-[10px] text-[#51459d] hover:underline"
              >
                + Save current
              </button>
            </div>

            {showSaveForm && (
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <input
                  className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-[#51459d]/30 mb-1.5"
                  placeholder="Bookmark name..."
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  autoFocus
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={handleSave}
                    disabled={!saveName.trim() || createBookmark.isPending}
                    className="flex-1 text-xs py-1 rounded bg-[#51459d] text-white hover:bg-[#51459d]/90 disabled:opacity-50 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setShowSaveForm(false)}
                    className="px-2 text-xs py-1 rounded border border-gray-200 dark:border-gray-700 text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="max-h-60 overflow-y-auto">
              {isLoading ? (
                <div className="px-3 py-4 text-center text-xs text-gray-400">Loading...</div>
              ) : bookmarks.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-gray-400">
                  No saved views yet. Use filters and save the current state.
                </div>
              ) : (
                bookmarks.map(bm => (
                  <div
                    key={bm.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 group"
                  >
                    <button
                      onClick={() => handleRestore(bm)}
                      className="flex-1 text-left text-xs text-gray-700 dark:text-gray-300 truncate hover:text-[#51459d] transition-colors"
                    >
                      {bm.is_default && <span className="text-[#6fd943] mr-1">★</span>}
                      {bm.name}
                    </button>
                    <button
                      onClick={() => deleteBookmark.mutate(bm.id)}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-0.5"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

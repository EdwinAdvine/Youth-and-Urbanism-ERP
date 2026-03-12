import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'

interface FocusTimeBlock {
  id: string
  label: string
  days_of_week: number[]
  start_hour: number
  end_hour: number
  auto_decline: boolean
  is_active: boolean
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6am to 11pm

function useFocusTimeBlocks() {
  return useQuery({
    queryKey: ['focus-time-blocks'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ blocks: FocusTimeBlock[] }>('/calendar/focus-time')
      return data.blocks
    },
  })
}

function useCreateFocusBlock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<FocusTimeBlock, 'id'>) => {
      const { data } = await apiClient.post<FocusTimeBlock>('/calendar/focus-time', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['focus-time-blocks'] }),
  })
}

function useDeleteFocusBlock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/calendar/focus-time/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['focus-time-blocks'] }),
  })
}

function useToggleFocusBlock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await apiClient.put(`/calendar/focus-time/${id}`, { is_active })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['focus-time-blocks'] }),
  })
}

export default function FocusTimeManager() {
  const { data: blocks = [], isLoading } = useFocusTimeBlocks()
  const createBlock = useCreateFocusBlock()
  const deleteBlock = useDeleteFocusBlock()
  const toggleBlock = useToggleFocusBlock()
  const [showForm, setShowForm] = useState(false)

  const [label, setLabel] = useState('Deep Work')
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5])
  const [startHour, setStartHour] = useState(9)
  const [endHour, setEndHour] = useState(12)
  const [autoDecline, setAutoDecline] = useState(true)

  const handleCreate = () => {
    createBlock.mutate(
      {
        label,
        days_of_week: selectedDays,
        start_hour: startHour,
        end_hour: endHour,
        auto_decline: autoDecline,
        is_active: true,
      },
      {
        onSuccess: () => {
          setShowForm(false)
          setLabel('Deep Work')
          setSelectedDays([1, 2, 3, 4, 5])
          setStartHour(9)
          setEndHour(12)
        },
      }
    )
  }

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )
  }

  const formatHour = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return `${hour}:00 ${period}`
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Focus Time</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Protect your deep work hours from meeting requests
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm font-medium text-white bg-[#51459d] rounded-lg hover:bg-[#51459d]/90 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Block'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#51459d] focus:border-transparent"
              placeholder="e.g. Morning Focus, Deep Work"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Days</label>
            <div className="flex gap-1.5">
              {DAYS.map((day, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`w-10 h-10 rounded-lg text-xs font-medium transition-colors ${
                    selectedDays.includes(i)
                      ? 'bg-[#51459d] text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Start</label>
              <select
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>{formatHour(h)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">End</label>
              <select
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                {HOURS.filter((h) => h > startHour).map((h) => (
                  <option key={h} value={h}>{formatHour(h)}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoDecline}
              onChange={(e) => setAutoDecline(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Auto-decline meeting invites during focus time
            </span>
          </label>

          <button
            onClick={handleCreate}
            disabled={!label.trim() || selectedDays.length === 0 || createBlock.isPending}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#51459d] rounded-lg hover:bg-[#51459d]/90 disabled:opacity-50 transition-colors"
          >
            {createBlock.isPending ? 'Creating...' : 'Create Focus Block'}
          </button>
        </div>
      )}

      {/* Existing Blocks */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : blocks.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          No focus time blocks configured. Add one to protect your deep work hours.
        </div>
      ) : (
        <div className="space-y-3">
          {blocks.map((block) => (
            <div
              key={block.id}
              className={`bg-white dark:bg-gray-900 border rounded-xl p-4 transition-all ${
                block.is_active
                  ? 'border-[#51459d]/30 dark:border-[#51459d]/50'
                  : 'border-gray-200 dark:border-gray-700 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    block.is_active ? 'bg-[#51459d]/10' : 'bg-gray-100 dark:bg-gray-800'
                  }`}>
                    <svg className={`w-5 h-5 ${block.is_active ? 'text-[#51459d]' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{block.label}</p>
                    <p className="text-xs text-gray-500">
                      {block.days_of_week.map((d) => DAYS[d]).join(', ')}
                      {' '}
                      {formatHour(block.start_hour)} - {formatHour(block.end_hour)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {block.auto_decline && (
                    <span className="text-[10px] font-medium px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                      Auto-decline
                    </span>
                  )}
                  <button
                    onClick={() => toggleBlock.mutate({ id: block.id, is_active: !block.is_active })}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      block.is_active ? 'bg-[#51459d]' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      block.is_active ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                  <button
                    onClick={() => deleteBlock.mutate(block.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

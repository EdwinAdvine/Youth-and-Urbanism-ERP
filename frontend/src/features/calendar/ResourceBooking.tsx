import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../api/client'

interface Resource {
  id: string
  name: string
  resource_type: string
  location: string | null
  capacity: number | null
  features: string[] | null
  is_active: boolean
}

interface ResourceBookingItem {
  id: string
  resource_id: string
  resource_name?: string
  start_time: string
  end_time: string
  status: string
}

const TYPE_ICONS: Record<string, string> = {
  room: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21',
  equipment: 'M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l5.653-4.655m0 0a3.75 3.75 0 115.304-5.304m-5.304 5.304l5.304-5.304',
  vehicle: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12',
  desk: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15',
}

function useResources() {
  return useQuery({
    queryKey: ['calendar-resources'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; resources: Resource[] }>('/calendar/resources')
      return data.resources
    },
  })
}

function useMyBookings() {
  return useQuery({
    queryKey: ['my-resource-bookings'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ bookings: ResourceBookingItem[] }>('/calendar/resources/bookings')
      return data.bookings
    },
  })
}

function useBookResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ resourceId, ...payload }: { resourceId: string; start_time: string; end_time: string; title?: string }) => {
      const { data } = await apiClient.post(`/calendar/resources/${resourceId}/book`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-resources'] })
      qc.invalidateQueries({ queryKey: ['my-resource-bookings'] })
      qc.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}

function useCancelBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (bookingId: string) => {
      await apiClient.delete(`/calendar/resources/bookings/${bookingId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-resource-bookings'] })
      qc.invalidateQueries({ queryKey: ['calendar-resources'] })
    },
  })
}

export default function ResourceBookingView() {
  const { data: resources = [], isLoading: loadingResources } = useResources()
  const { data: bookings = [], isLoading: loadingBookings } = useMyBookings()
  const bookResource = useBookResource()
  const cancelBooking = useCancelBooking()
  const [tab, setTab] = useState<'resources' | 'bookings'>('resources')
  const [bookingModal, setBookingModal] = useState<Resource | null>(null)
  const [bookDate, setBookDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [bookStart, setBookStart] = useState('09:00')
  const [bookEnd, setBookEnd] = useState('10:00')

  const handleBook = () => {
    if (!bookingModal) return
    bookResource.mutate(
      {
        resourceId: bookingModal.id,
        start_time: `${bookDate}T${bookStart}:00`,
        end_time: `${bookDate}T${bookEnd}:00`,
      },
      { onSuccess: () => setBookingModal(null) }
    )
  }

  const activeResources = resources.filter((r) => r.is_active)
  const grouped = activeResources.reduce<Record<string, Resource[]>>((acc, r) => {
    const type = r.resource_type || 'other'
    ;(acc[type] ||= []).push(r)
    return acc
  }, {})

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Resource Booking</h2>
        <p className="text-sm text-gray-500 mt-0.5">Book rooms, equipment, and vehicles</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 w-fit">
        {(['resources', 'bookings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
              tab === t
                ? 'bg-white dark:bg-gray-700 text-[#51459d] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'bookings' ? 'My Bookings' : 'Resources'}
          </button>
        ))}
      </div>

      {tab === 'resources' && (
        <>
          {loadingResources ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : activeResources.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              No resources available. An admin can add rooms, equipment, or vehicles.
            </div>
          ) : (
            Object.entries(grouped).map(([type, items]) => (
              <div key={type} className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d={TYPE_ICONS[type] || TYPE_ICONS.room} />
                  </svg>
                  {type}s
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {items.map((resource) => (
                    <div
                      key={resource.id}
                      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{resource.name}</p>
                          <p className="text-xs text-gray-500">
                            {resource.location && <span>{resource.location}</span>}
                            {resource.capacity && <span> &middot; Capacity: {resource.capacity}</span>}
                          </p>
                        </div>
                        <button
                          onClick={() => setBookingModal(resource)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-[#51459d] rounded-lg hover:bg-[#51459d]/90 transition-colors"
                        >
                          Book
                        </button>
                      </div>
                      {resource.features && resource.features.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {resource.features.map((f) => (
                            <span key={f} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded">
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {tab === 'bookings' && (
        <>
          {loadingBookings ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No upcoming bookings.
            </div>
          ) : (
            <div className="space-y-2">
              {bookings.map((b) => {
                const start = new Date(b.start_time)
                const end = new Date(b.end_time)
                return (
                  <div
                    key={b.id}
                    className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {b.resource_name || 'Resource'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        {' '}
                        {start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                        {' - '}
                        {end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        b.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        b.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {b.status}
                      </span>
                      {b.status !== 'cancelled' && (
                        <button
                          onClick={() => cancelBooking.mutate(b.id)}
                          className="text-xs text-red-500 hover:text-red-700 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Booking Modal */}
      {bookingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setBookingModal(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Book: {bookingModal.name}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                <input
                  type="date"
                  value={bookDate}
                  onChange={(e) => setBookDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Start</label>
                  <input
                    type="time"
                    value={bookStart}
                    onChange={(e) => setBookStart(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">End</label>
                  <input
                    type="time"
                    value={bookEnd}
                    onChange={(e) => setBookEnd(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setBookingModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 dark:bg-gray-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleBook}
                disabled={bookResource.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-[#51459d] rounded-lg hover:bg-[#51459d]/90 disabled:opacity-50"
              >
                {bookResource.isPending ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

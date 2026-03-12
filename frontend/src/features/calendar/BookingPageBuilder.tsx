import { useState } from 'react'
import {
  useBookingPages,
  useCreateBookingPage,
  useDeleteBookingPage,
  type BookingPage,
  type CreateBookingPagePayload,
} from '../../api/booking'

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function BookingPageBuilder() {
  const { data, isLoading } = useBookingPages()
  const createPage = useCreateBookingPage()
  const deletePage = useDeleteBookingPage()
  const [showForm, setShowForm] = useState(false)
  const [selectedPage, setSelectedPage] = useState<BookingPage | null>(null)

  const pages = data?.pages || []

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Booking Pages</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Create scheduling links others can use to book time with you
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setSelectedPage(null) }}
          className="px-4 py-2 text-sm font-medium text-white bg-[#51459d] rounded-lg hover:bg-[#51459d]/90 transition-colors"
        >
          + New Booking Page
        </button>
      </div>

      {showForm && (
        <BookingPageForm
          onCancel={() => setShowForm(false)}
          onCreated={() => setShowForm(false)}
          createPage={createPage}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : pages.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <p className="text-sm">No booking pages yet. Create one to let others schedule time with you.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pages.map((page) => (
            <div
              key={page.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: page.color || '#51459d' }}
                  >
                    {page.duration_minutes}m
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{page.title}</p>
                    <p className="text-xs text-gray-500">
                      /{page.slug} &middot; {page.duration_minutes} min
                      {page.buffer_before > 0 && ` &middot; ${page.buffer_before}min buffer`}
                      {!page.is_active && (
                        <span className="ml-2 text-amber-500">Inactive</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedPage(selectedPage?.id === page.id ? null : page)}
                    className="px-3 py-1.5 text-xs font-medium text-[#51459d] bg-[#51459d]/10 rounded-lg hover:bg-[#51459d]/20 transition-colors"
                  >
                    {selectedPage?.id === page.id ? 'Hide' : 'Details'}
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/book/${page.slug}`)
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={() => deletePage.mutate(page.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>

              {selectedPage?.id === page.id && (
                <BookingPageDetails page={page} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BookingPageDetails({ page }: { page: BookingPage }) {
  const availability = page.availability || []

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
      {page.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{page.description}</p>
      )}
      {page.welcome_message && (
        <p className="text-sm text-gray-500 italic">{page.welcome_message}</p>
      )}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
          <span className="text-gray-500">Min Notice:</span>{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">{page.min_notice_hours}h</span>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
          <span className="text-gray-500">Max Advance:</span>{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">{page.max_advance_days} days</span>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
          <span className="text-gray-500">Buffer Before:</span>{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">{page.buffer_before} min</span>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
          <span className="text-gray-500">Buffer After:</span>{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">{page.buffer_after} min</span>
        </div>
      </div>
      {availability.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Availability</p>
          <div className="flex flex-wrap gap-1.5">
            {availability.map((slot, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md"
              >
                {DAYS[slot.day]} {slot.start}-{slot.end}
              </span>
            ))}
          </div>
        </div>
      )}
      {page.auto_create_jitsi && (
        <p className="text-xs text-indigo-600 dark:text-indigo-400">Auto-creates Jitsi meeting link</p>
      )}
    </div>
  )
}

function BookingPageForm({
  onCancel,
  onCreated,
  createPage,
}: {
  onCancel: () => void
  onCreated: () => void
  createPage: ReturnType<typeof useCreateBookingPage>
}) {
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState(30)
  const [bufferBefore, setBufferBefore] = useState(0)
  const [bufferAfter, setBufferAfter] = useState(5)
  const [autoJitsi, setAutoJitsi] = useState(true)

  const handleSubmit = () => {
    const payload: CreateBookingPagePayload = {
      slug: slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title,
      description: description || undefined,
      duration_minutes: duration,
      buffer_before: bufferBefore,
      buffer_after: bufferAfter,
      auto_create_jitsi: autoJitsi,
      availability: [
        { day: 1, start: '09:00', end: '17:00' },
        { day: 2, start: '09:00', end: '17:00' },
        { day: 3, start: '09:00', end: '17:00' },
        { day: 4, start: '09:00', end: '17:00' },
        { day: 5, start: '09:00', end: '17:00' },
      ],
    }
    createPage.mutate(payload, { onSuccess: onCreated })
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">New Booking Page</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#51459d]"
            placeholder="e.g. 30-min Discovery Call"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Slug</label>
          <div className="flex items-center">
            <span className="text-xs text-gray-400 mr-1">/book/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#51459d]"
              placeholder="discovery-call"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#51459d]"
          placeholder="Brief description of what this meeting is about..."
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Duration</label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>{d} min</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Buffer Before</label>
          <select
            value={bufferBefore}
            onChange={(e) => setBufferBefore(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {[0, 5, 10, 15, 30].map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Buffer After</label>
          <select
            value={bufferAfter}
            onChange={(e) => setBufferAfter(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {[0, 5, 10, 15, 30].map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={autoJitsi}
          onChange={(e) => setAutoJitsi(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">Auto-create Jitsi video link</span>
      </label>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || createPage.isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-[#51459d] rounded-lg hover:bg-[#51459d]/90 disabled:opacity-50 transition-colors"
        >
          {createPage.isPending ? 'Creating...' : 'Create'}
        </button>
      </div>
    </div>
  )
}

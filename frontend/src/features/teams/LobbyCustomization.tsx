import { useState, useEffect } from 'react'
import { Card, Button, Spinner, toast } from '../../components/ui'
import {
  useMeetingsLobby,
  useUpdateMeetingsLobby,
  type LobbySettings,
} from '../../api/adminConfig'

/**
 * Admin form for customizing the meeting lobby / waiting room.
 * Allows setting a logo, welcome message, background color, and approval requirement.
 */
export default function LobbyCustomization() {
  const { data, isLoading } = useMeetingsLobby()
  const mutation = useUpdateMeetingsLobby()

  const [form, setForm] = useState<LobbySettings>({
    logo_url: '',
    welcome_message: 'Welcome! The host will let you in shortly.',
    background_color: '#1a1a2e',
    require_approval: true,
  })

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const save = () =>
    mutation.mutate(form, {
      onSuccess: () => toast('success', 'Lobby settings saved'),
      onError: () => toast('error', 'Failed to save lobby settings'),
    })

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 mb-5">
        Lobby / Waiting Room Customization
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Logo URL</label>
            <input
              type="url"
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              placeholder="https://your-domain.com/logo.png"
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            />
            <p className="text-xs text-gray-400">Displayed at the top of the waiting room</p>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Welcome Message</label>
            <textarea
              value={form.welcome_message}
              onChange={(e) => setForm({ ...form, welcome_message: e.target.value })}
              rows={3}
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Background Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.background_color}
                onChange={(e) => setForm({ ...form, background_color: e.target.value })}
                className="h-10 w-16 rounded-[8px] border border-gray-200 cursor-pointer"
              />
              <input
                type="text"
                value={form.background_color}
                onChange={(e) => setForm({ ...form, background_color: e.target.value })}
                className="w-32 rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.require_approval}
              onChange={(e) => setForm({ ...form, require_approval: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30 accent-primary"
            />
            <div>
              <span className="text-sm text-gray-700 font-medium">Require host approval</span>
              <p className="text-xs text-gray-400">Participants must wait for the host to admit them</p>
            </div>
          </label>

          <div className="pt-2">
            <Button onClick={save} loading={mutation.isPending}>
              Save Lobby Settings
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div
          className="rounded-[10px] overflow-hidden flex flex-col items-center justify-center p-8 min-h-[280px]"
          style={{ backgroundColor: form.background_color }}
        >
          {form.logo_url ? (
            <img
              src={form.logo_url}
              alt="Lobby logo"
              className="h-12 w-auto object-contain mb-4"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-[8px] bg-[#51459d] flex items-center justify-center mb-4">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
          <p className="text-white text-sm text-center font-medium mb-2">Meeting Title</p>
          <p className="text-white/70 text-xs text-center max-w-xs">{form.welcome_message}</p>
          {form.require_approval && (
            <div className="mt-4 flex items-center gap-1.5">
              <svg className="w-3 h-3 text-yellow-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-yellow-400/80">Waiting for host...</span>
            </div>
          )}
          <p className="text-[9px] text-white/30 mt-4 uppercase tracking-wider">Preview</p>
        </div>
      </div>
    </Card>
  )
}

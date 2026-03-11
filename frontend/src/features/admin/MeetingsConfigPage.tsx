import { useState, useEffect } from 'react'
import { Card, Button, Spinner, toast } from '../../components/ui'
import {
  useMeetingsConfig, useUpdateMeetingsConfig,
  useMeetingsDefaults, useUpdateMeetingsDefaults,
  useMeetingsRecording, useUpdateMeetingsRecording,
  useMeetingsLobby, useUpdateMeetingsLobby,
  useMeetingsTheme, useUpdateMeetingsTheme,
  useMeetingsSIP, useUpdateMeetingsSIP,
  type MeetingsServerConfig, type MeetingsDefaults, type MeetingsRecording,
  type LobbySettings, type JitsiTheme, type SIPConfig,
} from '../../api/adminConfig'
import LobbyCustomization from '../teams/LobbyCustomization'

type Tab = 'server' | 'defaults' | 'recording' | 'lobby' | 'theme' | 'sip'

const TABS: { id: Tab; label: string }[] = [
  { id: 'server', label: 'Server Config' },
  { id: 'defaults', label: 'Meeting Defaults' },
  { id: 'recording', label: 'Recording' },
  { id: 'lobby', label: 'Lobby' },
  { id: 'theme', label: 'Theme' },
  { id: 'sip', label: 'SIP Gateway' },
]

// ── Server Config Tab ───────────────────────────────────────────────────────

function ServerTab() {
  const { data, isLoading } = useMeetingsConfig()
  const mutation = useUpdateMeetingsConfig()
  const [form, setForm] = useState<MeetingsServerConfig>({
    jitsi_url: 'https://meet.jitsi', jwt_app_id: '', jwt_secret: '',
    enable_lobby: true, enable_breakout_rooms: true, require_authentication: true,
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const save = () => mutation.mutate(form, {
    onSuccess: () => toast('success', 'Jitsi server config saved'),
    onError: () => toast('error', 'Failed to save Jitsi config'),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 mb-5">Jitsi Server Configuration</h2>
      <div className="space-y-4 max-w-lg">
        <Field label="Jitsi Server URL" value={form.jitsi_url} onChange={v => setForm({ ...form, jitsi_url: v })} />
        <Field label="JWT App ID" value={form.jwt_app_id} onChange={v => setForm({ ...form, jwt_app_id: v })} />
        <Field label="JWT Secret" value={form.jwt_secret} onChange={v => setForm({ ...form, jwt_secret: v })} type="password" />
        <Toggle label="Enable Lobby" checked={form.enable_lobby} onChange={v => setForm({ ...form, enable_lobby: v })} />
        <Toggle label="Enable Breakout Rooms" checked={form.enable_breakout_rooms} onChange={v => setForm({ ...form, enable_breakout_rooms: v })} />
        <Toggle label="Require Authentication" checked={form.require_authentication} onChange={v => setForm({ ...form, require_authentication: v })} />
        <div className="pt-2">
          <Button onClick={save} loading={mutation.isPending}>Save Server Config</Button>
        </div>
      </div>
    </Card>
  )
}

// ── Meeting Defaults Tab ────────────────────────────────────────────────────

function DefaultsTab() {
  const { data, isLoading } = useMeetingsDefaults()
  const mutation = useUpdateMeetingsDefaults()
  const [form, setForm] = useState<MeetingsDefaults>({
    max_participants: 100, recording_enabled: true, default_video_quality: '720',
    default_mute_on_join: true, default_camera_off_on_join: false,
    max_meeting_duration_minutes: 480, enable_screen_sharing: true,
    enable_chat: true, enable_raise_hand: true,
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const save = () => mutation.mutate(form, {
    onSuccess: () => toast('success', 'Meeting defaults saved'),
    onError: () => toast('error', 'Failed to save meeting defaults'),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 mb-5">Meeting Default Settings</h2>
      <div className="space-y-4 max-w-lg">
        <NumberField label="Max Participants" value={form.max_participants} onChange={v => setForm({ ...form, max_participants: v })} />
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Default Video Quality</label>
          <select value={form.default_video_quality} onChange={e => setForm({ ...form, default_video_quality: e.target.value })}
            className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors">
            <option value="360">360p</option>
            <option value="480">480p</option>
            <option value="720">720p (HD)</option>
            <option value="1080">1080p (Full HD)</option>
          </select>
        </div>
        <NumberField label="Max Meeting Duration (minutes)" value={form.max_meeting_duration_minutes} onChange={v => setForm({ ...form, max_meeting_duration_minutes: v })} />
        <Toggle label="Recording Enabled by Default" checked={form.recording_enabled} onChange={v => setForm({ ...form, recording_enabled: v })} />
        <Toggle label="Mute on Join" checked={form.default_mute_on_join} onChange={v => setForm({ ...form, default_mute_on_join: v })} />
        <Toggle label="Camera Off on Join" checked={form.default_camera_off_on_join} onChange={v => setForm({ ...form, default_camera_off_on_join: v })} />
        <Toggle label="Enable Screen Sharing" checked={form.enable_screen_sharing} onChange={v => setForm({ ...form, enable_screen_sharing: v })} />
        <Toggle label="Enable Chat" checked={form.enable_chat} onChange={v => setForm({ ...form, enable_chat: v })} />
        <Toggle label="Enable Raise Hand" checked={form.enable_raise_hand} onChange={v => setForm({ ...form, enable_raise_hand: v })} />
        <div className="pt-2">
          <Button onClick={save} loading={mutation.isPending}>Save Defaults</Button>
        </div>
      </div>
    </Card>
  )
}

// ── Recording Tab ───────────────────────────────────────────────────────────

function RecordingTab() {
  const { data, isLoading } = useMeetingsRecording()
  const mutation = useUpdateMeetingsRecording()
  const [form, setForm] = useState<MeetingsRecording>({
    storage_bucket: 'recordings', auto_delete_after_days: 90,
    max_recording_size_mb: 2048, recording_format: 'mp4', auto_transcribe: false,
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const save = () => mutation.mutate(form, {
    onSuccess: () => toast('success', 'Recording config saved'),
    onError: () => toast('error', 'Failed to save recording config'),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 mb-5">Recording Configuration</h2>
      <div className="space-y-4 max-w-lg">
        <Field label="Storage Bucket" value={form.storage_bucket} onChange={v => setForm({ ...form, storage_bucket: v })} />
        <NumberField label="Auto-delete After (days)" value={form.auto_delete_after_days} onChange={v => setForm({ ...form, auto_delete_after_days: v })} />
        <NumberField label="Max Recording Size (MB)" value={form.max_recording_size_mb} onChange={v => setForm({ ...form, max_recording_size_mb: v })} />
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Recording Format</label>
          <select value={form.recording_format} onChange={e => setForm({ ...form, recording_format: e.target.value })}
            className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors">
            <option value="mp4">MP4</option>
            <option value="webm">WebM</option>
            <option value="mkv">MKV</option>
          </select>
        </div>
        <Toggle label="Auto-transcribe Recordings" checked={form.auto_transcribe} onChange={v => setForm({ ...form, auto_transcribe: v })} />
        <div className="pt-2">
          <Button onClick={save} loading={mutation.isPending}>Save Recording Config</Button>
        </div>
      </div>
    </Card>
  )
}

// ── Theme Tab ───────────────────────────────────────────────────────────────

const ALL_TOOLBAR_BUTTONS = [
  'camera', 'chat', 'closedcaptions', 'desktop', 'download',
  'embedmeeting', 'etherpad', 'feedback', 'filmstrip', 'fullscreen',
  'hangup', 'help', 'highlight', 'invite', 'linktosalesforce',
  'livestreaming', 'microphone', 'noisesuppression', 'participants-pane',
  'profile', 'raisehand', 'recording', 'security', 'select-background',
  'settings', 'shareaudio', 'sharedvideo', 'shortcuts', 'stats',
  'tileview', 'toggle-camera', 'videoquality', 'whiteboard',
]

function ThemeTab() {
  const { data, isLoading } = useMeetingsTheme()
  const mutation = useUpdateMeetingsTheme()
  const [form, setForm] = useState<JitsiTheme>({
    primary_color: '#51459d',
    logo_url: '',
    watermark_url: '',
    toolbar_buttons: [...ALL_TOOLBAR_BUTTONS],
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const save = () => mutation.mutate(form, {
    onSuccess: () => toast('success', 'Jitsi theme saved'),
    onError: () => toast('error', 'Failed to save Jitsi theme'),
  })

  const toggleButton = (btn: string) => {
    const current = new Set(form.toolbar_buttons)
    if (current.has(btn)) {
      current.delete(btn)
    } else {
      current.add(btn)
    }
    setForm({ ...form, toolbar_buttons: Array.from(current) })
  }

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 mb-5">Jitsi UI Theme</h2>
      <div className="space-y-5 max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Primary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.primary_color}
                onChange={e => setForm({ ...form, primary_color: e.target.value })}
                className="h-10 w-16 rounded-[8px] border border-gray-200 cursor-pointer"
              />
              <input
                type="text"
                value={form.primary_color}
                onChange={e => setForm({ ...form, primary_color: e.target.value })}
                className="w-32 rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
            </div>
          </div>
          <Field label="Logo URL" value={form.logo_url} onChange={v => setForm({ ...form, logo_url: v })} placeholder="https://..." />
          <Field label="Watermark URL" value={form.watermark_url} onChange={v => setForm({ ...form, watermark_url: v })} placeholder="https://..." />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Toolbar Buttons</label>
          <p className="text-xs text-gray-400">Select which buttons appear in the Jitsi meeting toolbar</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {ALL_TOOLBAR_BUTTONS.map(btn => {
              const active = form.toolbar_buttons.includes(btn)
              return (
                <button
                  key={btn}
                  onClick={() => toggleButton(btn)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    active
                      ? 'bg-primary/10 border-primary text-primary font-medium'
                      : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {btn}
                </button>
              )
            })}
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-[10px] border border-gray-100 p-4 bg-gray-50">
          <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">Preview</p>
          <div className="rounded-lg overflow-hidden" style={{ backgroundColor: form.primary_color + '20' }}>
            <div className="h-8 flex items-center px-3" style={{ backgroundColor: form.primary_color }}>
              {form.logo_url ? (
                <img src={form.logo_url} alt="" className="h-5 w-auto" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              ) : (
                <span className="text-xs font-bold text-white">Urban Teams</span>
              )}
            </div>
            <div className="h-32 bg-gray-800 flex items-center justify-center">
              <span className="text-gray-500 text-xs">Meeting area</span>
            </div>
            <div className="h-10 bg-gray-900 flex items-center justify-center gap-2 px-3 overflow-x-auto">
              {form.toolbar_buttons.slice(0, 12).map(btn => (
                <span key={btn} className="text-[9px] text-gray-400 px-1.5 py-0.5 bg-gray-800 rounded whitespace-nowrap">{btn}</span>
              ))}
              {form.toolbar_buttons.length > 12 && (
                <span className="text-[9px] text-gray-500">+{form.toolbar_buttons.length - 12}</span>
              )}
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Button onClick={save} loading={mutation.isPending}>Save Theme</Button>
        </div>
      </div>
    </Card>
  )
}

// ── SIP Tab ─────────────────────────────────────────────────────────────────

function SIPTab() {
  const { data, isLoading } = useMeetingsSIP()
  const mutation = useUpdateMeetingsSIP()
  const [form, setForm] = useState<SIPConfig>({
    sip_enabled: false,
    sip_server: '',
    sip_username: '',
    sip_password: '',
    dial_in_number: '',
    dial_in_pin_prefix: '',
  })

  useEffect(() => { if (data) setForm(data) }, [data])

  const save = () => mutation.mutate(form, {
    onSuccess: () => toast('success', 'SIP configuration saved'),
    onError: () => toast('error', 'Failed to save SIP config'),
  })

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>

  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 mb-5">SIP Gateway Configuration</h2>
      <p className="text-sm text-gray-500 mb-5">
        Configure SIP/PSTN dial-in to allow participants to join meetings via phone.
        This requires a compatible SIP gateway (e.g., Ooma, Twilio, FreeSWITCH) configured alongside Jitsi.
      </p>
      <div className="space-y-4 max-w-lg">
        <Toggle
          label="Enable SIP Gateway"
          checked={form.sip_enabled}
          onChange={v => setForm({ ...form, sip_enabled: v })}
        />

        {form.sip_enabled && (
          <>
            <Field label="SIP Server Address" value={form.sip_server} onChange={v => setForm({ ...form, sip_server: v })} placeholder="sip.example.com" />
            <Field label="SIP Username" value={form.sip_username} onChange={v => setForm({ ...form, sip_username: v })} />
            <Field label="SIP Password" value={form.sip_password} onChange={v => setForm({ ...form, sip_password: v })} type="password" />
            <Field label="Dial-In Phone Number" value={form.dial_in_number} onChange={v => setForm({ ...form, dial_in_number: v })} placeholder="+1-555-123-4567" />
            <Field label="PIN Prefix (optional)" value={form.dial_in_pin_prefix} onChange={v => setForm({ ...form, dial_in_pin_prefix: v })} placeholder="e.g. 99" />
            <p className="text-xs text-gray-400">
              A unique 8-digit PIN is auto-generated for each meeting. Callers dial the number above and enter the PIN when prompted.
            </p>
          </>
        )}

        <div className="pt-2">
          <Button onClick={save} loading={mutation.isPending}>Save SIP Config</Button>
        </div>
      </div>
    </Card>
  )
}

// ── Shared components ───────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
    </div>
  )
}

function NumberField({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
    </div>
  )
}

function Toggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/30 accent-primary" />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MeetingsConfigPage() {
  const [tab, setTab] = useState<Tab>('server')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Meetings Administration</h1>
        <p className="text-sm text-gray-500 mt-1">Configure Jitsi video conferencing server, default meeting settings, recording policies, lobby, theme, and SIP gateway</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-100 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              tab === t.id ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'server' && <ServerTab />}
      {tab === 'defaults' && <DefaultsTab />}
      {tab === 'recording' && <RecordingTab />}
      {tab === 'lobby' && <LobbyCustomization />}
      {tab === 'theme' && <ThemeTab />}
      {tab === 'sip' && <SIPTab />}
    </div>
  )
}

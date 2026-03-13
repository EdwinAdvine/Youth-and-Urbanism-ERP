import { useState } from 'react'
import { Button, Card, Modal, Input, toast } from '../../components/ui'
import {
  useOmnichannelConfigs,
  useCreateChannel,
  useToggleChannel,
  useOmnichannelStats,
  type OmnichannelConfig,
} from '@/api/support_phase2'

const CHANNEL_ICONS: Record<string, string> = {
  email: '📧',
  whatsapp: '💬',
  telegram: '✈️',
  slack: '🔷',
  facebook: '📘',
  twitter: '🐦',
  instagram: '📷',
  sms: '📱',
  webchat: '🌐',
}

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'slack', label: 'Slack' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'sms', label: 'SMS' },
  { value: 'webchat', label: 'Web Chat' },
]

function truncate(str: string | null | undefined, len = 40) {
  if (!str) return '—'
  return str.length > len ? str.slice(0, len) + '…' : str
}

const emptyForm = { channel: 'email', display_name: '', webhook_url: '', api_key: '' }

export default function OmnichannelConfigPage() {
  const { data: channels, isLoading } = useOmnichannelConfigs()
  const { data: stats } = useOmnichannelStats()
  const createChannel = useCreateChannel()
  const toggleChannel = useToggleChannel()

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const handleAdd = async () => {
    if (!form.display_name.trim()) { toast('error', 'Display name is required'); return }
    try {
      await createChannel.mutateAsync({
        channel: form.channel,
        display_name: form.display_name,
        webhook_url: form.webhook_url || undefined,
      })
      toast('success', 'Channel added')
      setShowAdd(false)
      setForm(emptyForm)
    } catch {
      toast('error', 'Failed to add channel')
    }
  }

  const handleToggle = async (id: string) => {
    try {
      await toggleChannel.mutateAsync(id)
      toast('success', 'Channel updated')
    } catch {
      toast('error', 'Failed to update channel')
    }
  }

  const channelList: OmnichannelConfig[] = channels ?? []

  // Stats bar values
  const totalChannels = stats?.total_channels ?? channelList.length
  const activeChannels = stats?.active_channels ?? channelList.filter((c) => c.is_active).length
  const totalTicketsToday = stats?.tickets_today ?? 0
  const avgResponseTime = stats?.avg_response_minutes ?? null

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Omnichannel Configuration</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage all support channel integrations</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Channel
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Channels', value: totalChannels, color: 'text-[#51459d]' },
          { label: 'Active', value: activeChannels, color: 'text-[#6fd943]' },
          { label: 'Tickets Today', value: totalTicketsToday, color: 'text-[#3ec9d6]' },
          {
            label: 'Avg Response',
            value: avgResponseTime !== null ? `${avgResponseTime}m` : '—',
            color: 'text-[#ffa21d]',
          },
        ].map((s) => (
          <Card key={s.label} className="text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Channel Table */}
      <Card padding={false}>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading channels...</div>
        ) : channelList.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <svg className="mx-auto h-12 w-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.143 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
            No channels configured yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Channel</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Display Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Webhook URL</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">API Key</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {channelList.map((ch: OmnichannelConfig) => (
                  <tr key={ch.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg" aria-hidden="true">{CHANNEL_ICONS[ch.channel] ?? '📡'}</span>
                        <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">{ch.channel}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{ch.display_name}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {ch.webhook_url ? (
                        <span className="font-mono text-xs text-gray-500" title={ch.webhook_url}>
                          {truncate(ch.webhook_url, 45)}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {ch.api_key_masked ? (
                        <span className="font-mono text-xs text-gray-500">{ch.api_key_masked}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(ch.id)}
                        disabled={toggleChannel.isPending}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                          ch.is_active ? 'bg-[#6fd943]' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                        title={ch.is_active ? 'Active' : 'Inactive'}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            ch.is_active ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Channel Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Channel" size="md">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Channel Type</label>
            <select
              className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
            >
              {CHANNEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <Input
            label="Display Name"
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            placeholder="e.g. Support WhatsApp"
          />
          <Input
            label="Webhook URL (optional)"
            value={form.webhook_url}
            onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
            placeholder="https://..."
          />
          <Input
            label="API Key (optional)"
            type="password"
            value={form.api_key}
            onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            placeholder="Stored encrypted"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} loading={createChannel.isPending}>Add Channel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

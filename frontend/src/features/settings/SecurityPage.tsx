import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useSessions, useRevokeSession, useRevokeAllSessions } from '../../api/sessions'
import { useAPIKeys, useCreateAPIKey, useRevokeAPIKey } from '../../api/security'
import MFASetup from '../auth/MFASetup'
import { Button, Input } from '../../components/ui'
import { useAuthStore } from '../../store/auth'

export default function SecurityPage() {
  const user = useAuthStore(s => s.user)
  const { data: sessions, isLoading: sessionsLoading } = useSessions()
  const { data: apiKeys, isLoading: keysLoading } = useAPIKeys()
  const revokeSession = useRevokeSession()
  const revokeAllSessions = useRevokeAllSessions()
  const createKey = useCreateAPIKey()
  const revokeKey = useRevokeAPIKey()

  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [showRevokeAll, setShowRevokeAll] = useState(false)

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return
    try {
      const result = await createKey.mutateAsync({ name: newKeyName.trim() })
      setCreatedKey(result.raw_key)
      setNewKeyName('')
    } catch {}
  }

  const handleRevokeAll = async () => {
    await revokeAllSessions.mutateAsync()
    setShowRevokeAll(false)
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Security</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account security settings</p>
      </div>

      {/* MFA Section */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Two-factor authentication</h2>
        <MFASetup mfaEnabled={user?.mfa_required ?? false} />
      </section>

      {/* Active Sessions */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Active sessions</h2>
            <p className="text-sm text-gray-500 mt-0.5">Devices currently signed in to your account</p>
          </div>
          {sessions && sessions.length > 1 && (
            <Button variant="danger" size="sm" onClick={() => setShowRevokeAll(true)}>
              Sign out everywhere
            </Button>
          )}
        </div>

        {showRevokeAll && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-800 font-medium">Sign out from all other sessions?</p>
            <p className="text-sm text-red-700 mt-1">Your current session will remain active.</p>
            <div className="flex gap-2 mt-3">
              <Button variant="danger" size="sm" loading={revokeAllSessions.isPending} onClick={handleRevokeAll}>Confirm</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowRevokeAll(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {sessionsLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />)}
          </div>
        ) : sessions && sessions.length > 0 ? (
          <div className="space-y-2">
            {sessions.map(session => (
              <div key={session.id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {session.device_name || parseUserAgent(session.user_agent)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {session.ip_address || 'Unknown IP'} · Last active {formatDistanceToNow(new Date(session.last_active_at), { addSuffix: true })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeSession.mutate(session.id)}
                  loading={revokeSession.isPending}
                  className="text-[#ff3a6e] hover:text-[#ff3a6e] flex-shrink-0"
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No active sessions found.</p>
        )}
      </section>

      {/* API Keys */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">API keys</h2>
          <p className="text-sm text-gray-500 mt-0.5">Use API keys to authenticate programmatic access</p>
        </div>

        {createdKey && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm font-medium text-green-800">API key created — copy it now, it won't be shown again</p>
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 text-xs font-mono bg-white border border-green-200 rounded-lg px-3 py-2 break-all">{createdKey}</code>
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(createdKey) }}>Copy</Button>
            </div>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setCreatedKey(null)}>Dismiss</Button>
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Key name (e.g. CI Pipeline)"
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateKey() }}
            className="flex-1"
          />
          <Button variant="primary" onClick={handleCreateKey} loading={createKey.isPending} disabled={!newKeyName.trim()}>
            Generate
          </Button>
        </div>

        {keysLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />)}
          </div>
        ) : apiKeys && apiKeys.length > 0 ? (
          <div className="space-y-2">
            {apiKeys.map(key => (
              <div key={key.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{key.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <code>{key.key_prefix}••••••••</code>
                    {key.last_used_at && <span> · Last used {formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })}</span>}
                    {!key.last_used_at && <span> · Never used</span>}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeKey.mutate(key.id)}
                  loading={revokeKey.isPending}
                  className="text-[#ff3a6e] hover:text-[#ff3a6e] flex-shrink-0"
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No API keys yet.</p>
        )}
      </section>
    </div>
  )
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown device'
  if (ua.includes('Chrome')) return 'Chrome Browser'
  if (ua.includes('Firefox')) return 'Firefox Browser'
  if (ua.includes('Safari')) return 'Safari Browser'
  if (ua.includes('Edge')) return 'Edge Browser'
  return 'Unknown Browser'
}

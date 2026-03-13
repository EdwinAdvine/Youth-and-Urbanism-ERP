import { useState } from 'react'
import { Card, Button, Badge } from '../../components/ui'
import { useAppAdmins, useGrantAppAdmin, useRevokeAppAdmin } from '../../api/admin'
import { useUsers } from '../../api/admin'
import type { AppAdmin } from '../../types'

const SUPPORTED_APPS = [
  'analytics', 'calendar', 'crm', 'docs', 'drive', 'ecommerce', 'finance',
  'forms', 'handbook', 'hr', 'inventory', 'kds', 'loyalty', 'mail',
  'manufacturing', 'notes', 'pos', 'projects', 'settings', 'supply-chain',
  'support', 'teams',
]

const APP_LABELS: Record<string, string> = {
  'analytics': 'Analytics', 'calendar': 'Calendar', 'crm': 'CRM',
  'docs': 'Docs', 'drive': 'Drive', 'ecommerce': 'E-Commerce',
  'finance': 'Finance', 'forms': 'Forms', 'handbook': 'Handbook',
  'hr': 'HR', 'inventory': 'Inventory', 'kds': 'KDS', 'loyalty': 'Loyalty',
  'mail': 'Mail', 'manufacturing': 'Manufacturing', 'notes': 'Notes',
  'pos': 'POS', 'projects': 'Projects', 'settings': 'Settings',
  'supply-chain': 'Supply Chain', 'support': 'Support', 'teams': 'Teams',
}

interface AssignDialogState {
  open: boolean
  userId: string
  appName: string
}

export default function AppAdminsPage() {
  const { data: admins = [], isLoading } = useAppAdmins()
  const { data: usersData } = useUsers(1, '')
  const grantMutation = useGrantAppAdmin()
  const revokeMutation = useRevokeAppAdmin()

  const [dialog, setDialog] = useState<AssignDialogState>({ open: false, userId: '', appName: '' })
  const [error, setError] = useState('')

  const users = usersData?.items ?? []

  const adminsByApp = SUPPORTED_APPS.reduce<Record<string, AppAdmin[]>>((acc, app) => {
    acc[app] = admins.filter((a) => a.app_name === app)
    return acc
  }, {})

  async function handleAssign() {
    if (!dialog.userId || !dialog.appName) return
    setError('')
    try {
      await grantMutation.mutateAsync({ user_id: dialog.userId, app_name: dialog.appName })
      setDialog({ open: false, userId: '', appName: '' })
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to assign admin')
    }
  }

  async function handleRevoke(id: string) {
    await revokeMutation.mutateAsync(id)
  }

  return (
    <div className="p-3 sm:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">App Admins</h1>
          <p className="text-gray-500 text-sm mt-0.5">Assign module-level administrators — they get extra settings and tools for their assigned apps</p>
        </div>
        <Button onClick={() => setDialog({ open: true, userId: '', appName: '' })} className="w-full sm:w-auto">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Assign Admin
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {SUPPORTED_APPS.map((app) => {
            const appAdmins = adminsByApp[app] ?? []
            return (
              <Card key={app}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{APP_LABELS[app]}</p>
                    <p className="text-xs text-gray-400">{appAdmins.length} admin{appAdmins.length !== 1 ? 's' : ''}</p>
                  </div>
                  <button
                    onClick={() => setDialog({ open: true, userId: '', appName: app })}
                    className="text-xs text-primary hover:text-primary/80 font-medium"
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-1.5">
                  {appAdmins.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No admin assigned</p>
                  ) : (
                    appAdmins.map((a) => (
                      <div key={a.id} className="flex items-center justify-between">
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[110px]">{a.user_id.slice(0, 8)}…</span>
                        <button
                          onClick={() => handleRevoke(a.id)}
                          disabled={revokeMutation.isPending}
                          className="text-xs text-danger hover:underline ml-1 shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* All assignments table */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">All Assignments</h2>
          <Badge variant="default">{admins.length} total</Badge>
        </div>
        {admins.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No app admins assigned yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Module</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">User ID</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Granted</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="py-3 px-4">
                    <Badge variant="primary">{APP_LABELS[a.app_name] ?? a.app_name}</Badge>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300 font-mono text-xs">{a.user_id}</td>
                  <td className="py-3 px-4 text-gray-500 text-sm">{new Date(a.granted_at).toLocaleDateString()}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleRevoke(a.id)}
                      disabled={revokeMutation.isPending}
                      className="text-xs text-danger hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Assign dialog */}
      {dialog.open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setDialog({ open: false, userId: '', appName: '' })} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-[10px] shadow-2xl w-full max-w-md p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Assign App Admin</h2>
              {error && <p className="text-sm text-danger">{error}</p>}

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Module</label>
                <select
                  value={dialog.appName}
                  onChange={(e) => setDialog((d) => ({ ...d, appName: e.target.value }))}
                  className="w-full rounded-[8px] border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select module…</option>
                  {SUPPORTED_APPS.map((app) => (
                    <option key={app} value={app}>{APP_LABELS[app]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">User</label>
                <select
                  value={dialog.userId}
                  onChange={(e) => setDialog((d) => ({ ...d, userId: e.target.value }))}
                  className="w-full rounded-[8px] border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select user…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleAssign}
                  disabled={!dialog.userId || !dialog.appName || grantMutation.isPending}
                  className="flex-1"
                >
                  {grantMutation.isPending ? 'Assigning…' : 'Assign Admin'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDialog({ open: false, userId: '', appName: '' })}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

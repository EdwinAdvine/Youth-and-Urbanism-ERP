import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Badge } from '../../components/ui'
import { useUserAppAccess, useSetUserAppAccess } from '../../api/admin'
import apiClient from '../../api/client'
import type { User } from '../../types'
import { useAuthStore } from '../../store/auth'

const SUPPORTED_APPS: { id: string; label: string; description: string }[] = [
  { id: 'analytics', label: 'Analytics', description: 'Dashboards and reports' },
  { id: 'calendar', label: 'Calendar', description: 'Events and scheduling' },
  { id: 'crm', label: 'CRM', description: 'Leads, contacts, deals' },
  { id: 'docs', label: 'Docs', description: 'Document editor (ONLYOFFICE)' },
  { id: 'drive', label: 'Drive', description: 'File storage (MinIO)' },
  { id: 'ecommerce', label: 'E-Commerce', description: 'Online store and orders' },
  { id: 'finance', label: 'Finance', description: 'Invoices, expenses, budgets' },
  { id: 'forms', label: 'Forms', description: 'Form builder and responses' },
  { id: 'handbook', label: 'Handbook', description: 'Company policy & docs' },
  { id: 'hr', label: 'HR', description: 'Staff, leave, payroll' },
  { id: 'inventory', label: 'Inventory', description: 'Stock and assets' },
  { id: 'kds', label: 'KDS', description: 'Kitchen display system' },
  { id: 'loyalty', label: 'Loyalty', description: 'Loyalty programme' },
  { id: 'mail', label: 'Mail', description: 'Email client (Stalwart)' },
  { id: 'manufacturing', label: 'Manufacturing', description: 'Production orders' },
  { id: 'notes', label: 'Notes', description: 'Personal notes' },
  { id: 'pos', label: 'POS', description: 'Point of sale' },
  { id: 'projects', label: 'Projects', description: 'Tasks, milestones, time tracking' },
  { id: 'supply-chain', label: 'Supply Chain', description: 'Procurement and suppliers' },
  { id: 'support', label: 'Support', description: 'Helpdesk tickets' },
  { id: 'teams', label: 'Teams', description: 'Video meetings (Jitsi)' },
]

export default function UserAppAccessPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.user)

  const [targetUser, setTargetUser] = useState<User | null>(null)
  const [grants, setGrants] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState(false)

  const { data: accessEntries = [], isLoading } = useUserAppAccess(userId ?? '')
  const setAccess = useSetUserAppAccess()

  useEffect(() => {
    if (!userId) return
    apiClient.get<User>(`/users/${userId}`).then(({ data }) => setTargetUser(data)).catch(() => {})
  }, [userId])

  // Initialize grants from DB entries; default to true for unset apps
  useEffect(() => {
    if (accessEntries.length === 0) {
      // No rows yet → all apps accessible by default
      const all: Record<string, boolean> = {}
      SUPPORTED_APPS.forEach((a) => { all[a.id] = true })
      setGrants(all)
    } else {
      const map: Record<string, boolean> = {}
      accessEntries.forEach((e) => { map[e.app_name] = e.granted })
      // Fill unset apps as true
      SUPPORTED_APPS.forEach((a) => { if (!(a.id in map)) map[a.id] = true })
      setGrants(map)
    }
  }, [accessEntries])

  async function handleSave() {
    if (!userId) return
    await setAccess.mutateAsync({ userId, app_grants: grants })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleResetAll() {
    const all: Record<string, boolean> = {}
    SUPPORTED_APPS.forEach((a) => { all[a.id] = true })
    setGrants(all)
  }

  const isSelf = currentUser?.id === userId
  const grantedCount = Object.values(grants).filter(Boolean).length

  return (
    <div className="p-3 sm:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/users')}
          className="p-1.5 rounded-[8px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">App Access</h1>
          {targetUser && (
            <p className="text-gray-500 text-sm mt-0.5">
              {targetUser.full_name} ({targetUser.email}) — {grantedCount} of {SUPPORTED_APPS.length} apps granted
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleResetAll} disabled={setAccess.isPending}>
            Reset All On
          </Button>
          <Button onClick={handleSave} disabled={setAccess.isPending}>
            {setAccess.isPending ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {isSelf && (
        <div className="rounded-[10px] bg-warning/10 border border-warning/20 px-4 py-3 text-sm text-warning font-medium">
          You are editing your own app access. You cannot remove access to the admin panel.
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading access settings…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SUPPORTED_APPS.map((app) => {
            const isGranted = grants[app.id] ?? true
            const isAdminApp = app.id === 'admin'
            const disabled = isSelf && isAdminApp

            return (
              <label
                key={app.id}
                className={`flex items-start gap-3 p-4 rounded-[10px] border cursor-pointer transition-all ${
                  isGranted
                    ? 'border-primary/30 bg-primary/5 dark:bg-primary/10'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 opacity-70'
                } ${disabled ? 'cursor-not-allowed' : 'hover:shadow-sm'}`}
              >
                <div className="mt-0.5">
                  <input
                    type="checkbox"
                    checked={isGranted}
                    disabled={disabled}
                    onChange={(e) => setGrants((g) => ({ ...g, [app.id]: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{app.label}</p>
                    {isGranted ? (
                      <Badge variant="success" className="text-[10px]">On</Badge>
                    ) : (
                      <Badge variant="default" className="text-[10px]">Off</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{app.description}</p>
                </div>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

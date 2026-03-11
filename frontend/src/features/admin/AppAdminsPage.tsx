import { useState } from 'react'
import { Card, Button, Badge } from '../../components/ui'

interface AppAdmin {
  id: string
  module: string
  user_email: string
  user_name: string
  assigned_at: string
}

const STUB_DATA: AppAdmin[] = [
  { id: '1', module: 'Finance', user_email: 'finance@urban.local', user_name: 'Finance Manager', assigned_at: '2024-01-15' },
  { id: '2', module: 'HR', user_email: 'hr@urban.local', user_name: 'HR Manager', assigned_at: '2024-01-15' },
  { id: '3', module: 'CRM', user_email: 'crm@urban.local', user_name: 'Sales Lead', assigned_at: '2024-02-01' },
  { id: '4', module: 'Inventory', user_email: 'inv@urban.local', user_name: 'Warehouse Head', assigned_at: '2024-02-10' },
]

const MODULES = ['Finance', 'HR', 'CRM', 'Projects', 'Inventory', 'Analytics']

const MODULE_ICONS: Record<string, string> = {
  Finance: '💰', HR: '👥', CRM: '🤝', Projects: '📋', Inventory: '📦', Analytics: '📊',
}

export default function AppAdminsPage() {
  const [admins] = useState<AppAdmin[]>(STUB_DATA)

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">App Admins</h1>
          <p className="text-gray-500 text-sm mt-0.5">Assign module-level administrators</p>
        </div>
        <Button>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Assign Admin
        </Button>
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {MODULES.map((mod) => {
          const assigned = admins.filter((a) => a.module === mod)
          return (
            <Card key={mod}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl">
                  {MODULE_ICONS[mod] ?? '📦'}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{mod}</p>
                  <p className="text-xs text-gray-400">{assigned.length} admin{assigned.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="space-y-2">
                {assigned.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No admin assigned</p>
                ) : (
                  assigned.map((a) => (
                    <div key={a.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-[9px] font-bold">
                          {a.user_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">{a.user_name}</span>
                      </div>
                      <button className="text-xs text-danger hover:underline">Remove</button>
                    </div>
                  ))
                )}
                <button className="text-xs text-primary hover:underline mt-1">+ Add</button>
              </div>
            </Card>
          )
        })}
      </div>

      {/* All assignments table */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">All Assignments</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Module</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Admin</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Assigned</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span>{MODULE_ICONS[a.module]}</span>
                    <Badge variant="primary">{a.module}</Badge>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <p className="font-medium text-gray-800 dark:text-gray-200">{a.user_name}</p>
                  <p className="text-xs text-gray-400">{a.user_email}</p>
                </td>
                <td className="py-3 px-4 text-gray-500 text-sm">{a.assigned_at}</td>
                <td className="py-3 px-4 text-right">
                  <button className="text-xs text-danger hover:underline">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

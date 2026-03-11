import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth'

interface ModuleMeta {
  label: string
  icon: string
  color: string
  description: string
}

const MODULE_META: Record<string, ModuleMeta> = {
  finance:       { label: 'Finance',       icon: '💰', color: 'from-emerald-400 to-emerald-600',  description: 'Invoices, accounts & reporting' },
  hr:            { label: 'HR',            icon: '👥', color: 'from-blue-400 to-blue-600',        description: 'People, payroll & attendance' },
  crm:           { label: 'CRM',           icon: '🤝', color: 'from-purple-400 to-purple-600',    description: 'Leads, contacts & deals' },
  projects:      { label: 'Projects',      icon: '📋', color: 'from-orange-400 to-orange-600',    description: 'Tasks & timelines' },
  inventory:     { label: 'Inventory',     icon: '📦', color: 'from-pink-400 to-pink-600',        description: 'Stock, warehouses & orders' },
  analytics:     { label: 'Analytics',     icon: '📊', color: 'from-indigo-400 to-indigo-600',    description: 'Reports & insights' },
  support:       { label: 'Support',       icon: '🎧', color: 'from-amber-400 to-amber-600',     description: 'Tickets & customer center' },
  manufacturing: { label: 'Manufacturing', icon: '🏭', color: 'from-slate-400 to-slate-600',     description: 'BOMs & work orders' },
  'supply-chain':{ label: 'Supply Chain',  icon: '🚛', color: 'from-lime-400 to-lime-600',       description: 'Suppliers & requisitions' },
  pos:           { label: 'POS',           icon: '🖥️', color: 'from-rose-400 to-rose-600',        description: 'Point of sale terminals' },
  mail:          { label: 'Mail',          icon: '✉️',  color: 'from-sky-400 to-sky-600',          description: 'Email & messages' },
  calendar:      { label: 'Calendar',      icon: '📅', color: 'from-rose-400 to-rose-600',        description: 'Schedule & events' },
  docs:          { label: 'Docs',          icon: '📄', color: 'from-teal-400 to-teal-600',        description: 'Documents & files' },
  drive:         { label: 'Drive',         icon: '💾', color: 'from-cyan-400 to-cyan-600',        description: 'File storage' },
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function MyModulesPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const firstName = user?.full_name?.split(' ')[0] ?? 'there'
  const scopes = user?.app_admin_scopes ?? []

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          You have admin access to the following modules. Select one to manage.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {scopes.map((scope) => {
          const meta = MODULE_META[scope] ?? {
            label: scope.charAt(0).toUpperCase() + scope.slice(1),
            icon: '📁',
            color: 'from-gray-400 to-gray-600',
            description: `Manage ${scope}`,
          }

          return (
            <button
              key={scope}
              onClick={() => navigate(`/${scope}`)}
              className="bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-800 p-5 shadow-sm hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-2xl shadow-sm group-hover:scale-105 transition-transform shrink-0`}
                >
                  {meta.icon}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{meta.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{meta.description}</p>
                  <p className="text-[10px] text-primary font-medium mt-2 group-hover:underline">
                    Open Dashboard →
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {scopes.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg font-medium">No modules assigned</p>
          <p className="text-sm mt-1">Contact a Super Admin to get module access.</p>
        </div>
      )}
    </div>
  )
}

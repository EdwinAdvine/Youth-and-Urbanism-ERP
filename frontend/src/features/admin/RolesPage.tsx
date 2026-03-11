import { Card } from '../../components/ui'

const ROLES = [
  {
    name: 'Super Admin',
    key: 'superadmin',
    color: 'bg-red-100 text-red-700',
    desc: 'Full system access. Can manage all users, configuration, and modules.',
    permissions: ['All permissions'],
  },
  {
    name: 'Admin',
    key: 'admin',
    color: 'bg-orange-100 text-orange-700',
    desc: 'Can manage users and most settings, but cannot change system-level configuration.',
    permissions: ['User management', 'Module access', 'Reports', 'Settings'],
  },
  {
    name: 'Manager',
    key: 'manager',
    color: 'bg-blue-100 text-blue-700',
    desc: 'Can manage their assigned modules and team members.',
    permissions: ['Module access', 'Team management', 'Reports'],
  },
  {
    name: 'Staff',
    key: 'staff',
    color: 'bg-primary/10 text-primary',
    desc: 'Standard user access to assigned modules.',
    permissions: ['Module access (read + write)', 'Own profile'],
  },
  {
    name: 'Viewer',
    key: 'viewer',
    color: 'bg-gray-100 text-gray-600',
    desc: 'Read-only access to assigned modules.',
    permissions: ['Module access (read only)', 'Own profile'],
  },
]

const MODULES = ['Finance', 'HR', 'CRM', 'Projects', 'Inventory', 'Analytics']
const ACTIONS = ['View', 'Create', 'Edit', 'Delete']

export default function RolesPage() {
  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
        <p className="text-gray-500 text-sm mt-1">System roles and their access levels</p>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ROLES.map((role) => (
          <Card key={role.key}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${role.color}`}>
                  {role.name}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-3">{role.desc}</p>
            <div className="space-y-1">
              {role.permissions.map((perm) => (
                <div key={perm} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <svg className="h-3.5 w-3.5 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                  {perm}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {/* Permission matrix */}
      <Card>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Permission Matrix</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Module</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Action</th>
                {ROLES.map((r) => (
                  <th key={r.key} className="text-center py-3 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <span className={`px-2 py-0.5 rounded-full ${r.color}`}>{r.name.split(' ')[0]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.flatMap((mod) =>
                ACTIONS.map((action, ai) => (
                  <tr key={`${mod}-${action}`} className={`border-b border-gray-50 ${ai === 0 ? 'bg-gray-50/50' : ''}`}>
                    <td className="py-2 px-4 text-gray-700 font-medium">{ai === 0 ? mod : ''}</td>
                    <td className="py-2 px-4 text-gray-500">{action}</td>
                    {ROLES.map((role) => {
                      const has = role.key === 'superadmin' ||
                        (role.key === 'admin') ||
                        (role.key === 'manager' && action !== 'Delete') ||
                        (role.key === 'staff' && (action === 'View' || action === 'Create' || action === 'Edit')) ||
                        (role.key === 'viewer' && action === 'View')
                      return (
                        <td key={role.key} className="py-2 px-3 text-center">
                          {has ? (
                            <svg className="h-4 w-4 text-success mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4 text-gray-200 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

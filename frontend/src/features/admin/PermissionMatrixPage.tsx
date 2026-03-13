import { Badge } from '../../components/ui'
import { useRoles, useAllPermissions, useAssignPermission, useRemovePermission } from '../../api/admin'
import { useQueries } from '@tanstack/react-query'
import apiClient from '../../api/client'
import type { Permission } from '../../types'

// Group permissions by app_scope
function groupPerms(perms: Permission[]): Record<string, Permission[]> {
  const groups: Record<string, Permission[]> = {}
  for (const p of perms) {
    const scope = p.app_scope ?? 'other'
    if (!groups[scope]) groups[scope] = []
    groups[scope].push(p)
  }
  return groups
}

export default function PermissionMatrixPage() {
  const { data: roles = [], isLoading: rolesLoading } = useRoles()
  const { data: allPerms = [], isLoading: permsLoading } = useAllPermissions()
  const assignPerm = useAssignPermission()
  const removePerm = useRemovePermission()

  // Fetch permissions for all roles in parallel
  const rolePermQueries = useQueries({
    queries: roles.map((role) => ({
      queryKey: ['roles', role.id, 'permissions'],
      queryFn: async () => {
        const { data } = await apiClient.get<Permission[]>(`/roles/${role.id}/permissions`)
        return { roleId: role.id, perms: data }
      },
      enabled: roles.length > 0,
    })),
  })

  // Build a map: roleId → Set<permId>
  const rolePermMap = new Map<string, Set<string>>()
  for (const q of rolePermQueries) {
    if (q.data) {
      rolePermMap.set(q.data.roleId, new Set(q.data.perms.map((p) => p.id)))
    }
  }

  const grouped = groupPerms(allPerms)
  const sortedScopes = Object.keys(grouped).sort()
  const isLoading = rolesLoading || permsLoading

  async function handleToggle(roleId: string, permId: string, isSystem: boolean, checked: boolean) {
    if (isSystem) return
    if (checked) {
      await assignPerm.mutateAsync({ roleId, permId })
    } else {
      await removePerm.mutateAsync({ roleId, permId })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading permission matrix…
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-6 max-w-full">
      <div className="mb-4 sm:mb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Permission Matrix</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {allPerms.length} permissions × {roles.length} roles — click cells to toggle (system roles are read-only)
        </p>
      </div>

      <div className="overflow-auto rounded-[10px] border border-gray-200 dark:border-gray-700 shadow-sm">
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="text-left py-3 px-4 font-semibold text-gray-600 dark:text-gray-300 min-w-[180px]">Permission</th>
              {roles.map((role) => (
                <th key={role.id} className="py-3 px-3 font-semibold text-gray-600 dark:text-gray-300 text-center whitespace-nowrap">
                  <div className="flex flex-col items-center gap-1">
                    <span>{role.name}</span>
                    {role.is_system && (
                      <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sortedScopes.map((scope) => (
              <>
                {/* Module section header */}
                <tr key={`scope-${scope}`} className="bg-gray-50/80 dark:bg-gray-800/50">
                  <td colSpan={roles.length + 1} className="py-2 px-4">
                    <Badge variant="primary" className="text-[10px] capitalize">{scope.replace('-', ' ')}</Badge>
                  </td>
                </tr>
                {grouped[scope].map((perm) => (
                  <tr key={perm.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                    <td className="py-2 px-4 font-mono text-gray-600 dark:text-gray-300 text-[11px]">
                      {perm.name}
                    </td>
                    {roles.map((role) => {
                      const rolePerms = rolePermMap.get(role.id)
                      const hasIt = rolePerms?.has(perm.id) ?? false
                      const isPending = assignPerm.isPending || removePerm.isPending
                      return (
                        <td key={role.id} className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={hasIt}
                            disabled={role.is_system || isPending}
                            onChange={(e) => handleToggle(role.id, perm.id, role.is_system, e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                            title={role.is_system ? `${role.name} (system role — read-only)` : `Toggle ${perm.name} for ${role.name}`}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Card, Button, Badge } from '../../components/ui'
import {
  useRoles,
  useAllPermissions,
  useRolePermissions,
  useCreateRole,
  useDeleteRole,
  useBulkAssignPermissions,
} from '../../api/admin'
import type { Permission } from '../../types'

// Group permissions by app_scope for display
function groupPermissions(perms: Permission[]): Record<string, Permission[]> {
  const groups: Record<string, Permission[]> = {}
  for (const p of perms) {
    const scope = p.app_scope ?? 'other'
    if (!groups[scope]) groups[scope] = []
    groups[scope].push(p)
  }
  return groups
}

const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export']

interface CreateRoleDialog {
  open: boolean
  name: string
  description: string
  app_scope: string
}

export default function RolesPage() {
  const { data: roles = [], isLoading: rolesLoading } = useRoles()
  const { data: allPerms = [] } = useAllPermissions()

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [createDialog, setCreateDialog] = useState<CreateRoleDialog>({
    open: false, name: '', description: '', app_scope: '',
  })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data: rolePerms = [] } = useRolePermissions(selectedRoleId)
  const createRole = useCreateRole()
  const deleteRole = useDeleteRole()
  const bulkAssign = useBulkAssignPermissions()

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null
  const rolePermIds = new Set(rolePerms.map((p) => p.id))
  const grouped = groupPermissions(allPerms)
  const sortedScopes = Object.keys(grouped).sort()

  async function handleTogglePermission(permId: string, checked: boolean) {
    if (!selectedRoleId || !selectedRole || selectedRole.is_system) return
    const newIds = checked
      ? [...rolePermIds, permId]
      : [...rolePermIds].filter((id) => id !== permId)
    await bulkAssign.mutateAsync({ roleId: selectedRoleId, permission_ids: newIds, replace: true })
  }

  async function handleCreateRole() {
    if (!createDialog.name.trim()) return
    await createRole.mutateAsync({
      name: createDialog.name.trim(),
      description: createDialog.description || undefined,
      app_scope: createDialog.app_scope || undefined,
    })
    setCreateDialog({ open: false, name: '', description: '', app_scope: '' })
  }

  async function handleDeleteRole(roleId: string) {
    await deleteRole.mutateAsync(roleId)
    if (selectedRoleId === roleId) setSelectedRoleId(null)
    setDeleteConfirm(null)
  }

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Roles & Permissions</h1>
          <p className="text-gray-500 text-sm mt-0.5">Create custom roles and configure their granular permissions</p>
        </div>
        <Button onClick={() => setCreateDialog({ open: true, name: '', description: '', app_scope: '' })} className="w-full sm:w-auto">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Role
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-5">
        {/* Left: Role list */}
        <div className="w-full md:w-72 shrink-0 space-y-2">
          {rolesLoading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Loading roles…</div>
          ) : (
            roles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRoleId(role.id)}
                className={`w-full text-left p-3.5 rounded-[10px] border transition-all ${
                  selectedRoleId === role.id
                    ? 'border-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{role.name}</span>
                  <div className="flex items-center gap-1">
                    {role.is_system && (
                      <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )}
                    {!role.is_system && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(role.id) }}
                        className="text-gray-300 hover:text-danger transition-colors"
                        title="Delete role"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                {role.description && (
                  <p className="text-xs text-gray-400 line-clamp-2">{role.description}</p>
                )}
                {role.app_scope && (
                  <Badge variant="primary" className="mt-1.5 text-[10px]">{role.app_scope}</Badge>
                )}
              </button>
            ))
          )}
        </div>

        {/* Right: Permission editor */}
        <div className="flex-1">
          {!selectedRole ? (
            <Card className="h-64 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <svg className="h-10 w-10 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <p className="text-sm font-medium">Select a role to view and edit permissions</p>
              </div>
            </Card>
          ) : (
            <Card padding={false}>
              <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-gray-100">{selectedRole.name}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedRole.is_system ? 'System role — permissions cannot be modified' : `${rolePerms.length} permissions assigned`}
                  </p>
                </div>
                {selectedRole.is_system && (
                  <Badge variant="default">System</Badge>
                )}
              </div>

              <div className="overflow-auto max-h-[calc(100vh-280px)]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/80 z-10">
                    <tr>
                      <th className="text-left py-2.5 px-4 font-semibold text-gray-500 uppercase tracking-wide w-36">Module</th>
                      {ACTIONS.map((a) => (
                        <th key={a} className="py-2.5 px-2 font-semibold text-gray-500 uppercase tracking-wide text-center capitalize">
                          {a}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedScopes.map((scope) => (
                      <tr key={scope} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="py-2 px-4 font-semibold text-gray-700 dark:text-gray-300 capitalize">
                          {scope.replace('-', ' ')}
                        </td>
                        {ACTIONS.map((action) => {
                          const perm = grouped[scope]?.find((p) => p.name.endsWith(`:${action}`))
                          if (!perm) {
                            return <td key={action} className="py-2 px-2 text-center text-gray-200 dark:text-gray-700">—</td>
                          }
                          const checked = rolePermIds.has(perm.id)
                          return (
                            <td key={action} className="py-2 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={selectedRole.is_system || bulkAssign.isPending}
                                onChange={(e) => handleTogglePermission(perm.id, e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                                title={perm.name}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Create role dialog */}
      {createDialog.open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setCreateDialog({ open: false, name: '', description: '', app_scope: '' })} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-[10px] shadow-2xl w-full max-w-md p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Create Role</h2>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Name *</label>
                <input
                  value={createDialog.name}
                  onChange={(e) => setCreateDialog((d) => ({ ...d, name: e.target.value }))}
                  placeholder="e.g., finance_viewer"
                  className="w-full rounded-[8px] border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Description</label>
                <input
                  value={createDialog.description}
                  onChange={(e) => setCreateDialog((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Short description"
                  className="w-full rounded-[8px] border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">App Scope (optional)</label>
                <input
                  value={createDialog.app_scope}
                  onChange={(e) => setCreateDialog((d) => ({ ...d, app_scope: e.target.value }))}
                  placeholder="e.g., finance"
                  className="w-full rounded-[8px] border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={handleCreateRole} disabled={!createDialog.name.trim() || createRole.isPending} className="flex-1">
                  {createRole.isPending ? 'Creating…' : 'Create Role'}
                </Button>
                <Button variant="outline" onClick={() => setCreateDialog({ open: false, name: '', description: '', app_scope: '' })} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete confirm dialog */}
      {deleteConfirm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setDeleteConfirm(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-[10px] shadow-2xl w-full max-w-sm p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Delete Role</h2>
              <p className="text-sm text-gray-500">This will permanently delete the role and remove it from all assigned users. This action cannot be undone.</p>
              <div className="flex gap-3 pt-2">
                <Button onClick={() => handleDeleteRole(deleteConfirm)} disabled={deleteRole.isPending} variant="danger" className="flex-1">
                  {deleteRole.isPending ? 'Deleting…' : 'Delete Role'}
                </Button>
                <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="flex-1">
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

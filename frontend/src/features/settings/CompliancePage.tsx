import { useState } from 'react'
import { Button, Card, Spinner, toast } from '../../components/ui'
import { useAuthStore } from '../../store/auth'
import {
  useRequestDataExport,
  useDeleteAccount,
  useRetentionPolicies,
} from '../../api/compliance'

export default function CompliancePage() {
  const user = useAuthStore((s) => s.user)
  const isSuperAdmin = user?.role === 'superadmin'
  const exportData = useRequestDataExport()
  const deleteAccount = useDeleteAccount()
  const { data: policies, isLoading: policiesLoading } = useRetentionPolicies()

  const [showDelete, setShowDelete] = useState(false)
  const [exportedJson, setExportedJson] = useState<string | null>(null)

  const handleExport = async () => {
    try {
      const result = await exportData.mutateAsync()
      const json = JSON.stringify(result, null, 2)
      setExportedJson(json)
      // Also trigger download
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `data-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast('success', 'Data exported successfully')
    } catch {
      toast('error', 'Failed to export data')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteAccount.mutateAsync()
      toast('success', 'Account deletion scheduled. You will be logged out.')
      setShowDelete(false)
      setTimeout(() => {
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }, 2000)
    } catch {
      toast('error', 'Failed to request account deletion')
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Privacy & Compliance</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your personal data and privacy rights (GDPR)</p>
      </div>

      {/* Data Export */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Export Your Data</h2>
        <p className="text-sm text-gray-500 mb-4">
          Download a copy of all personal data we hold about you, including your profile and audit history.
        </p>
        <Button onClick={handleExport} loading={exportData.isPending}>
          Download My Data
        </Button>
        {exportedJson && (
          <div className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Export complete — file downloaded. Contains {Math.round(exportedJson.length / 1024)} KB of data.
            </p>
          </div>
        )}
      </section>

      {/* Account Deletion */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Delete Account</h2>
        <p className="text-sm text-gray-500 mb-4">
          Request permanent deletion of your account and all associated data. This action cannot be undone.
          Your account will be deactivated immediately and data purged within 30 days.
        </p>
        {isSuperAdmin ? (
          <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
            Super Admin accounts cannot be self-deleted. Contact another admin to transfer ownership first.
          </p>
        ) : !showDelete ? (
          <Button variant="danger" onClick={() => setShowDelete(true)}>
            Request Account Deletion
          </Button>
        ) : (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              Are you sure? This will permanently delete your account and all data.
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                variant="danger"
                size="sm"
                loading={deleteAccount.isPending}
                onClick={handleDelete}
              >
                Yes, Delete My Account
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowDelete(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Data Retention Policies (Admin only) */}
      {isSuperAdmin && (
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Data Retention Policies</h2>
          <p className="text-sm text-gray-500 mb-4">
            How long different types of data are retained before automatic purging.
          </p>
          {policiesLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : policies && policies.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 font-medium text-gray-500">Data Type</th>
                  <th className="text-left py-2 font-medium text-gray-500">Retention</th>
                  <th className="text-left py-2 font-medium text-gray-500">Description</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.table} className="border-b border-gray-50 dark:border-gray-800">
                    <td className="py-2.5 text-gray-900 dark:text-gray-100 font-medium">{p.table}</td>
                    <td className="py-2.5 text-gray-600 dark:text-gray-400">{p.retention_days} days</td>
                    <td className="py-2.5 text-gray-500">{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-500">No retention policies configured.</p>
          )}
        </section>
      )}
    </div>
  )
}

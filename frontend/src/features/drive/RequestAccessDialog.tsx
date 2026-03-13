/**
 * RequestAccessDialog — modal for requesting access to a file the user can
 * see in Drive but cannot download due to module RBAC restrictions.
 */
import { useState } from 'react'
import { useRequestFileAccess } from '@/api/drive'

interface RequestAccessDialogProps {
  fileId: string
  fileName: string
  open: boolean
  onClose: () => void
}

export default function RequestAccessDialog({ fileId, fileName, open, onClose }: RequestAccessDialogProps) {
  const [reason, setReason] = useState('')
  const [permission, setPermission] = useState<'view' | 'edit'>('view')
  const requestAccess = useRequestFileAccess()

  if (!open) return null

  const handleSubmit = () => {
    requestAccess.mutate(
      { fileId, reason: reason || undefined, permission },
      {
        onSuccess: () => {
          setReason('')
          onClose()
        },
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg" style={{ borderRadius: 10 }}>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Request Access</h3>
        <p className="text-sm text-gray-500 mb-4">
          You don't have permission to access <span className="font-medium text-gray-700">{fileName}</span>.
          Send a request to the file owner.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Permission Level</label>
          <select
            value={permission}
            onChange={(e) => setPermission(e.target.value as 'view' | 'edit')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#51459d] focus:outline-none focus:ring-1 focus:ring-[#51459d]"
          >
            <option value="view">View only</option>
            <option value="edit">View &amp; Edit</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why do you need access to this file?"
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#51459d] focus:outline-none focus:ring-1 focus:ring-[#51459d] resize-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={requestAccess.isPending}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: '#51459d', borderRadius: 10 }}
          >
            {requestAccess.isPending ? 'Sending...' : 'Send Request'}
          </button>
        </div>

        {requestAccess.isError && (
          <p className="mt-2 text-sm text-red-600">
            {(requestAccess.error as any)?.response?.data?.detail || 'Failed to send request'}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * AccountSettings — manage email accounts (display name, defaults, removal).
 */
import { useState } from 'react'
import {
  useMailAccounts,
  useUpdateMailAccount,
  useRemoveMailAccount,
  useTestMailAccount,
  useSyncMailAccount,
  type MailAccount,
} from '@/api/mailAccounts'

interface AccountSettingsProps {
  onClose: () => void
}

export default function AccountSettings({ onClose }: AccountSettingsProps) {
  const { data: accounts = [] } = useMailAccounts()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-[10px] shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Manage Accounts</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700
              flex items-center justify-center transition"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Account list */}
        <div className="p-6 space-y-4">
          {accounts.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              No email accounts configured.
            </p>
          )}
          {accounts.map((acct) => (
            <AccountCard key={acct.id} account={acct} />
          ))}
        </div>
      </div>
    </div>
  )
}

function AccountCard({ account }: { account: MailAccount }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(account.display_name)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const updateMut = useUpdateMailAccount()
  const removeMut = useRemoveMailAccount()
  const testMut = useTestMailAccount()
  const syncMut = useSyncMailAccount()

  const handleSaveName = async () => {
    if (name.trim() && name !== account.display_name) {
      await updateMut.mutateAsync({ id: account.id, payload: { display_name: name.trim() } })
    }
    setEditing(false)
  }

  const handleSetDefault = () => {
    if (!account.is_default) {
      updateMut.mutate({ id: account.id, payload: { is_default: true } })
    }
  }

  const handleToggleSync = () => {
    updateMut.mutate({ id: account.id, payload: { sync_enabled: !account.sync_enabled } })
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-[10px] p-4">
      {/* Email + avatar */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#51459d] flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-white">
            {account.display_name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none
                  focus:ring-1 focus:ring-[#51459d]"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                autoFocus
              />
              <button onClick={handleSaveName} className="text-xs text-[#51459d] font-medium">
                Save
              </button>
            </div>
          ) : (
            <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
              {account.display_name}
              <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-[#51459d]">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">{account.email}</p>
        </div>
        {account.is_default && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-[#51459d]/10 text-[#51459d] font-medium">
            Default
          </span>
        )}
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2 flex-wrap">
        {!account.is_default && (
          <button
            onClick={handleSetDefault}
            disabled={updateMut.isPending}
            className="px-3 py-1.5 text-xs rounded-[10px] border border-gray-200 dark:border-gray-600
              hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition"
          >
            Set as Default
          </button>
        )}

        <button
          onClick={handleToggleSync}
          disabled={updateMut.isPending}
          className={`px-3 py-1.5 text-xs rounded-[10px] border transition
            ${account.sync_enabled
              ? 'border-[#6fd943]/30 bg-[#6fd943]/10 text-[#6fd943]'
              : 'border-gray-200 dark:border-gray-600 text-gray-500'
            }`}
        >
          Sync {account.sync_enabled ? 'On' : 'Off'}
        </button>

        <button
          onClick={() => testMut.mutate(account.id)}
          disabled={testMut.isPending}
          className="px-3 py-1.5 text-xs rounded-[10px] border border-gray-200 dark:border-gray-600
            hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition"
        >
          {testMut.isPending ? 'Testing...' : 'Test Connection'}
        </button>

        <button
          onClick={() => syncMut.mutate(account.id)}
          disabled={syncMut.isPending}
          className="px-3 py-1.5 text-xs rounded-[10px] border border-[#3ec9d6]/30
            bg-[#3ec9d6]/10 text-[#3ec9d6] hover:bg-[#3ec9d6]/20 transition"
        >
          {syncMut.isPending ? 'Syncing...' : 'Sync Now'}
        </button>

        <button
          onClick={() => setConfirmRemove(true)}
          className="px-3 py-1.5 text-xs rounded-[10px] border border-[#ff3a6e]/30
            text-[#ff3a6e] hover:bg-[#ff3a6e]/10 transition ml-auto"
        >
          Remove
        </button>
      </div>

      {/* Test result */}
      {testMut.isSuccess && (
        <p className={`mt-2 text-xs ${testMut.data?.imap_ok ? 'text-[#6fd943]' : 'text-[#ff3a6e]'}`}>
          {testMut.data?.message}
        </p>
      )}

      {/* Sync result */}
      {syncMut.isSuccess && (
        <p className="mt-2 text-xs text-[#3ec9d6]">
          Synced {syncMut.data?.synced} new messages
        </p>
      )}

      {/* Last sync */}
      {account.last_sync_at && (
        <p className="mt-2 text-xs text-gray-400">
          Last synced: {new Date(account.last_sync_at).toLocaleString()}
        </p>
      )}

      {/* Remove confirmation */}
      {confirmRemove && (
        <div className="mt-3 p-3 rounded-[10px] bg-red-50 dark:bg-red-900/20 border border-[#ff3a6e]/30">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
            Remove <strong>{account.email}</strong>? All synced messages will be deleted.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => removeMut.mutate(account.id)}
              disabled={removeMut.isPending}
              className="px-3 py-1.5 text-xs rounded-[10px] bg-[#ff3a6e] text-white hover:bg-[#e0325f] transition"
            >
              {removeMut.isPending ? 'Removing...' : 'Yes, Remove'}
            </button>
            <button
              onClick={() => setConfirmRemove(false)}
              className="px-3 py-1.5 text-xs rounded-[10px] border border-gray-200 dark:border-gray-600
                text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { Card, Button, Input, Spinner } from '../../components/ui'
import { useVaultStatus, useUnlockVault, useLockVault } from '../../api/drive_phase2'

export default function DriveVaultPanel() {
  const [password, setPassword] = useState('')
  const { data: vault, isLoading } = useVaultStatus()
  const unlock = useUnlockVault()
  const lock = useLockVault()

  const handleUnlock = async () => {
    if (!password) return
    try {
      await unlock.mutateAsync(password)
      setPassword('')
    } catch {
      alert('Incorrect password.')
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Personal Vault</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          A secure, re-authenticated folder that auto-locks after {vault?.lock_timeout_minutes ?? 20} minutes of inactivity.
        </p>
      </div>

      <Card>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-[12px] flex items-center justify-center text-3xl ${vault?.is_locked ? 'bg-gray-100 dark:bg-gray-900' : 'bg-green-50 dark:bg-green-900/20'}`}>
            {vault?.is_locked ? '🔒' : '🔓'}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800 dark:text-gray-200">
              {vault?.is_locked ? 'Vault is locked' : 'Vault is unlocked'}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {vault?.is_locked
                ? 'Enter your account password to access vault files.'
                : `Auto-locks after ${vault?.lock_timeout_minutes} min inactivity.`}
            </p>
            {vault?.last_accessed && (
              <p className="text-[11px] text-gray-400 mt-1">
                Last accessed: {new Date(vault.last_accessed).toLocaleString()}
              </p>
            )}
          </div>
          {!vault?.is_locked && (
            <Button size="sm" variant="outline" onClick={() => lock.mutate()} loading={lock.isPending}>
              Lock Now
            </Button>
          )}
        </div>
      </Card>

      {vault?.is_locked && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Unlock Vault</h3>
          <div className="space-y-3">
            <Input
              type="password"
              label="Account Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              placeholder="Enter your login password"
            />
            <Button onClick={handleUnlock} loading={unlock.isPending} className="w-full">
              Unlock Vault
            </Button>
          </div>
        </Card>
      )}

      {!vault?.is_locked && vault?.vault_folder_id && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Vault Folder</p>
              <p className="text-xs text-gray-500 mt-0.5">Files in this folder are protected by the vault</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // Navigate to vault folder — handled by parent DrivePage
                window.dispatchEvent(new CustomEvent('drive:open-folder', { detail: { folderId: vault.vault_folder_id } }))
              }}
            >
              Open Folder
            </Button>
          </div>
        </Card>
      )}

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-[10px] p-4">
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">How it works</p>
        <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-1 list-disc list-inside">
          <li>Vault requires re-authentication with your password</li>
          <li>Auto-locks after {vault?.lock_timeout_minutes ?? 20} minutes of inactivity</li>
          <li>Files inside are only accessible while unlocked</li>
          <li>Vault folder is excluded from search results when locked</li>
        </ul>
      </div>
    </div>
  )
}

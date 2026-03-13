/**
 * AccountSwitcher — renders in the mail sidebar above the folder list.
 *
 * Shows the current account (or "All Accounts" for unified view), a dropdown
 * to switch between accounts, and an "Add another account" button.
 */
import { useState } from 'react'
import { useMailAccounts, type MailAccount } from '@/api/mailAccounts'
import { useMailAccountsStore } from '@/store/mailAccounts'
import MailLoginScreen from './MailLoginScreen'
import AccountSettings from './AccountSettings'

export default function AccountSwitcher() {
  const [open, setOpen] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const { data: accounts = [] } = useMailAccounts()
  const { activeAccountId, setActiveAccount } = useMailAccountsStore()

  const activeAccount = accounts.find((a) => a.id === activeAccountId)
  const label = activeAccount ? activeAccount.email : 'All Accounts'
  const initials = activeAccount
    ? activeAccount.display_name.charAt(0).toUpperCase()
    : null

  return (
    <>
      <div className="relative mb-3">
        {/* Trigger */}
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px]
            bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700
            border border-gray-200 dark:border-gray-700 transition text-left"
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-[#51459d] flex items-center justify-center flex-shrink-0">
            {initials ? (
              <span className="text-sm font-semibold text-white">{initials}</span>
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{label}</p>
            {activeAccount && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {activeAccount.display_name}
              </p>
            )}
            {!activeAccount && accounts.length > 1 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {accounts.length} accounts
              </p>
            )}
          </div>

          {/* Chevron */}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute left-0 right-0 mt-1 z-20 bg-white dark:bg-gray-800
            rounded-[10px] shadow-lg border border-gray-200 dark:border-gray-700 py-1 max-h-72 overflow-y-auto">

            {/* All Accounts option */}
            {accounts.length > 1 && (
              <button
                onClick={() => { setActiveAccount(null); setOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition
                  ${!activeAccountId ? 'bg-[#51459d]/10' : ''}`}
              >
                <div className="w-7 h-7 rounded-full bg-[#3ec9d6] flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">All Accounts</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Unified inbox</p>
                </div>
                {!activeAccountId && (
                  <svg className="w-4 h-4 text-[#51459d]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            )}

            {accounts.length > 1 && (
              <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
            )}

            {/* Individual accounts */}
            {accounts.map((acct) => (
              <button
                key={acct.id}
                onClick={() => { setActiveAccount(acct.id); setOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition
                  ${activeAccountId === acct.id ? 'bg-[#51459d]/10' : ''}`}
              >
                <div className="w-7 h-7 rounded-full bg-[#51459d] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-white">
                    {acct.display_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">{acct.email}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {acct.display_name}
                    {acct.is_default && ' (Default)'}
                  </p>
                </div>
                {activeAccountId === acct.id && (
                  <svg className="w-4 h-4 text-[#51459d]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}

            <div className="border-t border-gray-100 dark:border-gray-700 my-1" />

            {/* Add another account */}
            <button
              onClick={() => { setShowAddDialog(true); setOpen(false) }}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600
                flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <p className="text-sm text-[#51459d] font-medium">Add another account</p>
            </button>

            {/* Manage accounts */}
            <button
              onClick={() => { setShowSettings(true); setOpen(false) }}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Manage accounts</p>
            </button>
          </div>
        )}
      </div>

      {/* Add Account Dialog */}
      {showAddDialog && (
        <MailLoginScreen asDialog onClose={() => setShowAddDialog(false)} />
      )}

      {/* Account Settings Dialog */}
      {showSettings && (
        <AccountSettings onClose={() => setShowSettings(false)} />
      )}
    </>
  )
}

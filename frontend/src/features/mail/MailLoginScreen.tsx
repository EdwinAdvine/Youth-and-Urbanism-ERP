/**
 * MailLoginScreen — shown when the user has no email accounts configured.
 *
 * Provides a clean login form restricted to @youthandurbanism.org emails.
 * On success, the account is created and the mail app loads.
 */
import { useState } from 'react'
import { useAddMailAccount } from '@/api/mailAccounts'
import { useMailAccountsStore } from '@/store/mailAccounts'

const ALLOWED_DOMAIN = 'youthandurbanism.org'

interface MailLoginScreenProps {
  /** When true, renders as a dialog overlay instead of full-page */
  asDialog?: boolean
  onClose?: () => void
}

export default function MailLoginScreen({ asDialog, onClose }: MailLoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')

  const addAccount = useAddMailAccount()
  const setHasLoggedIn = useMailAccountsStore((s) => s.setHasLoggedIn)

  const domainValid = email.includes('@')
    ? email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)
    : true // Don't show error until @ is typed

  const canSubmit = email.includes('@') && domainValid && password.length > 0 && displayName.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
      setError(`Only @${ALLOWED_DOMAIN} institutional emails are allowed.`)
      return
    }

    try {
      await addAccount.mutateAsync({ email, password, display_name: displayName })
      setHasLoggedIn(true)
      onClose?.()
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'Failed to add account'
      setError(detail)
    }
  }

  const content = (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-[10px] shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#51459d] flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {asDialog ? 'Add Another Account' : 'Sign in to your email'}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Use your @{ALLOWED_DOMAIN} institutional email
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Name"
              className="w-full px-4 py-2.5 rounded-[10px] border border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                focus:ring-2 focus:ring-[#51459d] focus:border-transparent outline-none transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError('') }}
              placeholder={`name@${ALLOWED_DOMAIN}`}
              className={`w-full px-4 py-2.5 rounded-[10px] border
                ${email.includes('@') && !domainValid
                  ? 'border-[#ff3a6e] focus:ring-[#ff3a6e]'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-[#51459d]'
                }
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                focus:ring-2 focus:border-transparent outline-none transition`}
              required
            />
            {email.includes('@') && !domainValid && (
              <p className="mt-1 text-sm text-[#ff3a6e]">
                Only @{ALLOWED_DOMAIN} institutional emails are allowed.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              placeholder="Your email password"
              className="w-full px-4 py-2.5 rounded-[10px] border border-gray-300 dark:border-gray-600
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                focus:ring-2 focus:ring-[#51459d] focus:border-transparent outline-none transition"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-[10px] bg-red-50 dark:bg-red-900/20 border border-[#ff3a6e]/30">
              <p className="text-sm text-[#ff3a6e]">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || addAccount.isPending}
            className="w-full py-2.5 rounded-[10px] bg-[#51459d] text-white font-medium
              hover:bg-[#41367d] disabled:opacity-50 disabled:cursor-not-allowed
              transition flex items-center justify-center gap-2"
          >
            {addAccount.isPending ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Connecting...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          Your credentials are encrypted and stored securely.
        </p>
      </div>
    </div>
  )

  if (asDialog) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="relative">
          <button
            onClick={onClose}
            className="absolute -top-2 -right-2 z-10 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700
              flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      {content}
    </div>
  )
}

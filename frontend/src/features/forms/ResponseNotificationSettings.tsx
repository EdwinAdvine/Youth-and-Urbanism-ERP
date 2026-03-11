import { useState } from 'react'

export interface NotificationConfig {
  emailOnSubmit: boolean
  notifyEmails: string[]
  includeAnswers: boolean
  sendConfirmationToRespondent: boolean
  respondentEmailFieldId: string
  confirmationSubject: string
  confirmationMessage: string
}

const DEFAULT_CONFIG: NotificationConfig = {
  emailOnSubmit: false,
  notifyEmails: [],
  includeAnswers: true,
  sendConfirmationToRespondent: false,
  respondentEmailFieldId: '',
  confirmationSubject: 'Thank you for your submission',
  confirmationMessage: 'Your response has been recorded. Thank you!',
}

interface Props {
  config?: NotificationConfig
  onChange: (config: NotificationConfig) => void
  emailFieldIds?: { id: string; label: string }[]
}

export default function ResponseNotificationSettings({ config, onChange, emailFieldIds = [] }: Props) {
  const [cfg, setCfg] = useState<NotificationConfig>(config ?? DEFAULT_CONFIG)
  const [emailInput, setEmailInput] = useState('')

  const update = (partial: Partial<NotificationConfig>) => {
    const updated = { ...cfg, ...partial }
    setCfg(updated)
    onChange(updated)
  }

  const addEmail = () => {
    const email = emailInput.trim()
    if (!email || cfg.notifyEmails.includes(email)) return
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    update({ notifyEmails: [...cfg.notifyEmails, email] })
    setEmailInput('')
  }

  const removeEmail = (email: string) => {
    update({ notifyEmails: cfg.notifyEmails.filter((e) => e !== email) })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Response Notifications</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Get notified when someone submits a response
        </p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-950 rounded-[10px] border border-gray-200 dark:border-gray-700 p-4 space-y-4">
        {/* Admin notification toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Email me on new response</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              Receive an email when someone submits the form
            </p>
          </div>
          <button
            onClick={() => update({ emailOnSubmit: !cfg.emailOnSubmit })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ cfg.emailOnSubmit ? 'bg-[#6fd943]' : 'bg-gray-200' }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-800 transition-transform ${ cfg.emailOnSubmit ? 'translate-x-6' : 'translate-x-1' }`}
            />
          </button>
        </div>

        {/* Notification emails */}
        {cfg.emailOnSubmit && (
          <div className="space-y-2 pl-1 border-l-2 border-[#51459d]/20 ml-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Notify these emails</label>
            <div className="flex gap-2">
              <input
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                placeholder="admin@example.com"
                className="flex-1 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d]"
              />
              <button
                onClick={addEmail}
                className="text-xs bg-[#51459d] text-white px-3 py-1.5 rounded-[8px] hover:bg-[#3d3480] transition-colors"
              >
                Add
              </button>
            </div>
            {cfg.notifyEmails.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {cfg.notifyEmails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 bg-[#51459d]/10 text-[#51459d] text-[10px] px-2 py-0.5 rounded-full"
                  >
                    {email}
                    <button onClick={() => removeEmail(email)} className="hover:text-[#3d3480]">
                      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={cfg.includeAnswers}
                onChange={(e) => update({ includeAnswers: e.target.checked })}
                className="rounded border-gray-300 text-[#51459d] focus:ring-[#51459d]/30"
              />
              Include response answers in notification email
            </label>
          </div>
        )}

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          {/* Respondent confirmation */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Send confirmation to respondent</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Automatically email a confirmation to the person who submitted
              </p>
            </div>
            <button
              onClick={() => update({ sendConfirmationToRespondent: !cfg.sendConfirmationToRespondent })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ cfg.sendConfirmationToRespondent ? 'bg-[#6fd943]' : 'bg-gray-200' }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-gray-800 transition-transform ${ cfg.sendConfirmationToRespondent ? 'translate-x-6' : 'translate-x-1' }`}
              />
            </button>
          </div>

          {cfg.sendConfirmationToRespondent && (
            <div className="mt-3 space-y-3 pl-1 border-l-2 border-[#51459d]/20 ml-1">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email field
                </label>
                <select
                  value={cfg.respondentEmailFieldId}
                  onChange={(e) => update({ respondentEmailFieldId: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] bg-white dark:bg-gray-800 focus:outline-none focus:border-[#51459d]"
                >
                  <option value="">Select email field...</option>
                  {emailFieldIds.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
                {emailFieldIds.length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    Add an email field to the form first
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subject line
                </label>
                <input
                  value={cfg.confirmationSubject}
                  onChange={(e) => update({ confirmationSubject: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirmation message
                </label>
                <textarea
                  value={cfg.confirmationMessage}
                  onChange={(e) => update({ confirmationMessage: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:border-[#51459d] resize-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

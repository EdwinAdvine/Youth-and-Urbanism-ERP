/**
 * Quick Steps Bar — one-click action sequences displayed above the message list.
 * Each quick step executes multiple actions (move, label, flag, etc.) in one click.
 */
import { useQuickSteps, useExecuteQuickStep } from '../../api/mail'
import type { MailQuickStep } from '../../api/mail'

interface QuickStepsBarProps {
  selectedMessageId?: string
}

const STEP_ICONS: Record<string, string> = {
  zap: 'M13 10V3L4 14h7v7l9-11h-7z',
  archive: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  star: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  flag: 'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9',
  tag: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
}

export default function QuickStepsBar({ selectedMessageId }: QuickStepsBarProps) {
  const { data: quickSteps, isLoading } = useQuickSteps()
  const executeStep = useExecuteQuickStep()

  if (isLoading || !quickSteps || quickSteps.length === 0) return null

  const handleExecute = (step: MailQuickStep) => {
    if (!selectedMessageId) return
    executeStep.mutate({ stepId: step.id, messageId: selectedMessageId })
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 overflow-x-auto">
      <span className="text-[10px] font-semibold text-gray-400 uppercase whitespace-nowrap mr-1">
        Quick Steps
      </span>
      {quickSteps.map((step) => {
        const iconPath = STEP_ICONS[step.icon || 'zap'] || STEP_ICONS.zap
        return (
          <button
            key={step.id}
            onClick={() => handleExecute(step)}
            disabled={!selectedMessageId || executeStep.isPending}
            title={`${step.name}${step.keyboard_shortcut ? ` (${step.keyboard_shortcut})` : ''}`}
            className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border border-gray-200 dark:border-gray-600 hover:border-[#51459d] hover:text-[#51459d] text-gray-600 dark:text-gray-400 transition whitespace-nowrap disabled:opacity-40"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
            </svg>
            {step.name}
          </button>
        )
      })}
    </div>
  )
}

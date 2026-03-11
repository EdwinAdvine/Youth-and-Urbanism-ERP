import { useRef } from 'react'

interface MentionsInputProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
}

export function MentionsInput({ value, onChange, placeholder }: MentionsInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Render a preview overlay with highlighted @mentions
  const parts = value.split(/(@\w+)/g)

  return (
    <div className="relative">
      {/* Hidden overlay for highlighting — shown behind textarea */}
      <div
        className="absolute inset-0 px-3 py-2 text-sm pointer-events-none whitespace-pre-wrap break-words overflow-hidden"
        aria-hidden="true"
      >
        {parts.map((part, i) =>
          part.startsWith('@') ? (
            <span
              key={i}
              className="text-[#51459d] font-medium bg-[#51459d]/10 rounded px-0.5"
            >
              {part}
            </span>
          ) : (
            <span key={i} className="text-transparent">
              {part}
            </span>
          )
        )}
      </div>

      {/* Actual textarea */}
      <textarea
        ref={textareaRef}
        className="w-full rounded-[10px] border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-[#51459d] relative z-10 caret-gray-900 dark:caret-gray-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ color: 'inherit' }}
      />
    </div>
  )
}

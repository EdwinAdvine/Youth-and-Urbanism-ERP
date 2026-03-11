interface ProTipBoxProps {
  children: React.ReactNode
  title?: string
}

export default function ProTipBox({ children, title }: ProTipBoxProps) {
  return (
    <div className="rounded-[10px] border-l-4 border-warning bg-warning/5 p-4 my-4">
      <div className="flex items-start gap-2">
        <svg className="h-5 w-5 text-warning shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-amber-800 mb-1">{title || 'Pro Tip'}</p>
          <div className="text-sm text-amber-700">{children}</div>
        </div>
      </div>
    </div>
  )
}

import { Button } from '@/components/ui'
import { useAISidebarStore } from '@/store/aiSidebar'

interface AIShortcutButtonProps {
  prompt: string
  label?: string
}

export default function AIShortcutButton({ prompt, label }: AIShortcutButtonProps) {
  const openSidebar = useAISidebarStore((s) => s.open)

  const handleClick = () => {
    openSidebar()
    // Dispatch a custom event that the AI sidebar can listen for to pre-fill the prompt
    window.dispatchEvent(
      new CustomEvent('handbook:ai-shortcut', { detail: { prompt } })
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      {label || 'Try it now'}
    </Button>
  )
}

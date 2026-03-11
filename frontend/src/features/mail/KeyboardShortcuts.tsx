import { useEffect, useCallback } from 'react'
import { useMarkAsRead, useDeleteMessage } from '../../api/mail'

interface KeyboardShortcutsConfig {
  messages: { id: string; read: boolean }[]
  selectedMessage: string | null
  onSelectMessage: (id: string | null) => void
  onReply: () => void
  onCompose: () => void
}

/**
 * Hook that adds Gmail-like keyboard shortcuts to the mail view.
 *
 * Shortcuts:
 * - j / ArrowDown: select next message
 * - k / ArrowUp: select previous message
 * - r: reply to selected message
 * - a: archive selected message (moves to archive)
 * - e: toggle read/unread on selected message
 * - c: open compose
 * - Escape: deselect message
 */
export function useMailKeyboardShortcuts({
  messages,
  selectedMessage,
  onSelectMessage,
  onReply,
  onCompose,
}: KeyboardShortcutsConfig) {
  const markAsRead = useMarkAsRead()
  const deleteMessage = useDeleteMessage()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea, or contenteditable
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).contentEditable === 'true') {
        return
      }

      const currentIndex = messages.findIndex((m) => m.id === selectedMessage)

      switch (e.key) {
        case 'j':
        case 'ArrowDown': {
          e.preventDefault()
          const nextIdx = currentIndex < messages.length - 1 ? currentIndex + 1 : 0
          if (messages[nextIdx]) onSelectMessage(messages[nextIdx].id)
          break
        }
        case 'k':
        case 'ArrowUp': {
          e.preventDefault()
          const prevIdx = currentIndex > 0 ? currentIndex - 1 : messages.length - 1
          if (messages[prevIdx]) onSelectMessage(messages[prevIdx].id)
          break
        }
        case 'r': {
          if (selectedMessage) {
            e.preventDefault()
            onReply()
          }
          break
        }
        case 'a': {
          if (selectedMessage) {
            e.preventDefault()
            // Archive = delete from inbox (moves to trash/archive)
            deleteMessage.mutate(selectedMessage, {
              onSuccess: () => {
                const next = messages.find((m) => m.id !== selectedMessage)
                onSelectMessage(next?.id ?? null)
              },
            })
          }
          break
        }
        case 'e': {
          if (selectedMessage) {
            e.preventDefault()
            markAsRead.mutate(selectedMessage)
          }
          break
        }
        case 'c': {
          e.preventDefault()
          onCompose()
          break
        }
        case 'Escape': {
          onSelectMessage(null)
          break
        }
      }
    },
    [messages, selectedMessage, onSelectMessage, onReply, onCompose, markAsRead, deleteMessage],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

/** Renders a small help tooltip showing available keyboard shortcuts */
export function KeyboardShortcutsHelp() {
  const shortcuts = [
    { key: 'j / ↓', desc: 'Next message' },
    { key: 'k / ↑', desc: 'Previous message' },
    { key: 'r', desc: 'Reply' },
    { key: 'a', desc: 'Archive' },
    { key: 'e', desc: 'Toggle read' },
    { key: 'c', desc: 'Compose' },
    { key: 'Esc', desc: 'Deselect' },
  ]

  return (
    <div className="bg-white border border-gray-200 rounded-[10px] shadow-lg p-4 w-56">
      <h3 className="text-xs font-semibold text-gray-900 mb-3">Keyboard Shortcuts</h3>
      <div className="space-y-1.5">
        {shortcuts.map((s) => (
          <div key={s.key} className="flex items-center justify-between">
            <kbd className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono border border-gray-200">
              {s.key}
            </kbd>
            <span className="text-[11px] text-gray-500">{s.desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

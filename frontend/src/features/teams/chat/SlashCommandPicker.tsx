import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Terminal,
  Zap,
  Brain,
  Shield,
  ChevronRight,
} from 'lucide-react'
import { useSlashCommands, useExecuteSlashCommand } from '@/api/chatExtended'
import { Spinner } from '@/components/ui/index'

// ── Types ────────────────────────────────────────────────────────────────────

interface SlashCommand {
  name: string
  description: string
  usage?: string
  category: 'general' | 'erp' | 'ai' | 'admin'
}

interface SlashCommandPickerProps {
  filterText: string
  channelId?: string
  onSelect: (command: SlashCommand) => void
  onClose: () => void
}

// ── Category config ──────────────────────────────────────────────────────────

const categoryConfig: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  general: {
    label: 'General',
    icon: <Terminal className="w-3.5 h-3.5" />,
    color: 'text-gray-500',
  },
  erp: {
    label: 'ERP',
    icon: <Zap className="w-3.5 h-3.5" />,
    color: 'text-[#51459d]',
  },
  ai: {
    label: 'AI',
    icon: <Brain className="w-3.5 h-3.5" />,
    color: 'text-[#3ec9d6]',
  },
  admin: {
    label: 'Admin',
    icon: <Shield className="w-3.5 h-3.5" />,
    color: 'text-[#ffa21d]',
  },
}

const CATEGORY_ORDER: string[] = ['general', 'erp', 'ai', 'admin']

// ── Component ────────────────────────────────────────────────────────────────

export default function SlashCommandPicker({
  filterText,
  channelId,
  onSelect,
  onClose,
}: SlashCommandPickerProps) {
  const { data: commands, isLoading } = useSlashCommands()
  const executeCommand = useExecuteSlashCommand()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  // Filter and group commands
  const filteredCommands: SlashCommand[] = useMemo(() => {
    if (!commands) return []
    const normalizedFilter = filterText.toLowerCase().replace(/^\//, '')
    return (commands as SlashCommand[]).filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(normalizedFilter) ||
        cmd.description.toLowerCase().includes(normalizedFilter)
    )
  }, [commands, filterText])

  // Group by category, maintaining order
  const groupedCommands = useMemo(() => {
    const groups: { category: string; commands: SlashCommand[] }[] = []
    for (const cat of CATEGORY_ORDER) {
      const cmds = filteredCommands.filter((c) => c.category === cat)
      if (cmds.length > 0) {
        groups.push({ category: cat, commands: cmds })
      }
    }
    // Any uncategorized
    const uncategorized = filteredCommands.filter(
      (c) => !CATEGORY_ORDER.includes(c.category)
    )
    if (uncategorized.length > 0) {
      groups.push({ category: 'general', commands: uncategorized })
    }
    return groups
  }, [filteredCommands])

  // Flat list for keyboard navigation
  const flatList: SlashCommand[] = useMemo(
    () => groupedCommands.flatMap((g) => g.commands),
    [groupedCommands]
  )

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [filterText])

  // Scroll selected item into view
  useEffect(() => {
    const el = itemRefs.current.get(selectedIndex)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // Handle command selection
  const handleSelect = useCallback(
    (cmd: SlashCommand) => {
      executeCommand.mutate(
        { command: cmd.name, channel_id: channelId },
        {
          onSuccess: () => {
            onSelect(cmd)
            onClose()
          },
          onError: () => {
            // Still pass the command even if execution fails
            // (the composer may want to insert it as text)
            onSelect(cmd)
            onClose()
          },
        }
      )
    },
    [executeCommand, channelId, onSelect, onClose]
  )

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % Math.max(flatList.length, 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) =>
            prev <= 0 ? Math.max(flatList.length - 1, 0) : prev - 1
          )
          break
        case 'Enter':
          e.preventDefault()
          if (flatList[selectedIndex]) {
            handleSelect(flatList[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [flatList, selectedIndex, handleSelect, onClose])

  // Loading state
  if (isLoading) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-[10px] shadow-xl z-20 p-4">
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <Spinner size="sm" />
          Loading commands...
        </div>
      </div>
    )
  }

  // No results
  if (flatList.length === 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-[10px] shadow-xl z-20 p-4">
        <p className="text-sm text-gray-400 text-center">
          No commands matching &quot;{filterText}&quot;
        </p>
      </div>
    )
  }

  // Track flat index across groups
  let flatIndex = 0

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-[10px] shadow-xl z-20 max-h-[320px] overflow-y-auto"
      ref={listRef}
    >
      <div className="p-1">
        {groupedCommands.map((group) => {
          const config = categoryConfig[group.category] || categoryConfig.general

          return (
            <div key={group.category}>
              {/* Category header */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 mt-1 first:mt-0">
                <span className={config.color}>{config.icon}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {config.label}
                </span>
              </div>

              {/* Commands */}
              {group.commands.map((cmd) => {
                const idx = flatIndex++
                const isSelected = idx === selectedIndex

                return (
                  <button
                    key={cmd.name}
                    ref={(el) => {
                      if (el) itemRefs.current.set(idx, el)
                    }}
                    onClick={() => handleSelect(cmd)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      isSelected
                        ? 'bg-[#51459d]/10 text-[#51459d]'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center text-xs font-mono font-bold text-gray-500">
                      /
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium font-mono truncate">
                          /{cmd.name}
                        </span>
                        {cmd.usage && (
                          <span className="text-xs text-gray-400 truncate">{cmd.usage}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{cmd.description}</p>
                    </div>
                    {isSelected && (
                      <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-[#51459d]" />
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Footer hint */}
      <div className="border-t border-gray-100 px-3 py-1.5 flex items-center gap-4 text-[10px] text-gray-400">
        <span>
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">Up</kbd>{' '}
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">Down</kbd> to navigate
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">Enter</kbd> to select
        </span>
        <span>
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">Esc</kbd> to close
        </span>
      </div>
    </div>
  )
}

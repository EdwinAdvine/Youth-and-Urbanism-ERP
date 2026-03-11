import { useState, useEffect } from 'react'
import { cn, Button, Modal, Input } from '../../components/ui'
import { toast } from '../../components/ui'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BoardColumn {
  key: string
  label: string
  color: string
}

const DEFAULT_COLUMNS: BoardColumn[] = [
  { key: 'todo', label: 'To Do', color: '#9ca3af' },
  { key: 'in_progress', label: 'In Progress', color: '#3b82f6' },
  { key: 'in_review', label: 'In Review', color: '#eab308' },
  { key: 'done', label: 'Done', color: '#22c55e' },
]

const PRESET_COLORS = [
  '#9ca3af', '#3b82f6', '#eab308', '#22c55e', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#51459d',
]

// ─── Storage ─────────────────────────────────────────────────────────────────

function loadColumns(projectId: string): BoardColumn[] {
  try {
    const raw = localStorage.getItem(`board_columns_${projectId}`)
    return raw ? JSON.parse(raw) : DEFAULT_COLUMNS
  } catch {
    return DEFAULT_COLUMNS
  }
}

function saveColumns(projectId: string, columns: BoardColumn[]) {
  localStorage.setItem(`board_columns_${projectId}`, JSON.stringify(columns))
}

// ─── Component ───────────────────────────────────────────────────────────────

interface BoardCustomizationProps {
  projectId: string
  open: boolean
  onClose: () => void
  onColumnsChange: (columns: BoardColumn[]) => void
}

export default function BoardCustomization({
  projectId,
  open,
  onClose,
  onColumnsChange,
}: BoardCustomizationProps) {
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editColor, setEditColor] = useState('')
  const [addMode, setAddMode] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])

  useEffect(() => {
    if (open) {
      setColumns(loadColumns(projectId))
      setEditingIndex(null)
      setAddMode(false)
    }
  }, [open, projectId])

  function handleSave() {
    if (columns.length === 0) {
      toast('error', 'Board must have at least one column')
      return
    }
    saveColumns(projectId, columns)
    onColumnsChange(columns)
    toast('success', 'Board columns updated')
    onClose()
  }

  function handleReset() {
    setColumns([...DEFAULT_COLUMNS])
  }

  function startEdit(index: number) {
    setEditingIndex(index)
    setEditLabel(columns[index].label)
    setEditColor(columns[index].color)
  }

  function confirmEdit() {
    if (editingIndex === null) return
    if (!editLabel.trim()) {
      toast('warning', 'Column label cannot be empty')
      return
    }
    const updated = [...columns]
    updated[editingIndex] = {
      ...updated[editingIndex],
      label: editLabel.trim(),
      color: editColor,
    }
    setColumns(updated)
    setEditingIndex(null)
  }

  function cancelEdit() {
    setEditingIndex(null)
  }

  function removeColumn(index: number) {
    if (columns.length <= 1) {
      toast('error', 'Cannot remove the last column')
      return
    }
    const updated = columns.filter((_, i) => i !== index)
    setColumns(updated)
  }

  function moveColumn(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= columns.length) return
    const updated = [...columns]
    const temp = updated[index]
    updated[index] = updated[target]
    updated[target] = temp
    setColumns(updated)
  }

  function handleAddColumn() {
    if (!newLabel.trim()) {
      toast('warning', 'Column label is required')
      return
    }
    const key = newKey.trim() || newLabel.trim().toLowerCase().replace(/\s+/g, '_')
    if (columns.some((c) => c.key === key)) {
      toast('error', 'A column with this key already exists')
      return
    }
    setColumns([...columns, { key, label: newLabel.trim(), color: newColor }])
    setNewKey('')
    setNewLabel('')
    setNewColor(PRESET_COLORS[0])
    setAddMode(false)
  }

  return (
    <Modal open={open} onClose={onClose} title="Customize Board Columns" size="md">
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          Rename, reorder, or add custom columns to your Kanban board.
        </p>

        {/* Column list */}
        <div className="space-y-2">
          {columns.map((col, index) => (
            <div
              key={col.key}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-[10px] border transition-colors',
                editingIndex === index ? 'border-primary bg-primary/5' : 'border-gray-100 bg-gray-50'
              )}
            >
              {editingIndex === index ? (
                <>
                  {/* Editing mode */}
                  <div className="flex gap-1">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditColor(c)}
                        className={cn(
                          'w-5 h-5 rounded-full transition-all',
                          editColor === c && 'ring-2 ring-offset-1 ring-primary'
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <input
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmEdit()
                      if (e.key === 'Escape') cancelEdit()
                    }}
                  />
                  <Button size="sm" variant="primary" onClick={confirmEdit}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>Cancel</Button>
                </>
              ) : (
                <>
                  {/* Display mode */}
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                  <span className="flex-1 text-sm font-medium text-gray-700">{col.label}</span>
                  <span className="text-[10px] text-gray-400 font-mono">{col.key}</span>

                  {/* Reorder buttons */}
                  <button
                    onClick={() => moveColumn(index, -1)}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    title="Move up"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveColumn(index, 1)}
                    disabled={index === columns.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    title="Move down"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  <button
                    onClick={() => startEdit(index)}
                    className="p-1 text-gray-400 hover:text-primary transition-colors"
                    title="Edit"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => removeColumn(index)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Remove"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add new column */}
        {addMode ? (
          <div className="border border-dashed border-primary/40 rounded-[10px] p-3 space-y-3 bg-primary/5">
            <Input
              label="Column Label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Testing"
              autoFocus
            />
            <Input
              label="Column Key (optional)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Auto-generated from label"
            />
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Color</label>
              <div className="flex gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={cn(
                      'w-6 h-6 rounded-full transition-all',
                      newColor === c && 'ring-2 ring-offset-1 ring-primary scale-110'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddColumn}>Add Column</Button>
              <Button size="sm" variant="ghost" onClick={() => setAddMode(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddMode(true)}
            className="w-full py-2 border border-dashed border-gray-300 rounded-[10px] text-sm text-gray-500 hover:border-primary hover:text-primary transition-colors"
          >
            + Add Custom Column
          </button>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Reset to Default
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Hook to load saved columns ─────────────────────────────────────────────

export function useBoardColumns(projectId: string): BoardColumn[] {
  return loadColumns(projectId)
}

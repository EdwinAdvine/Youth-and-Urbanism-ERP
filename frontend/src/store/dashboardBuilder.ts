/**
 * DashboardBuilder Zustand store — provides undo/redo history for the
 * dashboard builder page. Wraps widget layout state in a history stack.
 */
import { create } from 'zustand'

export interface WidgetLayout {
  id: string
  x: number
  y: number
  w: number
  h: number
}

interface HistoryEntry {
  layouts: WidgetLayout[]
  timestamp: number
}

interface DashboardBuilderState {
  // History stack
  past: HistoryEntry[]
  present: HistoryEntry | null
  future: HistoryEntry[]

  // Actions
  push: (layouts: WidgetLayout[]) => void
  undo: () => WidgetLayout[] | null
  redo: () => WidgetLayout[] | null
  canUndo: boolean
  canRedo: boolean
  clear: () => void
}

const MAX_HISTORY = 50

export const useDashboardBuilderStore = create<DashboardBuilderState>((set, get) => ({
  past: [],
  present: null,
  future: [],
  canUndo: false,
  canRedo: false,

  push: (layouts: WidgetLayout[]) => {
    const { present, past } = get()
    const entry: HistoryEntry = { layouts, timestamp: Date.now() }

    // Don't push if layouts are identical to present
    if (present && JSON.stringify(present.layouts) === JSON.stringify(layouts)) return

    const newPast = present
      ? [...past, present].slice(-MAX_HISTORY)
      : past

    set({
      past: newPast,
      present: entry,
      future: [],
      canUndo: newPast.length > 0 || present !== null,
      canRedo: false,
    })
  },

  undo: () => {
    const { past, present, future } = get()
    if (!past.length) return null

    const previous = past[past.length - 1]
    const newPast = past.slice(0, -1)

    set({
      past: newPast,
      present: previous,
      future: present ? [present, ...future] : future,
      canUndo: newPast.length > 0,
      canRedo: true,
    })

    return previous.layouts
  },

  redo: () => {
    const { past, present, future } = get()
    if (!future.length) return null

    const next = future[0]
    const newFuture = future.slice(1)

    set({
      past: present ? [...past, present] : past,
      present: next,
      future: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0,
    })

    return next.layouts
  },

  clear: () => set({
    past: [],
    present: null,
    future: [],
    canUndo: false,
    canRedo: false,
  }),
}))

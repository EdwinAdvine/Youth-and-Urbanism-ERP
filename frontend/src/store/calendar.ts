import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type CalView = 'month' | 'week' | 'day' | 'year' | 'schedule' | 'agenda'

interface VisibleCalendar {
  id: string
  name: string
  color: string
  visible: boolean
}

interface DragState {
  isDragging: boolean
  dragEventId: string | null
  dragStartSlot: { date: string; hour: number; minute: number } | null
  dragEndSlot: { date: string; hour: number; minute: number } | null
  isCreating: boolean
}

interface CalendarState {
  // View state
  view: CalView
  viewDate: Date
  setView: (view: CalView) => void
  setViewDate: (date: Date) => void
  navigate: (dir: 1 | -1) => void
  goToToday: () => void

  // Visible calendars (toggle on/off in sidebar)
  visibleCalendars: VisibleCalendar[]
  toggleCalendar: (id: string) => void
  setVisibleCalendars: (calendars: VisibleCalendar[]) => void

  // Sidebar
  sidebarOpen: boolean
  toggleSidebar: () => void

  // Overlay mode (show teammate calendars as ghost blocks)
  overlayUserIds: string[]
  toggleOverlayUser: (userId: string) => void
  clearOverlays: () => void

  // Drag state (for time-grid drag-to-create / drag-to-resize)
  drag: DragState
  startDrag: (eventId: string | null, slot: { date: string; hour: number; minute: number }) => void
  updateDrag: (slot: { date: string; hour: number; minute: number }) => void
  endDrag: () => DragState
  startCreating: (slot: { date: string; hour: number; minute: number }) => void

  // Time-grid settings
  dayStartHour: number
  dayEndHour: number
  slotDurationMinutes: number
  setTimeGridSettings: (settings: { dayStartHour?: number; dayEndHour?: number; slotDurationMinutes?: number }) => void

  // Active filters
  activeEventTypes: string[]
  toggleEventType: (type: string) => void
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      // View
      view: (typeof window !== 'undefined' && window.innerWidth < 640) ? 'day' : 'month',
      viewDate: new Date(),
      setView: (view) => set({ view }),
      setViewDate: (date) => set({ viewDate: date }),
      navigate: (dir) => {
        const { view, viewDate } = get()
        const d = new Date(viewDate)
        if (view === 'month') d.setMonth(d.getMonth() + dir)
        else if (view === 'week' || view === 'schedule') d.setDate(d.getDate() + dir * 7)
        else if (view === 'year') d.setFullYear(d.getFullYear() + dir)
        else d.setDate(d.getDate() + dir)
        set({ viewDate: d })
      },
      goToToday: () => set({ viewDate: new Date() }),

      // Visible calendars
      visibleCalendars: [
        { id: 'personal', name: 'Personal', color: '#51459d', visible: true },
        { id: 'team', name: 'Team', color: '#3ec9d6', visible: true },
        { id: 'holidays', name: 'Holidays', color: '#ff3a6e', visible: true },
        { id: 'tasks', name: 'Tasks', color: '#6fd943', visible: true },
        { id: 'birthdays', name: 'Birthdays', color: '#ffa21d', visible: true },
      ],
      toggleCalendar: (id) => set((s) => ({
        visibleCalendars: s.visibleCalendars.map((c) =>
          c.id === id ? { ...c, visible: !c.visible } : c
        ),
      })),
      setVisibleCalendars: (calendars) => set({ visibleCalendars: calendars }),

      // Sidebar
      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      // Overlay
      overlayUserIds: [],
      toggleOverlayUser: (userId) => set((s) => ({
        overlayUserIds: s.overlayUserIds.includes(userId)
          ? s.overlayUserIds.filter((id) => id !== userId)
          : [...s.overlayUserIds, userId],
      })),
      clearOverlays: () => set({ overlayUserIds: [] }),

      // Drag
      drag: { isDragging: false, dragEventId: null, dragStartSlot: null, dragEndSlot: null, isCreating: false },
      startDrag: (eventId, slot) => set({
        drag: { isDragging: true, dragEventId: eventId, dragStartSlot: slot, dragEndSlot: slot, isCreating: false },
      }),
      updateDrag: (slot) => set((s) => ({
        drag: { ...s.drag, dragEndSlot: slot },
      })),
      endDrag: () => {
        const dragState = { ...get().drag }
        set({ drag: { isDragging: false, dragEventId: null, dragStartSlot: null, dragEndSlot: null, isCreating: false } })
        return dragState
      },
      startCreating: (slot) => set({
        drag: { isDragging: true, dragEventId: null, dragStartSlot: slot, dragEndSlot: slot, isCreating: true },
      }),

      // Time-grid settings
      dayStartHour: 6,
      dayEndHour: 24,
      slotDurationMinutes: 30,
      setTimeGridSettings: (settings) => set((s) => ({
        dayStartHour: settings.dayStartHour ?? s.dayStartHour,
        dayEndHour: settings.dayEndHour ?? s.dayEndHour,
        slotDurationMinutes: settings.slotDurationMinutes ?? s.slotDurationMinutes,
      })),

      // Filters
      activeEventTypes: ['meeting', 'task', 'reminder', 'holiday', 'focus', 'booking', 'deadline'],
      toggleEventType: (type) => set((s) => ({
        activeEventTypes: s.activeEventTypes.includes(type)
          ? s.activeEventTypes.filter((t) => t !== type)
          : [...s.activeEventTypes, type],
      })),
    }),
    {
      name: 'era-calendar',
      partialize: (state) => ({
        view: state.view,
        dayStartHour: state.dayStartHour,
        dayEndHour: state.dayEndHour,
        slotDurationMinutes: state.slotDurationMinutes,
        visibleCalendars: state.visibleCalendars,
        sidebarOpen: state.sidebarOpen,
        activeEventTypes: state.activeEventTypes,
      }),
    }
  )
)

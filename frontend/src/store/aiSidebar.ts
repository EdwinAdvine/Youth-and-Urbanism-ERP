import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AISidebarState {
  isOpen: boolean
  toggle: () => void
  open: () => void
  close: () => void
}

export const useAISidebarStore = create<AISidebarState>()(
  persist(
    (set) => ({
      isOpen: false,
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    {
      name: 'urban-ai-sidebar',
      partialize: (state) => ({ isOpen: state.isOpen }),
    }
  )
)

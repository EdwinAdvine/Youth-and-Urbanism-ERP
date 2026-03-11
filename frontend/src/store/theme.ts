import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: () => 'light' | 'dark'
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (theme: Theme) => {
        set({ theme })
        applyTheme(theme)
      },
      resolvedTheme: () => {
        const { theme } = get()
        return theme === 'system' ? getSystemTheme() : theme
      },
    }),
    { name: 'urban-erp-theme' }
  )
)

// Apply theme on store hydration
export function initTheme() {
  const stored = localStorage.getItem('urban-erp-theme')
  const theme: Theme = stored ? (JSON.parse(stored)?.state?.theme ?? 'light') : 'light'
  applyTheme(theme)
  // Watch for system preference changes when in 'system' mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().theme === 'system') {
      applyTheme('system')
    }
  })
}

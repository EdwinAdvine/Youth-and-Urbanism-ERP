/**
 * Media query hooks for responsive layout in Urban Vibes Dynamics.
 *
 * Exports a low-level `useMediaQuery(query)` hook and convenience wrappers:
 *   - `useIsMobile()`          — viewport < 768px (phones)
 *   - `useIsTablet()`          — 768–1023px
 *   - `useIsDesktop()`         — ≥ 1024px
 *   - `useBreakpoint()`        — 'mobile' | 'tablet' | 'desktop'
 *   - `usePrefersReducedMotion()` — respects user accessibility preference
 *   - `useIsLandscape()`       — landscape orientation
 *
 * Breakpoints match Tailwind CSS defaults (sm: 640, md: 768, lg: 1024, xl: 1280).
 * SSR-safe: returns `false` when `window` is undefined (during build).
 *
 * Used by AppShell, Sidebar, and MobileBottomTabBar to toggle layout modes.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'

/**
 * Low-level hook: subscribes to a CSS media query and returns whether it matches.
 */
export function useMediaQuery(query: string): boolean {
  const mediaQuery = useMemo(
    () => (typeof window !== 'undefined' ? window.matchMedia(query) : null),
    [query],
  )

  const [matches, setMatches] = useState(() => mediaQuery?.matches ?? false)

  useEffect(() => {
    if (!mediaQuery) return
    setMatches(mediaQuery.matches)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [mediaQuery])

  return matches
}

/* ── Breakpoint constants (match Tailwind defaults) ─────────────────── */

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

/* ── Semantic device hooks ──────────────────────────────────────────── */

/** True when viewport is below Tailwind `md` (< 768px) — phones */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`)
}

/** True when viewport is between `md` and `lg` (768–1023px) — tablets */
export function useIsTablet(): boolean {
  return useMediaQuery(
    `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`,
  )
}

/** True when viewport is at or above `lg` (≥ 1024px) — desktops */
export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`)
}

/** Returns the current semantic breakpoint category */
export function useBreakpoint(): 'mobile' | 'tablet' | 'desktop' {
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  if (isMobile) return 'mobile'
  if (isTablet) return 'tablet'
  return 'desktop'
}

/** True when the user prefers reduced motion */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/** True in landscape orientation */
export function useIsLandscape(): boolean {
  return useMediaQuery('(orientation: landscape)')
}

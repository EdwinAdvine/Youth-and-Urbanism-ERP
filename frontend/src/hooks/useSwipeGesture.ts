/**
 * useSwipeGesture — touch swipe detection hook for mobile layouts.
 *
 * Returns touch event handlers (`onTouchStart`, `onTouchMove`, `onTouchEnd`)
 * to spread onto any element. Fires directional callbacks when the swipe
 * distance exceeds the configurable threshold (default: 50px).
 *
 * Supports four directions (left, right, up, down) plus a `onSwiping` callback
 * for live drag feedback (e.g. animating the mobile drawer) and `onSwipeCancel`
 * when the gesture falls below threshold.
 *
 * Used by the mobile drawer (`MobileDrawer.tsx`) to swipe-close the sidebar,
 * and by the mobile bottom tab bar for gesture navigation.
 */
import { useRef, useCallback } from 'react'

export interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: (e: React.TouchEvent) => void
}

export interface SwipeCallbacks {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  onSwipeUp?: () => void
  onSwipeDown?: () => void
  /** Minimum distance in px to trigger a swipe (default: 50) */
  threshold?: number
  /** Called with the current horizontal offset during the swipe */
  onSwiping?: (deltaX: number, deltaY: number) => void
  /** Called when the touch ends without meeting the threshold */
  onSwipeCancel?: () => void
}

export function useSwipeGesture(callbacks: SwipeCallbacks): SwipeHandlers {
  const startX = useRef(0)
  const startY = useRef(0)
  const swiping = useRef(false)
  const threshold = callbacks.threshold ?? 50

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    startX.current = touch.clientX
    startY.current = touch.clientY
    swiping.current = true
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - startX.current
    const deltaY = touch.clientY - startY.current
    callbacks.onSwiping?.(deltaX, deltaY)
  }, [callbacks])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return
    swiping.current = false
    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - startX.current
    const deltaY = touch.clientY - startY.current
    const absDeltaX = Math.abs(deltaX)
    const absDeltaY = Math.abs(deltaY)

    // Determine if horizontal or vertical swipe
    if (absDeltaX > absDeltaY && absDeltaX >= threshold) {
      if (deltaX > 0) {
        callbacks.onSwipeRight?.()
      } else {
        callbacks.onSwipeLeft?.()
      }
    } else if (absDeltaY > absDeltaX && absDeltaY >= threshold) {
      if (deltaY > 0) {
        callbacks.onSwipeDown?.()
      } else {
        callbacks.onSwipeUp?.()
      }
    } else {
      callbacks.onSwipeCancel?.()
    }
  }, [callbacks, threshold])

  return { onTouchStart, onTouchMove, onTouchEnd }
}

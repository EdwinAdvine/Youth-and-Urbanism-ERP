import React, { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from './index'

interface VirtualListProps<T> {
  items: T[]
  estimatedItemHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  keyExtractor: (item: T) => string
  /** Extra items rendered above/below viewport for smooth scrolling */
  overscan?: number
  className?: string
  /** Called when user scrolls near the bottom */
  onEndReached?: () => void
  /** Distance from bottom to trigger onEndReached (px) */
  endReachedThreshold?: number
}

export default function VirtualList<T>({
  items,
  estimatedItemHeight,
  renderItem,
  keyExtractor,
  overscan = 5,
  className,
  onEndReached,
  endReachedThreshold = 200,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const { scrollTop: st, scrollHeight, clientHeight } = containerRef.current
    setScrollTop(st)

    // End-reached detection
    if (onEndReached && scrollHeight - st - clientHeight < endReachedThreshold) {
      onEndReached()
    }
  }, [onEndReached, endReachedThreshold])

  const totalHeight = items.length * estimatedItemHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / estimatedItemHeight) - overscan)
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / estimatedItemHeight) + overscan
  )

  const visibleItems = items.slice(startIndex, endIndex)

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={cn('overflow-y-auto', className)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((item, i) => {
          const index = startIndex + i
          return (
            <div
              key={keyExtractor(item)}
              style={{
                position: 'absolute',
                top: index * estimatedItemHeight,
                left: 0,
                right: 0,
                height: estimatedItemHeight,
              }}
            >
              {renderItem(item, index)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

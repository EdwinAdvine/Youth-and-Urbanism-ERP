import React, { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from './index'

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Shown while loading */
  fallback?: React.ReactNode
  /** CSS aspect-ratio (e.g. "16/9", "1/1") for container sizing before load */
  aspectRatio?: string
}

export default function LazyImage({
  src,
  alt,
  fallback,
  aspectRatio,
  className,
  style,
  ...props
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [inView, setInView] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const handleLoad = useCallback(() => setLoaded(true), [])

  return (
    <div
      ref={containerRef}
      className={cn('overflow-hidden', className)}
      style={{ aspectRatio, ...style }}
    >
      {!loaded && (
        fallback ?? (
          <div className="w-full h-full animate-pulse bg-gray-200 dark:bg-gray-700 rounded-[10px]" />
        )
      )}
      {inView && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={handleLoad}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
          {...props}
        />
      )}
    </div>
  )
}

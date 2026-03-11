import { lazy, ComponentType } from 'react'

type ComponentModule = { default: ComponentType<any> }
type ImportFn = () => Promise<ComponentModule>

export type PreloadableComponent = ReturnType<typeof lazy> & { preload: () => void }

export function lazyWithPreload(importFn: ImportFn): PreloadableComponent {
  let modulePromise: Promise<ComponentModule> | null = null

  const Component = lazy(() => {
    if (!modulePromise) {
      modulePromise = importFn()
    }
    return modulePromise
  }) as PreloadableComponent

  Component.preload = () => {
    if (!modulePromise) {
      modulePromise = importFn()
    }
  }

  return Component
}

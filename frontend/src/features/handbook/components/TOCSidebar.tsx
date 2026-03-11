import { useEffect, useState } from 'react'
import { cn } from '@/components/ui'

interface TOCItem {
  id: string
  text: string
  level: number
}

interface TOCSidebarProps {
  markdown: string
}

function extractHeadings(md: string): TOCItem[] {
  const headingRegex = /^(#{1,4})\s+(.+)$/gm
  const items: TOCItem[] = []
  let match
  while ((match = headingRegex.exec(md)) !== null) {
    const level = match[1].length
    const text = match[2].replace(/[*_`\[\]]/g, '').trim()
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    items.push({ id, text, level })
  }
  return items
}

export default function TOCSidebar({ markdown }: TOCSidebarProps) {
  const [activeId, setActiveId] = useState('')
  const items = extractHeadings(markdown)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting)
        if (visible) setActiveId(visible.target.id)
      },
      { rootMargin: '-80px 0px -60% 0px' }
    )

    items.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [items])

  if (items.length < 2) return null

  return (
    <nav className="sticky top-20 space-y-0.5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
        On this page
      </p>
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={cn(
            'block text-xs py-1 transition-colors border-l-2',
            item.level === 1 && 'pl-3',
            item.level === 2 && 'pl-3',
            item.level === 3 && 'pl-6',
            item.level === 4 && 'pl-9',
            activeId === item.id
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          )}
        >
          {item.text}
        </a>
      ))}
    </nav>
  )
}

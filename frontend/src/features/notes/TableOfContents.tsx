import { useMemo } from 'react'

interface TocEntry {
  level: number
  text: string
  id: string
}

interface TableOfContentsProps {
  content: string
  onClose: () => void
}

export default function TableOfContents({ content, onClose }: TableOfContentsProps) {
  const entries = useMemo(() => {
    if (!content) return []
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
    const headings = doc.querySelectorAll('h1, h2, h3')
    const result: TocEntry[] = []
    headings.forEach((heading, idx) => {
      const level = parseInt(heading.tagName[1], 10)
      const text = heading.textContent?.trim() ?? ''
      if (text) {
        result.push({
          level,
          text,
          id: `heading-${idx}`,
        })
      }
    })
    return result
  }, [content])

  const scrollToHeading = (idx: number) => {
    // Find heading in the content-editable editor by index
    const editor = document.querySelector('[contenteditable="true"]')
    if (!editor) return
    const headings = editor.querySelectorAll('h1, h2, h3')
    if (headings[idx]) {
      headings[idx].scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="w-56 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100">Table of Contents</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[6px] text-gray-400">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* TOC entries */}
      <div className="flex-1 overflow-y-auto py-2">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-3">
            <svg className="h-6 w-6 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <p className="text-[11px] text-gray-400">No headings found</p>
            <p className="text-[10px] text-gray-300 mt-1">
              Add H1 or H2 headings to auto-generate a table of contents
            </p>
          </div>
        ) : (
          <nav className="space-y-0.5 px-2">
            {entries.map((entry, idx) => (
              <button
                key={entry.id}
                onClick={() => scrollToHeading(idx)}
                className="w-full text-left py-1.5 rounded-[6px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                style={{ paddingLeft: `${(entry.level - 1) * 12 + 8}px` }}
              >
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${ entry.level === 1 ? 'bg-[#51459d]' : entry.level === 2 ? 'bg-[#51459d]/50' : 'bg-[#51459d]/25' }`}
                  />
                  <span
                    className={`truncate group-hover:text-[#51459d] transition-colors ${ entry.level === 1 ? 'text-xs font-semibold text-gray-800' : entry.level === 2 ? 'text-[11px] font-medium text-gray-600' : 'text-[10px] text-gray-500' }`}
                  >
                    {entry.text}
                  </span>
                </div>
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Footer info */}
      {entries.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <p className="text-[10px] text-gray-400">
            {entries.length} heading{entries.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}

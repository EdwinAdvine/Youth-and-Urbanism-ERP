/**
 * ChangelogPage — in-app changelog viewer for Urban Vibes Dynamics.
 *
 * Fetches CHANGELOG.md from the backend (`GET /api/v1/settings/changelog`)
 * and renders it as formatted HTML using a lightweight markdown parser.
 *
 * Sections are parsed from the Keep-a-Changelog format:
 *   ## [version] — date
 *   ### Added / Changed / Fixed / Security / Breaking Changes
 *   - bullet items
 *
 * Features:
 * - Version filter (search box narrows visible sections)
 * - Colour-coded section badges (Added=green, Fixed=blue, Security=red, etc.)
 * - Copy link to specific version (anchor-based)
 * - Accessible at Settings → Changelog
 */
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '../../api/client'
import { Spinner } from '../../components/ui'

// ── API fetch ─────────────────────────────────────────────────────────────────

async function fetchChangelog(): Promise<string> {
  const res = await apiClient.get<string>('/settings/changelog', {
    responseType: 'text',
  })
  return res.data
}

function useChangelog() {
  return useQuery({
    queryKey: ['changelog'],
    queryFn: fetchChangelog,
    staleTime: 5 * 60 * 1000, // 5 minutes — changelog doesn't change often
    retry: 1,
  })
}

// ── Markdown parser ───────────────────────────────────────────────────────────

interface VersionSection {
  version: string
  date: string
  anchor: string
  groups: { heading: string; items: string[] }[]
  isBreaking: boolean
}

function parseChangelog(raw: string): VersionSection[] {
  const sections: VersionSection[] = []
  const lines = raw.split('\n')

  let current: VersionSection | null = null
  let currentGroup: { heading: string; items: string[] } | null = null

  // Regex: ## [1.0.0] — 2026-03-13  OR  ## [Unreleased]
  const versionRe = /^## \[(?<ver>[^\]]+)\](?:\s*[—-]\s*(?<date>\S+))?/

  for (const line of lines) {
    // New version section
    const vMatch = versionRe.exec(line)
    if (vMatch) {
      if (currentGroup && current) current.groups.push(currentGroup)
      if (current) sections.push(current)
      currentGroup = null

      const ver = vMatch.groups?.ver ?? ''
      const dt = vMatch.groups?.date ?? ''
      current = {
        version: ver,
        date: dt,
        anchor: `v${ver.replace(/\./g, '-')}`,
        groups: [],
        isBreaking: false,
      }
      continue
    }

    if (!current) continue

    // Sub-heading (### Added, ### Fixed, etc.)
    if (line.startsWith('### ')) {
      if (currentGroup) current.groups.push(currentGroup)
      const heading = line.replace(/^### /, '').trim()
      currentGroup = { heading, items: [] }
      if (heading.toLowerCase().includes('breaking')) {
        current.isBreaking = true
      }
      continue
    }

    // Bullet item
    if (line.startsWith('- ') && currentGroup) {
      currentGroup.items.push(line.replace(/^- /, '').trim())
    }
  }

  // Flush last group/section
  if (currentGroup && current) current.groups.push(currentGroup)
  if (current) sections.push(current)

  return sections
}

// ── Sub-components ────────────────────────────────────────────────────────────

const HEADING_STYLES: Record<string, string> = {
  Added:             'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  Changed:           'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Fixed:             'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  Security:          'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  Removed:           'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'Breaking Changes':'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200',
  '⚠ Breaking Changes':'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200',
}

function HeadingBadge({ heading }: { heading: string }) {
  const cls = HEADING_STYLES[heading] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {heading}
    </span>
  )
}

// Inline markdown: bold (**text**), code (`text`), link ([text](url))
function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[0.8em] dark:bg-gray-800">
              {part.slice(1, -1)}
            </code>
          )
        }
        const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
        if (linkMatch) {
          return (
            <a key={i} href={linkMatch[2]} className="text-primary underline" target="_blank" rel="noreferrer">
              {linkMatch[1]}
            </a>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function VersionCard({ section }: { section: VersionSection }) {
  const isUnreleased = section.version === 'Unreleased'
  return (
    <div
      id={section.anchor}
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900"
    >
      {/* Version header */}
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {isUnreleased ? 'Unreleased' : `v${section.version}`}
        </h2>
        {section.date && (
          <span className="text-sm text-gray-500 dark:text-gray-400">{section.date}</span>
        )}
        {section.isBreaking && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
            Breaking
          </span>
        )}
        {isUnreleased && (
          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
            Upcoming
          </span>
        )}
        {/* Copy anchor link */}
        <button
          className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          title="Copy link to this version"
          onClick={() => {
            const url = `${window.location.origin}${window.location.pathname}#${section.anchor}`
            navigator.clipboard.writeText(url).catch(() => {})
          }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </button>
      </div>

      {/* Groups */}
      <div className="space-y-4">
        {section.groups.map((group) => (
          <div key={group.heading}>
            <div className="mb-2">
              <HeadingBadge heading={group.heading} />
            </div>
            <ul className="space-y-1.5 pl-4">
              {group.items.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                  <InlineMarkdown text={item} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ChangelogPage() {
  const { data: raw, isLoading, isError } = useChangelog()
  const [filter, setFilter] = useState('')

  const sections = useMemo(() => {
    if (!raw) return []
    return parseChangelog(raw)
  }, [raw])

  const filtered = useMemo(() => {
    if (!filter.trim()) return sections
    const q = filter.toLowerCase()
    return sections.filter(
      (s) =>
        s.version.toLowerCase().includes(q) ||
        s.groups.some(
          (g) =>
            g.heading.toLowerCase().includes(q) ||
            g.items.some((item) => item.toLowerCase().includes(q))
        )
    )
  }, [sections, filter])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Changelog</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          Release history for Urban Vibes Dynamics — all notable changes, features, and fixes.
        </p>
      </div>

      {/* Search filter */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Filter by version, feature, or module..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
        />
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <p className="font-semibold">Failed to load changelog.</p>
          <p className="mt-1 text-sm">Check that CHANGELOG.md exists in the project root.</p>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="py-16 text-center text-gray-400">
          No changelog entries match your filter.
        </div>
      )}

      <div className="space-y-6">
        {filtered.map((section) => (
          <VersionCard key={section.version} section={section} />
        ))}
      </div>
    </div>
  )
}

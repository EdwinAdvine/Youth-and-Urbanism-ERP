/**
 * FilterBar — Client-side filter, sort, and group controls for database views.
 */
import { useState } from 'react'
import type { DatabaseProperty, DatabaseRow } from '../../../api/noteDatabases'

export type SortConfig = { property: string; direction: 'asc' | 'desc' }
export type FilterConfig = { property: string; operator: 'contains' | 'equals' | 'not_empty' | 'is_empty' | 'gt' | 'lt'; value: string }

interface FilterBarProps {
  properties: DatabaseProperty[]
  rows: DatabaseRow[]
  onFilteredRows: (rows: DatabaseRow[]) => void
}

function applyFilters(rows: DatabaseRow[], filters: FilterConfig[], sorts: SortConfig[]): DatabaseRow[] {
  let result = [...rows]

  // Apply filters
  for (const f of filters) {
    result = result.filter(row => {
      const val = String((row.values as any)[f.property] ?? '')
      switch (f.operator) {
        case 'contains': return val.toLowerCase().includes(f.value.toLowerCase())
        case 'equals': return val === f.value
        case 'not_empty': return val.trim() !== ''
        case 'is_empty': return val.trim() === ''
        case 'gt': return parseFloat(val) > parseFloat(f.value)
        case 'lt': return parseFloat(val) < parseFloat(f.value)
        default: return true
      }
    })
  }

  // Apply sorts
  if (sorts.length > 0) {
    const s = sorts[0]
    result.sort((a, b) => {
      const av = String((a.values as any)[s.property] ?? '')
      const bv = String((b.values as any)[s.property] ?? '')
      const cmp = av.localeCompare(bv, undefined, { numeric: true })
      return s.direction === 'asc' ? cmp : -cmp
    })
  }

  return result
}

export default function FilterBar({ properties, rows, onFilteredRows }: FilterBarProps) {
  const [filters, setFilters] = useState<FilterConfig[]>([])
  const [sorts, setSorts] = useState<SortConfig[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [showSorts, setShowSorts] = useState(false)

  const apply = (newFilters: FilterConfig[], newSorts: SortConfig[]) => {
    onFilteredRows(applyFilters(rows, newFilters, newSorts))
  }

  const addFilter = () => {
    const prop = properties[0]
    if (!prop) return
    const f: FilterConfig = { property: prop.name, operator: 'contains', value: '' }
    const next = [...filters, f]
    setFilters(next)
    apply(next, sorts)
  }

  const removeFilter = (i: number) => {
    const next = filters.filter((_, idx) => idx !== i)
    setFilters(next)
    apply(next, sorts)
  }

  const updateFilter = (i: number, patch: Partial<FilterConfig>) => {
    const next = filters.map((f, idx) => idx === i ? { ...f, ...patch } : f)
    setFilters(next)
    apply(next, sorts)
  }

  const addSort = () => {
    const prop = properties[0]
    if (!prop) return
    const s: SortConfig = { property: prop.name, direction: 'asc' }
    const next = [...sorts, s]
    setSorts(next)
    apply(filters, next)
  }

  const removeSort = (i: number) => {
    const next = sorts.filter((_, idx) => idx !== i)
    setSorts(next)
    apply(filters, next)
  }

  const clearAll = () => {
    setFilters([])
    setSorts([])
    onFilteredRows(rows)
  }

  const hasActive = filters.length > 0 || sorts.length > 0

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 px-4 py-1.5 flex items-center gap-2 flex-wrap shrink-0">
      {/* Filter button */}
      <button
        onClick={() => { setShowFilters(!showFilters); setShowSorts(false) }}
        className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-[6px] transition-colors ${filters.length > 0 ? 'bg-[#51459d]/10 text-[#51459d]' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707l-6.414 6.414A1 1 0 0014 13.828V19a1 1 0 01-1.447.894l-4-2A1 1 0 018 17v-3.172a1 1 0 00-.293-.707L1.293 6.707A1 1 0 011 6V4z" /></svg>
        Filter {filters.length > 0 && `(${filters.length})`}
      </button>

      {/* Sort button */}
      <button
        onClick={() => { setShowSorts(!showSorts); setShowFilters(false) }}
        className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-[6px] transition-colors ${sorts.length > 0 ? 'bg-[#51459d]/10 text-[#51459d]' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
        Sort {sorts.length > 0 && `(${sorts.length})`}
      </button>

      {hasActive && (
        <button onClick={clearAll} className="text-[11px] text-gray-400 hover:text-red-500 transition-colors">Clear all</button>
      )}

      {/* Filter panel */}
      {showFilters && (
        <div className="w-full mt-1 space-y-1.5">
          {filters.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 flex-wrap">
              <select
                value={f.property}
                onChange={e => updateFilter(i, { property: e.target.value })}
                className="text-[11px] border border-gray-200 dark:border-gray-700 rounded-[6px] px-1.5 py-1 bg-transparent"
              >
                {properties.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              <select
                value={f.operator}
                onChange={e => updateFilter(i, { operator: e.target.value as FilterConfig['operator'] })}
                className="text-[11px] border border-gray-200 dark:border-gray-700 rounded-[6px] px-1.5 py-1 bg-transparent"
              >
                <option value="contains">contains</option>
                <option value="equals">equals</option>
                <option value="not_empty">is not empty</option>
                <option value="is_empty">is empty</option>
                <option value="gt">greater than</option>
                <option value="lt">less than</option>
              </select>
              {f.operator !== 'not_empty' && f.operator !== 'is_empty' && (
                <input
                  value={f.value}
                  onChange={e => updateFilter(i, { value: e.target.value })}
                  className="text-[11px] border border-gray-200 dark:border-gray-700 rounded-[6px] px-2 py-1 bg-transparent w-32"
                  placeholder="value"
                />
              )}
              <button onClick={() => removeFilter(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
          <button onClick={addFilter} className="text-[11px] text-[#51459d] hover:underline">+ Add filter</button>
        </div>
      )}

      {/* Sort panel */}
      {showSorts && (
        <div className="w-full mt-1 space-y-1.5">
          {sorts.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <select
                value={s.property}
                onChange={e => { const next = sorts.map((ss, idx) => idx === i ? { ...ss, property: e.target.value } : ss); setSorts(next); apply(filters, next) }}
                className="text-[11px] border border-gray-200 dark:border-gray-700 rounded-[6px] px-1.5 py-1 bg-transparent"
              >
                {properties.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
              <select
                value={s.direction}
                onChange={e => { const next = sorts.map((ss, idx) => idx === i ? { ...ss, direction: e.target.value as 'asc' | 'desc' } : ss); setSorts(next); apply(filters, next) }}
                className="text-[11px] border border-gray-200 dark:border-gray-700 rounded-[6px] px-1.5 py-1 bg-transparent"
              >
                <option value="asc">A → Z</option>
                <option value="desc">Z → A</option>
              </select>
              <button onClick={() => removeSort(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
          <button onClick={addSort} className="text-[11px] text-[#51459d] hover:underline">+ Add sort</button>
        </div>
      )}
    </div>
  )
}

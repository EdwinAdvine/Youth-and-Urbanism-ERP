import { useState } from 'react'
import { Card, Button, Input, Spinner, Badge, Select } from '../../components/ui'
import { useFileSearch, type FileSearchParams, useSemanticSearch, type SemanticSearchResult } from '../../api/drive_ext'
import { formatFileSize, getFileType } from '../../api/drive'
import ModuleBadge from './ModuleBadge'

type SearchMode = 'basic' | 'semantic'

export default function DriveSearchPage() {
  const [query, setQuery] = useState('')
  const [fileType, setFileType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sourceModule, setSourceModule] = useState('')
  const [searchMode, setSearchMode] = useState<SearchMode>('semantic')
  const [submitted, setSubmitted] = useState<FileSearchParams | null>(null)

  const { data: basicData, isLoading: basicLoading } = useFileSearch(submitted ?? { query: '' })
  const semanticSearch = useSemanticSearch()

  const isLoading = searchMode === 'basic' ? basicLoading : semanticSearch.isPending
  const semanticResults = semanticSearch.data?.results ?? []

  const handleSearch = () => {
    if (!query.trim()) return
    const params: FileSearchParams = {
      query,
      file_type: fileType || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }
    if (searchMode === 'semantic') {
      semanticSearch.mutate({
        query,
        content_type: fileType || undefined,
        limit: 50,
      })
    } else {
      setSubmitted(params)
    }
  }

  const hasResults = searchMode === 'basic'
    ? submitted && basicData && basicData.files.length > 0
    : semanticResults.length > 0

  const noResults = searchMode === 'basic'
    ? submitted && basicData && basicData.files.length === 0
    : semanticSearch.isSuccess && semanticResults.length === 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Drive Search</h1>
        <p className="text-sm text-gray-500 mt-1">Find files across your drive using AI-powered semantic search</p>
      </div>

      <Card>
        <div className="space-y-4">
          {/* Search mode toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-[8px] overflow-hidden text-xs">
              <button
                onClick={() => setSearchMode('semantic')}
                className={`px-3 py-1.5 transition-colors ${searchMode === 'semantic' ? 'bg-[#51459d] text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                AI Search
              </button>
              <button
                onClick={() => setSearchMode('basic')}
                className={`px-3 py-1.5 transition-colors ${searchMode === 'basic' ? 'bg-[#51459d] text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                Basic
              </button>
            </div>
            {searchMode === 'semantic' && (
              <span className="text-[10px] text-[#51459d] bg-[#51459d]/10 px-2 py-0.5 rounded-full">
                Searches inside file content
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchMode === 'semantic' ? 'Ask anything... e.g. "invoices from Acme Corp"' : 'Search files...'}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              leftIcon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
            <Button onClick={handleSearch} className="shrink-0" loading={isLoading}>Search</Button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Select
              label="File Type"
              value={fileType}
              onChange={(e) => setFileType(e.target.value)}
              options={[
                { value: '', label: 'All types' },
                { value: 'image', label: 'Images' },
                { value: 'pdf', label: 'PDFs' },
                { value: 'docx', label: 'Documents' },
                { value: 'xlsx', label: 'Spreadsheets' },
                { value: 'video', label: 'Videos' },
              ]}
            />
            <Select
              label="Source Module"
              value={sourceModule}
              onChange={(e) => setSourceModule(e.target.value)}
              options={[
                { value: '', label: 'All modules' },
                { value: 'finance', label: 'Finance' },
                { value: 'notes', label: 'Notes' },
                { value: 'mail', label: 'Mail' },
                { value: 'pos', label: 'POS' },
                { value: 'hr', label: 'HR' },
                { value: 'support', label: 'Support' },
                { value: 'projects', label: 'Projects' },
                { value: 'calendar', label: 'Calendar' },
                { value: 'manufacturing', label: 'Manufacturing' },
                { value: 'supplychain', label: 'Supply Chain' },
                { value: 'crm', label: 'CRM' },
              ]}
            />
            <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Results */}
      {(submitted || semanticSearch.isSuccess) && (
        <Card padding={false}>
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Spinner /></div>
          ) : noResults ? (
            <div className="text-center py-16 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p>No files found for "{query}"</p>
              {searchMode === 'basic' && (
                <button onClick={() => setSearchMode('semantic')} className="mt-2 text-xs text-[#51459d] hover:underline">
                  Try AI Search instead
                </button>
              )}
            </div>
          ) : hasResults ? (
            <>
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {searchMode === 'basic'
                    ? `${basicData!.total} result${basicData!.total !== 1 ? 's' : ''}`
                    : `${semanticResults.length} result${semanticResults.length !== 1 ? 's' : ''}`}
                </span>
                {searchMode === 'semantic' && (
                  <span className="text-[10px] text-gray-400">Ranked by relevance</span>
                )}
              </div>
              <div className="divide-y divide-gray-50">
                {searchMode === 'basic'
                  ? basicData!.files.map((file) => (
                      <BasicResultRow key={file.id} file={file} />
                    ))
                  : semanticResults.map((result) => (
                      <SemanticResultRow key={result.file_id} result={result} />
                    ))}
              </div>
            </>
          ) : null}
        </Card>
      )}
    </div>
  )
}

function BasicResultRow({ file }: { file: { id: string; name: string; content_type: string; size: number; folder_path: string; source_module?: string; updated_at: string } }) {
  const type = getFileType(file.content_type, file.name)
  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <div className="w-10 h-10 rounded-[10px] bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-gray-500 shrink-0">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{file.name}</p>
          <ModuleBadge module={file.source_module} />
        </div>
        <p className="text-xs text-gray-400">{file.folder_path || '/'}</p>
      </div>
      <Badge variant="default">{type.toUpperCase()}</Badge>
      <span className="text-sm text-gray-500 w-20 text-right">{formatFileSize(file.size)}</span>
      <span className="text-xs text-gray-400 w-24 text-right">{new Date(file.updated_at).toLocaleDateString()}</span>
    </div>
  )
}

function SemanticResultRow({ result }: { result: SemanticSearchResult }) {
  const relevance = Math.round(result.relevance_score * 100)

  const matchColors: Record<string, string> = {
    full_text: 'bg-green-100 text-green-700',
    semantic: 'bg-purple-100 text-purple-700',
    filename: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <div className="w-10 h-10 rounded-[10px] bg-gray-100 dark:bg-gray-900 flex items-center justify-center shrink-0">
        <div className="relative">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{result.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-gray-400 truncate">{result.folder_path || '/'}</p>
          {result.snippet && (
            <p className="text-xs text-gray-400 truncate max-w-[200px]" title={result.snippet}>
              ...{result.snippet}...
            </p>
          )}
        </div>
      </div>
      <span className={`text-[10px] px-1.5 py-0.5 rounded ${matchColors[result.match_type] || 'bg-gray-100 text-gray-600'}`}>
        {result.match_type.replace('_', ' ')}
      </span>
      <div className="w-10 text-right" title={`${relevance}% relevance`}>
        <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#51459d] rounded-full"
            style={{ width: `${relevance}%` }}
          />
        </div>
        <span className="text-[9px] text-gray-400">{relevance}%</span>
      </div>
      <span className="text-sm text-gray-500 w-20 text-right">{formatFileSize(result.size)}</span>
    </div>
  )
}

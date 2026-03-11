import { useState } from 'react'
import { Card, Button, Input, Spinner, Badge, Select } from '../../components/ui'
import { useFileSearch, type FileSearchParams } from '../../api/drive_ext'
import { formatFileSize, getFileType } from '../../api/drive'

export default function DriveSearchPage() {
  const [query, setQuery] = useState('')
  const [fileType, setFileType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [submitted, setSubmitted] = useState<FileSearchParams | null>(null)

  const { data, isLoading } = useFileSearch(submitted ?? { query: '' })

  const handleSearch = () => {
    if (!query.trim()) return
    setSubmitted({
      query,
      file_type: fileType || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Drive Search</h1>
        <p className="text-sm text-gray-500 mt-1">Find files across your drive</p>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files..."
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              leftIcon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
            />
            <Button onClick={handleSearch} className="shrink-0">Search</Button>
          </div>
          <div className="grid grid-cols-3 gap-3">
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
            <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </Card>

      {submitted && (
        <Card padding={false}>
          {isLoading ? (
            <div className="flex items-center justify-center py-16"><Spinner /></div>
          ) : !data || data.files.length === 0 ? (
            <div className="text-center py-16 text-gray-400">No files found for "{submitted.query}"</div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm text-gray-500">{data.total} result{data.total !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {data.files.map((file) => {
                  const type = getFileType(file.content_type, file.name)
                  return (
                    <div key={file.id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="w-10 h-10 rounded-[10px] bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-gray-500 shrink-0">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{file.name}</p>
                        <p className="text-xs text-gray-400">{file.folder_path || '/'}</p>
                      </div>
                      <Badge variant="default">{type.toUpperCase()}</Badge>
                      <span className="text-sm text-gray-500 w-20 text-right">{formatFileSize(file.size)}</span>
                      <span className="text-xs text-gray-400 w-24 text-right">{new Date(file.updated_at).toLocaleDateString()}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  )
}

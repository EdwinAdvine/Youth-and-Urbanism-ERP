import { useState, useRef, useCallback } from 'react'
import { Card, Button, Badge, toast } from '@/components/ui'
import api from '@/api/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportResult {
  imported: number
  updated:  number
  errors:   { row: number; message: string }[]
}

type ImportTab = 'csv' | 'json' | 'formats'
type FormatType = 'rippling' | 'bamboohr' | 'hibob' | 'adp'

const EXPECTED_COLUMNS = [
  'first_name', 'last_name', 'email', 'phone', 'department_id', 'job_title',
  'employment_type', 'hire_date', 'manager_id', 'salary', 'currency',
]

const FORMAT_CARDS: {
  id: FormatType
  name: string
  logo: string
  description: string
  acceptedFormat: string
}[] = [
  {
    id:             'rippling',
    name:           'Rippling',
    logo:           '🔵',
    description:    'Export from Rippling → People → Export. Select CSV format with all employee fields.',
    acceptedFormat: 'CSV (Rippling export format)',
  },
  {
    id:             'bamboohr',
    name:           'BambooHR',
    logo:           '🟢',
    description:    'Go to Reports → Employee Data → Export. Download as CSV with standard fields.',
    acceptedFormat: 'CSV (BambooHR employee report)',
  },
  {
    id:             'hibob',
    name:           'HiBob',
    logo:           '🟣',
    description:    'Export from HiBob People → All Employees → Export to CSV.',
    acceptedFormat: 'CSV (HiBob people export)',
  },
  {
    id:             'adp',
    name:           'ADP',
    logo:           '🔴',
    description:    'ADP Workforce Now → Reports → Employee Master List. Export as CSV.',
    acceptedFormat: 'CSV (ADP Workforce Now export)',
  },
]

// ─── Error Table ──────────────────────────────────────────────────────────────

function ErrorTable({
  errors,
}: {
  errors: { row: number; message: string }[]
}) {
  const [collapsed, setCollapsed] = useState(true)

  if (errors.length === 0) return null

  return (
    <div className="rounded-[10px] border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 overflow-hidden">
      <button
        onClick={() => setCollapsed((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-100/50 transition-colors"
      >
        <span>{errors.length} error{errors.length !== 1 ? 's' : ''} found</span>
        <svg
          className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="overflow-x-auto border-t border-red-200 dark:border-red-800">
          <table className="w-full text-sm">
            <thead className="bg-red-100/70 dark:bg-red-900/20">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-red-700 dark:text-red-400">Row</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-red-700 dark:text-red-400">Error Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-200 dark:divide-red-800">
              {errors.map((err, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-red-600 dark:text-red-400 font-medium">{err.row}</td>
                  <td className="px-4 py-2 text-red-700 dark:text-red-300">{err.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Success Banner ───────────────────────────────────────────────────────────

function SuccessBanner({ result, onDismiss }: { result: ImportResult; onDismiss: () => void }) {
  return (
    <div
      className="flex items-start gap-3 rounded-[10px] border p-4"
      style={{ borderColor: '#6fd94340', backgroundColor: '#6fd94310' }}
    >
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white text-sm"
        style={{ backgroundColor: '#6fd943' }}
      >
        ✓
      </div>
      <div className="flex-1">
        <p className="font-semibold text-green-800 dark:text-green-300">Import Successful</p>
        <div className="mt-1 flex flex-wrap gap-4 text-sm text-green-700 dark:text-green-400">
          <span>
            <strong>{result.imported}</strong> employees imported
          </span>
          <span>
            <strong>{result.updated}</strong> updated
          </span>
          {result.errors.length > 0 && (
            <span className="text-red-600">
              <strong>{result.errors.length}</strong> errors
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="text-green-500 hover:text-green-700 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────

function DropZone({
  onFile,
  accept = '.csv',
  label = 'CSV',
}: {
  onFile: (file: File) => void
  accept?: string
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) { setFileName(file.name); onFile(file) }
    },
    [onFile]
  )

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) { setFileName(file.name); onFile(file) }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center rounded-[10px] border-2 border-dashed cursor-pointer transition-colors py-10 px-6 text-center ${
        dragging
          ? 'border-primary bg-primary/5'
          : 'border-gray-200 dark:border-gray-700 hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-800/50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
      <svg className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
      {fileName ? (
        <p className="text-sm font-medium text-primary">{fileName}</p>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Drag & drop your {label} file here
          </p>
          <p className="text-xs text-gray-400 mt-1">or click to browse</p>
        </>
      )}
    </div>
  )
}

// ─── CSV Tab ──────────────────────────────────────────────────────────────────

function CSVTab() {
  const [file, setFile]           = useState<File | null>(null)
  const [result, setResult]       = useState<ImportResult | null>(null)
  const [loading, setLoading]     = useState(false)

  async function handleDownloadTemplate() {
    try {
      const res = await api.get('/hr/import/template/csv', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data as Blob)
      const a   = document.createElement('a')
      a.href    = url
      a.download = 'urban_erp_employees_template.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast('error', 'Failed to download template')
    }
  }

  async function handleUpload() {
    if (!file) { toast('error', 'Please select a CSV file'); return }
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post<ImportResult>('/hr/import/employees/csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data)
      toast('success', `Imported ${data.imported} employees`)
    } catch (err: any) {
      toast('error', err?.response?.data?.detail ?? 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {result && (
        <SuccessBanner result={result} onDismiss={() => setResult(null)} />
      )}

      {/* Drop zone */}
      <DropZone onFile={setFile} accept=".csv" label="CSV" />

      {/* Expected columns */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Expected Columns:</p>
        <pre className="overflow-x-auto rounded-[10px] bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 p-4 text-xs text-gray-600 dark:text-gray-400 font-mono leading-relaxed">
{EXPECTED_COLUMNS.join(',')}
        </pre>
        <p className="text-xs text-gray-400">
          First row must be a header row with these column names. Optional columns can be left empty.
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Template
        </Button>
        <Button onClick={handleUpload} loading={loading} disabled={!file}>
          Upload & Import
        </Button>
      </div>

      {result && result.errors.length > 0 && (
        <ErrorTable errors={result.errors} />
      )}
    </div>
  )
}

// ─── JSON Tab ─────────────────────────────────────────────────────────────────

function JSONTab() {
  const [jsonText, setJsonText] = useState('')
  const [result, setResult]     = useState<ImportResult | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleUpload() {
    if (!jsonText.trim()) { toast('error', 'Please paste JSON data'); return }
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      toast('error', 'Invalid JSON — please check the format')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post<ImportResult>('/hr/import/employees/json', { employees: parsed })
      setResult(data)
      toast('success', `Imported ${data.imported} employees`)
    } catch (err: any) {
      toast('error', err?.response?.data?.detail ?? 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {result && (
        <SuccessBanner result={result} onDismiss={() => setResult(null)} />
      )}

      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Paste JSON Array
        </label>
        <textarea
          className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-3 text-sm font-mono text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-y"
          rows={12}
          placeholder={`[\n  {\n    "first_name": "Jane",\n    "last_name": "Smith",\n    "email": "jane@company.com",\n    "department_id": "dept-001",\n    "job_title": "Engineer",\n    "hire_date": "2026-01-15"\n  }\n]`}
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          spellCheck={false}
        />
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setJsonText(
              JSON.stringify(
                [{ first_name: 'Jane', last_name: 'Smith', email: 'jane@company.com', department_id: 'dept-001', job_title: 'Engineer', hire_date: '2026-01-15' }],
                null,
                2
              )
            )
          }
        >
          Load Example
        </Button>
        <Button onClick={handleUpload} loading={loading} disabled={!jsonText.trim()}>
          Import JSON
        </Button>
      </div>

      {result && result.errors.length > 0 && (
        <ErrorTable errors={result.errors} />
      )}
    </div>
  )
}

// ─── Format Importer Card ─────────────────────────────────────────────────────

function FormatImporterCard({
  format,
}: {
  format: (typeof FORMAT_CARDS)[number]
}) {
  const [file, setFile]       = useState<File | null>(null)
  const [result, setResult]   = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleUpload() {
    if (!file) { toast('error', 'Please select a file'); return }
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('format', format.id)
      const { data } = await api.post<ImportResult>(
        `/hr/import/employees/${format.id}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      setResult(data)
      toast('success', `Imported ${data.imported} employees from ${format.name}`)
    } catch (err: any) {
      toast('error', err?.response?.data?.detail ?? `${format.name} import failed`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">{format.logo}</span>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{format.name}</h3>
          <Badge variant="default" className="text-xs">{format.acceptedFormat}</Badge>
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
        {format.description}
      </p>

      {result && (
        <SuccessBanner result={result} onDismiss={() => setResult(null)} />
      )}

      <DropZone onFile={setFile} accept=".csv,.xlsx" label={format.name} />

      <Button
        onClick={handleUpload}
        loading={loading}
        disabled={!file}
        variant="outline"
        className="w-full"
      >
        Import from {format.name}
      </Button>

      {result && result.errors.length > 0 && (
        <ErrorTable errors={result.errors} />
      )}
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [tab, setTab] = useState<ImportTab>('csv')

  const tabs: { id: ImportTab; label: string }[] = [
    { id: 'csv',     label: 'CSV Import' },
    { id: 'json',    label: 'JSON Import' },
    { id: 'formats', label: 'Format Importers' },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Employee Import</h1>
        <p className="text-sm text-gray-500">
          Bulk import employees via CSV, JSON, or third-party HR platform exports
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-[10px] bg-gray-100 dark:bg-gray-800 p-1 w-fit">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-[8px] px-4 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'csv' && (
        <Card>
          <h2 className="mb-5 text-base font-semibold text-gray-900 dark:text-gray-100">
            CSV Import
          </h2>
          <CSVTab />
        </Card>
      )}

      {tab === 'json' && (
        <Card>
          <h2 className="mb-5 text-base font-semibold text-gray-900 dark:text-gray-100">
            JSON Import
          </h2>
          <JSONTab />
        </Card>
      )}

      {tab === 'formats' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FORMAT_CARDS.map((fmt) => (
              <FormatImporterCard key={fmt.id} format={fmt} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

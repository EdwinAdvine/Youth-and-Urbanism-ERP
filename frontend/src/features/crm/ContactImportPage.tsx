import { useState, useRef } from 'react'
import { Card, Button, Spinner, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import { useImportContacts } from '../../api/crm'

const REQUIRED_FIELDS = ['name', 'email']
const OPTIONAL_FIELDS = ['phone', 'company', 'contact_type', 'notes']
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]

type Step = 'upload' | 'mapping' | 'preview' | 'result'

export default function ContactImportPage() {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<string[][]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const importContacts = useImportContacts()

  function parseCSV(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return { headers: [], rows: [] }
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
    const rows = lines.slice(1).map((line) => line.split(',').map((c) => c.trim().replace(/^"|"$/g, '')))
    return { headers, rows }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const { headers, rows } = parseCSV(text)
      setCsvHeaders(headers)
      setCsvRows(rows)

      // Auto-map columns by name matching
      const autoMapping: Record<string, string> = {}
      ALL_FIELDS.forEach((field) => {
        const match = headers.find((h) => h.toLowerCase().replace(/[^a-z]/g, '') === field.replace(/_/g, ''))
        if (match) autoMapping[field] = match
      })
      setColumnMapping(autoMapping)
      setStep('mapping')
    }
    reader.readAsText(f)
  }

  function handleImport() {
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('column_mapping', JSON.stringify(columnMapping))

    importContacts.mutate(formData, {
      onSuccess: (result) => {
        setImportResult(result)
        setStep('result')
        toast('success', `${result.imported} contacts imported`)
      },
      onError: () => toast('error', 'Import failed'),
    })
  }

  function reset() {
    setStep('upload')
    setFile(null)
    setCsvHeaders([])
    setCsvRows([])
    setColumnMapping({})
    setImportResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const isValid = REQUIRED_FIELDS.every((f) => columnMapping[f])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import Contacts</h1>
        <p className="text-sm text-gray-500 mt-1">Upload a CSV file to import contacts in bulk</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2">
        {(['upload', 'mapping', 'preview', 'result'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${ step === s ? 'bg-primary text-white' : i < ['upload', 'mapping', 'preview', 'result'].indexOf(step) ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400' }`}>
              {i + 1}
            </div>
            <span className={`text-sm capitalize ${step === s ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{s}</span>
            {i < 3 && <div className="w-8 h-0.5 bg-gray-200" />}
          </div>
        ))}
      </div>

      {/* Upload Step */}
      {step === 'upload' && (
        <Card>
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload CSV File</h3>
            <p className="text-sm text-gray-500 mb-4">
              Your CSV should include headers like: name, email, phone, company, contact_type
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button onClick={() => fileRef.current?.click()}>Select CSV File</Button>
          </div>
        </Card>
      )}

      {/* Mapping Step */}
      {step === 'mapping' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Map Columns</h3>
          <p className="text-sm text-gray-500 mb-4">
            Map your CSV columns to contact fields. File: <span className="font-medium">{file?.name}</span> ({csvRows.length} rows)
          </p>
          <div className="space-y-3">
            {ALL_FIELDS.map((field) => (
              <div key={field} className="flex items-center gap-4">
                <div className="w-40 flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 capitalize">{field.replace(/_/g, ' ')}</span>
                  {REQUIRED_FIELDS.includes(field) && <Badge variant="danger">Required</Badge>}
                </div>
                <Select
                  options={[
                    { value: '', label: '-- Skip --' },
                    ...csvHeaders.map((h) => ({ value: h, label: h })),
                  ]}
                  value={columnMapping[field] ?? ''}
                  onChange={(e) => setColumnMapping((p) => ({ ...p, [field]: e.target.value }))}
                  className="w-64"
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between pt-4 mt-4 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" onClick={reset}>Back</Button>
            <Button disabled={!isValid} onClick={() => setStep('preview')}>Preview</Button>
          </div>
        </Card>
      )}

      {/* Preview Step */}
      {step === 'preview' && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Preview Import</h3>
          <p className="text-sm text-gray-500 mb-4">Showing first 10 rows. Total: {csvRows.length} rows.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {ALL_FIELDS.filter((f) => columnMapping[f]).map((field) => (
                    <th key={field} className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">
                      {field.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvRows.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-800">
                    {ALL_FIELDS.filter((f) => columnMapping[f]).map((field) => {
                      const colIdx = csvHeaders.indexOf(columnMapping[field])
                      return (
                        <td key={field} className="py-2 px-3">{colIdx >= 0 ? row[colIdx] : '-'}</td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between pt-4 mt-4 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" onClick={() => setStep('mapping')}>Back</Button>
            <Button onClick={handleImport} loading={importContacts.isPending}>
              Import {csvRows.length} Contacts
            </Button>
          </div>
        </Card>
      )}

      {/* Result Step */}
      {step === 'result' && importResult && (
        <Card>
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <span className="text-2xl text-green-600 font-bold">✓</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Import Complete</h3>
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-green-600">{importResult.imported}</span> contacts imported successfully
            </p>
            {importResult.errors.length > 0 && (
              <div className="mt-4 text-left max-w-md mx-auto">
                <p className="text-sm font-medium text-red-600 mb-2">{importResult.errors.length} errors:</p>
                <div className="max-h-40 overflow-y-auto bg-red-50 rounded-[10px] p-3">
                  {importResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-600">{err}</p>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-6">
              <Button onClick={reset}>Import More</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

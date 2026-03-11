import { useCallback, useState } from 'react'
import { useImportPreview, useImportConfirm } from '../../api/userImport'
import type { ImportPreviewRow, ImportErrorRow, ImportConfirmResponse } from '../../api/userImport'
import { Card, Button, Badge } from '../../components/ui'

function downloadTemplateCSV() {
  const header = 'email,full_name,role,department'
  const example1 = 'john@company.com,John Doe,user,Engineering'
  const example2 = 'jane@company.com,Jane Smith,user,Marketing'
  const csv = [header, example1, example2].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'user_import_template.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export default function BulkImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [validRows, setValidRows] = useState<ImportPreviewRow[]>([])
  const [errorRows, setErrorRows] = useState<ImportErrorRow[]>([])
  const [result, setResult] = useState<ImportConfirmResponse | null>(null)

  const previewMutation = useImportPreview()
  const confirmMutation = useImportConfirm()

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true)
    else if (e.type === 'dragleave') setDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files?.[0]) {
      setFile(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0])
    }
  }

  const handlePreview = async () => {
    if (!file) return
    setResult(null)
    const data = await previewMutation.mutateAsync(file)
    setValidRows(data.valid_rows)
    setErrorRows(data.error_rows)
  }

  const handleConfirm = async () => {
    if (!validRows.length) return
    const data = await confirmMutation.mutateAsync(validRows)
    setResult(data)
    setValidRows([])
    setErrorRows([])
    setFile(null)
  }

  const handleReset = () => {
    setFile(null)
    setValidRows([])
    setErrorRows([])
    setResult(null)
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bulk User Import</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Upload a CSV file to import multiple users at once. Required columns: email, full_name. Optional: role, department.
        </p>
      </div>

      {/* Upload Zone */}
      {!validRows.length && !result && (
        <Card>
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
              dragActive
                ? 'border-primary bg-primary/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-gray-700 font-medium">
              {file ? file.name : 'Drop your CSV file here, or click to browse'}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {file ? `${(file.size / 1024).toFixed(1)} KB` : 'CSV files only'}
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <div className="mt-4 flex gap-3 justify-center">
              <label
                htmlFor="csv-upload"
                className="cursor-pointer px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Browse Files
              </label>
              {file && (
                <Button onClick={handlePreview} loading={previewMutation.isPending}>
                  Preview Import
                </Button>
              )}
            </div>
          </div>

          {previewMutation.isError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {(previewMutation.error as any)?.response?.data?.detail || 'Failed to parse CSV file'}
            </div>
          )}

          {/* CSV Template */}
          <div className="mt-4 p-4 bg-gray-50 rounded-[10px]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">CSV Template</p>
              <button
                type="button"
                onClick={downloadTemplateCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-white hover:text-[#51459d] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Template
              </button>
            </div>
            <code className="text-xs text-gray-500 block font-mono">
              email,full_name,role,department<br />
              john@company.com,John Doe,user,Engineering<br />
              jane@company.com,Jane Smith,user,Marketing
            </code>
          </div>
        </Card>
      )}

      {/* Preview Table */}
      {(validRows.length > 0 || errorRows.length > 0) && !result && (
        <>
          {/* Valid Rows */}
          {validRows.length > 0 && (
            <Card>
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="success">{validRows.length} valid</Badge>
                  <span className="text-sm text-gray-600">Ready to import</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="px-4 py-3 font-medium text-gray-500">Row</th>
                      <th className="px-4 py-3 font-medium text-gray-500">Email</th>
                      <th className="px-4 py-3 font-medium text-gray-500">Full Name</th>
                      <th className="px-4 py-3 font-medium text-gray-500">Role</th>
                      <th className="px-4 py-3 font-medium text-gray-500">Department</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.map((row) => (
                      <tr key={row.row} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 text-gray-400">{row.row}</td>
                        <td className="px-4 py-2.5 text-gray-900">{row.email}</td>
                        <td className="px-4 py-2.5 text-gray-700">{row.full_name}</td>
                        <td className="px-4 py-2.5 text-gray-500">{row.role || '-'}</td>
                        <td className="px-4 py-2.5 text-gray-500">{row.department || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Error Rows */}
          {errorRows.length > 0 && (
            <Card>
              <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                <Badge variant="danger">{errorRows.length} errors</Badge>
                <span className="text-sm text-gray-600">These rows will be skipped</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="px-4 py-3 font-medium text-gray-500">Row</th>
                      <th className="px-4 py-3 font-medium text-gray-500">Email</th>
                      <th className="px-4 py-3 font-medium text-gray-500">Full Name</th>
                      <th className="px-4 py-3 font-medium text-gray-500">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorRows.map((row) => (
                      <tr key={row.row} className="border-b border-gray-50 hover:bg-red-50/30">
                        <td className="px-4 py-2.5 text-gray-400">{row.row}</td>
                        <td className="px-4 py-2.5 text-gray-900">{row.email || '-'}</td>
                        <td className="px-4 py-2.5 text-gray-700">{row.full_name || '-'}</td>
                        <td className="px-4 py-2.5 text-red-600 text-xs">{row.errors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleReset}>Cancel</Button>
            <Button
              onClick={handleConfirm}
              loading={confirmMutation.isPending}
              disabled={!validRows.length}
            >
              Import {validRows.length} Users
            </Button>
          </div>
        </>
      )}

      {/* Results */}
      {result && (
        <Card>
          <div className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Import Complete</h2>
            <p className="text-gray-500 mt-1">
              {result.created_count} users created, {result.skipped_count} skipped
            </p>
          </div>

          {result.created_users.length > 0 && (
            <div className="border-t border-gray-100">
              <div className="p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Created Users (save generated passwords)
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left">
                        <th className="px-4 py-2 font-medium text-gray-500">Email</th>
                        <th className="px-4 py-2 font-medium text-gray-500">Full Name</th>
                        <th className="px-4 py-2 font-medium text-gray-500">Generated Password</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.created_users.map((u) => (
                        <tr key={u.id} className="border-b border-gray-50">
                          <td className="px-4 py-2 text-gray-900">{u.email}</td>
                          <td className="px-4 py-2 text-gray-700">{u.full_name}</td>
                          <td className="px-4 py-2">
                            <code className="bg-yellow-50 text-yellow-800 px-2 py-0.5 rounded text-xs font-mono">
                              {u.generated_password}
                            </code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 border-t border-gray-100 flex justify-end">
            <Button variant="secondary" onClick={handleReset}>Import More</Button>
          </div>
        </Card>
      )}
    </div>
  )
}

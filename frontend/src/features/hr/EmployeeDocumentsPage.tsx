import { useState, useRef } from 'react'
import { Card, Button, Spinner, Table, Modal, Input, Select, Badge } from '../../components/ui'
import { toast } from '../../components/ui'
import {
  useEmployeeDocuments,
  useUploadDocument,
  useDeleteDocument,
  useEmployees,
  type EmployeeDocument,
} from '../../api/hr'

const DOCUMENT_TYPES = [
  { value: 'contract', label: 'Contract' },
  { value: 'id_copy', label: 'ID Copy' },
  { value: 'tax_form', label: 'Tax Form' },
  { value: 'certification', label: 'Certification' },
  { value: 'resume', label: 'Resume' },
  { value: 'offer_letter', label: 'Offer Letter' },
  { value: 'nda', label: 'NDA' },
  { value: 'other', label: 'Other' },
]

export default function EmployeeDocumentsPage() {
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const { data: empData } = useEmployees({ limit: 500 })
  const { data: documents, isLoading } = useEmployeeDocuments(selectedEmployee)
  const uploadDoc = useUploadDocument()
  const deleteDoc = useDeleteDocument()

  const [showUpload, setShowUpload] = useState(false)
  const [uploadForm, setUploadForm] = useState({ title: '', document_type: 'other', expiry_date: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedEmployee || !fileRef.current?.files?.[0]) return

    const formData = new FormData()
    formData.append('file', fileRef.current.files[0])
    formData.append('title', uploadForm.title)
    formData.append('document_type', uploadForm.document_type)
    if (uploadForm.expiry_date) formData.append('expiry_date', uploadForm.expiry_date)

    uploadDoc.mutate(
      { employeeId: selectedEmployee, formData },
      {
        onSuccess: () => {
          toast('success', 'Document uploaded')
          setShowUpload(false)
          setUploadForm({ title: '', document_type: 'other', expiry_date: '' })
        },
        onError: () => toast('error', 'Failed to upload document'),
      }
    )
  }

  function handleDelete(doc: EmployeeDocument) {
    if (!window.confirm(`Delete "${doc.title}"?`)) return
    deleteDoc.mutate(
      { employeeId: selectedEmployee, documentId: doc.id },
      {
        onSuccess: () => toast('success', 'Document deleted'),
        onError: () => toast('error', 'Failed to delete document'),
      }
    )
  }

  function isExpiringSoon(date: string | null): boolean {
    if (!date) return false
    const d = new Date(date)
    const now = new Date()
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff > 0 && diff <= 30
  }

  function isExpired(date: string | null): boolean {
    if (!date) return false
    return new Date(date) < new Date()
  }

  const columns = [
    {
      key: 'title',
      label: 'Document',
      render: (d: EmployeeDocument) => (
        <div>
          <p className="font-medium text-gray-900">{d.title}</p>
          <p className="text-xs text-gray-400">{d.file_name} ({(d.file_size / 1024).toFixed(1)} KB)</p>
        </div>
      ),
    },
    {
      key: 'document_type',
      label: 'Type',
      render: (d: EmployeeDocument) => (
        <Badge variant="primary">{d.document_type.replace('_', ' ')}</Badge>
      ),
    },
    {
      key: 'expiry_date',
      label: 'Expiry',
      render: (d: EmployeeDocument) => {
        if (!d.expiry_date) return <span className="text-gray-400">N/A</span>
        if (isExpired(d.expiry_date)) return <Badge variant="danger">Expired {new Date(d.expiry_date).toLocaleDateString()}</Badge>
        if (isExpiringSoon(d.expiry_date)) return <Badge variant="warning">Expires {new Date(d.expiry_date).toLocaleDateString()}</Badge>
        return new Date(d.expiry_date).toLocaleDateString()
      },
    },
    {
      key: 'uploaded_by_name',
      label: 'Uploaded By',
      render: (d: EmployeeDocument) => d.uploaded_by_name ?? '-',
    },
    {
      key: 'created_at',
      label: 'Uploaded',
      render: (d: EmployeeDocument) => new Date(d.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      render: (d: EmployeeDocument) => (
        <div className="flex items-center justify-end gap-2">
          <a href={d.file_url} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm">Download</Button>
          </a>
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDelete(d)}>Delete</Button>
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Documents</h1>
          <p className="text-sm text-gray-500 mt-1">Document vault for employee records</p>
        </div>
        <Button onClick={() => setShowUpload(true)} disabled={!selectedEmployee}>Upload Document</Button>
      </div>

      <div className="flex gap-3">
        <Select
          label="Select Employee"
          options={[
            { value: '', label: 'Choose an employee...' },
            ...(empData?.items?.map((e) => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })) ?? []),
          ]}
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
          className="w-72"
        />
      </div>

      {!selectedEmployee ? (
        <Card>
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg font-medium">Select an employee</p>
            <p className="text-sm mt-1">Choose an employee above to view and manage their documents</p>
          </div>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {documents && documents.some((d) => isExpired(d.expiry_date) || isExpiringSoon(d.expiry_date)) && (
            <Card className="border-warning bg-orange-50">
              <div className="flex items-start gap-3">
                <span className="text-warning text-xl">!</span>
                <div>
                  <p className="font-medium text-orange-800">Document Expiry Warnings</p>
                  <ul className="mt-1 text-sm text-orange-700 space-y-1">
                    {documents.filter((d) => isExpired(d.expiry_date)).map((d) => (
                      <li key={d.id}>{d.title} - <span className="font-semibold">EXPIRED</span></li>
                    ))}
                    {documents.filter((d) => isExpiringSoon(d.expiry_date)).map((d) => (
                      <li key={d.id}>{d.title} - Expires {new Date(d.expiry_date!).toLocaleDateString()}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          )}
          <Card padding={false}>
            <Table
              columns={columns}
              data={documents ?? []}
              keyExtractor={(d) => d.id}
              emptyText="No documents found for this employee."
            />
          </Card>
        </>
      )}

      <Modal open={showUpload} onClose={() => setShowUpload(false)} title="Upload Document">
        <form onSubmit={handleUpload} className="space-y-4">
          <Input
            label="Title"
            required
            value={uploadForm.title}
            onChange={(e) => setUploadForm((p) => ({ ...p, title: e.target.value }))}
          />
          <Select
            label="Document Type"
            options={DOCUMENT_TYPES}
            value={uploadForm.document_type}
            onChange={(e) => setUploadForm((p) => ({ ...p, document_type: e.target.value }))}
          />
          <Input
            label="Expiry Date (optional)"
            type="date"
            value={uploadForm.expiry_date}
            onChange={(e) => setUploadForm((p) => ({ ...p, expiry_date: e.target.value }))}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">File</label>
            <input
              ref={fileRef}
              type="file"
              required
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-[10px] file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button type="submit" loading={uploadDoc.isPending}>Upload</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

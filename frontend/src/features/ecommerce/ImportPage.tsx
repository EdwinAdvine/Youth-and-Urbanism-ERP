import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Button, Card, Badge, Table, Spinner, toast } from '../../components/ui'

// ─── Types ───────────────────────────────────────────────────────────────────

type Platform = 'shopify' | 'woocommerce' | 'bigcommerce' | 'magento' | 'csv'

interface FieldMapping {
  source: string
  target: string
}

interface ImportJob {
  id: string
  platform: Platform
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress_pct: number
  imported_products: number
  imported_customers: number
  imported_orders: number
  started_at: string
  error_message: string | null
}

interface StartImportPayload {
  platform: Platform
  file_key: string
  field_mappings: FieldMapping[]
}

// ─── API ─────────────────────────────────────────────────────────────────────

const fetchImportJobs = (): Promise<ImportJob[]> =>
  axios.get('/api/v1/ecommerce/imports').then((r) => r.data)

const uploadImportFile = (file: File): Promise<{ file_key: string; detected_fields: string[] }> => {
  const fd = new FormData()
  fd.append('file', file)
  return axios.post('/api/v1/ecommerce/imports/upload', fd).then((r) => r.data)
}

const startImport = (payload: StartImportPayload): Promise<ImportJob> =>
  axios.post('/api/v1/ecommerce/imports/start', payload).then((r) => r.data)

// ─── Platform cards ───────────────────────────────────────────────────────────

const PLATFORMS: { id: Platform; label: string; color: string; description: string }[] = [
  { id: 'shopify',      label: 'Shopify',      color: '#96bf48', description: 'Export via CSV / JSON admin export' },
  { id: 'woocommerce',  label: 'WooCommerce',  color: '#7f54b3', description: 'WooCommerce CSV / REST export' },
  { id: 'bigcommerce',  label: 'BigCommerce',  color: '#34313f', description: 'BigCommerce product CSV export' },
  { id: 'magento',      label: 'Magento',      color: '#ee672f', description: 'Magento data migration CSV' },
  { id: 'csv',          label: 'Generic CSV',  color: '#3ec9d6', description: 'Any custom CSV or JSON file' },
]

const TARGET_FIELDS = [
  'name', 'sku', 'price', 'compare_price', 'description', 'category',
  'stock_quantity', 'weight', 'image_url', 'status', 'tags',
  'customer_email', 'customer_name', 'customer_phone',
  'order_number', 'order_total', 'order_status', 'order_date',
]

const STATUS_COLORS: Record<ImportJob['status'], 'default' | 'info' | 'success' | 'danger'> = {
  pending: 'default',
  running: 'info',
  completed: 'success',
  failed: 'danger',
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ImportPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [fileKey, setFileKey] = useState<string | null>(null)
  const [_detectedFields, setDetectedFields] = useState<string[]>([])
  const [mappings, setMappings] = useState<FieldMapping[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null)

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['import-jobs'],
    queryFn: fetchImportJobs,
    refetchInterval: activeJob?.status === 'running' ? 2000 : false,
  })

  const uploadMutation = useMutation({
    mutationFn: uploadImportFile,
    onSuccess: (data) => {
      setFileKey(data.file_key)
      setDetectedFields(data.detected_fields)
      setMappings(data.detected_fields.map((f) => ({ source: f, target: '' })))
      setStep(3)
    },
    onError: () => toast('error', 'File upload failed. Please try again.'),
  })

  const importMutation = useMutation({
    mutationFn: startImport,
    onSuccess: (job) => {
      setActiveJob(job)
      qc.invalidateQueries({ queryKey: ['import-jobs'] })
      setStep(5)
    },
    onError: () => toast('error', 'Failed to start import.'),
  })

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadMutation.mutate(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadMutation.mutate(file)
  }

  function handleStartImport() {
    if (!platform || !fileKey) return
    importMutation.mutate({ platform, file_key: fileKey, field_mappings: mappings.filter((m) => m.target) })
  }

  const STEPS = ['Platform', 'Upload', 'Map Fields', 'Review', 'Import']

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Data Import</h1>
        <p className="text-sm text-gray-500 mt-1">Migrate products, customers, and orders from another platform</p>
      </div>

      {/* Step Indicator */}
      <Card>
        <div className="flex items-center justify-between">
          {STEPS.map((label, i) => {
            const s = (i + 1) as typeof step
            const done = step > s
            const active = step === s
            return (
              <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    done ? 'bg-success text-white' : active ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {done ? '✓' : s}
                  </div>
                  <span className={`text-sm font-medium ${active ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
                </div>
                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-100 mx-3" />}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Step 1: Platform */}
      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Choose your platform</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {PLATFORMS.map((p) => (
              <Card key={p.id} onClick={() => { setPlatform(p.id); setStep(2) }}
                className={`cursor-pointer border-2 transition-all ${platform === p.id ? 'border-primary' : 'border-transparent hover:border-gray-200'}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: p.color }}>
                    {p.label.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{p.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Upload */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Upload your export file</h2>
          <div
            className={`border-2 border-dashed rounded-[10px] p-12 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
          >
            {uploadMutation.isPending ? (
              <div className="flex flex-col items-center gap-3">
                <Spinner size="lg" />
                <p className="text-sm text-gray-500">Uploading and detecting fields...</p>
              </div>
            ) : (
              <>
                <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-gray-600 font-medium">Drop your .csv or .json file here</p>
                <p className="text-xs text-gray-400 mt-1">or</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => fileRef.current?.click()}>Browse File</Button>
                <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={handleFileInput} />
                <p className="text-xs text-gray-400 mt-3">Accepts: .csv, .json — max 50 MB</p>
              </>
            )}
          </div>
          <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
        </div>
      )}

      {/* Step 3: Map Fields */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Map fields</h2>
          <p className="text-sm text-gray-500">Match your file's columns to Urban Vibes Dynamics fields.</p>
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source Column</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Maps To</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m, i) => (
                    <tr key={m.source} className="border-b border-gray-50">
                      <td className="px-4 py-2.5 font-mono text-gray-700 text-xs">{m.source}</td>
                      <td className="px-4 py-2.5">
                        <select
                          className="rounded-[10px] border border-gray-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                          value={m.target}
                          onChange={(e) => {
                            const updated = [...mappings]
                            updated[i] = { ...m, target: e.target.value }
                            setMappings(updated)
                          }}
                        >
                          <option value="">— skip —</option>
                          {TARGET_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={() => setStep(4)}>Continue to Review</Button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Review import settings</h2>
          <Card>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Platform</dt>
                <dd className="font-medium text-gray-900 capitalize">{platform}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Mapped fields</dt>
                <dd className="font-medium text-gray-900">{mappings.filter((m) => m.target).length} / {mappings.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Skipped fields</dt>
                <dd className="font-medium text-gray-500">{mappings.filter((m) => !m.target).length}</dd>
              </div>
            </dl>
          </Card>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(3)}>Back</Button>
            <Button loading={importMutation.isPending} onClick={handleStartImport}>Start Import</Button>
          </div>
        </div>
      )}

      {/* Step 5: Progress */}
      {step === 5 && activeJob && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Import in progress</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Overall progress</span>
                <span>{activeJob.progress_pct.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${activeJob.progress_pct}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Products', value: activeJob.imported_products },
                { label: 'Customers', value: activeJob.imported_customers },
                { label: 'Orders', value: activeJob.imported_orders },
              ].map((s) => (
                <div key={s.label} className="text-center p-4 bg-gray-50 rounded-[10px]">
                  <p className="text-2xl font-bold text-primary">{s.value.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            <Badge variant={STATUS_COLORS[activeJob.status]} className="capitalize">{activeJob.status}</Badge>
          </div>
        </Card>
      )}

      {/* Import History */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Import History</h2>
        <Card padding={false}>
          <Table<ImportJob>
            loading={jobsLoading}
            keyExtractor={(j) => j.id}
            emptyText="No import jobs yet."
            data={jobs}
            columns={[
              { key: 'platform', label: 'Platform', render: (j) => <span className="capitalize font-medium text-gray-800">{j.platform}</span> },
              { key: 'status', label: 'Status', render: (j) => <Badge variant={STATUS_COLORS[j.status]} className="capitalize">{j.status}</Badge> },
              { key: 'progress', label: 'Progress', render: (j) => (
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-100 rounded-full h-1.5">
                    <div className="bg-primary h-full rounded-full" style={{ width: `${j.progress_pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500">{j.progress_pct.toFixed(0)}%</span>
                </div>
              )},
              { key: 'imported', label: 'Imported', render: (j) => (
                <span className="text-xs text-gray-600">
                  {j.imported_products}P / {j.imported_customers}C / {j.imported_orders}O
                </span>
              )},
              { key: 'started_at', label: 'Started', render: (j) => <span className="text-xs text-gray-400">{new Date(j.started_at).toLocaleString()}</span> },
            ]}
          />
        </Card>
      </div>
    </div>
  )
}

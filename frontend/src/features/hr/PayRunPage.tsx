import { useState } from 'react'
import { Button, Card, Input, Modal, Spinner, Badge, toast } from '../../components/ui'
import {
  usePayRuns,
  usePayRun,
  useGeneratePayRun,
  useApprovePayRun,
  useProcessPayRun,
  useSalaryStructures,
} from '../../api/hr'

function formatCurrency(amount: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount))
}

const STATUS_BADGE: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  draft: 'default',
  generated: 'info',
  reviewed: 'warning',
  approved: 'success',
  processed: 'success',
}

export default function PayRunPage() {
  const { data: payRuns, isLoading } = usePayRuns()
  const generatePayRun = useGeneratePayRun()
  const approvePayRun = useApprovePayRun()
  const processPayRun = useProcessPayRun()
  const { data: structures } = useSalaryStructures()

  // Generate modal
  const [showGenerate, setShowGenerate] = useState(false)
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [structureId, setStructureId] = useState('')

  // Detail view
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data: detail, isLoading: detailLoading } = usePayRun(selectedId ?? '')

  async function handleGenerate() {
    if (!periodStart || !periodEnd) {
      toast('warning', 'Period start and end are required')
      return
    }
    try {
      const result = await generatePayRun.mutateAsync({
        period_start: periodStart,
        period_end: periodEnd,
        salary_structure_id: structureId || null,
      })
      toast('success', `Pay run generated with ${result.payslips_generated} payslips`)
      setShowGenerate(false)
    } catch {
      toast('error', 'Failed to generate pay run')
    }
  }

  async function handleApprove(id: string) {
    try {
      await approvePayRun.mutateAsync(id)
      toast('success', 'Pay run approved')
    } catch {
      toast('error', 'Failed to approve')
    }
  }

  async function handleProcess(id: string) {
    try {
      await processPayRun.mutateAsync(id)
      toast('success', 'Pay run processed - payments disbursed')
    } catch {
      toast('error', 'Failed to process')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pay Runs</h1>
          <p className="text-sm text-gray-500 mt-1">Generate, review, approve, and process payroll batches</p>
        </div>
        <Button size="sm" onClick={() => { setPeriodStart(''); setPeriodEnd(''); setStructureId(''); setShowGenerate(true) }}>
          Generate Pay Run
        </Button>
      </div>

      {/* Pay Runs List */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Pay Run History</h2>
        </div>
        {!payRuns || payRuns.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No pay runs yet. Generate one to get started.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {payRuns.map((pr) => (
              <div
                key={pr.id}
                className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${selectedId === pr.id ? 'bg-primary/5' : ''}`}
                onClick={() => setSelectedId(pr.id)}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(pr.period_start).toLocaleDateString()} - {new Date(pr.period_end).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    Gross: {formatCurrency(pr.total_gross)} | Net: {formatCurrency(pr.total_net)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={STATUS_BADGE[pr.status] ?? 'default'}>{pr.status}</Badge>
                  {pr.status === 'generated' && (
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleApprove(pr.id) }} loading={approvePayRun.isPending}>
                      Approve
                    </Button>
                  )}
                  {pr.status === 'approved' && (
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); handleProcess(pr.id) }} loading={processPayRun.isPending}>
                      Process
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Detail View */}
      {selectedId && (
        <Card>
          {detailLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : detail ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Pay Run: {new Date(detail.period_start).toLocaleDateString()} - {new Date(detail.period_end).toLocaleDateString()}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Status: {detail.status} | Created: {new Date(detail.created_at).toLocaleDateString()}
                    {detail.processed_at && ` | Processed: ${new Date(detail.processed_at).toLocaleDateString()}`}
                  </p>
                </div>
                <Badge variant={STATUS_BADGE[detail.status] ?? 'default'}>{detail.status}</Badge>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-green-50 rounded-[10px] p-3 text-center">
                  <p className="text-xs text-green-600 font-medium">Total Gross</p>
                  <p className="text-lg font-bold text-green-700">{formatCurrency(detail.total_gross)}</p>
                </div>
                <div className="bg-red-50 rounded-[10px] p-3 text-center">
                  <p className="text-xs text-red-600 font-medium">Total Deductions</p>
                  <p className="text-lg font-bold text-red-700">{formatCurrency(detail.total_deductions)}</p>
                </div>
                <div className="bg-blue-50 rounded-[10px] p-3 text-center">
                  <p className="text-xs text-blue-600 font-medium">Total Net</p>
                  <p className="text-lg font-bold text-blue-700">{formatCurrency(detail.total_net)}</p>
                </div>
              </div>

              {/* Payslips */}
              {detail.payslips && detail.payslips.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Employee</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Gross</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Deductions</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Net</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.payslips.map((p) => (
                        <tr key={p.id} className="border-b border-gray-50">
                          <td className="py-2 px-3 text-gray-700 font-mono text-xs">{p.employee_id.slice(0, 8)}...</td>
                          <td className="py-2 px-3 text-right text-green-600">{formatCurrency(p.gross_pay)}</td>
                          <td className="py-2 px-3 text-right text-red-600">{formatCurrency(p.deductions_total)}</td>
                          <td className="py-2 px-3 text-right font-medium text-gray-900">{formatCurrency(p.net_pay)}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant={STATUS_BADGE[p.status] ?? 'default'}>{p.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </Card>
      )}

      {/* Generate Modal */}
      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Pay Run">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Period Start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            <Input label="Period End" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salary Structure (optional)</label>
            <select
              className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm"
              value={structureId}
              onChange={(e) => setStructureId(e.target.value)}
            >
              <option value="">Use employee base salary</option>
              {(structures ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name} (Base: {formatCurrency(s.base_salary)})</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-500">
            This will generate payslips for all active employees, applying configured tax brackets and statutory deductions.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button size="sm" onClick={handleGenerate} loading={generatePayRun.isPending}>Generate</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

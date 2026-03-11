import { useParams, useNavigate } from 'react-router-dom'
import { Button, Badge, Card, Spinner, toast } from '../../components/ui'
import {
  usePayslipDetail,
  useApprovePayslip,
  useMarkPayslipPaid,
  useEmployee,
  useSalaryStructures,
} from '../../api/hr'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

const PAYSLIP_BADGE: Record<string, 'default' | 'info' | 'success'> = {
  draft: 'default',
  approved: 'info',
  paid: 'success',
}

// ─── Key–Value breakdown table ────────────────────────────────────────────────

function KVTable({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data)
  if (entries.length === 0) return <p className="text-sm text-gray-400">—</p>
  return (
    <table className="w-full text-sm">
      <tbody>
        {entries.map(([key, val]) => (
          <tr key={key} className="border-b border-gray-50 last:border-0">
            <td className="py-2 text-gray-600 capitalize">{key}</td>
            <td className="py-2 text-right font-medium text-gray-900">{formatCurrency(val)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── PayslipDetail ────────────────────────────────────────────────────────────

export default function PayslipDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: payslip, isLoading, error } = usePayslipDetail(id)
  const { data: employee } = useEmployee(payslip?.employee_id ?? '')
  const { data: structures } = useSalaryStructures()

  const approveMut = useApprovePayslip()
  const markPaidMut = useMarkPayslipPaid()

  const structure = structures?.find((s) => s.id === payslip?.salary_structure_id) ?? null

  async function handleApprove() {
    try {
      await approveMut.mutateAsync(id)
      toast('success', 'Payslip approved')
    } catch {
      toast('error', 'Failed to approve payslip')
    }
  }

  async function handleMarkPaid() {
    try {
      await markPaidMut.mutateAsync(id)
      toast('success', 'Payslip marked as paid')
    } catch {
      toast('error', 'Failed to update payslip')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !payslip) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-500">Payslip not found.</p>
        <Button variant="outline" onClick={() => navigate('/hr/payroll')}>
          Back to Payroll
        </Button>
      </div>
    )
  }

  const employeeName = employee
    ? `${employee.first_name} ${employee.last_name}`
    : payslip.employee_id

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Back */}
      <button
        onClick={() => navigate('/hr/payroll')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Payroll
      </button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{employeeName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {formatDate(payslip.period_start)} – {formatDate(payslip.period_end)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Generated {formatDate(payslip.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={PAYSLIP_BADGE[payslip.status] ?? 'default'} className="text-sm px-3 py-1">
            {payslip.status.charAt(0).toUpperCase() + payslip.status.slice(1)}
          </Badge>
          {payslip.status === 'draft' && (
            <Button onClick={handleApprove} loading={approveMut.isPending}>
              Approve
            </Button>
          )}
          {payslip.status === 'approved' && (
            <Button variant="secondary" onClick={handleMarkPaid} loading={markPaidMut.isPending}>
              Mark Paid
            </Button>
          )}
        </div>
      </div>

      {/* Summary totals */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Gross Pay</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(payslip.gross_pay)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Deductions</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(payslip.deductions_total)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Net Pay</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(payslip.net_pay)}</p>
        </Card>
      </div>

      {/* Breakdown */}
      <Card>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Pay Breakdown</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Allowances */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Allowances
            </h3>
            {structure?.allowances && Object.keys(structure.allowances).length > 0 ? (
              <KVTable data={structure.allowances} />
            ) : (
              <p className="text-sm text-gray-400">—</p>
            )}
          </div>

          {/* Deductions */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Deductions
            </h3>
            {structure?.deductions && Object.keys(structure.deductions).length > 0 ? (
              <KVTable data={structure.deductions} />
            ) : (
              <p className="text-sm text-gray-400">—</p>
            )}
          </div>
        </div>

        {/* Net Pay footer */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-700">Net Pay</span>
          <span className="text-xl font-bold text-green-600">{formatCurrency(payslip.net_pay)}</span>
        </div>
      </Card>

      {/* Structure info */}
      {structure && (
        <div className="mt-4 text-xs text-gray-400">
          Salary structure: <span className="font-medium text-gray-600">{structure.name}</span>
          {' '} · Base: <span className="font-medium text-gray-600">{formatCurrency(structure.base_salary)}</span>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { Button, Card, Input, Spinner, Badge, toast } from '../../components/ui'
import {
  useBankStatements,
  useBankStatement,
  useImportBankStatement,
  useAutoMatchStatement,
  useReconcileStatement,
  useAccounts,
} from '../../api/finance'

function formatCurrency(amount: number | string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount))
}

export default function BankReconciliationPage() {
  const { data: accounts } = useAccounts()
  const { data: statements, isLoading } = useBankStatements()
  const importStatement = useImportBankStatement()
  const autoMatch = useAutoMatchStatement()
  const reconcile = useReconcileStatement()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data: detail, isLoading: detailLoading } = useBankStatement(selectedId ?? '')

  // Import form
  const [showImport, setShowImport] = useState(false)
  const [importAccountId, setImportAccountId] = useState('')
  const [importDate, setImportDate] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)

  async function handleImport() {
    if (!importAccountId || !importDate || !importFile) {
      toast('warning', 'All fields are required')
      return
    }
    try {
      const result = await importStatement.mutateAsync({
        accountId: importAccountId,
        statementDate: importDate,
        file: importFile,
      })
      toast('success', `Imported ${result.lines_imported} lines`)
      setShowImport(false)
      setImportFile(null)
    } catch {
      toast('error', 'Import failed')
    }
  }

  async function handleAutoMatch(id: string) {
    try {
      const result = await autoMatch.mutateAsync(id)
      toast('success', `Matched ${result.matched} of ${result.total_lines} lines`)
      setSelectedId(id) // Refresh detail
    } catch {
      toast('error', 'Auto-match failed')
    }
  }

  async function handleReconcile(id: string) {
    try {
      await reconcile.mutateAsync({ statementId: id })
      toast('success', 'Statement reconciled')
    } catch {
      toast('error', 'Reconciliation failed')
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bank Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-1">Import statements, match payments, and reconcile</p>
        </div>
        <Button size="sm" onClick={() => setShowImport(!showImport)}>
          Import Statement
        </Button>
      </div>

      {/* Import Form */}
      {showImport && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Import Bank Statement (CSV)</h3>
          <p className="text-xs text-gray-500 mb-4">CSV must have columns: date, description, amount</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account</label>
              <select
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                value={importAccountId}
                onChange={(e) => setImportAccountId(e.target.value)}
              >
                <option value="">Select account...</option>
                {(accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
            </div>
            <Input label="Statement Date" type="date" value={importDate} onChange={(e) => setImportDate(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CSV File</label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-[10px] file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" size="sm" onClick={() => setShowImport(false)}>Cancel</Button>
            <Button size="sm" onClick={handleImport} loading={importStatement.isPending}>Upload & Import</Button>
          </div>
        </Card>
      )}

      {/* Statements List */}
      <Card padding={false}>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Statements</h2>
        </div>
        {!statements || statements.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No statements imported yet</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {statements.map((s) => (
              <div
                key={s.id}
                className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${selectedId === s.id ? 'bg-primary/5' : ''}`}
                onClick={() => setSelectedId(s.id)}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {new Date(s.statement_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p className="text-xs text-gray-500">{s.line_count} lines, {s.matched_count} matched</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatCurrency(s.closing_balance)}</span>
                  {s.is_reconciled ? (
                    <Badge variant="success">Reconciled</Badge>
                  ) : (
                    <Badge variant="warning">Pending</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Statement Detail */}
      {selectedId && (
        <Card>
          {detailLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : detail ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Statement - {detail.account_name ?? 'Unknown Account'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Date: {detail.statement_date} | Opening: {formatCurrency(detail.opening_balance)} | Closing: {formatCurrency(detail.closing_balance)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!detail.is_reconciled && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleAutoMatch(selectedId)} loading={autoMatch.isPending}>
                        Auto Match
                      </Button>
                      <Button size="sm" onClick={() => handleReconcile(selectedId)} loading={reconcile.isPending}>
                        Reconcile
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Lines table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.lines ?? []).map((line) => (
                      <tr key={line.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-300">{line.date}</td>
                        <td className="py-2 px-3 text-gray-700 dark:text-gray-300 max-w-xs truncate">{line.description}</td>
                        <td className={`py-2 px-3 text-right font-medium ${Number(line.amount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(line.amount)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant={line.status === 'matched' ? 'success' : line.status === 'excluded' ? 'default' : 'warning'}>
                            {line.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </Card>
      )}
    </div>
  )
}

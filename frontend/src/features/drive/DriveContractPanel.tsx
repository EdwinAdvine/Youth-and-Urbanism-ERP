import { useState } from 'react'
import { Card, Button, Spinner, Badge } from '../../components/ui'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ContractMetadata {
  id: string
  file_id: string
  file_name?: string
  parties: string[]
  effective_date?: string
  expiry_date?: string
  renewal_date?: string
  contract_value?: number
  currency?: string
  key_obligations?: string[]
  governing_law?: string
  auto_renews?: boolean
  notice_period_days?: number
  confidence_score?: number
  analysed_at?: string
}

interface UpcomingContract {
  file_id: string
  file_name: string
  expiry_date?: string
  renewal_date?: string
  days_until_expiry?: number
  days_until_renewal?: number
  parties: string[]
  contract_value?: number
  currency?: string
}

// ─── API hooks ────────────────────────────────────────────────────────────────

function useUpcomingContracts(daysAhead = 90) {
  return useQuery({
    queryKey: ['drive', 'contracts', daysAhead],
    queryFn: async () => {
      const res = await axios.get(`/api/v1/drive/contracts?days_ahead=${daysAhead}`)
      return res.data as { contracts: UpcomingContract[]; total: number }
    },
  })
}

function useContractMetadata(fileId: string) {
  return useQuery({
    queryKey: ['drive', 'contract', fileId],
    queryFn: async () => {
      const res = await axios.get(`/api/v1/drive/files/${fileId}/contract`)
      return res.data as ContractMetadata
    },
    enabled: !!fileId,
    retry: false,
  })
}

function useAnalyseContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fileId: string) =>
      axios.post(`/api/v1/drive/files/${fileId}/contract/analyse`).then(r => r.data),
    onSuccess: (_data, fileId) => {
      qc.invalidateQueries({ queryKey: ['drive', 'contract', fileId] })
      qc.invalidateQueries({ queryKey: ['drive', 'contracts'] })
    },
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysLabel(days?: number) {
  if (days == null) return '—'
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Today'
  return `${days}d`
}

function urgencyVariant(days?: number): 'danger' | 'warning' | 'default' {
  if (days == null) return 'default'
  if (days < 0 || days <= 14) return 'danger'
  if (days <= 30) return 'warning'
  return 'default'
}

// ─── Contract detail view ─────────────────────────────────────────────────────

function ContractDetail({ fileId, onBack }: { fileId: string; onBack: () => void }) {
  const { data, isLoading, isError } = useContractMetadata(fileId)
  const analyse = useAnalyseContract()

  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString() : '—'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          ← Back
        </button>
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate flex-1">
          Contract Intelligence
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => analyse.mutate(fileId)}
          loading={analyse.isPending}
        >
          ✨ Re-Analyse
        </Button>
      </div>

      {isLoading && <div className="flex justify-center py-12"><Spinner /></div>}

      {isError && !data && (
        <Card>
          <div className="text-center py-10">
            <p className="text-4xl mb-3">📄</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No contract data yet</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">Run AI analysis to extract contract terms.</p>
            <Button onClick={() => analyse.mutate(fileId)} loading={analyse.isPending}>
              ✨ Analyse Contract
            </Button>
          </div>
        </Card>
      )}

      {data && (
        <>
          {/* Key dates */}
          <Card>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Key Dates</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Effective', value: fmt(data.effective_date) },
                { label: 'Expiry', value: fmt(data.expiry_date) },
                { label: 'Renewal', value: fmt(data.renewal_date) },
              ].map(({ label, value }) => (
                <div key={label} className="text-center p-2 bg-gray-50 dark:bg-gray-900 rounded-[8px]">
                  <p className="text-[11px] text-gray-400">{label}</p>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Value + auto-renew */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <p className="text-xs text-gray-500">Contract Value</p>
              <p className="text-xl font-bold text-[#51459d] mt-0.5">
                {data.contract_value != null
                  ? `${data.currency ?? 'USD'} ${data.contract_value.toLocaleString()}`
                  : '—'}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-gray-500">Auto-Renews</p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="text-xl">{data.auto_renews ? '🔄' : '🚫'}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {data.auto_renews ? 'Yes' : 'No'}
                </span>
              </div>
              {data.notice_period_days != null && (
                <p className="text-[11px] text-gray-400 mt-1">{data.notice_period_days}d notice required</p>
              )}
            </Card>
          </div>

          {/* Parties */}
          {data.parties.length > 0 && (
            <Card>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Parties</p>
              <div className="flex flex-wrap gap-1.5">
                {data.parties.map((p, i) => (
                  <span key={i} className="text-xs bg-[#51459d]/10 text-[#51459d] px-2.5 py-1 rounded-full">{p}</span>
                ))}
              </div>
            </Card>
          )}

          {/* Key obligations */}
          {data.key_obligations && data.key_obligations.length > 0 && (
            <Card>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Key Obligations</p>
              <ul className="space-y-1.5">
                {data.key_obligations.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <span className="mt-0.5 text-[#51459d] shrink-0">•</span>
                    {o}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            {data.governing_law && <span>Governing law: {data.governing_law}</span>}
            {data.confidence_score != null && (
              <span>AI confidence: {Math.round(data.confidence_score * 100)}%</span>
            )}
            {data.analysed_at && <span>Analysed {new Date(data.analysed_at).toLocaleDateString()}</span>}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function DriveContractPanel() {
  const [daysAhead, setDaysAhead] = useState(90)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)

  const { data, isLoading } = useUpcomingContracts(daysAhead)

  if (selectedFileId) {
    return <ContractDetail fileId={selectedFileId} onBack={() => setSelectedFileId(null)} />
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Contract Intelligence</h2>
        <p className="text-sm text-gray-500 mt-0.5">AI-extracted terms, key dates, and upcoming renewals</p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Show contracts expiring within:</span>
        {([30, 60, 90, 180] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDaysAhead(d)}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
              daysAhead === d
                ? 'bg-[#51459d] text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : !data?.contracts.length ? (
        <Card>
          <div className="text-center py-10">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No upcoming contract dates</p>
            <p className="text-xs text-gray-400 mt-1">
              Upload contract PDFs and run AI analysis to track key dates.
            </p>
          </div>
        </Card>
      ) : (
        <Card padding={false}>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {data.contracts.map((contract) => {
              const daysExp = contract.days_until_expiry
              const daysRen = contract.days_until_renewal
              const urgentDays = daysExp ?? daysRen
              return (
                <div
                  key={contract.file_id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-[8px] bg-[#51459d]/10 flex items-center justify-center text-lg shrink-0">
                    📋
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {contract.file_name}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {contract.parties.slice(0, 2).join(' · ')}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {daysExp != null && (
                        <Badge variant={urgencyVariant(daysExp)}>
                          Expires {daysLabel(daysExp)}
                        </Badge>
                      )}
                      {daysRen != null && (
                        <Badge variant={urgencyVariant(daysRen)}>
                          Renews {daysLabel(daysRen)}
                        </Badge>
                      )}
                      {contract.contract_value != null && (
                        <span className="text-[11px] text-gray-400">
                          {contract.currency ?? 'USD'} {contract.contract_value.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedFileId(contract.file_id)}
                  >
                    View
                  </Button>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-[10px] p-4">
        <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">How it works</p>
        <ul className="text-xs text-purple-600 dark:text-purple-400 space-y-1 list-disc list-inside">
          <li>Upload a PDF contract and open its Contract Intelligence view</li>
          <li>Click "Analyse Contract" to extract parties, dates, value, and obligations via AI</li>
          <li>Receive alerts 30/14/7 days before expiry or renewal</li>
          <li>All analysis runs locally on Ollama — no data leaves your server</li>
        </ul>
      </div>
    </div>
  )
}

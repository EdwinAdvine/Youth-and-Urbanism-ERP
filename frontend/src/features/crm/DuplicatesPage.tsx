import { useState } from 'react'
import {
  useDuplicates,
  useDetectDuplicates,
  useDismissDuplicate,
  type DuplicateCandidate,
} from '@/api/crm_v2'
import { Button, Badge, Card, Spinner, Select, toast } from '@/components/ui'
import ContactMergeDialog from './components/ContactMergeDialog'

export default function DuplicatesPage() {
  const [statusFilter, setStatusFilter] = useState('pending')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useDuplicates(statusFilter, page)
  const detectMutation = useDetectDuplicates()
  const dismissMutation = useDismissDuplicate()
  const [mergeCandidate, setMergeCandidate] = useState<DuplicateCandidate | null>(null)

  const candidates: DuplicateCandidate[] = data?.items ?? data ?? []

  const handleDetect = async () => {
    try {
      const result = await detectMutation.mutateAsync()
      toast('success', `Detection complete. Found ${result?.new_candidates ?? 0} new candidates.`)
    } catch {
      toast('error', 'Failed to run duplicate detection')
    }
  }

  const handleDismiss = async (id: string) => {
    try {
      await dismissMutation.mutateAsync(id)
      toast('info', 'Duplicate dismissed')
    } catch {
      toast('error', 'Failed to dismiss duplicate')
    }
  }

  const confidenceColor = (score: number) => {
    if (score >= 0.9) return 'danger'
    if (score >= 0.7) return 'warning'
    return 'info'
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Duplicate Contacts
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review and merge duplicate contact records
          </p>
        </div>
        <Button onClick={handleDetect} loading={detectMutation.isPending}>
          Run Detection
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select
          label="Status"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'merged', label: 'Merged' },
            { value: 'dismissed', label: 'Dismissed' },
            { value: '', label: 'All' },
          ]}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : candidates.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-400">No duplicate candidates found.</p>
          <Button variant="secondary" className="mt-4" onClick={handleDetect} loading={detectMutation.isPending}>
            Scan for Duplicates
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {candidates.map((c) => (
            <Card key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Contact A */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-1">Contact A</p>
                <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                  {c.contact_a_id}
                </p>
                {c.match_fields && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(c.match_fields).map(([field, val]) => (
                      <Badge key={field} variant="default" className="text-[10px]">
                        {field}: {String(val)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Confidence */}
              <div className="flex-shrink-0 text-center px-4">
                <Badge variant={confidenceColor(c.confidence_score)}>
                  {Math.round(c.confidence_score * 100)}% match
                </Badge>
              </div>

              {/* Contact B */}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-1">Contact B</p>
                <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                  {c.contact_b_id}
                </p>
              </div>

              {/* Actions */}
              {c.status === 'pending' && (
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" onClick={() => setMergeCandidate(c)}>
                    Merge
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDismiss(c.id)}
                    loading={dismissMutation.isPending}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
              {c.status !== 'pending' && (
                <Badge variant={c.status === 'merged' ? 'success' : 'default'}>
                  {c.status}
                </Badge>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Merge Dialog */}
      {mergeCandidate && (
        <ContactMergeDialog
          open={!!mergeCandidate}
          onClose={() => setMergeCandidate(null)}
          candidate={mergeCandidate}
        />
      )}
    </div>
  )
}

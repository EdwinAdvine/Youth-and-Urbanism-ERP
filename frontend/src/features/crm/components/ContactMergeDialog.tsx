import { useState } from 'react'
import { useMergeDuplicate, type DuplicateCandidate } from '@/api/crm_v2'
import { Modal, Button, Badge, cn, toast } from '@/components/ui'

interface ContactMergeDialogProps {
  open: boolean
  onClose: () => void
  candidate: DuplicateCandidate
}

export default function ContactMergeDialog({ open, onClose, candidate }: ContactMergeDialogProps) {
  const mergeDuplicate = useMergeDuplicate()
  const [keepContact, setKeepContact] = useState<'a' | 'b'>('a')

  const matchFields = candidate.match_fields ?? {}
  const fieldEntries = Object.entries(matchFields)

  const handleMerge = async () => {
    const keepContactId = keepContact === 'a' ? candidate.contact_a_id : candidate.contact_b_id
    if (!window.confirm('This action will merge the two contacts. The non-kept contact will be removed. Continue?')) return
    try {
      await mergeDuplicate.mutateAsync({
        candidateId: candidate.id,
        keepContactId,
      })
      toast('success', 'Contacts merged successfully')
      onClose()
    } catch {
      toast('error', 'Failed to merge contacts')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Merge Duplicate Contacts" size="xl">
      <div className="space-y-4">
        {/* Confidence */}
        <div className="text-center">
          <Badge
            variant={candidate.confidence_score >= 0.9 ? 'danger' : candidate.confidence_score >= 0.7 ? 'warning' : 'info'}
          >
            {Math.round(candidate.confidence_score * 100)}% confidence match
          </Badge>
        </div>

        {/* Side by side comparison */}
        <div className="grid grid-cols-2 gap-4">
          {/* Contact A */}
          <div
            className={cn(
              'border rounded-[10px] p-4 cursor-pointer transition-all',
              keepContact === 'a'
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            )}
            onClick={() => setKeepContact('a')}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Contact A</h3>
              {keepContact === 'a' && <Badge variant="success">Keep</Badge>}
            </div>
            <p className="text-xs text-gray-500 font-mono break-all">{candidate.contact_a_id}</p>
            {fieldEntries.length > 0 && (
              <div className="mt-3 space-y-2">
                {fieldEntries.map(([field, values]) => {
                  const val = Array.isArray(values) ? values[0] : values
                  return (
                    <div key={field}>
                      <p className="text-[10px] text-gray-400 uppercase">{field}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{String(val ?? '-')}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Contact B */}
          <div
            className={cn(
              'border rounded-[10px] p-4 cursor-pointer transition-all',
              keepContact === 'b'
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            )}
            onClick={() => setKeepContact('b')}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Contact B</h3>
              {keepContact === 'b' && <Badge variant="success">Keep</Badge>}
            </div>
            <p className="text-xs text-gray-500 font-mono break-all">{candidate.contact_b_id}</p>
            {fieldEntries.length > 0 && (
              <div className="mt-3 space-y-2">
                {fieldEntries.map(([field, values]) => {
                  const val = Array.isArray(values) ? values[1] ?? values[0] : values
                  return (
                    <div key={field}>
                      <p className="text-[10px] text-gray-400 uppercase">{field}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{String(val ?? '-')}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Click on the contact you want to keep. The other contact will be merged into it and removed.
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleMerge} loading={mergeDuplicate.isPending}>
            Merge (Keep Contact {keepContact.toUpperCase()})
          </Button>
        </div>
      </div>
    </Modal>
  )
}

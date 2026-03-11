import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Badge, Button, toast } from '../../../components/ui'
import {
  useCandidate,
  useUpdateCandidate,
  useBlacklistCandidate,
  useApplications,
  type CandidateApplication,
} from '@/api/hr_ats'

// ─── Stage badge ──────────────────────────────────────────────────────────────

const STAGE_BADGE_MAP: Record<CandidateApplication['stage'], { variant: 'success' | 'danger' | 'warning' | 'info' | 'primary' | 'default'; label: string }> = {
  applied:   { variant: 'default',  label: 'Applied' },
  screening: { variant: 'info',     label: 'Screening' },
  interview: { variant: 'primary',  label: 'Interview' },
  offer:     { variant: 'warning',  label: 'Offer' },
  hired:     { variant: 'success',  label: 'Hired' },
  rejected:  { variant: 'danger',   label: 'Rejected' },
}

// ─── Source label ─────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  linkedin:     'LinkedIn',
  indeed:       'Indeed',
  referral:     'Referral',
  careers_page: 'Careers Page',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full animate-pulse">
      <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-32 bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700" />
      <div className="h-24 bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700" />
      <div className="h-40 bg-white dark:bg-gray-800 rounded-[10px] border border-gray-100 dark:border-gray-700" />
    </div>
  )
}

// ─── Detail Page ──────────────────────────────────────────────────────────────

export default function CandidateDetail() {
  const { candidateId } = useParams<{ candidateId: string }>()
  const navigate = useNavigate()
  const [notes, setNotes] = useState<string | null>(null)
  const [notesDirty, setNotesDirty] = useState(false)

  const { data: candidate, isLoading, isError } = useCandidate(candidateId ?? '')
  const { data: appData, isLoading: appsLoading } = useApplications({
    page: 1,
    limit: 50,
  })

  // filter applications for this candidate client-side
  // (API doesn't expose candidate_id filter in our hook, so we filter locally)
  const candidateApps = appData?.items.filter((a) => a.candidate_id === candidateId) ?? []

  const updateMut = useUpdateCandidate()
  const blacklistMut = useBlacklistCandidate()

  // Sync notes from server once loaded
  if (candidate && notes === null && !notesDirty) {
    setNotes(candidate.notes ?? '')
  }

  async function handleSaveNotes() {
    if (!candidateId) return
    try {
      await updateMut.mutateAsync({ id: candidateId, notes: notes || null })
      toast('success', 'Notes saved')
      setNotesDirty(false)
    } catch {
      toast('error', 'Failed to save notes')
    }
  }

  async function handleBlacklist() {
    if (!candidateId || !candidate) return
    const name = `${candidate.first_name} ${candidate.last_name}`
    if (!confirm(`Blacklist ${name}? They will no longer be considered for positions.`)) return
    try {
      await blacklistMut.mutateAsync(candidateId)
      toast('success', `${name} blacklisted`)
    } catch {
      toast('error', 'Failed to update blacklist status')
    }
  }

  if (isLoading) return <Skeleton />

  if (isError || !candidate) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-4 min-h-[300px]">
        <p className="text-[#ff3a6e]">Failed to load candidate profile.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    )
  }

  const fullName = `${candidate.first_name} ${candidate.last_name}`
  const initials = `${candidate.first_name[0] ?? ''}${candidate.last_name[0] ?? ''}`.toUpperCase()
  const skills = candidate.skills_extracted ?? []

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-full">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#51459d] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Candidates
      </button>

      {/* Header */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-[#51459d]/10 flex items-center justify-center font-bold text-[#51459d] text-xl flex-shrink-0">
            {initials}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{fullName}</h1>
              {candidate.is_blacklisted && <Badge variant="danger">Blacklisted</Badge>}
              {candidate.source && (
                <span className="inline-flex items-center rounded-full bg-[#3ec9d6]/10 text-[#3ec9d6] px-2.5 py-0.5 text-xs font-medium">
                  {SOURCE_LABELS[candidate.source] ?? candidate.source}
                </span>
              )}
            </div>
            <p className="text-gray-500 mt-0.5">{candidate.email}</p>
            {candidate.phone && (
              <p className="text-sm text-gray-400">{candidate.phone}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
            {candidate.linkedin_url && (
              <a
                href={candidate.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-[#0A66C2]/10 text-[#0A66C2] text-sm font-medium hover:bg-[#0A66C2]/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                LinkedIn
              </a>
            )}
            <Button
              size="sm"
              variant={candidate.is_blacklisted ? 'outline' : 'danger'}
              onClick={handleBlacklist}
              loading={blacklistMut.isPending}
            >
              {candidate.is_blacklisted ? 'Remove Blacklist' : 'Blacklist'}
            </Button>
          </div>
        </div>

        {/* Member since */}
        <p className="mt-3 text-xs text-gray-400 border-t border-gray-50 dark:border-gray-700 pt-3">
          Added {new Date(candidate.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </Card>

      {/* AI Summary */}
      {candidate.ai_summary && (
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🤖</span>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Summary</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{candidate.ai_summary}</p>
        </Card>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center rounded-full bg-[#51459d]/10 text-[#51459d] px-3 py-1 text-xs font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Applications history */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Applications History</h2>
        {appsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        ) : candidateApps.length === 0 ? (
          <p className="text-sm text-gray-400">No applications on record.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  {['Requisition', 'Stage', 'Match Score', 'Applied Date'].map((h) => (
                    <th key={h} className="pb-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {candidateApps.map((app) => {
                  const stageMeta = STAGE_BADGE_MAP[app.stage]
                  return (
                    <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="py-3 pr-4 font-mono text-xs text-gray-500">
                        {app.requisition_id.slice(0, 8)}…
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={stageMeta.variant}>{stageMeta.label}</Badge>
                      </td>
                      <td className="py-3 pr-4">
                        {app.ai_match_score !== null
                          ? (
                            <span className={`text-xs font-semibold ${
                              app.ai_match_score >= 70 ? 'text-[#6fd943]'
                              : app.ai_match_score >= 50 ? 'text-[#ffa21d]'
                              : 'text-[#ff3a6e]'
                            }`}>
                              {app.ai_match_score}%
                            </span>
                          )
                          : <span className="text-gray-400 text-xs">—</span>
                        }
                      </td>
                      <td className="py-3 text-gray-400 text-xs">
                        {new Date(app.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Notes */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Internal Notes</h2>
          {notesDirty && (
            <Button size="sm" onClick={handleSaveNotes} loading={updateMut.isPending}>
              Save Notes
            </Button>
          )}
        </div>
        <textarea
          className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#51459d]/30 focus:border-[#51459d] resize-none transition-colors"
          rows={5}
          placeholder="Add internal notes about this candidate..."
          value={notes ?? ''}
          onChange={(e) => {
            setNotes(e.target.value)
            setNotesDirty(true)
          }}
        />
        <p className="text-xs text-gray-400 mt-1">Notes are visible to recruiters only.</p>
      </Card>
    </div>
  )
}

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Badge, Card, Input } from '../../components/ui'
import { toast } from '../../components/ui'
import { useCAPA, useUpdateCAPA, useVerifyCAPA } from '../../api/manufacturing_quality'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'

const statusColors: Record<string, BadgeVariant> = { open: 'danger', in_progress: 'info', verification: 'warning', closed: 'success' }

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CAPADetail() {
  const { capaId } = useParams<{ capaId: string }>()
  const navigate = useNavigate()
  const { data: capa, isLoading } = useCAPA(capaId!)
  const updateCAPA = useUpdateCAPA()
  const verifyCAPA = useVerifyCAPA()
  const [verificationNotes, setVerificationNotes] = useState('')

  if (isLoading) return <div className="p-6">Loading...</div>
  if (!capa) return <div className="p-6">CAPA not found</div>

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateCAPA.mutateAsync({ id: capa.id, status: newStatus })
      toast('success', `Status updated to ${newStatus}`)
    } catch {
      toast('error', 'Failed to update')
    }
  }

  const handleVerify = async (isEffective: boolean) => {
    if (!verificationNotes) return toast('error', 'Verification notes required')
    try {
      await verifyCAPA.mutateAsync({ capaId: capa.id, verification_notes: verificationNotes, is_effective: isEffective })
      toast('success', isEffective ? 'CAPA verified and closed' : 'CAPA reopened - not effective')
    } catch {
      toast('error', 'Failed to verify')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button className="text-sm text-gray-500 hover:underline mb-1" onClick={() => navigate('/manufacturing/capa')}>← Back to CAPAs</button>
          <h1 className="text-2xl font-bold">{capa.capa_number}</h1>
        </div>
        <div className="flex gap-2">
          {capa.status === 'open' && <Button onClick={() => handleStatusChange('in_progress')}>Start</Button>}
          {capa.status === 'in_progress' && <Button onClick={() => handleStatusChange('verification')}>Ready for Verification</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">Details</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-gray-500">Status</span>
            <Badge variant={statusColors[capa.status]}>{capa.status.replace('_', ' ')}</Badge>
            <span className="text-gray-500">Type</span>
            <span className="capitalize">{capa.capa_type}</span>
            <span className="text-gray-500">Priority</span>
            <span className="capitalize">{capa.priority}</span>
            <span className="text-gray-500">Due Date</span>
            <span>{formatDate(capa.due_date)}</span>
            <span className="text-gray-500">Verified</span>
            <span>{capa.effectiveness_verified ? 'Yes' : 'No'}</span>
            {capa.ncr_id && <><span className="text-gray-500">NCR</span><span className="text-xs">{capa.ncr_id}</span></>}
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">Actions</h2>
          <div className="space-y-2 text-sm">
            <div><span className="text-gray-500 block">Description</span><p>{capa.description}</p></div>
            {capa.root_cause_analysis && <div><span className="text-gray-500 block">Root Cause Analysis</span><p>{capa.root_cause_analysis}</p></div>}
            {capa.corrective_action && <div><span className="text-gray-500 block">Corrective Action</span><p>{capa.corrective_action}</p></div>}
            {capa.preventive_action && <div><span className="text-gray-500 block">Preventive Action</span><p>{capa.preventive_action}</p></div>}
            {capa.verification_notes && <div><span className="text-gray-500 block">Verification Notes</span><p>{capa.verification_notes}</p></div>}
          </div>
        </Card>
      </div>

      {capa.status === 'verification' && (
        <Card className="p-4 space-y-4">
          <h2 className="font-semibold">Effectiveness Verification</h2>
          <Input label="Verification Notes" value={verificationNotes} onChange={e => setVerificationNotes(e.target.value)} placeholder="Document your verification findings" />
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => handleVerify(true)} loading={verifyCAPA.isPending}>Effective — Close CAPA</Button>
            <Button variant="danger" onClick={() => handleVerify(false)} loading={verifyCAPA.isPending}>Not Effective — Reopen</Button>
          </div>
        </Card>
      )}
    </div>
  )
}

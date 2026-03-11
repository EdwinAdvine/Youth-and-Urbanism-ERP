import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Badge, Card, Input, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import { useNCR, useUpdateNCR, useCreateCAPA } from '../../api/manufacturing_quality'

const severityColors: Record<string, string> = { minor: 'yellow', major: 'orange', critical: 'red' }
const statusColors: Record<string, string> = { open: 'red', investigating: 'blue', resolved: 'green', closed: 'gray' }

export default function NCRDetail() {
  const { ncrId } = useParams<{ ncrId: string }>()
  const navigate = useNavigate()
  const { data: ncr, isLoading } = useNCR(ncrId!)
  const updateNCR = useUpdateNCR()
  const createCAPA = useCreateCAPA()
  const [rootCause, setRootCause] = useState('')
  const [disposition, setDisposition] = useState('')
  const [resolution, setResolution] = useState('')

  if (isLoading) return <div className="p-6">Loading...</div>
  if (!ncr) return <div className="p-6">NCR not found</div>

  const handleResolve = async () => {
    try {
      await updateNCR.mutateAsync({ id: ncr.id, status: 'resolved', root_cause: rootCause, disposition, resolution_notes: resolution })
      toast({ title: 'NCR resolved' })
    } catch {
      toast({ title: 'Failed to resolve', variant: 'destructive' })
    }
  }

  const handleCreateCAPA = async () => {
    try {
      const capa = await createCAPA.mutateAsync({ ncr_id: ncr.id, description: `CAPA for ${ncr.ncr_number}: ${ncr.description}` })
      toast({ title: `CAPA ${capa.capa_number} created` })
      navigate(`/manufacturing/capa/${capa.id}`)
    } catch {
      toast({ title: 'Failed to create CAPA', variant: 'destructive' })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button className="text-sm text-gray-500 hover:underline mb-1" onClick={() => navigate('/manufacturing/ncr')}>← Back to NCRs</button>
          <h1 className="text-2xl font-bold">{ncr.ncr_number}</h1>
        </div>
        <div className="flex gap-2">
          {ncr.status === 'open' && <Button variant="outline" onClick={() => updateNCR.mutateAsync({ id: ncr.id, status: 'investigating' })}>Start Investigation</Button>}
          <Button onClick={handleCreateCAPA}>Create CAPA</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">Details</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-gray-500">Status</span>
            <Badge variant={statusColors[ncr.status]}>{ncr.status}</Badge>
            <span className="text-gray-500">Severity</span>
            <Badge variant={severityColors[ncr.severity]}>{ncr.severity}</Badge>
            <span className="text-gray-500">Qty Affected</span>
            <span>{ncr.quantity_affected}</span>
            <span className="text-gray-500">Disposition</span>
            <span className="capitalize">{ncr.disposition || '—'}</span>
            {ncr.work_order_id && <><span className="text-gray-500">Work Order</span><span className="text-xs">{ncr.work_order_id}</span></>}
            {ncr.supplier_id && <><span className="text-gray-500">Supplier</span><span className="text-xs">{ncr.supplier_id}</span></>}
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="font-semibold">Description & Root Cause</h2>
          <p className="text-sm">{ncr.description}</p>
          {ncr.root_cause && <div><span className="text-sm text-gray-500">Root Cause:</span><p className="text-sm">{ncr.root_cause}</p></div>}
          {ncr.resolution_notes && <div><span className="text-sm text-gray-500">Resolution:</span><p className="text-sm">{ncr.resolution_notes}</p></div>}
        </Card>
      </div>

      {ncr.status === 'investigating' && (
        <Card className="p-4 space-y-4">
          <h2 className="font-semibold">Resolve NCR</h2>
          <Input label="Root Cause" value={rootCause} onChange={e => setRootCause(e.target.value)} placeholder="What caused this?" />
          <Select label="Disposition" value={disposition} onChange={e => setDisposition(e.target.value)}>
            <option value="">Select disposition</option>
            <option value="rework">Rework</option>
            <option value="scrap">Scrap</option>
            <option value="use_as_is">Use As Is</option>
            <option value="return_to_supplier">Return to Supplier</option>
          </Select>
          <Input label="Resolution Notes" value={resolution} onChange={e => setResolution(e.target.value)} placeholder="How was it resolved?" />
          <Button onClick={handleResolve} loading={updateNCR.isPending}>Resolve NCR</Button>
        </Card>
      )}
    </div>
  )
}

import { useParams, useNavigate } from 'react-router-dom'
import { Button, Badge, Card } from '../../components/ui'
import { toast } from '../../components/ui'
import { useECO, useSubmitECO, useApproveECO, useImplementECO } from '../../api/manufacturing_eco'

const statusColors: Record<string, string> = {
  draft: 'gray',
  submitted: 'blue',
  under_review: 'yellow',
  approved: 'green',
  rejected: 'red',
  implemented: 'purple',
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ECODetail() {
  const { ecoId } = useParams<{ ecoId: string }>()
  const navigate = useNavigate()
  const { data: eco, isLoading } = useECO(ecoId!)
  const submitECO = useSubmitECO()
  const approveECO = useApproveECO()
  const implementECO = useImplementECO()

  if (isLoading) return <div className="p-6">Loading...</div>
  if (!eco) return <div className="p-6">ECO not found</div>

  const handleSubmit = async () => {
    try {
      await submitECO.mutateAsync(eco.id)
      toast({ title: 'ECO submitted for approval' })
    } catch {
      toast({ title: 'Failed to submit ECO', variant: 'destructive' })
    }
  }

  const handleApprove = async (decision: string) => {
    try {
      await approveECO.mutateAsync({ ecoId: eco.id, decision })
      toast({ title: `ECO ${decision}` })
    } catch {
      toast({ title: `Failed to ${decision} ECO`, variant: 'destructive' })
    }
  }

  const handleImplement = async () => {
    try {
      await implementECO.mutateAsync(eco.id)
      toast({ title: 'ECO implemented — new BOM version created' })
    } catch {
      toast({ title: 'Failed to implement ECO', variant: 'destructive' })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button className="text-sm text-gray-500 hover:underline mb-1" onClick={() => navigate('/manufacturing/eco')}>
            ← Back to ECOs
          </button>
          <h1 className="text-2xl font-bold">{eco.eco_number}: {eco.title}</h1>
        </div>
        <div className="flex gap-2">
          {eco.status === 'draft' && (
            <Button onClick={handleSubmit} loading={submitECO.isPending}>Submit for Approval</Button>
          )}
          {(eco.status === 'submitted' || eco.status === 'under_review') && (
            <>
              <Button variant="success" onClick={() => handleApprove('approved')} loading={approveECO.isPending}>Approve</Button>
              <Button variant="destructive" onClick={() => handleApprove('rejected')} loading={approveECO.isPending}>Reject</Button>
            </>
          )}
          {eco.status === 'approved' && (
            <Button onClick={handleImplement} loading={implementECO.isPending}>Implement ECO</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-4 space-y-3">
          <h2 className="font-semibold text-lg">Details</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-gray-500">Status</span>
            <Badge variant={statusColors[eco.status] || 'gray'}>{eco.status.replace('_', ' ')}</Badge>
            <span className="text-gray-500">Change Type</span>
            <span className="capitalize">{eco.change_type}</span>
            <span className="text-gray-500">Priority</span>
            <span className="capitalize">{eco.priority}</span>
            <span className="text-gray-500">BOM</span>
            <span>{eco.bom_id}</span>
            <span className="text-gray-500">Submitted</span>
            <span>{formatDateTime(eco.submitted_at)}</span>
            <span className="text-gray-500">Approved</span>
            <span>{formatDateTime(eco.approved_at)}</span>
            <span className="text-gray-500">Implemented</span>
            <span>{formatDateTime(eco.implemented_at)}</span>
            {eco.new_bom_version && (
              <>
                <span className="text-gray-500">New BOM Version</span>
                <span>v{eco.new_bom_version}</span>
              </>
            )}
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <h2 className="font-semibold text-lg">Reason & Impact</h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-500 block">Reason</span>
              <p>{eco.reason || '—'}</p>
            </div>
            <div>
              <span className="text-gray-500 block">Impact Analysis</span>
              <p>{eco.impact_analysis || '—'}</p>
            </div>
            <div>
              <span className="text-gray-500 block">Description</span>
              <p>{eco.description || '—'}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Approvals */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold text-lg">Approval History</h2>
        {eco.approvals?.length === 0 ? (
          <p className="text-sm text-gray-500">No approvals yet</p>
        ) : (
          <div className="space-y-2">
            {eco.approvals?.map((approval) => (
              <div key={approval.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium">Approver #{approval.sequence}</span>
                  <span className="text-xs text-gray-500 ml-2">{approval.approver_id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={approval.decision === 'approved' ? 'green' : approval.decision === 'rejected' ? 'red' : 'gray'}>
                    {approval.decision}
                  </Badge>
                  {approval.decided_at && <span className="text-xs text-gray-500">{formatDateTime(approval.decided_at)}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

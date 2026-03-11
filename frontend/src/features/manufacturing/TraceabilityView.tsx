import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Badge, Card, Table } from '../../components/ui'
import { useLot, useLotEvents, useTraceForward, useTraceBackward, type TraceEvent } from '../../api/manufacturing_trace'

const statusColors: Record<string, string> = { active: 'green', consumed: 'blue', shipped: 'purple', recalled: 'red' }
const eventColors: Record<string, string> = { created: 'gray', consumed: 'blue', produced: 'green', inspected: 'yellow', shipped: 'purple', recalled: 'red' }

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function TraceabilityView() {
  const { lotId } = useParams<{ lotId: string }>()
  const navigate = useNavigate()
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')

  const { data: lot } = useLot(lotId!)
  const { data: events } = useLotEvents(lotId!)
  const { data: forward } = useTraceForward(direction === 'forward' ? lotId! : '')
  const { data: backward } = useTraceBackward(direction === 'backward' ? lotId! : '')

  if (!lot) return <div className="p-6">Loading...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button className="text-sm text-gray-500 hover:underline mb-1" onClick={() => navigate('/manufacturing/lots')}>← Back to Lots</button>
          <h1 className="text-2xl font-bold">{lot.tracking_number}</h1>
        </div>
        <Badge variant={statusColors[lot.status]}>{lot.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-500">Type</div>
          <div className="capitalize font-medium">{lot.tracking_type}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Quantity</div>
          <div className="font-medium">{lot.quantity}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Expiry</div>
          <div className="font-medium">{lot.expiry_date || '—'}</div>
        </Card>
      </div>

      {/* Event Timeline */}
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold text-lg">Event Timeline</h2>
        <div className="space-y-2">
          {events?.map((event: TraceEvent) => (
            <div key={event.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
              <Badge variant={eventColors[event.event_type] || 'gray'}>{event.event_type}</Badge>
              <span className="text-sm flex-1">{event.notes || '—'}</span>
              {event.quantity && <span className="text-sm text-gray-500">Qty: {event.quantity}</span>}
              <span className="text-xs text-gray-400">{formatDateTime(event.event_timestamp)}</span>
            </div>
          ))}
          {(!events || events.length === 0) && <p className="text-sm text-gray-500">No events recorded</p>}
        </div>
      </Card>

      {/* Traceability */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-semibold text-lg">Traceability</h2>
          <div className="flex gap-1">
            <Button size="sm" variant={direction === 'forward' ? 'default' : 'ghost'} onClick={() => setDirection('forward')}>Forward →</Button>
            <Button size="sm" variant={direction === 'backward' ? 'default' : 'ghost'} onClick={() => setDirection('backward')}>← Backward</Button>
          </div>
        </div>

        {direction === 'forward' && forward && (
          <div>
            <p className="text-sm text-gray-500 mb-2">Where did this lot go? ({forward.downstream_lots.length} downstream lots)</p>
            <Table>
              <thead><tr><th>Tracking #</th><th>Type</th><th>Status</th><th>Qty</th><th>Work Order</th></tr></thead>
              <tbody>
                {forward.downstream_lots.map(dl => (
                  <tr key={dl.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/manufacturing/lots/${dl.id}`)}>
                    <td className="font-mono text-sm">{dl.tracking_number}</td>
                    <td className="capitalize">{dl.tracking_type}</td>
                    <td><Badge variant={statusColors[dl.status] || 'gray'}>{dl.status}</Badge></td>
                    <td>{dl.quantity}</td>
                    <td className="text-xs">{dl.work_order_id || '—'}</td>
                  </tr>
                ))}
                {forward.downstream_lots.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-gray-500">No downstream lots</td></tr>}
              </tbody>
            </Table>
          </div>
        )}

        {direction === 'backward' && backward && (
          <div>
            <p className="text-sm text-gray-500 mb-2">Where did this come from? ({backward.upstream_lots.length} upstream lots)</p>
            <Table>
              <thead><tr><th>Tracking #</th><th>Type</th><th>Status</th><th>Qty</th><th>Supplier</th></tr></thead>
              <tbody>
                {backward.upstream_lots.map(ul => (
                  <tr key={ul.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/manufacturing/lots/${ul.id}`)}>
                    <td className="font-mono text-sm">{ul.tracking_number}</td>
                    <td className="capitalize">{ul.tracking_type}</td>
                    <td><Badge variant={statusColors[ul.status] || 'gray'}>{ul.status}</Badge></td>
                    <td>{ul.quantity}</td>
                    <td className="text-xs">{ul.supplier_id || '—'}</td>
                  </tr>
                ))}
                {backward.upstream_lots.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-gray-500">No upstream lots</td></tr>}
              </tbody>
            </Table>
          </div>
        )}
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => navigate(`/manufacturing/lots/${lotId}/genealogy`)}>View Genealogy Tree</Button>
      </div>
    </div>
  )
}

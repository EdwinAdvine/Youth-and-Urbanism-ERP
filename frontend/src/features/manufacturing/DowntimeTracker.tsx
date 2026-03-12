import { useState } from 'react'
import { Button, Badge, Card, Modal, Input, Select } from '../../components/ui'
import { toast } from '../../components/ui'
import { useDowntimeRecords, useLogDowntime, useCloseDowntime } from '../../api/manufacturing_equipment'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'

const typeColors: Record<string, BadgeVariant> = { planned: 'info', unplanned: 'danger', changeover: 'warning' }

function formatDateTime(dt: string) {
  return new Date(dt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function DowntimeTracker() {
  const [logOpen, setLogOpen] = useState(false)
  const [closeId, setCloseId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState('')
  const [form, setForm] = useState({
    workstation_id: '',
    downtime_type: 'unplanned',
    category: 'mechanical',
    start_time: new Date().toISOString().slice(0, 16),
    root_cause: '',
  })
  const [closeTime, setCloseTime] = useState(new Date().toISOString().slice(0, 16))
  const [closeResolution, setCloseResolution] = useState('')

  const { data: records, isLoading } = useDowntimeRecords(undefined, undefined)
  const logDowntime = useLogDowntime()
  const closeDowntime = useCloseDowntime()

  const filteredRecords = filterType ? records?.filter(r => r.downtime_type === filterType) : records

  const handleLog = async () => {
    if (!form.workstation_id) return toast('error', 'Workstation ID required')
    try {
      await logDowntime.mutateAsync({ ...form, start_time: new Date(form.start_time).toISOString() })
      toast('success', 'Downtime logged')
      setLogOpen(false)
    } catch {
      toast('error', 'Failed to log downtime')
    }
  }

  const handleClose = async () => {
    if (!closeId) return
    try {
      await closeDowntime.mutateAsync({
        id: closeId,
        end_time: new Date(closeTime).toISOString(),
        resolution: closeResolution || undefined,
      })
      toast('success', 'Downtime closed')
      setCloseId(null)
    } catch {
      toast('error', 'Failed to close downtime')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Downtime Tracker</h1>
        <Button onClick={() => setLogOpen(true)}>+ Log Downtime</Button>
      </div>

      <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-48">
        <option value="">All Types</option>
        {['planned', 'unplanned', 'changeover'].map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </Select>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-3 px-4">Type</th>
              <th className="text-left py-3 px-4">Category</th>
              <th className="text-left py-3 px-4">Started</th>
              <th className="text-left py-3 px-4">Duration</th>
              <th className="text-left py-3 px-4">Root Cause</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-8">Loading...</td></tr>
            ) : filteredRecords?.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-500">No downtime records</td></tr>
            ) : filteredRecords?.map(r => (
              <tr key={r.id}>
                <td><Badge variant={typeColors[r.downtime_type] || 'default'}>{r.downtime_type}</Badge></td>
                <td className="text-sm">{r.category}</td>
                <td className="text-sm">{formatDateTime(r.start_time)}</td>
                <td className="text-sm">
                  {r.duration_minutes ? `${r.duration_minutes}min` : <span className="text-orange-500 text-xs">Ongoing</span>}
                </td>
                <td className="text-sm text-gray-500 max-w-xs truncate">{r.root_cause || '—'}</td>
                <td>
                  {!r.end_time && (
                    <Button size="sm" onClick={() => { setCloseId(r.id); setCloseTime(new Date().toISOString().slice(0, 16)) }}>
                      Close
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Log Downtime Event">
        <div className="space-y-4">
          <Input label="Workstation ID" value={form.workstation_id} onChange={e => setForm({ ...form, workstation_id: e.target.value })} placeholder="UUID" />
          <div>
            <label className="text-sm font-medium">Type</label>
            <select className="mt-1 block w-full border rounded px-3 py-2 text-sm" value={form.downtime_type} onChange={e => setForm({ ...form, downtime_type: e.target.value })}>
              {['planned', 'unplanned', 'changeover'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Category</label>
            <select className="mt-1 block w-full border rounded px-3 py-2 text-sm" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {['mechanical', 'electrical', 'operator', 'material', 'quality', 'other'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Input label="Start Time" type="datetime-local" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
          <Input label="Root Cause (optional)" value={form.root_cause} onChange={e => setForm({ ...form, root_cause: e.target.value })} />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button onClick={handleLog} loading={logDowntime.isPending}>Log</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!closeId} onClose={() => setCloseId(null)} title="Close Downtime">
        <div className="space-y-4">
          <Input label="End Time" type="datetime-local" value={closeTime} onChange={e => setCloseTime(e.target.value)} />
          <Input label="Resolution Notes" value={closeResolution} onChange={e => setCloseResolution(e.target.value)} />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setCloseId(null)}>Cancel</Button>
            <Button onClick={handleClose} loading={closeDowntime.isPending}>Close Downtime</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

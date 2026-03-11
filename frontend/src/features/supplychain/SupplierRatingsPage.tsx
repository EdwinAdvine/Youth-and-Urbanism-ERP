import { useState } from 'react'
import { Button, Card, Modal, Input, Spinner, toast } from '../../components/ui'
import { useSupplierRatings, useCreateSupplierRating, type SupplierRating, type CreateSupplierRatingPayload } from '../../api/supplychain_ext'

function ScoreBar({ label, score, max = 5 }: { label: string; score: number; max?: number }) {
  const pct = (score / max) * 100
  const color = score >= 4 ? 'bg-green-500' : score >= 3 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-28 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-3">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold w-10 text-right">{score.toFixed(1)}</span>
    </div>
  )
}

export default function SupplierRatingsPage() {
  const { data: ratings, isLoading, error } = useSupplierRatings()
  const createRating = useCreateSupplierRating()

  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<CreateSupplierRatingPayload>({
    supplier_id: '',
    period: new Date().toISOString().slice(0, 7),
    quality_score: 3,
    delivery_score: 3,
    price_score: 3,
    communication_score: 3,
    notes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createRating.mutateAsync(form)
      toast('success', 'Rating submitted')
      setShowModal(false)
    } catch {
      toast('error', 'Failed to submit rating')
    }
  }

  if (error) return <div className="p-6 text-danger">Failed to load ratings</div>

  // Group by supplier
  const bySupplier = (ratings ?? []).reduce((acc, r) => {
    const key = r.supplier_id
    if (!acc[key]) acc[key] = { name: r.supplier_name || r.supplier_id, ratings: [] }
    acc[key].ratings.push(r)
    return acc
  }, {} as Record<string, { name: string; ratings: SupplierRating[] }>)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supplier Ratings</h1>
          <p className="text-sm text-gray-500 mt-1">Supplier scorecards and performance evaluation</p>
        </div>
        <Button onClick={() => setShowModal(true)}>Add Rating</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : Object.keys(bySupplier).length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-400">No supplier ratings yet</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(bySupplier).map(([supplierId, { name, ratings: supplierRatings }]) => {
            const latest = supplierRatings[0]
            return (
              <Card key={supplierId}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
                    <p className="text-xs text-gray-500">Period: {latest.period}</p>
                  </div>
                  <div className="text-center">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                      latest.overall_score >= 4 ? 'bg-green-500' : latest.overall_score >= 3 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}>
                      {latest.overall_score.toFixed(1)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Overall</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <ScoreBar label="Quality" score={latest.quality_score} />
                  <ScoreBar label="Delivery" score={latest.delivery_score} />
                  <ScoreBar label="Pricing" score={latest.price_score} />
                  <ScoreBar label="Communication" score={latest.communication_score} />
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm text-gray-500">
                  <span>Orders: {latest.total_orders}</span>
                  <span>On-time: {latest.on_time_deliveries}</span>
                  <span>Defect: {(latest.defect_rate * 100).toFixed(1)}%</span>
                </div>
                {latest.notes && <p className="text-xs text-gray-400 mt-2 italic">{latest.notes}</p>}
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Rate Supplier" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Supplier ID" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} required />
            <Input label="Period" type="month" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Quality Score (1-5)" type="number" min="1" max="5" step="0.1" value={form.quality_score} onChange={(e) => setForm({ ...form, quality_score: parseFloat(e.target.value) || 0 })} required />
            <Input label="Delivery Score (1-5)" type="number" min="1" max="5" step="0.1" value={form.delivery_score} onChange={(e) => setForm({ ...form, delivery_score: parseFloat(e.target.value) || 0 })} required />
            <Input label="Price Score (1-5)" type="number" min="1" max="5" step="0.1" value={form.price_score} onChange={(e) => setForm({ ...form, price_score: parseFloat(e.target.value) || 0 })} required />
            <Input label="Communication Score (1-5)" type="number" min="1" max="5" step="0.1" value={form.communication_score} onChange={(e) => setForm({ ...form, communication_score: parseFloat(e.target.value) || 0 })} required />
          </div>
          <Input label="Notes" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={createRating.isPending}>Submit Rating</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

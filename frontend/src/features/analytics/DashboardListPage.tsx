import './print-styles.css'
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Modal, Input, Badge, Spinner, toast } from '../../components/ui'
import { useSwipeGesture } from '../../hooks/useSwipeGesture'
import { useDashboards, useCreateDashboard, useDeleteDashboard, type Dashboard, type CreateDashboardPayload } from '../../api/analytics_ext'

export default function DashboardListPage() {
  const navigate = useNavigate()
  const { data: dashboards, isLoading, error } = useDashboards()
  const createDashboard = useCreateDashboard()
  const deleteDashboard = useDeleteDashboard()

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateDashboardPayload>({ name: '', description: '', is_shared: false })

  // Mobile swipe navigation between dashboards
  const [mobileIndex, setMobileIndex] = useState(0)
  const handleSwipeLeft = useCallback(() => {
    if (dashboards && mobileIndex < dashboards.length - 1) {
      setMobileIndex((i) => i + 1)
    }
  }, [dashboards, mobileIndex])
  const handleSwipeRight = useCallback(() => {
    if (mobileIndex > 0) {
      setMobileIndex((i) => i - 1)
    }
  }, [mobileIndex])
  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 60,
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const d = await createDashboard.mutateAsync(form)
      toast('success', 'Dashboard created')
      setShowCreate(false)
      navigate(`/analytics/dashboards/${d.id}`)
    } catch {
      toast('error', 'Failed to create dashboard')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this dashboard?')) return
    try {
      await deleteDashboard.mutateAsync(id)
      toast('success', 'Dashboard deleted')
    } catch {
      toast('error', 'Failed to delete')
    }
  }

  if (error) return <div className="p-6 text-danger">Failed to load dashboards</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboards</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage custom analytics dashboards</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>New Dashboard</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : !dashboards || dashboards.length === 0 ? (
        <Card className="text-center py-16">
          <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-gray-500 mb-4">No dashboards yet</p>
          <Button onClick={() => setShowCreate(true)}>Create Your First Dashboard</Button>
        </Card>
      ) : (
        <>
          <div className="md:hidden" {...swipeHandlers}>
            {dashboards.length > 0 && (
              <>
                <Card
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/analytics/dashboards/${dashboards[mobileIndex].id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{dashboards[mobileIndex].name}</h3>
                      {dashboards[mobileIndex].description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{dashboards[mobileIndex].description}</p>}
                    </div>
                    <div className="flex gap-1 ml-2">
                      {dashboards[mobileIndex].is_default && <Badge variant="primary">Default</Badge>}
                      {dashboards[mobileIndex].is_shared && <Badge variant="info">Shared</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-xs text-gray-400">
                      {dashboards[mobileIndex].owner_name || 'You'} - Updated {new Date(dashboards[mobileIndex].updated_at).toLocaleDateString()}
                    </span>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={(e) => { e.stopPropagation(); handleDelete(dashboards[mobileIndex].id) }}
                    >
                      Delete
                    </Button>
                  </div>
                </Card>
                <div className="flex items-center justify-center gap-1.5 mt-4">
                  {dashboards.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setMobileIndex(i)}
                      className={`w-2 h-2 rounded-full transition-colors ${i === mobileIndex ? 'bg-[#51459d]' : 'bg-gray-300'}`}
                    />
                  ))}
                </div>
                <p className="text-center text-[10px] text-gray-400 mt-2">Swipe left/right to browse dashboards</p>
              </>
            )}
          </div>
          <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboards.map((d) => (
              <Card key={d.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/analytics/dashboards/${d.id}`)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{d.name}</h3>
                    {d.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{d.description}</p>}
                  </div>
                  <div className="flex gap-1 ml-2">
                    {d.is_default && <Badge variant="primary">Default</Badge>}
                    {d.is_shared && <Badge variant="info">Shared</Badge>}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-xs text-gray-400">
                    {d.owner_name || 'You'} - Updated {new Date(d.updated_at).toLocaleDateString()}
                  </span>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={(e) => { e.stopPropagation(); handleDelete(d.id) }}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Dashboard">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="My Dashboard" />
          <Input label="Description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="dash-shared" checked={form.is_shared} onChange={(e) => setForm({ ...form, is_shared: e.target.checked })} className="rounded" />
            <label htmlFor="dash-shared" className="text-sm text-gray-700">Share with team</label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={createDashboard.isPending}>Create</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

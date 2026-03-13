import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button, Card, Table, Modal, Input, Select, Badge, Spinner, toast } from '../../components/ui'
import apiClient from '@/api/client'

interface Route {
  id: string
  name: string
  origin: string
  destination: string
  transport_mode: string
  transit_days: number
  base_cost: number
  currency: string
  carrier_name: string | null
  is_active: boolean
}

interface OptimalRouteResult {
  routes: Route[]
  recommended_route_id: string | null
  reasoning: string | null
}

const modeVariant: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
  road: 'info',
  air: 'warning',
  sea: 'default',
  rail: 'success',
  multimodal: 'warning',
}

export default function RoutePlannerPage() {
  const [modeFilter, setModeFilter] = useState('')
  const [showOptimal, setShowOptimal] = useState(false)
  const [optimalForm, setOptimalForm] = useState({ origin: '', destination: '', transport_mode: '' })
  const [optimalResult, setOptimalResult] = useState<OptimalRouteResult | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['sc', 'routes', modeFilter],
    queryFn: () =>
      apiClient
        .get('/supply-chain/logistics/routes', {
          params: modeFilter ? { transport_mode: modeFilter } : {},
        })
        .then((r) => r.data),
  })

  const findOptimal = useMutation({
    mutationFn: (payload: typeof optimalForm) =>
      apiClient.post('/supply-chain/logistics/routes/optimal', payload).then((r) => r.data),
    onSuccess: (result) => {
      setOptimalResult(result)
    },
    onError: () => toast('error', 'Failed to find optimal route'),
  })

  const routes: Route[] = data?.items ?? data ?? []

  const columns = [
    {
      key: 'route',
      label: 'Route',
      render: (r: Route) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{r.name}</p>
          <p className="text-xs text-gray-500">
            {r.origin} → {r.destination}
          </p>
        </div>
      ),
    },
    {
      key: 'mode',
      label: 'Mode',
      render: (r: Route) => (
        <Badge variant={modeVariant[r.transport_mode] ?? 'default'}>{r.transport_mode}</Badge>
      ),
    },
    {
      key: 'carrier',
      label: 'Carrier',
      render: (r: Route) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">{r.carrier_name || '-'}</span>
      ),
    },
    {
      key: 'transit',
      label: 'Transit Days',
      render: (r: Route) => (
        <span className="text-sm font-medium">{r.transit_days} days</span>
      ),
    },
    {
      key: 'cost',
      label: 'Base Cost',
      render: (r: Route) => (
        <span className="text-sm font-medium">
          {r.currency} {r.base_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
      ),
    },
  ]

  const handleFindOptimal = (e: React.FormEvent) => {
    e.preventDefault()
    setOptimalResult(null)
    findOptimal.mutate(optimalForm)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Route Planner</h1>
          <p className="text-sm text-gray-500 mt-1">Browse and optimize transport routes</p>
        </div>
        <div className="flex gap-3">
          <Select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            options={[
              { value: '', label: 'All Modes' },
              { value: 'road', label: 'Road' },
              { value: 'air', label: 'Air' },
              { value: 'sea', label: 'Sea' },
              { value: 'rail', label: 'Rail' },
              { value: 'multimodal', label: 'Multimodal' },
            ]}
          />
          <Button onClick={() => { setShowOptimal(true); setOptimalResult(null) }}>
            Find Optimal Route
          </Button>
        </div>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={routes}
          loading={isLoading}
          keyExtractor={(r) => r.id}
          emptyText="No routes found"
        />
      </Card>

      {/* Optimal Route Finder Modal */}
      <Modal
        open={showOptimal}
        onClose={() => setShowOptimal(false)}
        title="Find Optimal Route"
        size="md"
      >
        <form onSubmit={handleFindOptimal} className="space-y-4">
          <Input
            label="Origin"
            value={optimalForm.origin}
            onChange={(e) => setOptimalForm({ ...optimalForm, origin: e.target.value })}
            required
          />
          <Input
            label="Destination"
            value={optimalForm.destination}
            onChange={(e) => setOptimalForm({ ...optimalForm, destination: e.target.value })}
            required
          />
          <Select
            label="Preferred Mode (optional)"
            value={optimalForm.transport_mode}
            onChange={(e) => setOptimalForm({ ...optimalForm, transport_mode: e.target.value })}
            options={[
              { value: '', label: 'Any' },
              { value: 'road', label: 'Road' },
              { value: 'air', label: 'Air' },
              { value: 'sea', label: 'Sea' },
              { value: 'rail', label: 'Rail' },
              { value: 'multimodal', label: 'Multimodal' },
            ]}
          />

          <div className="flex justify-end gap-3">
            <Button variant="ghost" type="button" onClick={() => setShowOptimal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={findOptimal.isPending}>
              Search
            </Button>
          </div>
        </form>

        {/* Results */}
        {optimalResult && (
          <div className="mt-6 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
            {optimalResult.reasoning && (
              <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                {optimalResult.reasoning}
              </p>
            )}
            {optimalResult.routes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No routes found</p>
            ) : (
              optimalResult.routes.map((r) => (
                <div
                  key={r.id}
                  className={`p-3 rounded-lg border ${
                    r.id === optimalResult.recommended_route_id
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {r.id === optimalResult.recommended_route_id && (
                    <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                      Recommended
                    </span>
                  )}
                  <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                    {r.origin} → {r.destination}
                  </p>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500">
                    <span>{r.transport_mode}</span>
                    <span>{r.transit_days} days</span>
                    <span>
                      {r.currency} {r.base_cost.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

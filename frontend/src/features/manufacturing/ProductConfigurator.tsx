import { useState } from 'react'
import { Button, Card, Badge, Input } from '../../components/ui'
import { toast } from '../../components/ui'
import { useMutation } from '@tanstack/react-query'
import apiClient from '../../api/client'

interface ConfigSession {
  id: string
  session_code: string
  base_bom_id: string
  selections: Record<string, string>
  computed_bom_items: Array<{
    bom_item_id: string
    item_id: string
    name: string
    quantity: number
    unit_cost: number
    included?: boolean
  }>
  computed_cost: number
  status: string
}

export default function ProductConfigurator() {
  const [bomId, setBomId] = useState('')
  const [session, setSession] = useState<ConfigSession | null>(null)
  const [feature, setFeature] = useState('')
  const [featureValue, setFeatureValue] = useState('')
  const [finalResult, setFinalResult] = useState<{ finalized_bom_id: string; bom_number: string } | null>(null)

  const startSession = useMutation({
    mutationFn: (id: string) =>
      apiClient.post<ConfigSession>(`/manufacturing/configurator/sessions?bom_id=${id}`).then(r => r.data),
    onSuccess: s => { setSession(s); toast('success', `Session ${s.session_code} started`) },
    onError: () => toast('error', 'Failed to start session'),
  })

  const applySelection = useMutation({
    mutationFn: ({ sessionId, feat, val }: { sessionId: string; feat: string; val: string }) =>
      apiClient.post<ConfigSession>(`/manufacturing/configurator/sessions/${sessionId}/select`, { feature: feat, value: val }).then(r => r.data),
    onSuccess: s => { setSession(s); setFeature(''); setFeatureValue('') },
    onError: () => toast('error', 'Failed to apply selection'),
  })

  const finalizeSession = useMutation({
    mutationFn: (sessionId: string) =>
      apiClient.post<{ session: ConfigSession; finalized_bom_id: string; bom_number: string }>(
        `/manufacturing/configurator/sessions/${sessionId}/finalize`
      ).then(r => r.data),
    onSuccess: r => {
      setFinalResult({ finalized_bom_id: r.finalized_bom_id, bom_number: r.bom_number })
      setSession(prev => prev ? { ...prev, status: 'finalized' } : null)
      toast('success', `BOM ${r.bom_number} created successfully`)
    },
    onError: () => toast('error', 'Failed to finalize'),
  })

  if (finalResult) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-bold">Configuration Complete</h1>
        <Card className="p-6 space-y-4 text-center">
          <div className="text-5xl">✅</div>
          <div className="text-xl font-semibold">BOM Created Successfully</div>
          <div className="font-mono text-sm bg-gray-50 rounded p-3">{finalResult.bom_number}</div>
          <p className="text-gray-500 text-sm">The configured BOM has been saved and is ready for production.</p>
          <Button onClick={() => { setSession(null); setFinalResult(null); setBomId('') }}>Start New Configuration</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Product Configurator (CPQ)</h1>

      {!session ? (
        <Card className="p-6 space-y-4 max-w-md">
          <h2 className="font-semibold">Start Configuration</h2>
          <Input
            label="Base BOM ID"
            value={bomId}
            onChange={e => setBomId(e.target.value)}
            placeholder="BOM UUID"
          />
          <Button
            onClick={() => { if (bomId) startSession.mutate(bomId) }}
            loading={startSession.isPending}
            disabled={!bomId}
          >
            Start CPQ Session
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Configuration</h2>
                <Badge variant="info" className="font-mono text-xs">{session.session_code}</Badge>
              </div>

              {/* Current selections */}
              {Object.entries(session.selections).length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-gray-500 font-medium">Selections</div>
                  {Object.entries(session.selections).map(([feat, val]) => (
                    <div key={feat} className="flex justify-between text-sm bg-gray-50 px-2 py-1 rounded">
                      <span className="text-gray-600">{feat}</span>
                      <span className="font-medium">{val}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Add selection */}
              {session.status === 'active' && (
                <div className="space-y-2 border-t pt-3">
                  <div className="text-xs text-gray-500 font-medium">Add Selection</div>
                  <Input placeholder="Feature (e.g. color)" value={feature} onChange={e => setFeature(e.target.value)} />
                  <Input placeholder="Value (e.g. blue)" value={featureValue} onChange={e => setFeatureValue(e.target.value)} />
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => {
                      if (feature && featureValue)
                        applySelection.mutate({ sessionId: session.id, feat: feature, val: featureValue })
                    }}
                    loading={applySelection.isPending}
                    disabled={!feature || !featureValue}
                  >
                    Apply
                  </Button>
                </div>
              )}
            </Card>

            {/* Total cost */}
            <Card className="p-4">
              <div className="text-xs text-gray-500">Computed Cost</div>
              <div className="text-3xl font-bold text-purple-700">
                ${Number(session.computed_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </Card>

            {session.status === 'active' && (
              <Button
                className="w-full"
                onClick={() => finalizeSession.mutate(session.id)}
                loading={finalizeSession.isPending}
              >
                Finalize & Create BOM
              </Button>
            )}
          </div>

          {/* Computed BOM Items */}
          <Card className="lg:col-span-2 overflow-hidden">
            <div className="px-4 py-3 border-b font-semibold">
              Computed BOM Items ({session.computed_bom_items?.filter(i => i.included !== false).length || 0} included)
            </div>
            <div className="divide-y max-h-96 overflow-y-auto">
              {session.computed_bom_items?.map(item => (
                <div
                  key={item.bom_item_id}
                  className={`flex items-center gap-4 px-4 py-3 ${item.included === false ? 'opacity-40 line-through' : ''}`}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{item.name}</div>
                    <div className="text-xs text-gray-500">Qty: {item.quantity} × ${item.unit_cost.toFixed(2)}</div>
                  </div>
                  <div className="font-medium">${(item.quantity * item.unit_cost).toFixed(2)}</div>
                  {item.included === false && <Badge variant="danger" className="text-xs">Excluded</Badge>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

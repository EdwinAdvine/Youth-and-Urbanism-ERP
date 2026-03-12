import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Badge, Input } from '../../components/ui'
import { toast } from '../../components/ui'
import apiClient from '../../api/client'

interface RoutingStep {
  id: string
  step_number: number
  name: string
  description: string
  workstation_id: string | null
  machine_time: number
  labor_time: number
  required_skill: string | null
  min_operators: number
  work_instructions: string | null
  instruction_media: Array<{ type: string; url: string; caption?: string }> | null
  barcode_scan_required: boolean
}

interface Routing {
  id: string
  routing_number: string
  name: string
  steps: RoutingStep[]
}

export default function DigitalWorkInstructions() {
  const { routingId } = useParams<{ routingId: string }>()
  const [editingStep, setEditingStep] = useState<string | null>(null)
  const [instrText, setInstrText] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaCaption, setMediaCaption] = useState('')
  const qc = useQueryClient()

  const { data: routing, isLoading } = useQuery<Routing>({
    queryKey: ['routing-wi', routingId],
    queryFn: () => apiClient.get(`/manufacturing/routing/${routingId}`).then(r => r.data),
    enabled: !!routingId,
  })

  const saveInstructions = useMutation({
    mutationFn: ({ stepId, instructions }: { stepId: string; instructions: string }) =>
      apiClient.put(`/manufacturing/routing-steps/${stepId}/instructions`, { work_instructions: instructions }).then(r => r.data),
    onSuccess: () => {
      toast('success', 'Instructions saved')
      qc.invalidateQueries({ queryKey: ['routing-wi', routingId] })
      setEditingStep(null)
    },
    onError: () => toast('error', 'Save failed'),
  })

  const addMedia = useMutation({
    mutationFn: ({ stepId, url, caption }: { stepId: string; url: string; caption: string }) =>
      apiClient.post(`/manufacturing/routing-steps/${stepId}/media`, { url, caption, type: 'image' }).then(r => r.data),
    onSuccess: () => {
      toast('success', 'Media added')
      qc.invalidateQueries({ queryKey: ['routing-wi', routingId] })
      setMediaUrl('')
      setMediaCaption('')
    },
    onError: () => toast('error', 'Failed to add media'),
  })

  const startEdit = (step: RoutingStep) => {
    setEditingStep(step.id)
    setInstrText(step.work_instructions || '')
  }

  if (!routingId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Digital Work Instructions</h1>
        <Card className="p-8 text-center text-gray-500">
          Select a routing from the Routing page to view its work instructions.
        </Card>
      </div>
    )
  }

  if (isLoading) return <div className="p-6">Loading...</div>
  if (!routing) return <div className="p-6 text-red-600">Routing not found</div>

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Digital Work Instructions</h1>
        <p className="text-gray-500 text-sm mt-1">{routing.routing_number} — {routing.name}</p>
      </div>

      <div className="space-y-4">
        {routing.steps?.map(step => (
          <Card key={step.id} className="overflow-hidden">
            {/* Step header */}
            <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm">
                  {step.step_number}
                </div>
                <div>
                  <div className="font-semibold">{step.name}</div>
                  <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                    <span>Machine: {step.machine_time}min</span>
                    <span>Labor: {step.labor_time}min</span>
                    {step.required_skill && <span>Skill: {step.required_skill}</span>}
                    {step.min_operators > 1 && <span>Min operators: {step.min_operators}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {step.barcode_scan_required && (
                  <Badge variant="info" className="text-xs">Scan Required</Badge>
                )}
                <Button size="sm" variant="ghost" onClick={() => startEdit(step)}>Edit</Button>
              </div>
            </div>

            {/* Step content */}
            <div className="p-5 space-y-4">
              {/* Description */}
              {step.description && (
                <p className="text-sm text-gray-600">{step.description}</p>
              )}

              {/* Work instructions */}
              {editingStep === step.id ? (
                <div className="space-y-3">
                  <label className="text-sm font-medium">Work Instructions</label>
                  <textarea
                    className="w-full border rounded-lg p-3 text-sm min-h-[120px] font-mono resize-y"
                    value={instrText}
                    onChange={e => setInstrText(e.target.value)}
                    placeholder="Enter step-by-step work instructions..."
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveInstructions.mutate({ stepId: step.id, instructions: instrText })} loading={saveInstructions.isPending}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingStep(null)}>Cancel</Button>
                  </div>
                </div>
              ) : step.work_instructions ? (
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-xs font-semibold text-blue-700 mb-2">Work Instructions</div>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{step.work_instructions}</pre>
                </div>
              ) : (
                <div className="text-sm text-gray-400 italic">No work instructions yet. Click Edit to add.</div>
              )}

              {/* Media attachments */}
              {step.instruction_media && step.instruction_media.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 mb-2">Reference Media</div>
                  <div className="flex flex-wrap gap-3">
                    {step.instruction_media.map((m, i) => (
                      <div key={i} className="border rounded-lg overflow-hidden w-40">
                        {m.type === 'image' ? (
                          <img src={m.url} alt={m.caption || `Step ${step.step_number} media`} className="w-full h-28 object-cover" />
                        ) : (
                          <div className="w-full h-28 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                            {m.type.toUpperCase()}
                          </div>
                        )}
                        {m.caption && (
                          <div className="px-2 py-1 text-xs text-gray-600">{m.caption}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add media (only when editing this step) */}
              {editingStep === step.id && (
                <div className="border-t pt-3 space-y-2">
                  <div className="text-xs font-semibold text-gray-500">Add Media</div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Image URL"
                      value={mediaUrl}
                      onChange={e => setMediaUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Caption"
                      value={mediaCaption}
                      onChange={e => setMediaCaption(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={() => { if (mediaUrl) addMedia.mutate({ stepId: step.id, url: mediaUrl, caption: mediaCaption }) }}
                      disabled={!mediaUrl}
                      loading={addMedia.isPending}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {(!routing.steps || routing.steps.length === 0) && (
        <Card className="p-8 text-center text-gray-500">No routing steps defined.</Card>
      )}
    </div>
  )
}

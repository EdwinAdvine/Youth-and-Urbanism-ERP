import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  useWorkflow,
  useAddNode,
  useUpdateNode,
  useDeleteNode,
  useTestWorkflow,
  useWorkflowExecutions,
  type WorkflowNode,
  type WorkflowExecution,
  type NodeCreatePayload,
} from '@/api/crm_workflows'
import { Button, Badge, Spinner, Modal, Select, cn, toast } from '@/components/ui'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// ─── Node color mapping ──────────────────────────────────────────────────────

const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  trigger:   { bg: '#51459d20', border: '#51459d', text: '#51459d' },
  action:    { bg: '#3ec9d620', border: '#3ec9d6', text: '#0e7490' },
  condition: { bg: '#ffa21d20', border: '#ffa21d', text: '#92400e' },
  delay:     { bg: '#6fd94320', border: '#6fd943', text: '#166534' },
  branch:    { bg: '#ff3a6e20', border: '#ff3a6e', text: '#9f1239' },
}

const NODE_TYPE_OPTIONS = [
  { value: 'trigger', label: 'Trigger' },
  { value: 'action', label: 'Action' },
  { value: 'condition', label: 'Condition' },
  { value: 'delay', label: 'Delay' },
  { value: 'branch', label: 'Branch' },
]

// ─── Custom Node Component ──────────────────────────────────────────────────

function WorkflowNodeComponent({ data }: NodeProps) {
  const nodeData = data as { label: string; nodeType: string; onSelect: () => void }
  const colors = NODE_COLORS[nodeData.nodeType] ?? NODE_COLORS.action
  return (
    <div
      onClick={nodeData.onSelect}
      className="px-4 py-3 rounded-[10px] min-w-[160px] cursor-pointer shadow-sm border-2 transition-shadow hover:shadow-md"
      style={{ backgroundColor: colors.bg, borderColor: colors.border }}
    >
      <div className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: colors.text }}>
        {nodeData.nodeType}
      </div>
      <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
        {nodeData.label}
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = {
  workflowNode: WorkflowNodeComponent as any,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildFlowElements(
  workflowNodes: WorkflowNode[],
  onSelectNode: (n: WorkflowNode) => void,
) {
  const nodes: Node[] = workflowNodes.map((wn) => ({
    id: wn.id,
    type: 'workflowNode',
    position: { x: wn.position_x, y: wn.position_y },
    data: {
      label: wn.config?.label ?? wn.node_type,
      nodeType: wn.node_type,
      onSelect: () => onSelectNode(wn),
    },
  }))

  const edges: Edge[] = []
  for (const wn of workflowNodes) {
    if (wn.next_node_id) {
      edges.push({
        id: `e-${wn.id}-${wn.next_node_id}`,
        source: wn.id,
        target: wn.next_node_id,
        label: '',
        animated: true,
        style: { stroke: '#51459d' },
      })
    }
    if (wn.true_branch_node_id) {
      edges.push({
        id: `e-${wn.id}-true-${wn.true_branch_node_id}`,
        source: wn.id,
        target: wn.true_branch_node_id,
        label: 'True',
        style: { stroke: '#6fd943' },
      })
    }
    if (wn.false_branch_node_id) {
      edges.push({
        id: `e-${wn.id}-false-${wn.false_branch_node_id}`,
        source: wn.id,
        target: wn.false_branch_node_id,
        label: 'False',
        style: { stroke: '#ff3a6e' },
      })
    }
  }

  return { nodes, edges }
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function WorkflowCanvasPage() {
  const { workflowId } = useParams<{ workflowId: string }>()
  const navigate = useNavigate()
  const { data: workflow, isLoading, error } = useWorkflow(workflowId ?? '')
  const addNode = useAddNode(workflowId ?? '')
  const updateNode = useUpdateNode(workflowId ?? '')
  const deleteNode = useDeleteNode(workflowId ?? '')
  const testWorkflow = useTestWorkflow()
  const { data: executionsData } = useWorkflowExecutions(workflowId ?? '')

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null)
  const [configStr, setConfigStr] = useState('{}')
  const [addNodeOpen, setAddNodeOpen] = useState(false)
  const [newNodeType, setNewNodeType] = useState('action')
  const [execPanelOpen, setExecPanelOpen] = useState(false)

  const executions: WorkflowExecution[] = executionsData?.items ?? executionsData ?? []

  // Sync workflow nodes to ReactFlow state
  useEffect(() => {
    if (!workflow?.nodes) return
    const { nodes: flowNodes, edges: flowEdges } = buildFlowElements(
      workflow.nodes,
      (wn) => {
        setSelectedNode(wn)
        setConfigStr(wn.config ? JSON.stringify(wn.config, null, 2) : '{}')
      },
    )
    setNodes(flowNodes)
    setEdges(flowEdges)
  }, [workflow?.nodes, setNodes, setEdges])

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: true, style: { stroke: '#51459d' } }, eds))
    },
    [setEdges],
  )

  const handleAddNode = async () => {
    const payload: NodeCreatePayload = {
      node_type: newNodeType,
      position_x: 250 + Math.random() * 200,
      position_y: 100 + (workflow?.nodes?.length ?? 0) * 120,
      config: { label: `New ${newNodeType}` },
    }
    try {
      await addNode.mutateAsync(payload)
      toast('success', 'Node added')
      setAddNodeOpen(false)
    } catch {
      toast('error', 'Failed to add node')
    }
  }

  const handleUpdateNodeConfig = async () => {
    if (!selectedNode) return
    let config: Record<string, any> | null = null
    try {
      config = JSON.parse(configStr)
    } catch {
      toast('error', 'Invalid JSON')
      return
    }
    try {
      await updateNode.mutateAsync({ nodeId: selectedNode.id, config })
      toast('success', 'Node config updated')
      setSelectedNode(null)
    } catch {
      toast('error', 'Failed to update node')
    }
  }

  const handleDeleteNode = async () => {
    if (!selectedNode) return
    if (!window.confirm('Delete this node?')) return
    try {
      await deleteNode.mutateAsync(selectedNode.id)
      toast('success', 'Node deleted')
      setSelectedNode(null)
    } catch {
      toast('error', 'Failed to delete node')
    }
  }

  const handleTest = async () => {
    if (!workflowId) return
    try {
      await testWorkflow.mutateAsync({ id: workflowId })
      toast('success', 'Test execution started')
    } catch {
      toast('error', 'Test failed')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error || !workflow) {
    return (
      <div className="p-6 text-center text-gray-500">
        Failed to load workflow.
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/crm/workflows')}>
          Back to Workflows
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/crm/workflows')}
            className="text-sm text-gray-500 hover:text-primary flex items-center gap-1"
          >
            &larr; Back
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{workflow.name}</h1>
          <Badge variant={workflow.status === 'active' ? 'success' : workflow.status === 'paused' ? 'warning' : 'default'}>
            {workflow.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setAddNodeOpen(true)}>
            + Add Node
          </Button>
          <Button size="sm" variant="secondary" onClick={handleTest} loading={testWorkflow.isPending}>
            Test Workflow
          </Button>
          <Button size="sm" variant="outline" onClick={() => setExecPanelOpen(!execPanelOpen)}>
            Executions ({executions.length})
          </Button>
        </div>
      </div>

      {/* Canvas + Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* ReactFlow Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            className="bg-gray-50 dark:bg-gray-900"
          >
            <Background color="#51459d" gap={20} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                const nt = (n.data as any)?.nodeType ?? 'action'
                return NODE_COLORS[nt]?.border ?? '#51459d'
              }}
              style={{ borderRadius: 10 }}
            />
          </ReactFlow>
        </div>

        {/* Right sidebar — node config editor */}
        {selectedNode && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Node Config</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-gray-500">Type</span>
              <div>
                <Badge variant="primary">{selectedNode.node_type}</Badge>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-gray-500">ID</span>
              <code className="block text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-400 break-all">
                {selectedNode.id}
              </code>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Config (JSON)
              </label>
              <textarea
                className="w-full rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                rows={10}
                value={configStr}
                onChange={(e) => setConfigStr(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={handleUpdateNodeConfig} loading={updateNode.isPending}>
                Save Config
              </Button>
              <Button size="sm" variant="danger" onClick={handleDeleteNode} loading={deleteNode.isPending}>
                Delete Node
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom panel — executions */}
      {execPanelOpen && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 max-h-56 overflow-y-auto">
          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Execution History
            </h3>
            <button
              onClick={() => setExecPanelOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Close
            </button>
          </div>
          {executions.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              No executions yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">ID</th>
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Started</th>
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Completed</th>
                  <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Error</th>
                </tr>
              </thead>
              <tbody>
                {executions.map((ex) => (
                  <tr key={ex.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                    <td className="py-2 px-4">
                      <code className="text-xs text-gray-500">{ex.id.slice(0, 8)}...</code>
                    </td>
                    <td className="py-2 px-4">
                      <Badge variant={ex.status === 'completed' ? 'success' : ex.status === 'failed' ? 'danger' : 'info'}>
                        {ex.status}
                      </Badge>
                    </td>
                    <td className="py-2 px-4 text-gray-500">{new Date(ex.started_at).toLocaleString()}</td>
                    <td className="py-2 px-4 text-gray-500">{ex.completed_at ? new Date(ex.completed_at).toLocaleString() : '-'}</td>
                    <td className="py-2 px-4 text-red-500 text-xs truncate max-w-[200px]">{ex.error_message ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Node Modal */}
      <Modal open={addNodeOpen} onClose={() => setAddNodeOpen(false)} title="Add Node" size="sm">
        <div className="space-y-4">
          <Select
            label="Node Type"
            value={newNodeType}
            onChange={(e) => setNewNodeType(e.target.value)}
            options={NODE_TYPE_OPTIONS}
          />
          <div className="grid grid-cols-5 gap-2">
            {NODE_TYPE_OPTIONS.map((opt) => {
              const colors = NODE_COLORS[opt.value] ?? NODE_COLORS.action
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNewNodeType(opt.value)}
                  className={cn(
                    'rounded-[10px] p-2 text-center text-xs font-medium border-2 transition-all',
                    newNodeType === opt.value ? 'ring-2 ring-offset-1' : 'opacity-70 hover:opacity-100',
                  )}
                  style={{
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    color: colors.text,
                    ...(newNodeType === opt.value ? { ringColor: colors.border } : {}),
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setAddNodeOpen(false)}>Cancel</Button>
            <Button onClick={handleAddNode} loading={addNode.isPending}>Add Node</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

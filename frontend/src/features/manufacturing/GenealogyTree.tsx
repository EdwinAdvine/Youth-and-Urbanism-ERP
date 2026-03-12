import { useParams, useNavigate } from 'react-router-dom'
import { Badge, Card } from '../../components/ui'
import { useGenealogy, type GenealogyNode } from '../../api/manufacturing_trace'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary'

const statusColors: Record<string, BadgeVariant> = { active: 'success', consumed: 'info', shipped: 'primary', recalled: 'danger' }

function TreeNode({ node, depth = 0, queriedId, onNavigate }: { node: GenealogyNode; depth?: number; queriedId: string; onNavigate: (id: string) => void }) {
  const isQueried = node.id === queriedId
  return (
    <div style={{ marginLeft: depth * 32 }} className="my-1">
      <div
        className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-100 ${isQueried ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50'}`}
        onClick={() => onNavigate(node.id)}
      >
        <span className="text-xs text-gray-400">{'└'.repeat(depth > 0 ? 1 : 0)}</span>
        <span className="font-mono text-sm font-medium">{node.tracking_number}</span>
        <Badge variant={statusColors[node.status] || 'default'} className="text-xs">{node.status}</Badge>
        <span className="text-xs text-gray-500 capitalize">{node.tracking_type}</span>
        <span className="text-xs text-gray-400">qty: {node.quantity}</span>
        {isQueried && <span className="text-xs text-purple-600 font-semibold">← queried</span>}
      </div>
      {node.children?.map(child => (
        <TreeNode key={child.id} node={child} depth={depth + 1} queriedId={queriedId} onNavigate={onNavigate} />
      ))}
    </div>
  )
}

export default function GenealogyTreePage() {
  const { lotId } = useParams<{ lotId: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useGenealogy(lotId!)

  if (isLoading) return <div className="p-6">Loading genealogy...</div>
  if (!data) return <div className="p-6">No genealogy data</div>

  return (
    <div className="p-6 space-y-6">
      <div>
        <button className="text-sm text-gray-500 hover:underline mb-1" onClick={() => navigate(`/manufacturing/lots/${lotId}`)}>
          ← Back to Lot
        </button>
        <h1 className="text-2xl font-bold">Product Genealogy</h1>
      </div>

      <Card className="p-4">
        <p className="text-sm text-gray-500 mb-4">Full product genealogy tree showing parent-child relationships between lots and serial numbers.</p>
        {data.genealogy_tree.id ? (
          <TreeNode node={data.genealogy_tree} queriedId={data.queried_lot_id} onNavigate={(id) => navigate(`/manufacturing/lots/${id}`)} />
        ) : (
          <p className="text-sm text-gray-500">No genealogy data available</p>
        )}
      </Card>
    </div>
  )
}

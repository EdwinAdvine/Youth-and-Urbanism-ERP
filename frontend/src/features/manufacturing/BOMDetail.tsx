import { useParams, useNavigate } from 'react-router-dom'
import { Spinner, Badge, Card } from '../../components/ui'
import { useBOMDetail, useBOMCost, type BOMItem } from '../../api/manufacturing'

function formatCurrency(amount: string | number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount))
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function BOMDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: bom, isLoading } = useBOMDetail(id ?? '')
  const { data: cost, isLoading: costLoading } = useBOMCost(id ?? '')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!bom) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-400">
        Bill of Materials not found.
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/manufacturing/bom')}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
          >
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{bom.bom_number}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={bom.is_active ? 'success' : 'default'}>{bom.is_active ? 'Active' : 'Inactive'}</Badge>
              {bom.is_default && <Badge variant="info">Default</Badge>}
              <span className="text-sm text-gray-500">v{bom.version}</span>
            </div>
          </div>
        </div>
      </div>

      {/* BOM Header Info */}
      <Card className="mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Name</p>
            <p className="text-sm font-semibold text-gray-900 mt-1">{bom.name}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Finished Item</p>
            <p className="text-sm text-gray-900 mt-1">{bom.finished_item_name ?? bom.finished_item_id}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Qty Produced</p>
            <p className="text-sm text-gray-900 mt-1">{bom.quantity_produced}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created</p>
            <p className="text-sm text-gray-900 mt-1">{formatDate(bom.created_at)}</p>
          </div>
        </div>
        {bom.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-gray-700">{bom.notes}</p>
          </div>
        )}
      </Card>

      {/* Cost Summary */}
      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Material Cost Breakdown</p>
            {costLoading ? (
              <div className="flex items-center gap-2 mt-2">
                <Spinner size="sm" />
                <span className="text-sm text-gray-400">Calculating costs...</span>
              </div>
            ) : cost ? (
              <div className="flex items-center gap-6 mt-2">
                <div>
                  <span className="text-xs text-gray-500">Unit Cost</span>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(cost.unit_cost)}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Total Cost ({bom.quantity_produced} units)</span>
                  <p className="text-lg font-bold text-primary">{formatCurrency(cost.total_cost)}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 mt-1">Unable to calculate costs</p>
            )}
          </div>
        </div>
      </Card>

      {/* BOM Items Tree */}
      <Card padding={false}>
        <div className="p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Materials ({bom.items.length} items)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Qty Required</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-20">UOM</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide w-24">Scrap %</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sub-BOM</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
              </tr>
            </thead>
            <tbody>
              {bom.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">No items in this BOM</td>
                </tr>
              ) : (
                bom.items
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((item: BOMItem, idx: number) => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-gray-400">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900">{item.item_name ?? item.item_id}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">{item.quantity_required}</td>
                      <td className="py-3 px-4 text-gray-600">{item.unit_of_measure}</td>
                      <td className="py-3 px-4 text-right">
                        {Number(item.scrap_percentage) > 0 ? (
                          <span className="text-orange-600">{item.scrap_percentage}%</span>
                        ) : (
                          <span className="text-gray-400">0%</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {item.child_bom_id ? (
                          <button
                            className="text-primary hover:underline text-xs"
                            onClick={() => navigate(`/manufacturing/bom/${item.child_bom_id}`)}
                          >
                            View Sub-BOM
                          </button>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs max-w-[150px] truncate">
                        {item.notes ?? '--'}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

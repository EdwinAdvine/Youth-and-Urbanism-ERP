import { useState } from 'react'
import { Card, Spinner, Select } from '../../components/ui'
import { useInventoryValuation, useWarehouses } from '../../api/inventory'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default function ValuationReportPage() {
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const { data: valuations, isLoading } = useInventoryValuation({ warehouse_id: warehouseFilter || undefined })
  const { data: warehouses } = useWarehouses()

  const grandTotal = valuations?.reduce((sum, v) => sum + v.total_value, 0) ?? 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Inventory Valuation</h1>
        <p className="text-sm text-gray-500 mt-1">Stock value by warehouse and item</p>
      </div>

      <div className="flex gap-4 items-end">
        <Select
          label="Warehouse"
          options={[
            { value: '', label: 'All Warehouses' },
            ...(warehouses?.map((w) => ({ value: w.id, label: w.name })) ?? []),
          ]}
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
          className="w-64"
        />
      </div>

      {/* Grand Total */}
      <Card className="bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Inventory Value</p>
            <p className="text-3xl font-bold text-primary mt-1">{formatCurrency(grandTotal)}</p>
          </div>
          <p className="text-sm text-gray-500">{valuations?.length ?? 0} warehouse(s)</p>
        </div>
      </Card>

      {valuations && valuations.length > 0 ? (
        valuations.map((v) => (
          <Card key={v.warehouse_id}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{v.warehouse_name}</h3>
              <span className="text-lg font-bold text-primary">{formatCurrency(v.total_value)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Item</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">SKU</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Qty</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Unit Cost</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {v.items.map((item) => (
                    <tr key={item.item_id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-2 px-3 font-medium">{item.item_name}</td>
                      <td className="py-2 px-3 text-gray-500">{item.sku}</td>
                      <td className="py-2 px-3 text-right">{item.quantity.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right">{formatCurrency(item.unit_cost)}</td>
                      <td className="py-2 px-3 text-right font-semibold">{formatCurrency(item.total_value)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 dark:border-gray-700">
                    <td colSpan={4} className="py-2 px-3 font-semibold text-right">Warehouse Total</td>
                    <td className="py-2 px-3 text-right font-bold text-primary">{formatCurrency(v.total_value)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        ))
      ) : (
        <Card>
          <div className="text-center py-12 text-gray-400">No valuation data available</div>
        </Card>
      )}
    </div>
  )
}

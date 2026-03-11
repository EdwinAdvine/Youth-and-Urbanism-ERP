import { useState } from 'react'
import { Card, Badge, Input, Spinner } from '../../components/ui'
import { useInventoryItems, useStockLevels, type InventoryItem, type StockLevel } from '../../api/inventory'

export default function MobileStockCheck() {
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)

  const { data: items, isLoading: itemsLoading } = useInventoryItems({
    search: search || undefined,
    limit: 20,
  })

  const { data: stockLevels, isLoading: stockLoading } = useStockLevels(
    selectedItem ? { item_id: selectedItem.id } : {}
  )

  const filteredItems = items?.items ?? []

  function handleSelectItem(item: InventoryItem) {
    setSelectedItem(item)
    setSearch(item.name)
  }

  function handleClearSelection() {
    setSelectedItem(null)
    setSearch('')
  }

  // Calculate total stock across warehouses
  const totalStock = (stockLevels ?? []).reduce((sum, sl) => sum + sl.quantity_on_hand, 0)
  const totalReserved = (stockLevels ?? []).reduce((sum, sl) => sum + sl.quantity_reserved, 0)

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Input
          placeholder="Search items by name or SKU..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            if (selectedItem) setSelectedItem(null)
          }}
          className="min-h-[48px] text-base pr-10"
          leftIcon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          }
        />
        {search && (
          <button
            onClick={handleClearSelection}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Selected Item Detail */}
      {selectedItem && (
        <Card className="border-2 border-primary/20">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{selectedItem.name}</h3>
              <p className="text-sm text-gray-500">SKU: {selectedItem.sku}</p>
              {selectedItem.category && (
                <Badge variant="default" className="mt-1">{selectedItem.category}</Badge>
              )}
            </div>
            <button
              onClick={handleClearSelection}
              className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 -mt-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Total Stock Summary */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center bg-green-50 rounded-[10px] p-3">
              <p className="text-2xl font-bold text-green-700">{totalStock}</p>
              <p className="text-[10px] text-green-600 uppercase tracking-wide">On Hand</p>
            </div>
            <div className="text-center bg-orange-50 rounded-[10px] p-3">
              <p className="text-2xl font-bold text-orange-700">{totalReserved}</p>
              <p className="text-[10px] text-orange-600 uppercase tracking-wide">Reserved</p>
            </div>
            <div className="text-center bg-blue-50 rounded-[10px] p-3">
              <p className="text-2xl font-bold text-blue-700">{totalStock - totalReserved}</p>
              <p className="text-[10px] text-blue-600 uppercase tracking-wide">Available</p>
            </div>
          </div>

          {/* Reorder alert */}
          {totalStock <= selectedItem.reorder_level && (
            <div className="bg-red-50 border border-red-200 rounded-[10px] px-3 py-2 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm text-red-700">
                Below reorder level ({selectedItem.reorder_level})
              </span>
            </div>
          )}

          {/* Per-warehouse breakdown */}
          {stockLoading ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : (stockLevels ?? []).length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">By Warehouse</h4>
              {(stockLevels ?? []).map((sl: StockLevel) => (
                <div
                  key={`${sl.item_id}-${sl.warehouse_id}`}
                  className="flex items-center justify-between py-3 px-3 bg-gray-50 dark:bg-gray-950 rounded-[10px]"
                >
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {sl.warehouse_name ?? sl.warehouse_id}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{sl.quantity_on_hand}</span>
                    {sl.quantity_reserved > 0 && (
                      <span className="text-xs text-orange-600">({sl.quantity_reserved} reserved)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-gray-400 py-4">No stock data available</p>
          )}

          {/* Price info */}
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-sm">
            <div>
              <span className="text-gray-500">Cost: </span>
              <span className="font-medium">${selectedItem.cost_price.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500">Sell: </span>
              <span className="font-medium">${selectedItem.selling_price.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500">UoM: </span>
              <span className="font-medium">{selectedItem.unit_of_measure}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Search Results */}
      {!selectedItem && search.length > 0 && (
        <Card padding={false}>
          {itemsLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No items found</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 transition-colors min-h-[56px] flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      SKU: {item.sku}
                      {item.category && ` | ${item.category}`}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Empty state when no search */}
      {!selectedItem && !search && (
        <Card className="text-center py-8">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm text-gray-500">Search for an item to check stock levels</p>
          <p className="text-xs text-gray-400 mt-1">Search by name, SKU, or category</p>
        </Card>
      )}
    </div>
  )
}

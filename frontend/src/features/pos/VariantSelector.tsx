import { useState } from 'react'
import { Button, Badge, Spinner, Modal } from '../../components/ui'
import { useProductVariants, type ProductVariant } from '../../api/pos'

interface VariantSelectorProps {
  open: boolean
  onClose: () => void
  itemId: string
  onSelect: (variantId: string, priceAdjustment: number) => void
}

export function VariantSelector({ open, onClose, itemId, onSelect }: VariantSelectorProps) {
  const { data: variants, isLoading } = useProductVariants(itemId)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedVariant = variants?.find((v) => v.id === selectedId)

  const handleAdd = () => {
    if (!selectedVariant) return
    onSelect(selectedVariant.id, parseFloat(selectedVariant.price_adjustment))
    setSelectedId(null)
    onClose()
  }

  const handleClose = () => {
    setSelectedId(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Select Variant" size="lg">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : !variants || variants.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No variants available</p>
      ) : (
        <div className="space-y-4">
          {/* Group variants by variant_name (e.g. Size, Color) */}
          {Object.entries(groupByName(variants)).map(([groupName, groupVariants]) => (
            <div key={groupName}>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {groupName}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {groupVariants.map((v) => {
                  const isSelected = selectedId === v.id
                  const adjustment = parseFloat(v.price_adjustment)
                  const outOfStock = v.stock_on_hand <= 0

                  return (
                    <button
                      key={v.id}
                      disabled={outOfStock || !v.is_active}
                      onClick={() => setSelectedId(v.id)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        isSelected
                          ? 'border-[#51459d] bg-[#51459d]/5 ring-2 ring-[#51459d]/20'
                          : outOfStock || !v.is_active
                            ? 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 opacity-50 cursor-not-allowed'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-[#51459d]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {v.variant_value}
                        </span>
                        {outOfStock && (
                          <Badge variant="danger">Out</Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className={adjustment > 0 ? 'text-[#ffa21d]' : adjustment < 0 ? 'text-[#6fd943]' : 'text-gray-400'}>
                          {adjustment > 0
                            ? `+$${adjustment.toFixed(2)}`
                            : adjustment < 0
                              ? `-$${Math.abs(adjustment).toFixed(2)}`
                              : 'Base price'}
                        </span>
                        <span className="text-gray-400">
                          {v.stock_on_hand} in stock
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Selected summary and action */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
            <div>
              {selectedVariant ? (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Selected: <span className="font-medium">{selectedVariant.variant_name} - {selectedVariant.variant_value}</span>
                  {parseFloat(selectedVariant.price_adjustment) !== 0 && (
                    <span className="ml-2 text-[#51459d] font-medium">
                      ({parseFloat(selectedVariant.price_adjustment) > 0 ? '+' : ''}${selectedVariant.price_adjustment})
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-gray-400">Select a variant to continue</p>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!selectedVariant}
                onClick={handleAdd}
              >
                Add to Cart
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

function groupByName(variants: ProductVariant[]): Record<string, ProductVariant[]> {
  const groups: Record<string, ProductVariant[]> = {}
  for (const v of variants) {
    const key = v.variant_name
    if (!groups[key]) groups[key] = []
    groups[key].push(v)
  }
  return groups
}

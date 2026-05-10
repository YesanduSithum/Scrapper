import type { BasketItem, Retailer } from '../types'
import { AVAILABLE_RETAILERS, RETAILER_LABELS, RETAILER_MAP_QUERIES } from '../constants/retailers'
import { MapPin, ChevronDown } from 'lucide-react'

function openNearestStoreMap(store: Retailer) {
  const query = RETAILER_MAP_QUERIES[store]
  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank')
}

const STORES: Retailer[] = AVAILABLE_RETAILERS

function getStoreTotals(items: BasketItem[]) {
  return STORES.map((store) => ({
    store,
    total: items.reduce(
      (sum, { product, quantity }) => sum + (product.prices[store] ?? 0) * quantity,
      0
    ),
    breakdown: items.map(({ product, quantity }) => ({
      name: product.name,
      quantity,
      unitPrice: product.prices[store] ?? 0,
      lineTotal: (product.prices[store] ?? 0) * quantity,
    })),
  }))
}

export function CheapestStoreResults({
  items,
  onBack,
  onFindNearestStore,
  isProcessing = false,
}: {
  items: BasketItem[]
  onBack: () => void
  onFindNearestStore?: (store: Retailer) => void
  isProcessing?: boolean
}) {
  const storeTotals = getStoreTotals(items)
  const sorted = [...storeTotals].sort((a, b) => a.total - b.total)
  const cheapestTotal = sorted[0]?.total ?? 0

  return (
    <div className="px-4 py-6 pb-28">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-grey-900">Cheapest stores for your list</h2>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-primary-600 hover:underline"
        >
          Back to list
        </button>
      </div>
      <p className="text-sm text-grey-500 mb-6">
        Stores ranked by total price. Tap a store to see item details.
      </p>

      <div className="space-y-4">
        {sorted.map(({ store, total, breakdown }, rank) => {
          const isCheapest = total <= cheapestTotal
          return (
            <details
              key={store}
              className="bg-white rounded-2xl border border-grey-200 shadow-card overflow-hidden group"
            >
              <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                <div className="flex items-center gap-3">
                  <span
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      rank === 0 ? 'bg-primary-100 text-primary-700' : 'bg-grey-100 text-grey-700'
                    }`}
                  >
                    {rank + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-grey-900">{RETAILER_LABELS[store]}</p>
                    <p className={`text-sm ${isCheapest ? 'text-primary-600 font-semibold' : 'text-grey-500'}`}>
                      Rs. {total.toLocaleString()}
                      {isCheapest && ' — Cheapest'}
                    </p>
                  </div>
                </div>
                <ChevronDown className="w-5 h-5 text-grey-400 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="border-t border-grey-100 bg-grey-50/50 px-4 py-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-grey-500 text-left">
                      <th className="pb-2 font-medium">Item</th>
                      <th className="pb-2 font-medium text-center">Qty</th>
                      <th className="pb-2 font-medium text-right">Unit</th>
                      <th className="pb-2 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map(({ name, quantity, unitPrice, lineTotal }) => (
                      <tr key={name} className="border-t border-grey-100">
                        <td className="py-2 text-grey-900">{name}</td>
                        <td className="py-2 text-center text-grey-600">{quantity}</td>
                        <td className="py-2 text-right text-grey-600">Rs. {unitPrice.toLocaleString()}</td>
                        <td className="py-2 text-right font-medium text-grey-900">Rs. {lineTotal.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end mt-3 pt-3 border-t border-grey-200">
                  <strong className="text-grey-900">Rs. {total.toLocaleString()}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => (onFindNearestStore ? onFindNearestStore(store) : openNearestStoreMap(store))}
                  disabled={isProcessing}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary-100 text-primary-700 font-medium hover:bg-primary-200"
                >
                  <MapPin className="w-4 h-4" />
                  {isProcessing ? 'Saving purchase...' : `Save and show nearest ${RETAILER_LABELS[store]}`}
                </button>
              </div>
            </details>
          )
        })}
      </div>
    </div>
  )
}

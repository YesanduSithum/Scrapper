import { useMemo } from 'react'
import type { BasketItem, Retailer } from '../types'
import { AVAILABLE_RETAILERS, RETAILER_LABELS } from '../constants/retailers'
import { ShoppingBag } from 'lucide-react'

const STORES: Retailer[] = AVAILABLE_RETAILERS

function totalByStore(items: BasketItem[], store: Retailer): number {
  return items.reduce(
    (sum, { product, quantity }) => sum + (product.prices[store] ?? 0) * quantity,
    0
  )
}

export function BasketSummary({ items }: { items: BasketItem[] }) {
  const { totals, cheapestStore } = useMemo(() => {
    const totals = STORES.map((store) => ({
      store,
      total: totalByStore(items, store),
    }))
    const cheapest = totals.reduce((a, b) => (a.total <= b.total ? a : b))
    return { totals, cheapestStore: cheapest.store }
  }, [items])

  if (items.length === 0) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-grey-200 shadow-dock safe-bottom">
        <div className="px-4 py-3 flex items-center justify-center gap-2 text-grey-500">
          <ShoppingBag className="w-5 h-5" />
          <span className="text-sm">Add items to see basket total &amp; cheapest store</span>
        </div>
      </div>
    )
  }

  const cheapestTotal = Math.min(...totals.map((t) => t.total))

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-grey-200 shadow-dock safe-bottom">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-grey-700">Basket Summary</span>
          <span className="text-xs text-grey-500">{items.length} item(s)</span>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center mb-2">
          {totals.map(({ store, total }) => (
            <div
              key={store}
              className={`rounded-lg py-1.5 ${
                store === cheapestStore ? 'bg-primary-100 text-primary-800' : 'bg-grey-100 text-grey-700'
              }`}
            >
              <p className="text-[10px] font-medium uppercase">{RETAILER_LABELS[store]}</p>
              <p className="text-sm font-bold">Rs. {total.toLocaleString()}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-grey-600 text-center">
          Cheapest total: <strong className="text-primary-600">{RETAILER_LABELS[cheapestStore]}</strong> — Rs. {cheapestTotal.toLocaleString()}
        </p>
      </div>
    </div>
  )
}

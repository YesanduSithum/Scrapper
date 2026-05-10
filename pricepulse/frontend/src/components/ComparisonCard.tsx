import type { Product, Retailer } from '../types'
import { AVAILABLE_RETAILERS, RETAILER_LABELS } from '../constants/retailers'
import { Plus } from 'lucide-react'

const STORES: Retailer[] = AVAILABLE_RETAILERS

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  return `${hours}h ago`
}

function getPriceClass(price: number | undefined, prices: Product['prices']) {
  if (price == null) return 'text-grey-400'
  const values = Object.values(prices).filter((p): p is number => p != null)
  if (values.length === 0) return 'text-grey-700'
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (price <= min) return 'text-green-600 font-bold'
  if (price >= max) return 'text-red-600 font-semibold'
  return 'text-grey-700'
}

export function ComparisonCard({
  product,
  onAddToBasket,
}: {
  product: Product
  onAddToBasket: () => void
}) {
  const { name, nameSinhala, image, prices, lastUpdated } = product

  return (
    <article className="bg-white rounded-2xl border border-grey-200 shadow-card overflow-hidden">
      <div className="flex gap-3 p-4">
        <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-grey-100">
          <img
            src={image}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-grey-900 truncate">{name}</h3>
          {nameSinhala && (
            <p className="text-sm text-grey-500 sinhala truncate">{nameSinhala}</p>
          )}
          <p className="text-xs text-grey-400 mt-1">Updated {formatTime(lastUpdated)}</p>
        </div>
        <button
          type="button"
          onClick={onAddToBasket}
          className="flex-shrink-0 self-center p-2 rounded-full bg-primary-100 text-primary-700 hover:bg-primary-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label="Add to basket"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
      <div className="grid grid-cols-4 border-t border-grey-100 bg-grey-50/80">
        {STORES.map((store) => {
          const price = prices[store]
          return (
            <div
              key={store}
              className="px-3 py-2.5 text-center border-r border-grey-100 last:border-r-0"
            >
              <p className="text-[10px] uppercase tracking-wide text-grey-500 font-medium">
                {RETAILER_LABELS[store]}
              </p>
              <p className={`text-sm font-semibold ${getPriceClass(price, prices)}`}>
                {price != null && price > 0 ? `Rs. ${price.toLocaleString()}` : 'N/A'}
              </p>
            </div>
          )
        })}
      </div>
    </article>
  )
}

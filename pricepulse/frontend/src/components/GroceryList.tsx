import type { BasketItem } from '../types'
import { Minus, Plus, Trash2 } from 'lucide-react'

export function GroceryList({
  items,
  onUpdateQuantity,
  onRemove,
}: {
  items: BasketItem[]
  onUpdateQuantity: (productId: string, delta: number) => void
  onRemove: (productId: string) => void
}) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-grey-500 bg-grey-50 rounded-2xl mx-4">
        <p className="text-sm">Your grocery list is empty.</p>
        <p className="text-xs mt-1">Search above and add items to compare prices.</p>
      </div>
    )
  }

  return (
    <section className="px-4 py-4" aria-label="My grocery list">
      <h2 className="text-lg font-semibold text-grey-900 mb-3">My grocery list</h2>
      <ul className="space-y-3">
        {items.map(({ product, quantity }) => (
          <li
            key={product.id}
            className="flex items-center gap-3 p-3 bg-white rounded-xl border border-grey-200 shadow-card"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-grey-900 truncate">{product.name}</p>
              <p className="text-xs text-grey-500">Rs. {product.prices.cargills} – Rs. {Math.max(...Object.values(product.prices))} per unit</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onUpdateQuantity(product.id, -1)}
                disabled={quantity <= 1}
                className="p-2 rounded-lg bg-grey-100 text-grey-700 hover:bg-grey-200 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Decrease quantity"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center font-semibold text-grey-900" aria-live="polite">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => onUpdateQuantity(product.id, 1)}
                className="p-2 rounded-lg bg-primary-100 text-primary-700 hover:bg-primary-200"
                aria-label="Increase quantity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => onRemove(product.id)}
              className="p-2 rounded-lg text-grey-500 hover:bg-dangerLight hover:text-danger"
              aria-label="Remove from list"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

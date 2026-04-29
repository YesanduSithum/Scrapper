import { useMemo } from 'react'
import type { Product } from '../types'
import { ComparisonCard } from './ComparisonCard'

export function ComparisonRadar({
  searchQuery,
  products,
  onAddToBasket,
}: {
  searchQuery: string
  products: Product[]
  onAddToBasket: (product: Product) => void
}) {
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.nameSinhala && p.nameSinhala.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q)
    )
  }, [products, searchQuery])

  return (
    <section className="px-4 py-4" aria-label="Comparison Radar">
      <h2 className="text-lg font-semibold text-grey-900 mb-3">Comparison Radar</h2>
      <p className="text-sm text-grey-500 mb-4">
        Real-time prices across Cargills, Keells & Sathosa. Lowest in green, highest in red.
      </p>
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <p className="text-grey-500 text-center py-8">No products match your search.</p>
        ) : (
          filtered.map((product) => (
            <ComparisonCard
              key={product.id}
              product={product}
              onAddToBasket={() => onAddToBasket(product)}
            />
          ))
        )}
      </div>
    </section>
  )
}

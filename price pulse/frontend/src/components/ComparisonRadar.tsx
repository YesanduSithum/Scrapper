import { useMemo } from 'react'
import type { Product } from '../types'
import { ComparisonCard } from './ComparisonCard'
import { MOCK_PRODUCTS } from '../data/mockProducts'

export function ComparisonRadar({
  searchQuery,
  onAddToBasket,
}: {
  searchQuery: string
  onAddToBasket: (product: Product) => void
}) {
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return MOCK_PRODUCTS
    return MOCK_PRODUCTS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.nameSinhala && p.nameSinhala.includes(q)) ||
        p.category.toLowerCase().includes(q)
    )
  }, [searchQuery])

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

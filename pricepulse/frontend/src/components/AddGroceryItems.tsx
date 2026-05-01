import { useMemo, useState } from 'react'
import { Plus, Minus, PlusCircle } from 'lucide-react'
import type { Product } from '../types'
import type { ProcessListResult } from '../types'
import { api } from '../services/api'
import { mapApiProductToProduct } from '../services/productMapper'

interface AddGroceryItemsProps {
  products: Product[]
  onAddToBasket: (product: Product, quantity: number) => void
}

export function AddGroceryItems({ products, onAddToBasket }: AddGroceryItemsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [customInput, setCustomInput] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [pendingItems, setPendingItems] = useState<string[]>([])
  const [isProcessingItems, setIsProcessingItems] = useState(false)
  const [processError, setProcessError] = useState<string | null>(null)
  const [processedResults, setProcessedResults] = useState<ProcessListResult[]>([])

  const categories = useMemo(() => {
    const seen = new Set<string>()
    return products
      .map((product) => product.category)
      .filter((category) => {
        const normalized = category.trim().toLowerCase()
        if (!normalized || seen.has(normalized)) return false
        seen.add(normalized)
        return true
      })
      .sort((a, b) => a.localeCompare(b))
  }, [products])

  const filteredProducts = selectedCategory
    ? products.filter((product) => product.category.toLowerCase() === selectedCategory.toLowerCase())
    : []

  const handleQuantityChange = (productId: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [productId]: Math.max(1, (prev[productId] || 1) + delta),
    }))
  }

  const handleAddItem = (product: Product) => {
    const quantity = quantities[product.id] || 1
    onAddToBasket(product, quantity)
    setQuantities((prev) => ({ ...prev, [product.id]: 1 }))
  }

  const handleAddCustomItems = () => {
    if (!customInput.trim()) return

    const items = customInput
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    if (items.length === 0) return

    setPendingItems((prev) => [...prev, ...items])
    setCustomInput('')
  }

  const handleProcessItems = async () => {
    if (pendingItems.length === 0 || isProcessingItems) return

    setIsProcessingItems(true)
    setProcessError(null)

    try {
      const results = await api.products.processList(
        pendingItems.map((itemName) => ({ name: itemName, quantity: 1 }))
      )

      setProcessedResults(results)

      results.forEach((result) => {
        if (!result.bestMatch) return
        const mappedProduct = mapApiProductToProduct(result.bestMatch.product)
        onAddToBasket(mappedProduct, result.quantity)
      })

      setPendingItems([])
    } catch (error) {
      setProcessError(error instanceof Error ? error.message : 'Failed to process grocery items.')
    } finally {
      setIsProcessingItems(false)
    }
  }

  return (
    <section className="px-4 py-4" aria-label="Add grocery items">
      <h2 className="text-lg font-semibold text-grey-900 mb-3">Add Items</h2>

      {/* Custom Text Input */}
      <div className="mb-4">
        <div className="flex gap-2">
          <textarea
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Type items you want to add (separate with commas: milk, bread, eggs)..."
            className="flex-1 p-3 border border-grey-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            rows={2}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleAddCustomItems()
              }
            }}
          />
          <button
            type="button"
            onClick={handleAddCustomItems}
            disabled={!customInput.trim()}
            className="px-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            title="Add to processing queue"
          >
            <PlusCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleProcessItems}
            disabled={pendingItems.length === 0 || isProcessingItems}
            className="px-4 py-2 rounded-lg bg-secondary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessingItems ? 'Processing...' : `Process (${pendingItems.length})`}
          </button>
          <p className="text-xs text-grey-500">
            Press Enter or click + to queue items, then Process.
          </p>
        </div>

        {pendingItems.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {pendingItems.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="px-2 py-1 bg-grey-100 text-grey-700 rounded-full text-xs"
              >
                {item}
              </span>
            ))}
          </div>
        )}

        {processError && <p className="text-xs text-danger mt-2">{processError}</p>}

        {processedResults.length > 0 && (
          <div className="mt-3 p-3 rounded-xl border border-grey-200 bg-grey-50 space-y-2">
            <p className="text-sm font-semibold text-grey-800">Processed matches</p>
            {processedResults.map((result, idx) => (
              <div key={`${result.inputName}-${idx}`} className="text-xs text-grey-700">
                <p>
                  <span className="font-medium">{result.inputName}</span>
                  {' -> '}
                  {result.bestMatch ? (
                    <>
                      <span className="font-medium">{result.bestMatch.product.name}</span>
                      {' ('}
                      {(result.bestMatch.similarity * 100).toFixed(1)}%
                      {')'}
                    </>
                  ) : (
                    <span className="text-danger">No match found</span>
                  )}
                </p>
                {result.alternatives.length > 0 && (
                  <p className="text-grey-500 mt-0.5">
                    Alternatives: {result.alternatives.map((alt) => alt.product.name).join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category Buttons */}
      <div className="mb-4">
        <p className="text-sm font-medium text-grey-700 mb-2">Select Category</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() =>
                setSelectedCategory(selectedCategory === category ? '' : category)
              }
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === category
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-grey-100 text-grey-700 hover:bg-grey-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Products in Selected Category */}
      {selectedCategory && (
        <div>
          <p className="text-sm font-medium text-grey-700 mb-3">
            {selectedCategory} Items
          </p>
          <div className="space-y-2">
            {filteredProducts.map((product) => {
              const quantity = quantities[product.id] || 1
              return (
                <div
                  key={product.id}
                  className="flex items-center gap-3 p-3 bg-white rounded-xl border border-grey-200 shadow-sm"
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-grey-900 text-sm truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-grey-500">
                      Rs. {Math.min(...Object.values(product.prices))} - {Math.max(...Object.values(product.prices))}
                    </p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(product.id, -1)}
                      disabled={quantity <= 1}
                      className="p-1.5 rounded-lg bg-grey-100 text-grey-700 hover:bg-grey-200 disabled:opacity-50"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(product.id, 1)}
                      className="p-1.5 rounded-lg bg-primary-100 text-primary-700 hover:bg-primary-200"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Add Button */}
                  <button
                    type="button"
                    onClick={() => handleAddItem(product)}
                    className="px-3 py-1.5 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700"
                  >
                    Add
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {products.length === 0 && (
        <p className="text-sm text-grey-500 text-center py-6">
          Loading products from the database...
        </p>
      )}

      {!selectedCategory && products.length > 0 && (
        <p className="text-sm text-grey-500 text-center py-6">
          Select a category above to browse items
        </p>
      )}
    </section>
  )
}

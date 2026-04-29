import { useState } from 'react'
import { Plus, Minus, PlusCircle } from 'lucide-react'
import { MOCK_PRODUCTS, CATEGORIES } from '../data/mockProducts'
import type { Product } from '../types'

interface AddGroceryItemsProps {
  onAddToBasket: (product: Product, quantity: number) => void
}

export function AddGroceryItems({ onAddToBasket }: AddGroceryItemsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [customInput, setCustomInput] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const filteredProducts = selectedCategory
    ? MOCK_PRODUCTS.filter(
        (p) => p.category.toLowerCase() === selectedCategory.toLowerCase()
      )
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
    
    const items = customInput.split(',').map((item) => item.trim()).filter(Boolean)
    
    items.forEach((itemName) => {
      // Try to find matching product in our catalog
      const matchedProduct = MOCK_PRODUCTS.find(
        (p) => p.name.toLowerCase().includes(itemName.toLowerCase()) || 
               p.nameSinhala?.includes(itemName)
      )
      
      if (matchedProduct) {
        onAddToBasket(matchedProduct, 1)
      } else {
        // Create a custom product entry
        const customProduct: Product = {
          id: `custom-${Date.now()}-${Math.random()}`,
          name: itemName,
          image: 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=200&h=200&fit=crop',
          prices: { cargills: 0, keells: 0, sathosa: 0 },
          lastUpdated: new Date().toISOString(),
          category: 'Custom',
        }
        onAddToBasket(customProduct, 1)
      }
    })
    
    setCustomInput('')
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
          >
            <PlusCircle className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-grey-500 mt-1">
          Press Enter or click + to add items
        </p>
      </div>

      {/* Category Buttons */}
      <div className="mb-4">
        <p className="text-sm font-medium text-grey-700 mb-2">Select Category</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() =>
                setSelectedCategory(
                  selectedCategory === category.name ? '' : category.name
                )
              }
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === category.name
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-grey-100 text-grey-700 hover:bg-grey-200'
              }`}
            >
              {category.label}
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

      {!selectedCategory && (
        <p className="text-sm text-grey-500 text-center py-6">
          Select a category above to browse items
        </p>
      )}
    </section>
  )
}

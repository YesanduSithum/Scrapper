import { useState } from 'react'
import type { BasketItem, ComparisonFilter, Retailer } from '../types'
import { calculateStoreComparisons, getBestStoreOption, formatPrice, getRetailerLabel } from '../services/comparisonService'
import { ChevronDown, MapPin, AlertCircle, Check } from 'lucide-react'
import { AVAILABLE_RETAILERS, RETAILER_MAP_QUERIES } from '../constants/retailers'

function openNearestStoreMap(store: Retailer) {
  const query = RETAILER_MAP_QUERIES[store]
  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank')
}

export function ComparisonPage({
  items,
  onBack,
  onSelectStore,
  isProcessing = false,
}: {
  items: BasketItem[]
  onBack: () => void
  onSelectStore?: (store: Retailer) => void
  isProcessing?: boolean
}) {
  const [filter, setFilter] = useState<ComparisonFilter>('availability')

  const comparisons = calculateStoreComparisons(items, filter)
  const bestOption = getBestStoreOption(comparisons, filter)

  return (
    <div className="px-4 py-6 pb-28">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-grey-900">Compare Prices</h1>
          <p className="text-sm text-grey-500 mt-1">Find the best store for your shopping list</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-primary-600 hover:underline"
        >
          Back
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['availability', 'detailed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full font-medium text-sm transition-colors ${
              filter === f
                ? 'bg-primary-600 text-white'
                : 'bg-grey-100 text-grey-700 hover:bg-grey-200'
            }`}
          >
            {f === 'availability' ? 'Availability' : 'Detailed'}
          </button>
        ))}
      </div>

      {/* Filter Description */}
      <div className="mb-6 p-3 bg-primary-50 rounded-xl border border-primary-200">
        <p className="text-sm text-primary-900">
          {filter === 'availability'
            ? 'Shows stores with all items available, ranked by price'
            : 'Shows best price for each item individually'}
        </p>
      </div>

      {/* Best Option Highlight */}
      {bestOption && (
        <div className="mb-6 p-4 bg-gradient-to-r from-secondary/10 to-primary/10 rounded-2xl border border-secondary/30">
          <p className="text-xs font-semibold text-grey-600 mb-1">🏆 BEST OPTION</p>
          <p className="text-xl font-bold text-grey-900">{getRetailerLabel(bestOption.retailer)}</p>
          <p className="text-lg font-semibold text-secondary mt-1">{formatPrice(bestOption.totalPrice)}</p>
          {bestOption.unavailableProducts.length > 0 && (
            <p className="text-xs text-warning mt-2">
              ⚠️ {bestOption.unavailableProducts.length} item(s) not available
            </p>
          )}
        </div>
      )}

      {/* Store Comparison Cards or Detailed View */}
      {filter === 'availability' ? (
        <div className="space-y-4">
          {comparisons.map((comparison, index) => (
            <details
              key={comparison.retailer}
              className={`bg-white rounded-2xl border overflow-hidden group transition-all ${
                comparison.isComplete
                  ? 'border-secondary/50 shadow-md'
                  : 'border-grey-200 shadow-card'
              }`}
              open={index === 0}
            >
              <summary className="flex items-center justify-between p-4 cursor-pointer list-none hover:bg-grey-50">
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      comparison.isComplete
                        ? 'bg-secondary/20 text-secondary'
                        : index === 0
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-grey-100 text-grey-700'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-grey-900">{getRetailerLabel(comparison.retailer)}</p>
                    <p className="text-sm text-grey-500">
                      {comparison.availableProductCount}/{items.length} items available
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold text-lg text-grey-900">{formatPrice(comparison.totalPrice)}</p>
                    {comparison.unavailableProducts.length > 0 && (
                      <p className="text-xs text-warning">
                        {comparison.unavailableProducts.length} unavailable
                      </p>
                    )}
                  </div>
                  <ChevronDown className="w-5 h-5 text-grey-400 group-open:rotate-180 transition-transform" />
                </div>
              </summary>

              <div className="border-t border-grey-100 bg-grey-50/50">
                {/* Items List */}
                <div className="p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-grey-900">Price Breakdown</h4>
                  {comparison.products.map((product) => {
                    const availability = product.availability.find((a) => a.retailer === comparison.retailer)
                    const isAvailable = availability?.available ?? false
                    const price = availability?.price ?? 0

                    return (
                      <div
                        key={product.productId}
                        className="flex items-center justify-between p-2 rounded-lg bg-white border border-grey-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-grey-900 truncate">{product.name}</p>
                          <p className="text-xs text-grey-500">
                            {product.quantity} × {isAvailable ? formatPrice(price) : 'N/A'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isAvailable ? (
                            <>
                              <span className="text-sm font-semibold text-grey-900">
                                {formatPrice(price * product.quantity)}
                              </span>
                              {product.cheapestRetailer === comparison.retailer && (
                                <span className="text-xs bg-secondary/20 text-secondary px-2 py-1 rounded">
                                  Cheapest
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-warning flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Unavailable
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Action Buttons */}
                <div className="border-t border-grey-100 p-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openNearestStoreMap(comparison.retailer)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary-100 text-primary-700 font-medium text-sm hover:bg-primary-200 transition-colors"
                  >
                    <MapPin className="w-4 h-4" />
                    Nearest Store
                  </button>
                  {comparison.isComplete && (
                    <button
                      type="button"
                      onClick={() => onSelectStore?.(comparison.retailer)}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-secondary text-white font-medium text-sm hover:bg-secondary/90 disabled:opacity-50 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      {isProcessing ? 'Processing...' : 'Buy Here'}
                    </button>
                  )}
                </div>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Detailed Mode: Group products by the store where they are cheapest */}
          {(() => {
            const RETAILERS: Retailer[] = AVAILABLE_RETAILERS
            const groups: Record<string, typeof items> = {}
            
            items.forEach((item) => {
              const availabilities = RETAILERS.map((r) => ({
                retailer: r,
                price: item.product.prices[r] ?? 0,
              }))
                .filter((a) => a.price > 0)
                .sort((a, b) => a.price - b.price)

              const cheapest = availabilities[0]?.retailer ?? 'none'
              if (!groups[cheapest]) groups[cheapest] = []
              groups[cheapest].push(item)
            })

            const sortedGroups = Object.entries(groups).sort((a, b) => b[1].length - a[1].length)

            return sortedGroups.map(([retailer, groupItems]) => {
              if (retailer === 'none') {
                return (
                  <div key={retailer} className="bg-white rounded-2xl border border-warning/50 shadow-sm overflow-hidden mb-4 p-4">
                    <p className="text-sm font-semibold text-warning mb-2">Unavailable anywhere</p>
                    {groupItems.map(item => (
                      <p key={item.product.id} className="text-sm text-grey-700">• {item.product.name}</p>
                    ))}
                  </div>
                )
              }

              return (
                <div key={retailer} className="bg-white rounded-2xl border border-grey-200 shadow-card overflow-hidden group mb-4">
                  <div className="p-4 bg-primary-50 border-b border-primary-100 flex items-center justify-between">
                    <h3 className="font-bold text-primary-900">{getRetailerLabel(retailer as Retailer)}</h3>
                    <span className="text-sm font-medium bg-primary-100 text-primary-700 px-2.5 py-1 rounded-full">
                      {groupItems.length} items cheapest here
                    </span>
                  </div>
                  <div className="p-4 space-y-4">
                    {groupItems.map((item) => {
                      const availabilities = RETAILERS.map((r) => ({
                        retailer: r,
                        price: item.product.prices[r] ?? 0,
                      }))
                        .filter((a) => a.price > 0)
                        .sort((a, b) => a.price - b.price)

                      const cheapestPrice = availabilities[0]

                      return (
                        <div key={item.product.id} className="border border-grey-100 rounded-xl p-3 bg-white">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-medium text-grey-900 block">{item.product.name}</span>
                              <span className="text-xs text-grey-500">Qty: {item.quantity}</span>
                            </div>
                            <span className="font-bold text-secondary text-base">
                              {cheapestPrice ? formatPrice(cheapestPrice.price * item.quantity) : 'N/A'}
                            </span>
                          </div>
                          
                          {/* Show other prices for comparison */}
                          {availabilities.length > 1 && (
                            <div className="mt-2 pt-2 border-t border-grey-100 flex flex-wrap gap-2">
                              {availabilities.slice(1).map((a) => (
                                <span key={a.retailer} className="text-xs text-grey-600 bg-grey-50 border border-grey-200 px-2 py-1 rounded">
                                  {getRetailerLabel(a.retailer)}: {formatPrice(a.price * item.quantity)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          })()}
        </div>
      )}
    </div>
  )
}

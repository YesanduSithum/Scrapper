import type { BasketItem, ComparisonFilter, ProductComparison, RetailerAvailability, StoreComparison, Retailer } from '../types'
import { AVAILABLE_RETAILERS, RETAILER_LABELS } from '../constants/retailers'

const RETAILERS: Retailer[] = AVAILABLE_RETAILERS

export function calculateStoreComparisons(items: BasketItem[], filter: ComparisonFilter = 'availability'): StoreComparison[] {
  const storeComparisons: StoreComparison[] = RETAILERS.map((retailer: Retailer) => {
    const unavailableProducts: string[] = []
    let totalPrice = 0
    let availableProductCount = 0

    const productComparisons: ProductComparison[] = items.map(({ product, quantity }) => {
      const price = product.prices[retailer]
      const available = price != null && price > 0

      if (available) {
        totalPrice += price * quantity
        availableProductCount++
      } else {
        unavailableProducts.push(product.name)
      }

      const availability: RetailerAvailability[] = RETAILERS.map((r: Retailer) => {
        const p = product.prices[r]
        return {
          retailer: r,
          available: p != null && p > 0,
          price: p,
        }
      })

      return {
        productId: product.id,
        name: product.name,
        quantity,
        availability,
        cheapestRetailer: availability
          .filter((a) => a.available)
          .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0]?.retailer,
      }
    })

    return {
      retailer,
      totalPrice,
      availableProductCount,
      unavailableProducts,
      isComplete: availableProductCount === items.length,
      products: productComparisons,
    }
  })

  // Sort by completeness and price
  return storeComparisons.sort((a, b) => {
    if (filter === 'availability') {
      // Availability: prioritize complete availability, then by price
      if (a.isComplete && !b.isComplete) return -1
      if (!a.isComplete && b.isComplete) return 1
      if (a.isComplete && b.isComplete) return a.totalPrice - b.totalPrice
      // If neither is complete, rank by most available products first, then cheapest total price
      if (a.availableProductCount !== b.availableProductCount) {
        return b.availableProductCount - a.availableProductCount
      }
      return a.totalPrice - b.totalPrice
    } else {
      // Detailed: sort by total price as a fallback
      return a.totalPrice - b.totalPrice
    }
  })
}

export function getBestStoreOption(comparisons: StoreComparison[], filter: ComparisonFilter = 'availability'): StoreComparison | null {
  if (filter === 'availability') {
    // Return the top ranked store
    return comparisons[0] || null
  } else {
    // In detailed mode, there is no single best option
    return null
  }
}

export function formatPrice(price: number): string {
  return `Rs. ${price.toLocaleString()}`
}

export function getRetailerLabel(retailer: Retailer): string {
  return RETAILER_LABELS[retailer]
}

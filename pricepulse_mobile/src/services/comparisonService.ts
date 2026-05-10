import { AVAILABLE_RETAILERS, RETAILER_LABELS } from "../constants/retailers";
import type {
  BasketItem,
  ComparisonFilter,
  ProductComparison,
  Retailer,
  RetailerAvailability,
  StoreComparison,
} from "../types";

const RETAILERS: Retailer[] = AVAILABLE_RETAILERS;

export function calculateStoreComparisons(
  items: BasketItem[],
  filter: ComparisonFilter = "availability"
): StoreComparison[] {
  const storeComparisons: StoreComparison[] = RETAILERS.map((retailer: Retailer) => {
    const unavailableProducts: string[] = [];
    let totalPrice = 0;
    let availableProductCount = 0;

    const productComparisons: ProductComparison[] = items.map(({ product, quantity }) => {
      const price = product.prices[retailer];
      const available = price != null && price > 0;

      if (available) {
        totalPrice += price * quantity;
        availableProductCount += 1;
      } else {
        unavailableProducts.push(product.name);
      }

      const availability: RetailerAvailability[] = RETAILERS.map((r: Retailer) => {
        const p = product.prices[r];
        return {
          retailer: r,
          available: p != null && p > 0,
          price: p,
        };
      });

      return {
        productId: product.id,
        name: product.name,
        quantity,
        availability,
        cheapestRetailer: availability
          .filter((a) => a.available)
          .sort((a, b) => (a.price ?? 0) - (b.price ?? 0))[0]?.retailer,
      };
    });

    return {
      retailer,
      totalPrice,
      availableProductCount,
      unavailableProducts,
      isComplete: availableProductCount === items.length,
      products: productComparisons,
    };
  });

  return storeComparisons.sort((a, b) => {
    if (filter === "availability") {
      if (a.isComplete && !b.isComplete) return -1;
      if (!a.isComplete && b.isComplete) return 1;
      if (a.isComplete && b.isComplete) return a.totalPrice - b.totalPrice;
      if (a.availableProductCount !== b.availableProductCount) {
        return b.availableProductCount - a.availableProductCount;
      }
      return a.totalPrice - b.totalPrice;
    }
    return a.totalPrice - b.totalPrice;
  });
}

export function getBestStoreOption(
  comparisons: StoreComparison[],
  filter: ComparisonFilter = "availability"
): StoreComparison | null {
  if (filter === "availability") return comparisons[0] || null;
  return null;
}

export function formatPrice(price: number): string {
  return `Rs. ${price.toLocaleString()}`;
}

export function getRetailerLabel(retailer: Retailer): string {
  return RETAILER_LABELS[retailer];
}

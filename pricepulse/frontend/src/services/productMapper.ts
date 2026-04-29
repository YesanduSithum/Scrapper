import type { ApiProduct, Product, Retailer } from '../types'

const STORE_MATCHERS: Array<{ pattern: RegExp; store: Retailer }> = [
  { pattern: /cargill/i, store: 'cargills' },
  { pattern: /keell/i, store: 'keells' },
  { pattern: /sathosa/i, store: 'sathosa' },
]

function resolveStoreName(value: string | undefined | null): Retailer | null {
  if (!value) return null

  for (const matcher of STORE_MATCHERS) {
    if (matcher.pattern.test(value)) return matcher.store
  }

  return null
}

function resolveLatestTimestamp(product: ApiProduct): string {
  const timestamps = [
    product.updatedAt,
    product.createdAt,
    ...product.prices.map((price) => price.updatedAt),
    ...product.prices.map((price) => price.lastUpdated),
  ]
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))

  if (timestamps.length === 0) {
    return new Date().toISOString()
  }

  return new Date(Math.max(...timestamps)).toISOString()
}

export function mapApiProductToProduct(product: ApiProduct): Product {
  const prices: Product['prices'] = {
    cargills: 0,
    keells: 0,
    sathosa: 0,
  }

  for (const price of product.prices) {
    const store =
      resolveStoreName(price.retailer?.name) ??
      resolveStoreName(price.retailerId) ??
      resolveStoreName(price.retailer?.mapQuery)

    if (store) {
      prices[store] = price.price
    }
  }

  return {
    id: product.id,
    name: product.name,
    nameSinhala: product.nameSinhala || undefined,
    image: product.image,
    prices,
    lastUpdated: resolveLatestTimestamp(product),
    category: product.category?.label ?? product.category?.name ?? 'Uncategorized',
  }
}
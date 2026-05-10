import { AVAILABLE_RETAILERS } from '../constants/retailers'
import type { ApiProduct, Product, Retailer } from '../types'

const STORE_MATCHERS: Array<{ patterns: string[]; store: Retailer }> = [
  { patterns: ['cargills', 'cargillsonline', 'cargill', 'cargillsupermarket'], store: 'cargills' },
  { patterns: ['keells', 'keellssuper', 'keell', 'keellssupermarket'], store: 'keells' },
  { patterns: ['spar2u', 'spar 2u', 'spar 2 u', 'spar2 u'], store: 'spar2u' },
  { patterns: ['glowmark', 'glomark', 'glow mark', 'glomarksupermarket'], store: 'glowmark' },
]

const STORE_ID_MATCHERS: Array<{ ids: string[]; store: Retailer }> = [
  { ids: ['e0917db7-7572-45be-a294-4d8f9e17b576', 'a79a1a35-5692-52c1-b5e1-03fbf28bdc88'], store: 'cargills' },
  { ids: ['e35d865c-1413-4d61-a5c3-6f07d2003998', '31a45046-4865-505f-97a1-a6f22b2de7f3'], store: 'keells' },
  { ids: ['25e14557-727d-51a3-ab86-347ef049f51a'], store: 'spar2u' },
  { ids: ['f6c4c606-834a-51ae-a860-bdd73e4f8a96'], store: 'glowmark' },
]

function normalizeStoreValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function resolveStoreName(value: string | undefined | null): Retailer | null {
  if (!value) return null

  const normalizedValue = normalizeStoreValue(value)

  for (const matcher of STORE_MATCHERS) {
    if (matcher.patterns.some((pattern) => normalizedValue.includes(normalizeStoreValue(pattern)))) {
      return matcher.store
    }
  }

  return null
}

function resolveStoreId(value: string | undefined | null): Retailer | null {
  if (!value) return null

  const normalizedValue = value.toLowerCase()

  for (const matcher of STORE_ID_MATCHERS) {
    if (matcher.ids.includes(normalizedValue)) {
      return matcher.store
    }
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
  const prices = AVAILABLE_RETAILERS.reduce((acc, store) => {
    acc[store] = 0
    return acc
  }, {} as Product['prices'])

  for (const price of product.prices) {
    const store =
      resolveStoreName(price.retailer?.name) ??
      resolveStoreId(price.retailerId) ??
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
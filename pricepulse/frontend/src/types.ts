export type Retailer = 'cargills' | 'keells' | 'sathosa'

export interface User {
  id: string
  email: string
  name: string
}

export interface PriceByStore {
  cargills: number
  keells: number
  sathosa: number
}

export interface Product {
  id: string
  name: string
  nameSinhala?: string
  image: string
  prices: PriceByStore
  lastUpdated: string
  category: string
}

export interface BasketItem {
  product: Product
  quantity: number
}

export interface BudgetState {
  monthlyLimit: number
  spent: number
  byCategory: { name: string; value: number }[]
  byRetailer: { name: string; value: number; fill: string }[]
}

export interface ApiCategory {
  id: string
  name: string
  label: string
}

export interface ApiRetailer {
  id: string
  name: string
  mapQuery: string
}

export interface ApiPrice {
  id: string
  productId: string
  retailerId: string
  price: number
  lastUpdated: string
  createdAt: string
  updatedAt: string
  retailer?: ApiRetailer | null
}

export interface ApiProduct {
  id: string
  name: string
  nameSinhala: string
  image: string
  categoryId: string
  createdAt: string
  updatedAt: string
  category?: ApiCategory | null
  prices: ApiPrice[]
}

export interface ProcessListRequestItem {
  name: string
  quantity: number
}

export interface ProductMatchCandidate {
  similarity: number
  product: ApiProduct
}

export interface ProcessListResult {
  inputName: string
  userInput?: string
  quantity: number
  bestMatch: ProductMatchCandidate | null
  alternatives: ProductMatchCandidate[]
}

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

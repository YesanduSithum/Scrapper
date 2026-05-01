import type { ApiProduct, ProcessListRequestItem, ProcessListResult } from '../types'

const API_BASE_URL = 'http://localhost:5000/api'
const TOKEN_KEY = 'pricepulse_token'

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  const token = sessionStorage.getItem(TOKEN_KEY)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.message || 'Request failed')
  }
  return data.data as T
}

type PurchaseItemInput = {
  productId: string
  name: string
  nameSinhala?: string
  image: string
  category: string
  quantity: number
  unitPrice: number
}

type PurchaseSummary = {
  month: string
  spent: number
  purchaseCount: number
  itemCount: number
  byCategory: { name: string; value: number }[]
  byRetailer: { name: string; value: number }[]
}

export const api = {
  // Auth endpoints
  auth: {
    register: async (email: string, password: string, name: string) => {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Registration failed')
      }
      return data.data
    },

    login: async (email: string, password: string) => {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Login failed')
      }
      return data.data
    },
  },

  // Products endpoints
  products: {
    getAll: async () => {
      return requestJson<ApiProduct[]>(`${API_BASE_URL}/products`)
    },

    search: async (query: string) => {
      return requestJson<ApiProduct[]>(`${API_BASE_URL}/products/search?q=${encodeURIComponent(query)}`)
    },

    getByCategory: async (categoryId: string) => {
      return requestJson<ApiProduct[]>(`${API_BASE_URL}/products/category/${categoryId}`)
    },

    processList: async (items: ProcessListRequestItem[], candidateLimit: number = 5) => {
      return requestJson<ProcessListResult[]>(`${API_BASE_URL}/products/process-list`, {
        method: 'POST',
        body: JSON.stringify({ items, candidateLimit }),
      })
    },

    getAlternatives: async (productId: string, limit: number = 5) => {
      return requestJson<ApiProduct[]>(
        `${API_BASE_URL}/products/search-alternatives/${productId}?limit=${limit}`
      )
    },
  },

  // Categories endpoints
  categories: {
    getAll: async () => {
      const response = await fetch(`${API_BASE_URL}/categories`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to fetch categories')
      return data.data
    },
  },

  // Retailers endpoints
  retailers: {
    getAll: async () => {
      const response = await fetch(`${API_BASE_URL}/retailers`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Failed to fetch retailers')
      return data.data
    },
  },

  purchases: {
    record: async (retailerName: string, items: PurchaseItemInput[]) => {
      return requestJson(`${API_BASE_URL}/purchases/record`, {
        method: 'POST',
        body: JSON.stringify({ retailerName, items }),
      })
    },

    summary: async (month?: string) => {
      const query = month ? `?month=${encodeURIComponent(month)}` : ''
      return requestJson<PurchaseSummary>(`${API_BASE_URL}/purchases/summary${query}`)
    },
  },
}

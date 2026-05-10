export type Retailer = "cargills" | "keells" | "spar2u" | "glowmark";

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface PriceByStore {
  cargills: number;
  keells: number;
  spar2u?: number;
  glowmark?: number;
  [key: string]: number | undefined;
}

export interface Product {
  id: string;
  name: string;
  nameSinhala?: string;
  image: string;
  prices: PriceByStore;
  lastUpdated: string;
  category: string;
}

export interface BasketItem {
  product: Product;
  quantity: number;
}

export interface ApiCategory {
  id: string;
  name: string;
  label: string;
}

export interface ApiRetailer {
  id: string;
  name: string;
  mapQuery: string;
}

export interface ApiPrice {
  id: string;
  productId: string;
  retailerId: string;
  price: number;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
  retailer?: ApiRetailer | null;
}

export interface ApiProduct {
  id: string;
  name: string;
  nameSinhala: string;
  image: string;
  categoryId: string;
  createdAt: string;
  updatedAt: string;
  category?: ApiCategory | null;
  prices: ApiPrice[];
}

export interface ProcessListRequestItem {
  name: string;
  quantity: number;
}

export interface ProductMatchCandidate {
  similarity: number;
  product: ApiProduct;
}

export interface ProcessListResult {
  inputName: string;
  userInput?: string;
  quantity: number;
  bestMatch: ProductMatchCandidate | null;
  alternatives: ProductMatchCandidate[];
}

export interface ProcessListResponse {
  items: ProcessListResult[];
  totalItems: number;
  processedAt: string;
}

export type ComparisonFilter = "availability" | "detailed";

export interface RetailerAvailability {
  retailer: Retailer;
  available: boolean;
  price?: number;
}

export interface ProductComparison {
  productId: string;
  name: string;
  quantity: number;
  availability: RetailerAvailability[];
  cheapestRetailer?: Retailer;
}

export interface StoreComparison {
  retailer: Retailer;
  totalPrice: number;
  availableProductCount: number;
  unavailableProducts: string[];
  isComplete: boolean;
  products: ProductComparison[];
}


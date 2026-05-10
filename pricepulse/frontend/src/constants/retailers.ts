import type { Retailer } from '../types'

export const AVAILABLE_RETAILERS: Retailer[] = ['cargills', 'keells', 'spar2u', 'glowmark']

export const RETAILER_LABELS: Record<Retailer, string> = {
  cargills: 'Cargills',
  keells: 'Keells',
  spar2u: 'Spar2U',
  glowmark: 'Glowmark',
}

export const RETAILER_MAP_QUERIES: Record<Retailer, string> = {
  cargills: 'Cargills Supermarket nearme',
  keells: 'Keells Supermarket nearme',
  spar2u: 'Spar2U upermarket nearme',
  glowmark: 'Glowmark Supermarket nearme ',
}

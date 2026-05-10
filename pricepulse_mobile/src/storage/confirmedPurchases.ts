import * as SecureStore from "expo-secure-store";
import { RETAILER_LABELS } from "../constants/retailers";
import type { BasketItem, Retailer } from "../types";

export const CONFIRMED_PURCHASES_STORAGE_KEY = "pricepulse-confirmed-purchases";

export type ConfirmedPurchaseItem = {
  productId: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
};

export type ConfirmedPurchaseRecord = {
  id: string;
  confirmedAt: string;
  estimatedStore: Retailer | null;
  estimatedStoreLabel: string;
  estimatedTotal: number;
  itemCount: number;
  items: ConfirmedPurchaseItem[];
};

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export async function readConfirmedPurchases(): Promise<ConfirmedPurchaseRecord[]> {
  try {
    const raw = await SecureStore.getItemAsync(CONFIRMED_PURCHASES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ConfirmedPurchaseRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function appendConfirmedPurchase(record: ConfirmedPurchaseRecord): Promise<void> {
  const existing = await readConfirmedPurchases();
  await SecureStore.setItemAsync(CONFIRMED_PURCHASES_STORAGE_KEY, JSON.stringify([...existing, record]));
}

export function buildConfirmedPurchaseRecord(items: BasketItem[], store: Retailer | null): ConfirmedPurchaseRecord {
  return {
    id: newId(),
    confirmedAt: new Date().toISOString(),
    estimatedStore: store,
    estimatedStoreLabel: store ? RETAILER_LABELS[store] : "Confirmed list",
    estimatedTotal: items.reduce((total, { product, quantity }) => {
      const storePrice = store ? (product.prices[store] ?? 0) : 0;
      return total + storePrice * quantity;
    }, 0),
    itemCount: items.reduce((count, { quantity }) => count + quantity, 0),
    items: items.map(({ product, quantity }) => ({
      productId: product.id,
      name: product.name,
      category: product.category,
      quantity,
      unitPrice: store ? (product.prices[store] ?? 0) : 0,
    })),
  };
}

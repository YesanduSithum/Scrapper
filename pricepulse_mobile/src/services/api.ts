import * as SecureStore from "expo-secure-store";
import type { ApiProduct, ProcessListRequestItem, ProcessListResponse } from "../types";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://172.20.10.3:5000/api";
export const TOKEN_KEY = "pricepulse_token";
export const USER_KEY = "pricepulse_user";

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Request failed");
  return data.data as T;
}

export const api = {
  auth: {
    register: async (email: string, password: string, name: string) => {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Registration failed");
      return data.data;
    },
    login: async (email: string, password: string) => {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Login failed");
      return data.data;
    },
  },
  products: {
    getAll: async (limit: number = 10) =>
      requestJson<ApiProduct[]>(`${API_BASE_URL}/products?limit=${limit}`),
    processList: async (items: ProcessListRequestItem[], candidateLimit: number = 5) =>
      requestJson<ProcessListResponse>(`${API_BASE_URL}/products/process-list`, {
        method: "POST",
        body: JSON.stringify({ items, candidateLimit }),
      }),
  },
  purchases: {
    record: async (
      retailerName: string,
      items: Array<{
        productId: string;
        name: string;
        nameSinhala?: string;
        image: string;
        category: string;
        quantity: number;
        unitPrice: number;
      }>
    ) =>
      requestJson(`${API_BASE_URL}/purchases/record`, {
        method: "POST",
        body: JSON.stringify({ retailerName, items }),
      }),
    summary: async (month?: string) => {
      const query = month ? `?month=${encodeURIComponent(month)}` : "";
      return requestJson<{
        month: string;
        spent: number;
        purchaseCount: number;
        itemCount: number;
        byCategory: { name: string; value: number }[];
        byRetailer: { name: string; value: number }[];
      }>(`${API_BASE_URL}/purchases/summary${query}`);
    },
    history: async (months: number = 12) =>
      requestJson<Array<{ month: string; spent: number; purchaseCount: number }>>(
        `${API_BASE_URL}/purchases/history?months=${months}`
      ),
  },
};


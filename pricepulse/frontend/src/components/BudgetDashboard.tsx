import { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts'
import { api } from '../services/api'
import { RETAILER_LABELS } from '../constants/retailers'
import type { Retailer } from '../types'

type SummaryEntry = {
  name: string
  value: number
}

type PurchaseSummary = {
  month: string
  spent: number
  purchaseCount: number
  itemCount: number
  byCategory: SummaryEntry[]
  byRetailer: SummaryEntry[]
}

type HistoryEntry = {
  month: string
  spent: number
  purchaseCount: number
}

type ConfirmedPurchaseItem = {
  productId: string
  name: string
  category: string
  quantity: number
  unitPrice: number
}

type ConfirmedPurchaseRecord = {
  id: string
  confirmedAt: string
  estimatedStore: Retailer | null
  estimatedStoreLabel: string
  estimatedTotal: number
  itemCount: number
  items: ConfirmedPurchaseItem[]
}

const CHART_COLORS = ['#059669', '#10b981', '#34d399', '#6ee7b7', '#047857', '#065f46']

const MONTHLY_LIMIT_STORAGE_KEY = 'pricepulse-monthly-limit'
const CONFIRMED_PURCHASES_STORAGE_KEY = 'pricepulse-confirmed-purchases'

function getMonthKey(isoDate: string) {
  return isoDate.slice(0, 7)
}

function readConfirmedPurchases(): ConfirmedPurchaseRecord[] {
  try {
    const raw = localStorage.getItem(CONFIRMED_PURCHASES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ConfirmedPurchaseRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function combineHistory(baseHistory: HistoryEntry[], purchases: ConfirmedPurchaseRecord[]) {
  const historyMap = new Map<string, HistoryEntry>()

  baseHistory.forEach((entry) => {
    historyMap.set(entry.month, { ...entry })
  })

  purchases.forEach((purchase) => {
    const month = getMonthKey(purchase.confirmedAt)
    const existing = historyMap.get(month) ?? { month, spent: 0, purchaseCount: 0 }
    historyMap.set(month, {
      month,
      spent: Number((existing.spent + purchase.estimatedTotal).toFixed(2)),
      purchaseCount: existing.purchaseCount + 1,
    })
  })

  return Array.from(historyMap.values()).sort((a, b) => a.month.localeCompare(b.month))
}

function combineSummary(
  baseSummary: PurchaseSummary | null,
  purchases: ConfirmedPurchaseRecord[],
  currentMonth: string
) {
  const currentMonthPurchases = purchases.filter((purchase) => getMonthKey(purchase.confirmedAt) === currentMonth)
  if (currentMonthPurchases.length === 0) return baseSummary

  const categoryTotals = new Map<string, number>()
  const retailerTotals = new Map<string, number>()
  let spent = currentMonthPurchases.reduce((total, purchase) => total + purchase.estimatedTotal, 0)
  let purchaseCount = currentMonthPurchases.length
  let itemCount = currentMonthPurchases.reduce((total, purchase) => total + purchase.itemCount, 0)

  currentMonthPurchases.forEach((purchase) => {
    purchase.items.forEach((item) => {
      const lineTotal = item.unitPrice * item.quantity
      categoryTotals.set(item.category, (categoryTotals.get(item.category) ?? 0) + lineTotal)
    })

    const retailerName = purchase.estimatedStore ? RETAILER_LABELS[purchase.estimatedStore] : purchase.estimatedStoreLabel
    retailerTotals.set(retailerName, (retailerTotals.get(retailerName) ?? 0) + purchase.estimatedTotal)
  })

  const confirmedSummary: PurchaseSummary = {
    month: currentMonth,
    spent: Number(spent.toFixed(2)),
    purchaseCount,
    itemCount,
    byCategory: Array.from(categoryTotals.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value),
    byRetailer: Array.from(retailerTotals.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value),
  }

  if (!baseSummary) return confirmedSummary

  return {
    ...baseSummary,
    spent: Number((baseSummary.spent + confirmedSummary.spent).toFixed(2)),
    purchaseCount: baseSummary.purchaseCount + confirmedSummary.purchaseCount,
    itemCount: baseSummary.itemCount + confirmedSummary.itemCount,
    byCategory: [...baseSummary.byCategory, ...confirmedSummary.byCategory],
    byRetailer: [...baseSummary.byRetailer, ...confirmedSummary.byRetailer],
  }
}

export function BudgetDashboard() {
  const [monthlyLimit, setMonthlyLimit] = useState(() => {
    const stored = localStorage.getItem(MONTHLY_LIMIT_STORAGE_KEY)
    const parsed = Number(stored)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 25000
  })
  const [summary, setSummary] = useState<PurchaseSummary | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmedPurchases] = useState<ConfirmedPurchaseRecord[]>(() => readConfirmedPurchases())

  useEffect(() => {
    localStorage.setItem(MONTHLY_LIMIT_STORAGE_KEY, String(monthlyLimit || 0))
  }, [monthlyLimit])

  useEffect(() => {
    let mounted = true

    async function loadDashboardData() {
      setIsLoading(true)
      setError(null)
      try {
        const [summaryResponse, historyResponse] = await Promise.all([
          api.purchases.summary() as Promise<PurchaseSummary>,
          api.purchases.history(12) as Promise<HistoryEntry[]>,
        ])
        if (!mounted) return
        const now = new Date()
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        setSummary(combineSummary(summaryResponse, confirmedPurchases, currentMonth))
        setHistory(combineHistory(historyResponse, confirmedPurchases))
      } catch {
        if (!mounted) return
        setSummary(null)
        setHistory([])
        setError('Could not load budget insights right now.')
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    loadDashboardData()
    return () => {
      mounted = false
    }
  }, [confirmedPurchases])

  const { categoryData, retailerData, spent, purchaseCount, itemCount } = useMemo(() => {
    const categoryData = (summary?.byCategory ?? []).map((entry, index) => ({
      ...entry,
      value: Math.round(entry.value),
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }))

    const retailerData = (summary?.byRetailer ?? []).map((entry, index) => ({
      ...entry,
      value: Math.round(entry.value),
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }))

    return {
      categoryData,
      retailerData,
      spent: Math.round(summary?.spent ?? 0),
      purchaseCount: summary?.purchaseCount ?? 0,
      itemCount: summary?.itemCount ?? 0,
    }
  }, [summary])

  const progress = Math.min(100, (spent / monthlyLimit) * 100)
  const isOverBudget = progress >= 100
  const isNearLimit = progress >= 80 && progress < 100

  return (
    <section className="px-4 py-6 bg-grey-50 rounded-2xl mx-4 mb-4" aria-label="Inflation & Budgeting">
      <h2 className="text-lg font-semibold text-grey-900 mb-1">Inflation &amp; Budgeting</h2>
      <p className="text-sm text-grey-500 mb-4">Actual purchases recorded this month</p>

      {isLoading && <p className="text-sm text-grey-500 mb-4">Loading budget insights...</p>}
      {error && <p className="text-sm text-danger mb-4">{error}</p>}
      {!isLoading && !error && !summary && (
        <p className="text-sm text-grey-500 mb-4">No purchases recorded yet.</p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl bg-white border border-grey-200 p-3 shadow-card">
          <p className="text-xs text-grey-500">Purchases</p>
          <p className="text-xl font-bold text-grey-900">{purchaseCount}</p>
        </div>
        <div className="rounded-xl bg-white border border-grey-200 p-3 shadow-card">
          <p className="text-xs text-grey-500">Items bought</p>
          <p className="text-xl font-bold text-grey-900">{itemCount}</p>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-grey-600">Budget progress</span>
          <span className={isOverBudget ? 'text-danger font-semibold' : 'text-grey-700'}>
            Rs. {spent.toLocaleString()} / Rs. {monthlyLimit.toLocaleString()}
          </span>
        </div>
        <div className="h-3 rounded-full bg-grey-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isOverBudget ? 'bg-danger' : isNearLimit ? 'bg-amber-500' : 'bg-primary-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        {isNearLimit && !isOverBudget && (
          <p className="text-xs text-amber-700 mt-1">Approaching monthly limit</p>
        )}
        {isOverBudget && (
          <p className="text-xs text-danger mt-1">Over budget — consider reducing spend</p>
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-medium text-grey-700 mb-2">Inflation chart (12-month trend)</h3>
        <p className="text-xs text-grey-500 mb-3">Your monthly spending pattern</p>
        {history.length > 0 ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ left: 0, right: 8, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `Rs.${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v) => (v != null ? [`Rs. ${Number(v).toLocaleString()}`, 'Spent'] : null)}
                  labelFormatter={(label) => `Month: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="spent"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={{ fill: '#059669', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-grey-500">No spending history yet</p>
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-medium text-grey-700 mb-2">Spending by category</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} layout="vertical" margin={{ left: 0, right: 8 }}>
              <XAxis type="number" tickFormatter={(v) => `Rs.${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => (v != null ? [`Rs. ${Number(v).toLocaleString()}`, 'Spent'] : null)} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-grey-700 mb-2">Savings by retailer</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={retailerData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={2}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {retailerData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => (v != null ? [`Rs. ${Number(v).toLocaleString()}`, 'Spent'] : null)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm text-grey-600 mb-1">Monthly budget limit (Rs.)</label>
        <input
          type="number"
          value={monthlyLimit}
          onChange={(e) => setMonthlyLimit(Number(e.target.value) || 0)}
          className="w-full px-3 py-2 rounded-lg border border-grey-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>
    </section>
  )
}

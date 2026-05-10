import * as SecureStore from "expo-secure-store";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";
import { RETAILER_LABELS } from "../constants/retailers";
import { theme } from "../constants/theme";
import { api } from "../services/api";
import type { ConfirmedPurchaseRecord } from "../storage/confirmedPurchases";
import { readConfirmedPurchases } from "../storage/confirmedPurchases";

const MONTHLY_LIMIT_STORAGE_KEY = "pricepulse-monthly-limit";

const CHART_COLORS = ["#059669", "#10b981", "#34d399", "#6ee7b7", "#047857", "#065f46"];

type SummaryEntry = { name: string; value: number };

type PurchaseSummary = {
  month: string;
  spent: number;
  purchaseCount: number;
  itemCount: number;
  byCategory: SummaryEntry[];
  byRetailer: SummaryEntry[];
};

type HistoryEntry = { month: string; spent: number; purchaseCount: number };

function getMonthKey(isoDate: string) {
  return isoDate.slice(0, 7);
}

function combineHistory(baseHistory: HistoryEntry[], purchases: ConfirmedPurchaseRecord[]) {
  const historyMap = new Map<string, HistoryEntry>();
  baseHistory.forEach((entry) => {
    historyMap.set(entry.month, { ...entry });
  });
  purchases.forEach((purchase) => {
    const month = getMonthKey(purchase.confirmedAt);
    const existing = historyMap.get(month) ?? { month, spent: 0, purchaseCount: 0 };
    historyMap.set(month, {
      month,
      spent: Number((existing.spent + purchase.estimatedTotal).toFixed(2)),
      purchaseCount: existing.purchaseCount + 1,
    });
  });
  return Array.from(historyMap.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function combineSummary(
  baseSummary: PurchaseSummary | null,
  purchases: ConfirmedPurchaseRecord[],
  currentMonth: string
) {
  const currentMonthPurchases = purchases.filter((purchase) => getMonthKey(purchase.confirmedAt) === currentMonth);
  if (currentMonthPurchases.length === 0) return baseSummary;

  const categoryTotals = new Map<string, number>();
  const retailerTotals = new Map<string, number>();
  let spent = currentMonthPurchases.reduce((total, purchase) => total + purchase.estimatedTotal, 0);
  let purchaseCount = currentMonthPurchases.length;
  let itemCount = currentMonthPurchases.reduce((total, purchase) => total + purchase.itemCount, 0);

  currentMonthPurchases.forEach((purchase) => {
    purchase.items.forEach((item) => {
      const lineTotal = item.unitPrice * item.quantity;
      categoryTotals.set(item.category, (categoryTotals.get(item.category) ?? 0) + lineTotal);
    });
    const retailerName = purchase.estimatedStore
      ? RETAILER_LABELS[purchase.estimatedStore]
      : purchase.estimatedStoreLabel;
    retailerTotals.set(retailerName, (retailerTotals.get(retailerName) ?? 0) + purchase.estimatedTotal);
  });

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
  };

  if (!baseSummary) return confirmedSummary;

  return {
    ...baseSummary,
    spent: Number((baseSummary.spent + confirmedSummary.spent).toFixed(2)),
    purchaseCount: baseSummary.purchaseCount + confirmedSummary.purchaseCount,
    itemCount: baseSummary.itemCount + confirmedSummary.itemCount,
    byCategory: [...baseSummary.byCategory, ...confirmedSummary.byCategory],
    byRetailer: [...baseSummary.byRetailer, ...confirmedSummary.byRetailer],
  };
}

type Props = { refreshToken?: number; extraConfirmedPurchases?: ConfirmedPurchaseRecord[] };

export function BudgetDashboard({ refreshToken = 0, extraConfirmedPurchases = [] }: Props) {
  const [monthlyLimit, setMonthlyLimit] = useState(25000);
  const [summary, setSummary] = useState<PurchaseSummary | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLimit = async () => {
      try {
        const stored = await SecureStore.getItemAsync(MONTHLY_LIMIT_STORAGE_KEY);
        const parsed = Number(stored);
        if (Number.isFinite(parsed) && parsed > 0) setMonthlyLimit(parsed);
      } catch {
        /* ignore */
      }
    };
    void loadLimit();
  }, []);

  useEffect(() => {
    const save = async () => {
      await SecureStore.setItemAsync(MONTHLY_LIMIT_STORAGE_KEY, String(monthlyLimit || 0));
    };
    void save();
  }, [monthlyLimit]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const confirmedPurchases = [...(await readConfirmedPurchases()), ...extraConfirmedPurchases];
        const [summaryResponse, historyResponse] = await Promise.all([
          api.purchases.summary() as Promise<PurchaseSummary>,
          api.purchases.history(12),
        ]);
        if (!mounted) return;
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        setSummary(combineSummary(summaryResponse, confirmedPurchases, currentMonth));
        setHistory(combineHistory(historyResponse, confirmedPurchases));
      } catch {
        if (!mounted) return;
        setSummary(null);
        setHistory([]);
        setError("Could not load budget insights right now.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [refreshToken]);

  const { categoryRows, retailerRows, spent, purchaseCount, itemCount, maxCategory, retailerTotal } = useMemo(() => {
    const cats = (summary?.byCategory ?? []).map((e, i) => ({
      ...e,
      value: Math.round(e.value),
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
    const maxCat = Math.max(1, ...cats.map((c) => c.value));
    const rets = (summary?.byRetailer ?? []).map((e, i) => ({
      ...e,
      value: Math.round(e.value),
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
    const totalRet = rets.reduce((s, r) => s + r.value, 0) || 1;
    return {
      categoryRows: cats,
      retailerRows: rets,
      spent: Math.round(summary?.spent ?? 0),
      purchaseCount: summary?.purchaseCount ?? 0,
      itemCount: summary?.itemCount ?? 0,
      maxCategory: maxCat,
      retailerTotal: totalRet,
    };
  }, [summary]);

  const progress = Math.min(100, (spent / Math.max(1, monthlyLimit)) * 100);
  const over = progress >= 100;
  const near = progress >= 80 && progress < 100;
  const maxHist = Math.max(1, ...history.map((h) => h.spent));

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Inflation & budgeting</Text>
      <Text style={styles.sectionSub}>Actual purchases recorded this month</Text>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={theme.colors.primary} />
      ) : null}
      {error ? <Text style={styles.errText}>{error}</Text> : null}
      {!loading && !error && !summary ? (
        <Text style={styles.empty}>No purchases recorded yet.</Text>
      ) : null}

      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Purchases</Text>
          <Text style={styles.statValue}>{purchaseCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Items bought</Text>
          <Text style={styles.statValue}>{itemCount}</Text>
        </View>
      </View>

      <View style={styles.budgetBlock}>
        <View style={styles.budgetLabels}>
          <Text style={styles.budgetLabelLeft}>Budget progress</Text>
          <Text style={[styles.budgetLabelRight, over && styles.budgetOver]}>
            Rs. {spent.toLocaleString()} / Rs. {monthlyLimit.toLocaleString()}
          </Text>
        </View>
        <View style={styles.progressBg}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress}%` },
              over && styles.progressOver,
              near && !over && styles.progressNear,
            ]}
          />
        </View>
        {near && !over ? <Text style={styles.nearText}>Approaching monthly limit</Text> : null}
        {over ? <Text style={styles.overText}>Over budget — consider reducing spend</Text> : null}
      </View>

      <Text style={styles.blockTitle}>12-month trend</Text>
      <Text style={styles.blockSub}>Your monthly spending pattern</Text>
      {history.length > 0 ? (
        <View style={styles.chartCard}>
          {history.map((h) => (
            <View key={h.month} style={styles.histRow}>
              <Text style={styles.histMonth} numberOfLines={1}>
                {h.month}
              </Text>
              <View style={styles.histBarBg}>
                <View style={[styles.histBarFill, { width: `${(h.spent / maxHist) * 100}%` }]} />
              </View>
              <Text style={styles.histSpent}>Rs. {Math.round(h.spent).toLocaleString()}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptySmall}>No spending history yet</Text>
      )}

      <Text style={styles.blockTitle}>Spending by category</Text>
      {categoryRows.length > 0 ? (
        <View style={styles.chartCard}>
          {categoryRows.map((row) => (
            <View key={row.name} style={styles.catRow}>
              <Text style={styles.catName} numberOfLines={1}>
                {row.name}
              </Text>
              <View style={styles.catBarBg}>
                <View
                  style={[
                    styles.catBarFill,
                    { width: `${(row.value / maxCategory) * 100}%`, backgroundColor: row.color },
                  ]}
                />
              </View>
              <Text style={styles.catVal}>Rs. {row.value.toLocaleString()}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptySmall}>No category data yet</Text>
      )}

      <Text style={styles.blockTitle}>By retailer</Text>
      {retailerRows.length > 0 ? (
        <View style={styles.chartCard}>
          {retailerRows.map((row) => (
            <View key={row.name} style={styles.retRow}>
              <View style={[styles.retDot, { backgroundColor: row.color }]} />
              <Text style={styles.retName} numberOfLines={1}>
                {row.name}
              </Text>
              <Text style={styles.retPct}>{Math.round((row.value / retailerTotal) * 100)}%</Text>
              <Text style={styles.retVal}>Rs. {row.value.toLocaleString()}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptySmall}>No retailer split yet</Text>
      )}

      <Text style={styles.limitLabel}>Monthly budget limit (Rs.)</Text>
      <TextInput
        style={styles.limitInput}
        keyboardType="number-pad"
        value={String(monthlyLimit)}
        onChangeText={(t) => setMonthlyLimit(Number(t.replace(/[^0-9]/g, "")) || 0)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 4,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  sectionSub: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 8 },
  loader: { marginVertical: 12 },
  errText: { color: theme.colors.danger, fontSize: 14, marginBottom: 8 },
  empty: { fontSize: 14, color: theme.colors.textMuted, marginBottom: 8 },
  emptySmall: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 12 },
  statRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statLabel: { fontSize: 12, color: theme.colors.textMuted },
  statValue: { fontSize: 20, fontWeight: "800", color: theme.colors.text, marginTop: 4 },
  budgetBlock: { marginBottom: 16 },
  budgetLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  budgetLabelLeft: { fontSize: 13, color: theme.colors.textMuted },
  budgetLabelRight: { fontSize: 13, fontWeight: "600", color: theme.colors.text },
  budgetOver: { color: theme.colors.danger },
  progressBg: { height: 10, borderRadius: 999, backgroundColor: theme.colors.border, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: theme.colors.primary },
  progressNear: { backgroundColor: theme.colors.amber },
  progressOver: { backgroundColor: theme.colors.danger },
  nearText: { fontSize: 12, color: "#b45309", marginTop: 6 },
  overText: { fontSize: 12, color: theme.colors.danger, marginTop: 6 },
  blockTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.text, marginTop: 8 },
  blockSub: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 8 },
  chartCard: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
    gap: 8,
  },
  histRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  histMonth: { width: 72, fontSize: 11, color: theme.colors.textMuted, fontVariant: ["tabular-nums"] },
  histBarBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: theme.colors.surface, overflow: "hidden" },
  histBarFill: { height: "100%", backgroundColor: theme.colors.primary, borderRadius: 4 },
  histSpent: { width: 88, fontSize: 11, fontWeight: "600", color: theme.colors.text, textAlign: "right" },
  catRow: { gap: 6 },
  catName: { fontSize: 12, fontWeight: "600", color: theme.colors.text },
  catBarBg: { height: 8, borderRadius: 4, backgroundColor: theme.colors.surface, overflow: "hidden" },
  catBarFill: { height: "100%", borderRadius: 4 },
  catVal: { fontSize: 11, color: theme.colors.textMuted, alignSelf: "flex-end" },
  retRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  retDot: { width: 10, height: 10, borderRadius: 5 },
  retName: { flex: 1, fontSize: 13, color: theme.colors.text },
  retPct: { fontSize: 12, fontWeight: "600", color: theme.colors.textMuted, width: 36 },
  retVal: { fontSize: 12, fontWeight: "700", color: theme.colors.text },
  limitLabel: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
  limitInput: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
  },
});

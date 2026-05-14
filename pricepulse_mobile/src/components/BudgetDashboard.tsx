import * as SecureStore from "expo-secure-store";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  View,
  Dimensions,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { RETAILER_LABELS } from "../constants/retailers";
import { theme } from "../constants/theme";
import { api } from "../services/api";
import type { ConfirmedPurchaseRecord } from "../storage/confirmedPurchases";
import { readConfirmedPurchases } from "../storage/confirmedPurchases";

const MONTHLY_LIMIT_STORAGE_KEY = "pricepulse-monthly-limit";
const CHART_COLORS = ["#059669", "#10b981", "#34d399", "#6ee7b7", "#047857", "#065f46"];

type SummaryEntry = { name: string; value: number };
type ChartSlice = SummaryEntry & { path: string | null; color: string; perc: number };

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
  const map = new Map<string, HistoryEntry>();
  baseHistory.forEach((h) => map.set(h.month, { ...h }));
  purchases.forEach((p) => {
    const m = getMonthKey(p.confirmedAt);
    const existing = map.get(m) ?? { month: m, spent: 0, purchaseCount: 0 };
    existing.spent = Number((existing.spent + p.estimatedTotal).toFixed(2));
    existing.purchaseCount = existing.purchaseCount + (p.itemCount ?? 0 > 0 ? 1 : 1);
    map.set(m, existing);
  });
  return Array.from(map.values()).sort((a, b) => (a.month < b.month ? -1 : 1));
}

function combineSummary(baseSummary: PurchaseSummary, purchases: ConfirmedPurchaseRecord[], currentMonth: string) {
  const byCategory = new Map<string, number>();
  const byRetailer = new Map<string, number>();

  const addValue = (map: Map<string, number>, name: string, value: number) => {
    if (!name) return;
    map.set(name, (map.get(name) ?? 0) + value);
  };

  (baseSummary?.byCategory ?? []).forEach((entry) => addValue(byCategory, entry.name, entry.value));
  (baseSummary?.byRetailer ?? []).forEach((entry) => addValue(byRetailer, entry.name, entry.value));

  purchases.forEach((p) => {
    p.items.forEach((item) => {
      addValue(byCategory, item.category || "Other", item.unitPrice * item.quantity);
    });
    const name = p.estimatedStore ? RETAILER_LABELS[p.estimatedStore] : p.estimatedStoreLabel || "Confirmed list";
    addValue(byRetailer, name, p.estimatedTotal);
  });

  const merged: PurchaseSummary = {
    month: currentMonth,
    spent: Number(Array.from(byRetailer.values()).reduce((s, v) => s + v, 0).toFixed(2)),
    purchaseCount: (baseSummary?.purchaseCount ?? 0) + purchases.length,
    itemCount: (baseSummary?.itemCount ?? 0) + purchases.reduce((s, p) => s + p.itemCount, 0),
    byCategory: Array.from(byCategory.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value),
    byRetailer: Array.from(byRetailer.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value),
  };
  return merged;
}

function AnimatedBar({ percentage, delay = 0 }: { percentage: number; delay?: number }) {
  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(width, { toValue: percentage, duration: 600, delay, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [percentage, delay, width]);
  const w = width.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });
  return <Animated.View style={[styles.histBarFill, { width: w }]} />;
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  const d = [
    `M ${x} ${y}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
  return d;
}

function AnimatedPieChart({ data }: { data: SummaryEntry[] }) {
  const scale = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const [revealProgress, setRevealProgress] = useState(0);
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
    const listenerId = reveal.addListener(({ value }) => setRevealProgress(value));
    reveal.setValue(0);
    Animated.timing(reveal, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => {
      reveal.removeListener(listenerId);
    };
  }, [scale, reveal, data]);

  const total = data.reduce((s, d) => s + d.value, 0);
  const safeTotal = total > 0 ? total : 1;
  const dims = Dimensions.get("window");
  const size = Math.min(280, dims.width - 32);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;
  const innerR = size * 0.28;

  const slices = data.filter((d) => d.value > 0);
  let start = 0;
  const chartItems: ChartSlice[] = slices.map((d, i) => {
    const perc = d.value / safeTotal;
    const angle = perc * 360;
    const visibleEnd = Math.min(start + angle, 360 * revealProgress);
    const visibleAngle = Math.max(0, visibleEnd - start);
    const path = visibleAngle > 0 ? describeArc(cx, cy, r, start, start + visibleAngle) : null;
    const slice: ChartSlice = { path, color: CHART_COLORS[i % CHART_COLORS.length], perc, name: d.name, value: d.value };
    start += angle;
    return slice;
  });

  const animatedSlices = chartItems.filter((slice): slice is ChartSlice & { path: string } => Boolean(slice.path));

  const topSlice = slices[0];

  const animatedStyle = { transform: [{ scale }] } as any;

  return (
    <View style={styles.pieContainer}>
      <Animated.View style={[animatedStyle, styles.pieWrap]}>
        <Svg width={size} height={size}>
          {animatedSlices.length > 0 ? (
            animatedSlices.map((s, idx) => <Path key={`slice-${idx}-${s.name}`} d={s.path as string} fill={s.color} />)
          ) : (
            <Path d={describeArc(cx, cy, r, 0, 359.9)} fill={CHART_COLORS[0]} opacity={0.16} />
          )}
        </Svg>
        <View style={[styles.pieCenter, { width: innerR * 2, height: innerR * 2, borderRadius: innerR }]}> 
          <Text style={styles.pieCenterValue}>{total > 0 ? `Rs. ${Math.round(total).toLocaleString()}` : "No spend"}</Text>
          <Text style={styles.pieCenterLabel}>{topSlice ? topSlice.name : "No retailer data"}</Text>
        </View>
      </Animated.View>
      <View style={styles.pieLegend}>
        {chartItems.length > 0 ? (
          chartItems.map((d, i) => (
            <View key={`legend-${i}-${d.name}`} style={styles.legendCard}>
              <View style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                <Text style={styles.legendLabel} numberOfLines={1}>
                  {d.name}
                </Text>
                <Text style={styles.legendPercent}>{Math.round(d.perc * 100)}%</Text>
              </View>
              <View style={styles.legendTrack}>
                <View style={[styles.legendTrackFill, { width: `${Math.max(4, d.perc * 100)}%`, backgroundColor: d.color }]} />
              </View>
              <Text style={styles.legendAmount}>Rs. {Math.round(d.value).toLocaleString()}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptySmall}>No retailer spend recorded yet.</Text>
        )}
      </View>
    </View>
  );
}

export function BudgetDashboard({ refreshToken = 0, extraConfirmedPurchases = [] }: { refreshToken?: number; extraConfirmedPurchases?: ConfirmedPurchaseRecord[] }) {
  const [monthlyLimit, setMonthlyLimit] = useState(25000);
  const [summary, setSummary] = useState<PurchaseSummary | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await SecureStore.getItemAsync(MONTHLY_LIMIT_STORAGE_KEY);
        const n = Number(s);
        if (Number.isFinite(n) && n > 0) setMonthlyLimit(n);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    void SecureStore.setItemAsync(MONTHLY_LIMIT_STORAGE_KEY, String(monthlyLimit || 0));
  }, [monthlyLimit]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const confirmed = [...(await readConfirmedPurchases()), ...extraConfirmedPurchases];
        const [sumResp, histResp] = await Promise.all([api.purchases.summary() as Promise<PurchaseSummary>, api.purchases.history(12)]);
        if (!mounted) return;
        const now = new Date();
        const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        setSummary(combineSummary(sumResp, confirmed, cur));
        setHistory(combineHistory(histResp, confirmed));
      } catch (e) {
        if (!mounted) return;
        setError("Could not load budget insights right now.");
        setSummary(null);
        setHistory([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [refreshToken, extraConfirmedPurchases]);

  const { retailerRows, spent, purchaseCount, itemCount, maxHist } = useMemo(() => {
    const rets = (summary?.byRetailer ?? []).map((e, i) => ({ ...e, value: Math.round(e.value), color: CHART_COLORS[i % CHART_COLORS.length] }));
    const total = rets.reduce((s, r) => s + r.value, 0) || 1;
    return { retailerRows: rets, spent: Math.round(summary?.spent ?? 0), purchaseCount: summary?.purchaseCount ?? 0, itemCount: summary?.itemCount ?? 0, maxHist: Math.max(1, ...history.map((h) => h.spent)) };
  }, [summary, history]);

  const progress = Math.min(100, (spent / Math.max(1, monthlyLimit)) * 100);
  const over = progress >= 100;
  const near = progress >= 80 && progress < 100;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Inflation & budgeting</Text>
      <Text style={styles.sectionSub}>Actual purchases recorded this month</Text>

      {loading ? <ActivityIndicator style={styles.loader} color={theme.colors.primary} /> : null}
      {error ? <Text style={styles.errText}>{error}</Text> : null}

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
          <Text style={styles.budgetLabelLeft}>This month</Text>
          <Text style={styles.budgetLabelRight}>Rs. {spent.toLocaleString()}</Text>
        </View>
        <View style={styles.progressBg}>
          <View style={[styles.progressFill, { width: `${progress}%` }, over && styles.progressOver, near && !over && styles.progressNear]} />
        </View>
        {near && !over ? <Text style={styles.nearText}>Approaching monthly limit</Text> : null}
        {over ? <Text style={styles.overText}>Over budget — consider reducing spend</Text> : null}
      </View>

      <Text style={styles.blockTitle}>12-month trend</Text>
      <Text style={styles.blockSub}>Your monthly spending pattern</Text>
      {history.length > 0 ? (
        <View style={styles.chartCard}>
          {history.map((h, i) => (
            <View key={`hist-${h.month}-${i}`} style={styles.histRow}>
              <Text style={styles.histMonth} numberOfLines={1}>
                {h.month}
              </Text>
              <View style={styles.histBarBg}>
                <AnimatedBar percentage={(h.spent / Math.max(1, ...history.map((x) => x.spent))) * 100} delay={i * 50} />
              </View>
              <Text style={styles.histSpent}>Rs. {Math.round(h.spent).toLocaleString()}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptySmall}>No spending history yet</Text>
      )}

      <Text style={styles.blockTitle}> Spending by retailer</Text>
      {retailerRows.length > 0 ? <AnimatedPieChart data={retailerRows} /> : <Text style={styles.emptySmall}>No retailer data yet</Text>}

      <Text style={styles.limitLabel}>Monthly budget limit (Rs.)</Text>
      <TextInput style={styles.limitInput} keyboardType="number-pad" value={String(monthlyLimit)} onChangeText={(t) => setMonthlyLimit(Number(t.replace(/[^0-9]/g, "")) || 0)} />
    </View>
  );
}

export default BudgetDashboard;

const styles = StyleSheet.create({
  section: { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg, padding: 16, borderWidth: 1, borderColor: theme.colors.border, gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  sectionSub: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 8 },
  loader: { marginVertical: 12 },
  errText: { color: theme.colors.danger, fontSize: 14, marginBottom: 8 },
  emptySmall: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 12 },
  statRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: theme.colors.background, borderRadius: theme.radii.md, padding: 12, borderWidth: 1, borderColor: theme.colors.border },
  statLabel: { fontSize: 12, color: theme.colors.textMuted },
  statValue: { fontSize: 20, fontWeight: "800", color: theme.colors.text, marginTop: 4 },
  budgetBlock: { marginBottom: 16 },
  budgetLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  budgetLabelLeft: { fontSize: 13, color: theme.colors.textMuted },
  budgetLabelRight: { fontSize: 13, fontWeight: "600", color: theme.colors.text },
  progressBg: { height: 10, borderRadius: 999, backgroundColor: theme.colors.border, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: theme.colors.primary },
  progressNear: { backgroundColor: theme.colors.amber },
  progressOver: { backgroundColor: theme.colors.danger },
  nearText: { fontSize: 12, color: "#b45309", marginTop: 6 },
  overText: { fontSize: 12, color: theme.colors.danger, marginTop: 6 },
  blockTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.text, marginTop: 14, marginBottom: 10 },
  blockSub: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 8 },
  chartCard: { backgroundColor: theme.colors.background, borderRadius: theme.radii.md, padding: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 12, gap: 8 },
  histRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  histMonth: { width: 72, fontSize: 11, color: theme.colors.textMuted },
  histBarBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: theme.colors.surface, overflow: "hidden" },
  histBarFill: { height: "100%", backgroundColor: theme.colors.primary, borderRadius: 4 },
  histSpent: { width: 88, fontSize: 11, fontWeight: "600", color: theme.colors.text, textAlign: "right" },
  pieContainer: { backgroundColor: theme.colors.background, borderRadius: theme.radii.lg, padding: 16, borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", marginBottom: 12 },
  pieWrap: { alignItems: "center", justifyContent: "center" },
  pieCenter: { position: "absolute", backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 12, paddingVertical: 10 },
  pieCenterValue: { fontSize: 15, fontWeight: "800", color: theme.colors.text, textAlign: "center" },
  pieCenterLabel: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2, textAlign: "center" },
  pieLegend: { width: "100%", marginTop: 12, gap: 10 },
  legendCard: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md, padding: 10, backgroundColor: theme.colors.surface, gap: 6 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { flex: 1, fontSize: 13, fontWeight: "600", color: theme.colors.text },
  legendPercent: { fontSize: 13, fontWeight: "800", color: theme.colors.secondary, minWidth: 40, textAlign: "right" },
  legendTrack: { height: 6, borderRadius: 999, backgroundColor: theme.colors.border, overflow: "hidden" },
  legendTrackFill: { height: "100%", borderRadius: 999 },
  legendAmount: { fontSize: 12, color: theme.colors.textMuted, fontWeight: "600" },
  limitLabel: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4 },
  limitInput: { marginTop: 6, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: theme.colors.background, color: theme.colors.text },
});

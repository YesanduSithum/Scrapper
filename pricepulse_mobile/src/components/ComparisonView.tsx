import { useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { AVAILABLE_RETAILERS, RETAILER_MAP_QUERIES } from "../constants/retailers";
import { theme } from "../constants/theme";
import {
  calculateStoreComparisons,
  formatPrice,
  getBestStoreOption,
  getRetailerLabel,
} from "../services/comparisonService";
import type { BasketItem, ComparisonFilter, Retailer } from "../types";

type Props = {
  items: BasketItem[];
  onBack: () => void;
  onSelectStore?: (store: Retailer) => void;
  isProcessing?: boolean;
};

function openMap(store: Retailer) {
  const q = RETAILER_MAP_QUERIES[store];
  void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`);
}

export function ComparisonView({ items, onBack, onSelectStore, isProcessing }: Props) {
  const [filter, setFilter] = useState<ComparisonFilter>("availability");
  const [openRetailers, setOpenRetailers] = useState<Record<string, boolean>>({});

  const comparisons = useMemo(() => calculateStoreComparisons(items, filter), [items, filter]);
  const bestOption = useMemo(() => getBestStoreOption(comparisons, filter), [comparisons, filter]);

  const toggleRetailer = (r: Retailer) => {
    setOpenRetailers((prev) => ({ ...prev, [r]: !prev[r] }));
  };

  const detailedGroups = useMemo(() => {
    const RETAILERS: Retailer[] = AVAILABLE_RETAILERS;
    const groups: Record<string, BasketItem[]> = {};
    items.forEach((item) => {
      const availabilities = RETAILERS.map((r) => ({
        retailer: r,
        price: item.product.prices[r] ?? 0,
      }))
        .filter((a) => a.price > 0)
        .sort((a, b) => a.price - b.price);
      const cheapest = availabilities[0]?.retailer;
      const key = cheapest ?? "none";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [items]);

  return (
    <View style={styles.root}>
      <View style={styles.topRow}>
        <View style={styles.topTitles}>
          <Text style={styles.pageTitle}>Compare prices</Text>
          <Text style={styles.pageSub}>Find the best store for your list</Text>
        </View>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.backLink}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(["availability", "detailed"] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.tab, filter === f && styles.tabActive]}
          >
            <Text style={[styles.tabText, filter === f && styles.tabTextActive]}>
              {f === "availability" ? "Availability" : "Detailed"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.hint}>
        <Text style={styles.hintText}>
          {filter === "availability"
            ? "Shows stores with all items available, ranked by total price."
            : "Shows which store is cheapest for each item on your list."}
        </Text>
      </View>

      {bestOption ? (
        <View style={styles.bestCard}>
          <Text style={styles.bestLabel}>Best option</Text>
          <Text style={styles.bestStore}>{getRetailerLabel(bestOption.retailer)}</Text>
          <Text style={styles.bestPrice}>{formatPrice(bestOption.totalPrice)}</Text>
          {bestOption.unavailableProducts.length > 0 ? (
            <Text style={styles.bestWarn}>
              {bestOption.unavailableProducts.length} item(s) not available here
            </Text>
          ) : null}
        </View>
      ) : null}

      {filter === "availability" ? (
        <View style={styles.cards}>
          {comparisons.map((comparison, index) => {
            const expanded = openRetailers[comparison.retailer] ?? index === 0;
            return (
              <View
                key={comparison.retailer}
                style={[
                  styles.storeCard,
                  comparison.isComplete && styles.storeCardComplete,
                ]}
              >
                <Pressable onPress={() => toggleRetailer(comparison.retailer)} style={styles.storeHead}>
                  <View style={styles.rankCircle}>
                    <Text
                      style={[
                        styles.rankText,
                        comparison.isComplete && styles.rankTextComplete,
                      ]}
                    >
                      {index + 1}
                    </Text>
                  </View>
                  <View style={styles.storeHeadMid}>
                    <Text style={styles.storeName}>{getRetailerLabel(comparison.retailer)}</Text>
                    <Text style={styles.storeMeta}>
                      {comparison.availableProductCount}/{items.length} items available
                    </Text>
                  </View>
                  <View style={styles.storeHeadRight}>
                    <Text style={styles.storeTotal}>{formatPrice(comparison.totalPrice)}</Text>
                    {comparison.unavailableProducts.length > 0 ? (
                      <Text style={styles.unavailMeta}>{comparison.unavailableProducts.length} missing</Text>
                    ) : null}
                    <Text style={styles.expandHint}>{expanded ? "▲" : "▼"}</Text>
                  </View>
                </Pressable>

                {expanded ? (
                  <View style={styles.breakdown}>
                    <Text style={styles.breakdownTitle}>Price breakdown</Text>
                    {comparison.products.map((p) => {
                      const avail = p.availability.find((a) => a.retailer === comparison.retailer);
                      const ok = avail?.available ?? false;
                      const unit = avail?.price ?? 0;
                      return (
                        <View key={p.productId} style={styles.lineItem}>
                          <View style={styles.lineItemLeft}>
                            <Text style={styles.lineName} numberOfLines={2}>
                              {p.name}
                            </Text>
                            <Text style={styles.lineQty}>
                              {p.quantity} × {ok ? formatPrice(unit) : "N/A"}
                            </Text>
                          </View>
                          <View style={styles.lineItemRight}>
                            {ok ? (
                              <>
                                <Text style={styles.lineTotal}>{formatPrice(unit * p.quantity)}</Text>
                                {p.cheapestRetailer === comparison.retailer ? (
                                  <View style={styles.cheapestTag}>
                                    <Text style={styles.cheapestTagText}>Cheapest</Text>
                                  </View>
                                ) : null}
                              </>
                            ) : (
                              <Text style={styles.na}>Unavailable</Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                    <View style={styles.actions}>
                      <Pressable style={styles.secondaryBtn} onPress={() => openMap(comparison.retailer)}>
                        <Text style={styles.secondaryBtnText}>Nearest store</Text>
                      </Pressable>
                      {comparison.isComplete ? (
                        <Pressable
                          style={[styles.primaryAction, isProcessing && styles.btnDisabled]}
                          onPress={() => onSelectStore?.(comparison.retailer)}
                          disabled={isProcessing}
                        >
                          <Text style={styles.primaryActionText}>
                            {isProcessing ? "Saving…" : "Buy here"}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.cards}>
          {detailedGroups.map(([retailerKey, groupItems]) => {
            if (retailerKey === "none") {
              return (
                <View key="none" style={styles.detailedWarn}>
                  <Text style={styles.detailedWarnTitle}>Unavailable anywhere</Text>
                  {groupItems.map((it) => (
                    <Text key={it.product.id} style={styles.detailedWarnLine}>
                      • {it.product.name}
                    </Text>
                  ))}
                </View>
              );
            }
            const r = retailerKey as Retailer;
            return (
              <View key={retailerKey} style={styles.detailedCard}>
                <View style={styles.detailedHead}>
                  <Text style={styles.detailedHeadTitle}>{getRetailerLabel(r)}</Text>
                  <View style={styles.detailedBadge}>
                    <Text style={styles.detailedBadgeText}>{groupItems.length} cheapest</Text>
                  </View>
                </View>
                {groupItems.map((item) => {
                  const RETAILERS: Retailer[] = AVAILABLE_RETAILERS;
                  const availabilities = RETAILERS.map((store) => ({
                    retailer: store,
                    price: item.product.prices[store] ?? 0,
                  }))
                    .filter((a) => a.price > 0)
                    .sort((a, b) => a.price - b.price);
                  const best = availabilities[0];
                  return (
                    <View key={item.product.id} style={styles.detailedItem}>
                      <View style={styles.detailedItemTop}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.detailedItemName}>{item.product.name}</Text>
                          <Text style={styles.detailedItemQty}>Qty: {item.quantity}</Text>
                        </View>
                        <Text style={styles.detailedItemPrice}>
                          {best ? formatPrice(best.price * item.quantity) : "N/A"}
                        </Text>
                      </View>
                      {availabilities.length > 1 ? (
                        <View style={styles.otherPrices}>
                          {availabilities.slice(1).map((a) => (
                            <Text key={a.retailer} style={styles.otherPriceChip}>
                              {getRetailerLabel(a.retailer)}: {formatPrice(a.price * item.quantity)}
                            </Text>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  topTitles: { flex: 1, minWidth: 0 },
  pageTitle: { fontSize: 22, fontWeight: "800", color: theme.colors.text },
  pageSub: { fontSize: 14, color: theme.colors.textMuted, marginTop: 4 },
  backLink: { fontSize: 15, fontWeight: "600", color: theme.colors.primary },
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
  },
  tabActive: { backgroundColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: "600", color: theme.colors.textMuted },
  tabTextActive: { color: "#fff" },
  hint: {
    padding: 12,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.2)",
  },
  hintText: { fontSize: 13, color: "#064e3b", lineHeight: 18 },
  bestCard: {
    padding: 16,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.secondarySoft,
    borderWidth: 1,
    borderColor: "rgba(4, 120, 87, 0.25)",
  },
  bestLabel: { fontSize: 11, fontWeight: "700", color: theme.colors.textMuted, letterSpacing: 0.5 },
  bestStore: { fontSize: 20, fontWeight: "800", color: theme.colors.text, marginTop: 4 },
  bestPrice: { fontSize: 18, fontWeight: "700", color: theme.colors.secondary, marginTop: 4 },
  bestWarn: { fontSize: 12, color: theme.colors.warning, marginTop: 8 },
  cards: { gap: 12 },
  storeCard: {
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    overflow: "hidden",
    ...theme.shadow.card,
  },
  storeCardComplete: { borderColor: "rgba(4, 120, 87, 0.35)" },
  storeHead: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  rankCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { fontSize: 14, fontWeight: "800", color: theme.colors.textMuted },
  rankTextComplete: { color: theme.colors.secondary },
  storeHeadMid: { flex: 1, minWidth: 0 },
  storeName: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  storeMeta: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
  storeHeadRight: { alignItems: "flex-end" },
  storeTotal: { fontSize: 17, fontWeight: "800", color: theme.colors.text },
  unavailMeta: { fontSize: 11, color: theme.colors.warning, marginTop: 2 },
  expandHint: { fontSize: 10, color: theme.colors.textMuted, marginTop: 4 },
  breakdown: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: 14,
    backgroundColor: theme.colors.surface,
    gap: 10,
  },
  breakdownTitle: { fontSize: 13, fontWeight: "700", color: theme.colors.text },
  lineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    padding: 10,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  lineItemLeft: { flex: 1, minWidth: 0 },
  lineName: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
  lineQty: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
  lineItemRight: { alignItems: "flex-end", justifyContent: "center", gap: 4 },
  lineTotal: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  cheapestTag: {
    backgroundColor: theme.colors.secondarySoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cheapestTagText: { fontSize: 10, fontWeight: "700", color: theme.colors.secondary },
  na: { fontSize: 12, fontWeight: "600", color: theme.colors.warning },
  actions: { flexDirection: "row", gap: 10, marginTop: 6 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
  },
  secondaryBtnText: { fontSize: 14, fontWeight: "700", color: theme.colors.primary },
  primaryAction: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.secondary,
    alignItems: "center",
  },
  primaryActionText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  btnDisabled: { opacity: 0.6 },
  detailedWarn: {
    padding: 14,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: "rgba(217, 119, 6, 0.35)",
    backgroundColor: theme.colors.warningSoft,
    gap: 4,
  },
  detailedWarnTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.warning },
  detailedWarnLine: { fontSize: 13, color: theme.colors.text },
  detailedCard: {
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    backgroundColor: theme.colors.background,
  },
  detailedHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    backgroundColor: theme.colors.primarySoft,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(5, 150, 105, 0.15)",
  },
  detailedHeadTitle: { fontSize: 16, fontWeight: "800", color: "#064e3b" },
  detailedBadge: {
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  detailedBadgeText: { fontSize: 12, fontWeight: "700", color: theme.colors.primary },
  detailedItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 8,
  },
  detailedItemTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  detailedItemName: { fontSize: 15, fontWeight: "600", color: theme.colors.text },
  detailedItemQty: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  detailedItemPrice: { fontSize: 16, fontWeight: "800", color: theme.colors.secondary },
  otherPrices: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  otherPriceChip: {
    fontSize: 11,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});

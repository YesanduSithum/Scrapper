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
  
  // Check if we have any valid data to display
  const hasValidData = useMemo(() => {
    if (items.length === 0) return false;
    return items.some(item => {
      const prices = Object.values(item.product.prices).filter(p => p != null && p > 0);
      return prices.length > 0;
    });
  }, [items]);

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
    return Object.entries(groups).sort((a, b) => {
      if (a[0] === "none") return 1;
      if (b[0] === "none") return -1;
      return b[1].length - a[1].length;
    });
  }, [items]);

  // Handle empty data state
  if (!hasValidData) {
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
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyStateIcon}>📊</Text>
          <Text style={styles.emptyStateTitle}>No pricing data available</Text>
          <Text style={styles.emptyStateText}>
            The items in your list don't have prices from any stores yet. Please check your items or try again later.
          </Text>
          <Pressable onPress={onBack} style={styles.emptyStateButton}>
            <Text style={styles.emptyStateButtonText}>Go back to list</Text>
          </Pressable>
        </View>
      </View>
    );
  }

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
              {f === "availability" ? "🏪 Availability" : "🏷️ Best Deals"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.hint}>
        <Text style={styles.hintText}>
          {filter === "availability"
            ? "✓ Shows stores with all items available, ranked by total price."
            : "💰 Shows which store has the cheapest price for each item."}
        </Text>
      </View>

      {bestOption && filter === "availability" ? (
        <View style={styles.bestCard}>
          <View style={styles.bestCardTop}>
            <Text style={styles.bestLabel}>🎯 BEST OPTION</Text>
            <Text style={styles.bestPrice}>{formatPrice(bestOption.totalPrice)}</Text>
          </View>
          <Text style={styles.bestStore}>{getRetailerLabel(bestOption.retailer)}</Text>
          {bestOption.unavailableProducts.length > 0 ? (
            <Text style={styles.bestWarn}>
              ⚠️ {bestOption.unavailableProducts.length} item(s) not available
            </Text>
          ) : (
            <Text style={styles.bestWarning}>✓ All items available!</Text>
          )}
        </View>
      ) : null}

      {filter === "availability" ? (
        <View style={styles.cards}>
          {comparisons.length === 0 ? (
            <View style={styles.emptyCards}>
              <Text style={styles.emptyCardsText}>No store information available</Text>
            </View>
          ) : (
            comparisons.map((comparison, index) => {
              const expanded = openRetailers[comparison.retailer] ?? index === 0;
              return (
                <Pressable
                  key={comparison.retailer}
                  onPress={() => toggleRetailer(comparison.retailer)}
                  style={[
                    styles.storeCard,
                    comparison.isComplete && styles.storeCardComplete,
                    expanded && styles.storeCardExpanded,
                  ]}
                >
                  <View style={styles.storeHead}>
                    <View style={[styles.rankCircle, comparison.isComplete && styles.rankCircleComplete]}>
                      <Text style={[styles.rankText, comparison.isComplete && styles.rankTextComplete]}>
                        #{index + 1}
                      </Text>
                    </View>
                    <View style={styles.storeHeadMid}>
                      <Text style={styles.storeName}>{getRetailerLabel(comparison.retailer)}</Text>
                      <Text style={styles.storeMeta}>
                        {comparison.availableProductCount}/{items.length} items • {formatPrice(comparison.totalPrice)}
                      </Text>
                    </View>
                    <View style={styles.storeHeadRight}>
                      {comparison.unavailableProducts.length > 0 && (
                        <View style={styles.missingBadge}>
                          <Text style={styles.missingBadgeText}>{comparison.unavailableProducts.length} missing</Text>
                        </View>
                      )}
                      <Text style={styles.expandHint}>{expanded ? "▲" : "▼"}</Text>
                    </View>
                  </View>

                  {expanded ? (
                    <View style={styles.breakdown}>
                      <Text style={styles.breakdownTitle}>Price Breakdown</Text>
                      <View style={styles.breakdownGrid}>
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
                                  {p.quantity}× {ok ? formatPrice(unit) : "N/A"}
                                </Text>
                              </View>
                              <View style={styles.lineItemRight}>
                                {ok ? (
                                  <>
                                    <Text style={styles.lineTotal}>{formatPrice(unit * p.quantity)}</Text>
                                    {p.cheapestRetailer === comparison.retailer && (
                                      <View style={styles.cheapestTag}>
                                        <Text style={styles.cheapestTagText}>💰 Best</Text>
                                      </View>
                                    )}
                                  </>
                                ) : (
                                  <Text style={styles.na}>Not available</Text>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                      <View style={styles.actions}>
                        <Pressable style={styles.secondaryBtn} onPress={() => openMap(comparison.retailer)}>
                          <Text style={styles.secondaryBtnText}>📍 Find nearest</Text>
                        </Pressable>
                        {comparison.isComplete ? (
                          <Pressable
                            style={[styles.primaryAction, isProcessing && styles.btnDisabled]}
                            onPress={() => onSelectStore?.(comparison.retailer)}
                            disabled={isProcessing}
                          >
                            <Text style={styles.primaryActionText}>
                              {isProcessing ? "Saving…" : "✓ Mark as bought"}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </View>
      ) : (
        <View style={styles.cards}>
          {detailedGroups.length === 0 ? (
            <View style={styles.emptyCards}>
              <Text style={styles.emptyCardsText}>No pricing data available</Text>
            </View>
          ) : (
            detailedGroups.map(([retailerKey, groupItems]) => {
              if (retailerKey === "none") {
                return (
                  <View key="none" style={styles.detailedWarn}>
                    <View style={styles.detailedWarnHeader}>
                      <Text style={styles.detailedWarnTitle}>⚠️ Unavailable Anywhere</Text>
                    </View>
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
                    <View style={styles.detailedHeadLeft}>
                      <Text style={styles.detailedHeadTitle}>{getRetailerLabel(r)}</Text>
                      <View style={styles.detailedBadge}>
                        <Text style={styles.detailedBadgeText}>
                          💰 {groupItems.length} cheapest deal{groupItems.length > 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {groupItems.map((item, idx) => {
                    const RETAILERS: Retailer[] = AVAILABLE_RETAILERS;
                    const availabilities = RETAILERS.map((store) => ({
                      retailer: store,
                      price: item.product.prices[store] ?? 0,
                    }))
                      .filter((a) => a.price > 0)
                      .sort((a, b) => a.price - b.price);
                    const best = availabilities[0];
                    const others = availabilities.slice(1);
                    return (
                      <View
                        key={item.product.id}
                        style={[styles.detailedItem, idx === groupItems.length - 1 && styles.detailedItemLast]}
                      >
                        <View style={styles.detailedItemTop}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.detailedItemName}>{item.product.name}</Text>
                            <Text style={styles.detailedItemQty}>Qty: {item.quantity}</Text>
                          </View>
                          <View style={styles.detailedItemPriceBlock}>
                            <Text style={styles.detailedItemPrice}>
                              {best ? formatPrice(best.price * item.quantity) : "N/A"}
                            </Text>
                            <Text style={styles.detailedItemUnit}>
                              {best ? formatPrice(best.price) + '/unit' : ''}
                            </Text>
                          </View>
                        </View>
                        {others.length > 0 && (
                          <View style={styles.otherPrices}>
                            <Text style={styles.otherPricesLabel}>Other stores:</Text>
                            {others.map((a) => (
                              <View key={a.retailer} style={styles.otherPriceChip}>
                                <Text style={styles.otherPriceChipText}>
                                  {getRetailerLabel(a.retailer)}: {formatPrice(a.price * item.quantity)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  topTitles: { flex: 1, minWidth: 0 },
  pageTitle: { fontSize: 24, fontWeight: "900", color: theme.colors.text },
  pageSub: { fontSize: 14, color: theme.colors.textMuted, marginTop: 4 },
  backLink: { fontSize: 15, fontWeight: "700", color: theme.colors.primary, paddingVertical: 4 },
  
  // Empty state
  emptyStateCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyStateIcon: { fontSize: 48, marginBottom: 16 },
  emptyStateTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.text, marginBottom: 8 },
  emptyStateText: { fontSize: 14, color: theme.colors.textMuted, textAlign: "center", marginBottom: 20, lineHeight: 20 },
  emptyStateButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primary,
  },
  emptyStateButtonText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  
  emptyCards: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyCardsText: { fontSize: 14, color: theme.colors.textMuted },

  // Tabs
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: "700", color: theme.colors.textMuted },
  tabTextActive: { color: "#fff" },

  // Hint
  hint: {
    padding: 14,
    borderRadius: theme.radii.md,
    backgroundColor: "rgba(5, 150, 105, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.2)",
  },
  hintText: { fontSize: 13, color: "#064e3b", lineHeight: 20, fontWeight: "500" },

  // Best card
  bestCard: {
    padding: 18,
    borderRadius: theme.radii.lg,
    backgroundColor: "rgba(4, 120, 87, 0.08)",
    borderWidth: 2,
    borderColor: theme.colors.secondary,
    ...theme.shadow.card,
  },
  bestCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  bestLabel: { fontSize: 10, fontWeight: "800", color: theme.colors.secondary, letterSpacing: 1 },
  bestPrice: { fontSize: 24, fontWeight: "900", color: theme.colors.secondary },
  bestStore: { fontSize: 18, fontWeight: "800", color: theme.colors.text, marginBottom: 8 },
  bestWarn: { fontSize: 12, color: theme.colors.warning, marginTop: 4, fontWeight: "600" },
  bestWarning: { fontSize: 12, color: theme.colors.secondary, marginTop: 4, fontWeight: "600" },

  // Cards
  cards: { gap: 12 },
  storeCard: {
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    overflow: "hidden",
    ...theme.shadow.card,
  },
  storeCardComplete: { borderWidth: 2, borderColor: theme.colors.secondary },
  storeCardExpanded: { backgroundColor: theme.colors.surface },
  storeHead: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  rankCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rankCircleComplete: { backgroundColor: theme.colors.secondarySoft, borderColor: theme.colors.secondary },
  rankText: { fontSize: 14, fontWeight: "800", color: theme.colors.textMuted },
  rankTextComplete: { color: theme.colors.secondary },
  storeHeadMid: { flex: 1, minWidth: 0 },
  storeName: { fontSize: 17, fontWeight: "800", color: theme.colors.text },
  storeMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2, fontWeight: "500" },
  storeHeadRight: { alignItems: "flex-end", gap: 6 },
  missingBadge: {
    backgroundColor: theme.colors.warningSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  missingBadgeText: { fontSize: 11, fontWeight: "700", color: theme.colors.warning },
  expandHint: { fontSize: 12, color: theme.colors.textMuted, fontWeight: "600" },

  // Breakdown
  breakdown: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    padding: 14,
    backgroundColor: theme.colors.surface,
    gap: 12,
  },
  breakdownTitle: { fontSize: 14, fontWeight: "800", color: theme.colors.text, marginBottom: 4 },
  breakdownGrid: { gap: 10 },
  lineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    padding: 12,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  lineItemLeft: { flex: 1, minWidth: 0 },
  lineName: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
  lineQty: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4, fontWeight: "500" },
  lineItemRight: { alignItems: "flex-end", justifyContent: "center", gap: 4 },
  lineTotal: { fontSize: 15, fontWeight: "800", color: theme.colors.text },
  cheapestTag: {
    backgroundColor: theme.colors.secondarySoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  cheapestTagText: { fontSize: 11, fontWeight: "700", color: theme.colors.secondary },
  na: { fontSize: 12, fontWeight: "700", color: theme.colors.warning },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.2)",
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

  // Detailed view
  detailedWarn: {
    padding: 16,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: "rgba(217, 119, 6, 0.3)",
    backgroundColor: "rgba(217, 119, 6, 0.05)",
    gap: 8,
  },
  detailedWarnHeader: { marginBottom: 4 },
  detailedWarnTitle: { fontSize: 15, fontWeight: "800", color: theme.colors.warning },
  detailedWarnLine: { fontSize: 13, color: theme.colors.text, fontWeight: "500" },
  detailedCard: {
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    backgroundColor: theme.colors.background,
    ...theme.shadow.card,
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
  detailedHeadLeft: { flex: 1, minWidth: 0 },
  detailedHeadTitle: { fontSize: 17, fontWeight: "800", color: "#064e3b" },
  detailedBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  detailedBadgeText: { fontSize: 12, fontWeight: "700", color: theme.colors.primary },
  detailedItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 10,
  },
  detailedItemLast: { borderBottomWidth: 0 },
  detailedItemTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  detailedItemName: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
  detailedItemQty: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2, fontWeight: "500" },
  detailedItemPriceBlock: { alignItems: "flex-end" },
  detailedItemPrice: { fontSize: 18, fontWeight: "900", color: theme.colors.secondary },
  detailedItemUnit: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2, fontWeight: "500" },
  otherPrices: { gap: 8 },
  otherPricesLabel: { fontSize: 11, fontWeight: "700", color: theme.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  otherPriceChip: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  otherPriceChipText: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: "600",
  },
});

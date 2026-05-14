import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../constants/theme";
import type { ProcessListResult, ProductMatchCandidate } from "../types";

type Props = {
  results: ProcessListResult[];
  onSelectAlternative?: (candidate: ProductMatchCandidate, quantity: number, result?: ProcessListResult) => void;
};

function resultKey(result: ProcessListResult, index: number): string {
  return `${result.inputName}-${result.quantity}-${index}`;
}

export function ProcessedResults({ results, onSelectAlternative }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (results.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Text style={styles.headerIconText}>✦</Text>
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Processed matches</Text>
          <Text style={styles.headerSub}>Tap an item to view alternatives</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{results.length} items</Text>
        </View>
      </View>

      <View style={styles.list}>
        {results.map((result, idx) => {
          const key = resultKey(result, idx);
          const itemName = result.inputName || result.userInput || "";
          const hasAlts = (result.alternatives?.length ?? 0) > 0;
          const isOpen = expanded[key] ?? false;
          const prices = result.bestMatch?.product.prices ?? [];
          const pricePreview =
            prices.length > 0
              ? prices
                  .slice(0, 2)
                  .map((p) => `Rs. ${p.price}`)
                  .join(" – ")
              : null;

          return (
            <View key={key} style={styles.itemCard}>
              <Pressable
                onPress={() => hasAlts && toggle(key)}
                disabled={!hasAlts}
                style={({ pressed }) => [styles.itemHead, pressed && hasAlts && styles.itemHeadPressed]}
              >
                <View style={styles.itemHeadRow}>
                  <View style={[styles.statusIcon, result.bestMatch ? styles.statusOk : styles.statusWarn]}>
                    <Text style={[styles.statusIconText, !result.bestMatch && styles.statusIconTextWarn]}>
                      {result.bestMatch ? "✓" : "!"}
                    </Text>
                  </View>
                  <View style={styles.itemBody}>
                    <View style={styles.itemTitleRow}>
                      <Text style={styles.inputLabel} numberOfLines={1}>
                        {itemName}
                      </Text>
                      <View style={styles.qtyPill}>
                        <Text style={styles.qtyPillText}>Qty {result.quantity}</Text>
                      </View>
                    </View>
                    {result.bestMatch ? (
                      <>
                        <Text style={styles.productName} numberOfLines={2}>
                          {result.bestMatch.product.name}
                        </Text>
                        <Text style={styles.matchLine}>
                          Best match{" "}
                          <Text style={styles.matchPct}>{(result.bestMatch.similarity * 100).toFixed(1)}%</Text>
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.noMatch}>No match found</Text>
                    )}
                  </View>
                  {hasAlts ? <Text style={styles.chevron}>{isOpen ? "▲" : "▼"}</Text> : null}
                </View>
                {pricePreview ? (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceRowLabel}>Price preview</Text>
                    <Text style={styles.priceRowValue}>{pricePreview}</Text>
                  </View>
                ) : null}
              </Pressable>

              {isOpen && hasAlts ? (
                <View style={styles.alts}>
                  <Text style={styles.altsTitle}>Similar products ({result.alternatives.length})</Text>
                  {result.alternatives.map((alt, altIdx) => (
                    <View key={`${key}-alt-${alt.product.id}-${altIdx}`} style={styles.altRow}>
                      <View style={styles.altText}>
                        <Text style={styles.altName} numberOfLines={2}>
                          {alt.product.name}
                        </Text>
                        <Text style={styles.altMatch}>Match: {(alt.similarity * 100).toFixed(1)}%</Text>
                      </View>
                      {onSelectAlternative ? (
                        <Pressable
                          style={({ pressed }) => [styles.useBtn, pressed && styles.useBtnPressed]}
                          onPress={() => onSelectAlternative(alt, result.quantity, result)}
                        >
                          <Text style={styles.useBtnText}>Use this</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: theme.radii.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    overflow: "hidden",
    ...theme.shadow.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.primarySoft,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.secondarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconText: { fontSize: 16, color: theme.colors.secondary },
  headerTextWrap: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
  headerSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  badge: {
    backgroundColor: theme.colors.secondarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: theme.colors.secondary },
  list: { padding: 10, gap: 10 },
  itemCard: {
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    overflow: "hidden",
  },
  itemHead: { padding: 12 },
  itemHeadPressed: { opacity: 0.92 },
  itemHeadRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusOk: { backgroundColor: theme.colors.secondarySoft },
  statusWarn: { backgroundColor: theme.colors.warningSoft },
  statusIconText: { fontSize: 18, fontWeight: "700", color: theme.colors.secondary },
  statusIconTextWarn: { color: theme.colors.warning },
  itemBody: { flex: 1, minWidth: 0 },
  itemTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  inputLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: theme.colors.textMuted,
    minWidth: 80,
  },
  qtyPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  qtyPillText: { fontSize: 11, fontWeight: "600", color: theme.colors.textMuted },
  productName: { marginTop: 4, fontSize: 15, fontWeight: "700", color: theme.colors.text },
  matchLine: { marginTop: 4, fontSize: 12, color: theme.colors.textMuted },
  matchPct: { fontWeight: "700", color: theme.colors.secondary },
  noMatch: { marginTop: 4, fontSize: 14, fontWeight: "600", color: theme.colors.warning },
  chevron: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
  priceRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceRowLabel: { fontSize: 12, color: theme.colors.textMuted },
  priceRowValue: { fontSize: 12, fontWeight: "600", color: theme.colors.text },
  alts: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    padding: 12,
    gap: 10,
  },
  altsTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: theme.colors.textMuted,
  },
  altRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  altText: { flex: 1, minWidth: 0 },
  altName: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
  altMatch: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  useBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.primarySoft,
  },
  useBtnPressed: { opacity: 0.85 },
  useBtnText: { fontSize: 12, fontWeight: "700", color: theme.colors.primary },
});

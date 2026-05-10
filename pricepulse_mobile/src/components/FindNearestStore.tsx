import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { RETAILER_LABELS, RETAILER_MAP_QUERIES } from "../constants/retailers";
import { theme } from "../constants/theme";
import type { Retailer } from "../types";

type Props = {
  cheapestStore: Retailer | null;
};

export function FindNearestStore({ cheapestStore }: Props) {
  const [open, setOpen] = useState(false);
  const store = cheapestStore ?? "cargills";
  const query = RETAILER_MAP_QUERIES[store];

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Find nearest store</Text>
      <Text style={styles.sub}>Open maps for the closest {RETAILER_LABELS[store]} branch.</Text>
      <Pressable style={styles.btn} onPress={() => setOpen((o) => !o)}>
        <Text style={styles.btnText}>{open ? "Hide options" : "Find nearest store"}</Text>
      </Pressable>
      {open ? (
        <Pressable
          style={styles.mapBtn}
          onPress={() =>
            void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`)
          }
        >
          <Text style={styles.mapBtnText}>Open in Google Maps</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    padding: 16,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
  },
  title: { fontSize: 17, fontWeight: "800", color: theme.colors.text },
  sub: { fontSize: 13, color: theme.colors.textMuted, lineHeight: 18 },
  btn: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  mapBtn: {
    paddingVertical: 12,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.25)",
  },
  mapBtnText: { color: theme.colors.primary, fontWeight: "700", fontSize: 14 },
});

import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import BudgetDashboard from "./src/components/BudgetDashboard";
import { ComparisonView } from "./src/components/ComparisonView";
import { ProcessedResults } from "./src/components/ProcessedResults";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { AVAILABLE_RETAILERS, RETAILER_LABELS } from "./src/constants/retailers";
import { theme } from "./src/constants/theme";
import { api } from "./src/services/api";
import { mapApiProductToProduct } from "./src/services/productMapper";
import { appendConfirmedPurchase, buildConfirmedPurchaseRecord } from "./src/storage/confirmedPurchases";
import type { ConfirmedPurchaseRecord } from "./src/storage/confirmedPurchases";
import type { BasketItem, ProcessListResult, Product, ProductMatchCandidate, Retailer } from "./src/types";

const LOGO = require("./assets/applogo.png");

const STORES: Retailer[] = AVAILABLE_RETAILERS;

function getCheapestStoreForBasket(items: BasketItem[]): Retailer | null {
  if (items.length === 0) return null;
  const totals = STORES.map((store) => ({
    store,
    total: items.reduce((s, { product, quantity }) => s + (product.prices[store] ?? 0) * quantity, 0),
  }));
  return totals.reduce((a, b) => (a.total <= b.total ? a : b)).store;
}

type AppView = "home" | "processed-matches" | "grocery-list" | "comparison" | "budget";

const AUTO_LIST_DELAY_MS = 1100;

function AppBody() {
  const { user, bootstrapping } = useAuth();
  if (bootstrapping) {
    return (
      <SafeAreaView style={styles.centered}>
        <LinearGradient colors={["#ecfdf5", "#d1fae5", "#ffffff"]} locations={[0, 0.45, 1]} style={styles.loadingGradient}>
          <View style={styles.loadingContent}>
            <Image source={LOGO} style={styles.loadingLogo} resizeMode="contain" accessibilityLabel="PricePulse logo" />
            <Text style={styles.loadingText}>Loading PricePulse</Text>
            <ActivityIndicator style={styles.loadingSpinner} size="large" color={theme.colors.primary} />
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }
  return user ? <Dashboard /> : <AuthScreen />;
}

function AuthScreen() {
  const [isRegister, setIsRegister] = useState(false);
  const { login, register, isLoading, error } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const placeholderColor = theme.colors.textMuted;

  const submit = async () => {
    setLocalError(null);
    if (!email.trim()) {
      setLocalError("Enter your email");
      return;
    }
    if (!password.trim()) {
      setLocalError("Enter your password");
      return;
    }
    if (isRegister) {
      if (!name.trim()) {
        setLocalError("Enter your name");
        return;
      }
      if (password.length < 6) {
        setLocalError("Password must be at least 6 characters");
        return;
      }
      await register(email.trim(), password, name.trim());
    } else {
      await login(email.trim(), password);
    }
  };

  const displayError = localError || error;
  const switchMode = (next: boolean) => {
    setIsRegister(next);
    setLocalError(null);
  };

  return (
    <LinearGradient colors={["#ecfdf5", "#d1fae5", "#ffffff"]} locations={[0, 0.45, 1]} style={styles.authGradient}>
      <SafeAreaView style={styles.authSafe}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.authKeyboard}
        >
          <ScrollView
            contentContainerStyle={styles.authScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Image source={LOGO} style={styles.authLogo} resizeMode="contain" accessibilityLabel="PricePulse logo" />
            <View style={styles.authCard}>
              <View style={styles.authSwitchRow}>
                <Pressable
                  style={({ pressed }) => [styles.authSwitchBtn, !isRegister && styles.authSwitchActive, pressed && styles.authSwitchPressed]}
                  onPress={() => switchMode(false)}
                >
                  <Text style={!isRegister ? styles.authSwitchActiveText : styles.authSwitchText}>Sign in</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.authSwitchBtn, isRegister && styles.authSwitchActive, pressed && styles.authSwitchPressed]}
                  onPress={() => switchMode(true)}
                >
                  <Text style={isRegister ? styles.authSwitchActiveText : styles.authSwitchText}>Register</Text>
                </Pressable>
              </View>

              <View style={styles.authForm}>
                {!isRegister ? (
                  <>
                    <Text style={styles.authHeading}>Welcome back</Text>
                    <Text style={styles.authSub}>Sign in to continue to PricePulse</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.authHeading}>Create account</Text>
                    <Text style={styles.authSub}>Join PricePulse to compare grocery prices</Text>
                  </>
                )}

                {displayError ? (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorBannerText}>{displayError}</Text>
                  </View>
                ) : null}

                {isRegister && (
                  <>
                    <Text style={styles.inputLabel}>Name</Text>
                    <TextInput
                      style={styles.authInput}
                      placeholder="Your name"
                      placeholderTextColor={placeholderColor}
                      value={name}
                      onChangeText={setName}
                      autoComplete="name"
                      editable={!isLoading}
                    />
                  </>
                )}
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.authInput}
                  placeholder="you@example.com"
                  placeholderTextColor={placeholderColor}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                  editable={!isLoading}
                />
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.authInput}
                  placeholder="••••••••"
                  placeholderTextColor={placeholderColor}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  autoComplete={isRegister ? "password-new" : "password"}
                  editable={!isLoading}
                />

                <Pressable
                  style={({ pressed }) => [styles.authSubmitBtn, (isLoading || pressed) && styles.authSubmitBtnPressed]}
                  onPress={() => void submit()}
                  disabled={isLoading}
                >
                  <Text style={styles.authSubmitBtnText}>
                    {isLoading ? (isRegister ? "Creating account..." : "Signing in...") : isRegister ? "Create account" : "Sign in"}
                  </Text>
                </Pressable>
              </View>
            </View>

            <Text style={styles.authFooter}>
              {isRegister ? "Already have an account? " : "Don't have an account? "}
              <Text
                style={styles.authFooterLink}
                onPress={() => switchMode(!isRegister)}
                suppressHighlighting
              >
                {isRegister ? "Sign in" : "Register"}
              </Text>
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Dashboard() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<AppView>("home");
  const [catalogCount, setCatalogCount] = useState(0);
  const [productLoadError, setProductLoadError] = useState<string | null>(null);
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [pendingInput, setPendingInput] = useState("");
  const [pendingItems, setPendingItems] = useState<Array<{ name: string; quantity: number }>>([]);
  const [processedResults, setProcessedResults] = useState<ProcessListResult[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingProcess, setLoadingProcess] = useState(false);
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);
  const [selectionToast, setSelectionToast] = useState<string | null>(null);
  const [budgetRefreshKey, setBudgetRefreshKey] = useState(0);
  const [extraConfirmedPurchases, setExtraConfirmedPurchases] = useState<ConfirmedPurchaseRecord[]>([]);
  const [listCountdown, setListCountdown] = useState<number | null>(null);
  const [pendingAutoListAfterMatches, setPendingAutoListAfterMatches] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const transitionLock = useRef(false);

  const transitionToView = useCallback(
    (next: AppView) => {
      if (transitionLock.current) return;
      transitionLock.current = true;
      const easeOut = Easing.out(Easing.cubic);
      const easeIn = Easing.in(Easing.cubic);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          easing: easeIn,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -14,
          duration: 180,
          easing: easeIn,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setView(next);
        slideAnim.setValue(18);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 260,
            easing: easeOut,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 260,
            easing: easeOut,
            useNativeDriver: true,
          }),
        ]).start(() => {
          transitionLock.current = false;
        });
      });
    },
    [fadeAnim, slideAnim]
  );

  useEffect(() => {
    if (!selectionToast) return;
    const t = setTimeout(() => setSelectionToast(null), 3000);
    return () => clearTimeout(t);
  }, [selectionToast]);

  useEffect(() => {
    if (view !== "processed-matches" || !pendingAutoListAfterMatches) {
      setListCountdown(null);
      return;
    }
    let alive = true;
    const start = Date.now();
    const tick = () => {
      const left = Math.max(0, Math.ceil((AUTO_LIST_DELAY_MS - (Date.now() - start)) / 1000));
      if (alive) setListCountdown(left);
    };
    tick();
    const interval = setInterval(tick, 250);
    const t = setTimeout(() => {
      clearInterval(interval);
      if (alive) {
        setListCountdown(null);
        setPendingAutoListAfterMatches(false);
        transitionToView("grocery-list");
      }
    }, AUTO_LIST_DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(t);
      clearInterval(interval);
      setListCountdown(null);
    };
  }, [view, pendingAutoListAfterMatches, transitionToView]);

  useEffect(() => {
    let active = true;
    async function loadProducts() {
      setLoadingProducts(true);
      setProductLoadError(null);
      try {
        const apiProducts = await api.products.getAll(10);
        if (!active) return;
        setCatalogCount(apiProducts.length);
      } catch (err) {
        if (!active) return;
        setProductLoadError(err instanceof Error ? err.message : "Failed to load products.");
        setCatalogCount(0);
      } finally {
        if (active) setLoadingProducts(false);
      }
    }
    void loadProducts();
    return () => {
      active = false;
    };
  }, []);

  const cheapestStore = useMemo(() => getCheapestStoreForBasket(basket), [basket]);

  const handleAddToList = (product: Product, quantity: number = 1) => {
    setBasket((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const handleReplaceBasketItem = (originalProductId: string, product: Product, quantity: number) => {
    setBasket((prev) => {
      const withoutOriginal = prev.filter((item) => item.product.id !== originalProductId);
      const existing = withoutOriginal.find((item) => item.product.id === product.id);
      if (existing) {
        return withoutOriginal.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...withoutOriginal, { product, quantity }];
    });
  };

  const handleSelectAlternative = (
    candidate: ProductMatchCandidate,
    quantity: number,
    result?: ProcessListResult
  ) => {
    const mappedProduct = mapApiProductToProduct(candidate.product);
    const originalProductId = result?.bestMatch?.product.id;

    if (originalProductId) {
      handleReplaceBasketItem(originalProductId, mappedProduct, quantity);
    } else {
      handleAddToList(mappedProduct, quantity);
    }

    if (result) {
      const previousBestMatch = result.bestMatch;
      const selectedCandidate: ProductMatchCandidate = {
        similarity: candidate.similarity,
        product: candidate.product,
      };

      setProcessedResults((prev) =>
        prev.map((item) => {
          if (item.inputName === result.inputName && item.quantity === result.quantity) {
            const nextAlternatives = [...item.alternatives];
            if (previousBestMatch) nextAlternatives.unshift(previousBestMatch);
            const dedupedAlternatives = nextAlternatives.filter(
              (alt, altIndex, altList) =>
                alt.product.id !== candidate.product.id &&
                altList.findIndex((entry) => entry.product.id === alt.product.id) === altIndex
            );
            return {
              ...item,
              bestMatch: selectedCandidate,
              alternatives: dedupedAlternatives,
            };
          }
          return item;
        })
      );
    }

    setSelectionToast(`Updated: ${mappedProduct.name}`);
  };

  const queueItems = () => {
    const parsed = pendingInput
      .split(",")
      .map((raw) => raw.trim())
      .filter(Boolean)
      .map((item) => {
        const qtyMatch = item.match(/^\s*(\d+)\s*(?:x|X)?\s+(.+)$/);
        if (!qtyMatch) return { name: item, quantity: 1 };
        return { name: qtyMatch[2].trim(), quantity: Math.max(1, parseInt(qtyMatch[1], 10)) };
      });
    if (parsed.length === 0) return;
    setPendingItems((prev) => [...prev, ...parsed]);
    setPendingInput("");
  };

  const removePendingAt = (index: number) => {
    setPendingItems((prev) => prev.filter((_, i) => i !== index));
  };

  const processItems = async () => {
    if (pendingItems.length === 0 || loadingProcess) return;
    setLoadingProcess(true);
    try {
      const response = await api.products.processList(
        pendingItems.map((it) => ({ name: it.name, quantity: it.quantity }))
      );
      setProcessedResults(response.items);
      setBasket((prev) => {
        let next = [...prev];
        for (const result of response.items) {
          if (!result.bestMatch) continue;
          const product = mapApiProductToProduct(result.bestMatch.product);
          const found = next.find((x) => x.product.id === product.id);
          if (!found) next = [...next, { product, quantity: result.quantity }];
          else {
            next = next.map((x) =>
              x.product.id === product.id ? { ...x, quantity: x.quantity + result.quantity } : x
            );
          }
        }
        return next;
      });
      setPendingItems([]);
      // Do not auto-navigate to grocery list — only navigate when user explicitly requests.
      transitionToView("processed-matches");
    } catch (err) {
      Alert.alert("Processing failed", err instanceof Error ? err.message : "Unable to process list");
    } finally {
      setLoadingProcess(false);
    }
  };

  const handleConfirmItemList = async () => {
    if (basket.length === 0) return;
    const record = buildConfirmedPurchaseRecord(basket, cheapestStore);
    await appendConfirmedPurchase(record);
    // Track this new confirmed purchase in-memory so BudgetDashboard can reflect it immediately.
    setExtraConfirmedPurchases((prev) => [...prev, record]);
    setSelectionToast("Item list confirmed — opening comparison");
    setBudgetRefreshKey((k) => k + 1);
    transitionToView("comparison");
  };

  const updateQty = (productId: string, delta: number) => {
    setBasket((prev) =>
      prev
        .map((item) =>
          item.product.id === productId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const recordPurchase = async (store: Retailer) => {
    if (basket.length === 0 || isSavingPurchase) return;
    setIsSavingPurchase(true);
    try {
      await api.purchases.record(
        RETAILER_LABELS[store],
        basket.map(({ product, quantity }) => ({
          productId: product.id,
          name: product.name,
          nameSinhala: product.nameSinhala,
          image: product.image,
          category: product.category,
          quantity,
          unitPrice: product.prices[store] ?? 0,
        }))
      );
      setBasket([]);
      transitionToView("budget");
      setBudgetRefreshKey((k) => k + 1);
      setSelectionToast(`Purchase recorded at ${RETAILER_LABELS[store]}!`);
    } catch {
      setSelectionToast("Failed to record purchase. Try again.");
    } finally {
      setIsSavingPurchase(false);
    }
  };

  const placeholderColor = theme.colors.textMuted;

  const nav = (key: AppView, label: string) => (
    <Pressable
      key={key}
      onPress={() => {
        setPendingAutoListAfterMatches(false);
        transitionToView(key);
      }}
      style={[styles.navItem, view === key && styles.navItemActive]}
    >
      <Text style={[styles.navLabel, view === key && styles.navLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image source={LOGO} style={styles.headerLogo} resizeMode="contain" accessibilityLabel="PricePulse" />
          <Text style={styles.headerTitle} numberOfLines={1}>
            Hi, {user?.name ?? "User"}
          </Text>
        </View>
        <Pressable onPress={() => void logout()} hitSlop={8}>
          <Text style={styles.link}>Log out</Text>
        </Pressable>
      </View>

      <Animated.View
        style={[
          styles.animatedScreen,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {view === "home" && (
          <View style={styles.screenBlock}>
            <LinearGradient
              colors={["#ffffff", "#f0fdf4", "#ecfdf5"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroTop}>
                <View>
                  <Text style={styles.heroKicker}>Smart list builder</Text>
                  <Text style={styles.heroTitle}>Add items</Text>
                </View>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>✦</Text>
                </View>
              </View>
              <Text style={styles.heroBody}>
                Add a comma-separated list. Quantities like <Text style={styles.heroEm}>2 eggs</Text> work.
              </Text>
              {productLoadError ? (
                <View style={styles.inlineError}>
                  <Text style={styles.inlineErrorText}>{productLoadError}</Text>
                </View>
              ) : null}
              <TextInput
                multiline
                style={styles.heroInput}
                placeholder="Try: eggs, milk, 2 bread, bananas"
                placeholderTextColor={placeholderColor}
                value={pendingInput}
                onChangeText={setPendingInput}
              />
              <View style={styles.heroActions}>
                <Pressable
                  style={[styles.heroSecondaryBtn, !pendingInput.trim() && styles.btnDisabledLight]}
                  onPress={queueItems}
                  disabled={!pendingInput.trim()}
                >
                  <Text style={styles.heroSecondaryBtnText}>Add to queue</Text>
                </Pressable>
              </View>
              {pendingItems.length > 0 ? (
                <View style={styles.queueSection}>
                  <View style={styles.queueHeader}>
                    <Text style={styles.queueTitle}>Your preview</Text>
                    <Text style={styles.queueCount}>
                      {pendingItems.length} item{pendingItems.length === 1 ? "" : "s"}
                    </Text>
                  </View>
                  {pendingItems.map((item, index) => (
                    <View key={`pending-${item.name}-${item.quantity}-${index}`} style={styles.queueRow}>
                      <View style={styles.queueQty}>
                        <Text style={styles.queueQtyText}>{item.quantity}</Text>
                      </View>
                      <View style={styles.queueMid}>
                        <Text style={styles.queueName} numberOfLines={2}>
                          {item.name}
                        </Text>
                        <Text style={styles.queueHint}>Queued for price matching</Text>
                      </View>
                      <Pressable onPress={() => removePendingAt(index)} hitSlop={8} style={styles.queueRemove}>
                        <Text style={styles.queueRemoveText}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              <Pressable
                style={[styles.heroPrimaryBtn, (pendingItems.length === 0 || loadingProcess) && styles.btnDisabledLight]}
                onPress={() => void processItems()}
                disabled={pendingItems.length === 0 || loadingProcess}
              >
                <Text style={styles.heroPrimaryBtnText}>
                  {loadingProcess
                    ? "Processing…"
                    : `Process list${pendingItems.length ? ` (${pendingItems.length})` : ""}`}
                </Text>
              </Pressable>
              {loadingProducts ? (
                <View style={styles.catalogRow}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={styles.catalogHint}> Loading catalog…</Text>
                </View>
              ) : catalogCount > 0 ? (
                <Text style={styles.catalogHint}>Live catalog ready ({catalogCount} sample products)</Text>
              ) : null}
            </LinearGradient>
          </View>
        )}

        {view === "processed-matches" && (
          <View style={styles.screenBlock}>
            <Text style={styles.flowStepTitle}>Matches</Text>
            <Text style={styles.flowStepSub}>
              Review alternatives below. Tap to open your list when ready.
            </Text>
            <ProcessedResults results={processedResults} onSelectAlternative={handleSelectAlternative} />
            {listCountdown !== null && listCountdown > 0 ? (
              <View style={styles.countdownPill}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.countdownText}>Opening your list in {listCountdown}s…</Text>
              </View>
            ) : null}
            <Pressable
              style={styles.secondaryOutlineBtn}
              onPress={() => {
                // Start the short countdown then navigate — user-initiated only.
                setPendingAutoListAfterMatches(true);
              }}
            >
              <Text style={styles.secondaryOutlineBtnText}>Go to list now</Text>
            </Pressable>
          </View>
        )}

        {view === "grocery-list" && (
          <View style={styles.screenBlock}>
            <Pressable onPress={() => transitionToView("home")} style={styles.backRow}>
              <Text style={styles.backLink}>← Back to home</Text>
            </Pressable>
            <Text style={styles.flowStepTitle}>My grocery list</Text>
            <Text style={styles.flowStepSub}>Adjust quantities, then confirm to open store comparison.</Text>
            {basket.length === 0 ? (
              <View style={styles.emptyList}>
                <Text style={styles.emptyListText}>Your list is empty.</Text>
                <Text style={styles.emptyListSub}>Add items on Home, then process your list.</Text>
              </View>
            ) : (
              basket.map(({ product, quantity }) => {
                const priceVals = Object.values(product.prices).filter((v): v is number => v != null && v > 0);
                const hi = priceVals.length ? Math.max(...priceVals) : 0;
                const lo = product.prices.cargills ?? priceVals[0] ?? 0;
                return (
                  <View key={product.id} style={styles.listCard}>
                    <Text style={styles.listCardTitle} numberOfLines={2}>
                      {product.name}
                    </Text>
                    <Text style={styles.listCardMeta}>
                      Rs. {lo.toLocaleString()} – Rs. {hi.toLocaleString()} per unit
                    </Text>
                    <View style={styles.listCardActions}>
                      <Pressable
                        style={[styles.iconBtn, quantity <= 1 && styles.iconBtnDisabled]}
                        onPress={() => updateQty(product.id, -1)}
                        disabled={quantity <= 1}
                      >
                        <Text style={styles.iconBtnText}>−</Text>
                      </Pressable>
                      <Text style={styles.qtyLabel}>{quantity}</Text>
                      <Pressable style={styles.iconBtn} onPress={() => updateQty(product.id, 1)}>
                        <Text style={styles.iconBtnText}>+</Text>
                      </Pressable>
                      <Pressable
                        style={styles.removeBtn}
                        onPress={() => setBasket((prev) => prev.filter((x) => x.product.id !== product.id))}
                      >
                        <Text style={styles.removeBtnText}>Remove</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
            <Pressable
              style={[styles.confirmBtn, basket.length === 0 && styles.btnDisabledLight]}
              onPress={() => void handleConfirmItemList()}
              disabled={basket.length === 0}
            >
              <Text style={styles.confirmBtnText}>Confirm item list</Text>
            </Pressable>
          </View>
        )}

        {view === "comparison" && (
          <View style={styles.screenBlock}>
            <ComparisonView
              items={basket}
              onBack={() => transitionToView("home")}
              onSelectStore={(store) => void recordPurchase(store)}
              isProcessing={isSavingPurchase}
            />
            <Pressable style={styles.textLinkWrap} onPress={() => transitionToView("budget")}>
              <Text style={styles.textLink}>Budget & store finder →</Text>
            </Pressable>
          </View>
        )}

        {view === "budget" && (
          <View style={styles.screenBlock}>
            <Pressable onPress={() => transitionToView("home")} style={styles.backRow}>
              <Text style={styles.backLink}>← Back to home</Text>
            </Pressable>
            <BudgetDashboard refreshToken={budgetRefreshKey} extraConfirmedPurchases={extraConfirmedPurchases} />
          </View>
        )}
      </ScrollView>
      </Animated.View>

      {selectionToast ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{selectionToast}</Text>
        </View>
      ) : null}

      <View style={styles.bottomNav}>
        {nav("home", "Home")}
        {nav("processed-matches", "Matches")}
        {nav("grocery-list", "List")}
        {nav("comparison", "Compare")}
        {nav("budget", "Budget")}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppBody />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background },
  loadingGradient: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  loadingContent: { alignItems: "center", gap: 24 },
  loadingLogo: { width: 120, height: 120, marginBottom: 8 },
  loadingText: { fontSize: 18, fontWeight: "700", color: theme.colors.text, textAlign: "center" },
  loadingSpinner: { marginTop: 16 },
  animatedScreen: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 100, gap: 14 },
  screenBlock: { gap: 14 },
  flowStepTitle: { fontSize: 22, fontWeight: "800", color: theme.colors.text },
  flowStepSub: { fontSize: 14, color: theme.colors.textMuted, lineHeight: 20, marginBottom: 4 },
  countdownPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.2)",
  },
  countdownText: { fontSize: 14, fontWeight: "600", color: theme.colors.primary },
  secondaryOutlineBtn: {
    paddingVertical: 14,
    borderRadius: theme.radii.md,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    alignItems: "center",
    backgroundColor: theme.colors.background,
  },
  secondaryOutlineBtnText: { fontSize: 15, fontWeight: "700", color: theme.colors.primary },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: theme.colors.background,
    ...theme.shadow.card,
  },
  headerLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  headerLogo: { width: 42, height: 42 },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: "600", color: theme.colors.textMuted },
  heroCard: {
    borderRadius: theme.radii.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroKicker: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: theme.colors.primary,
  },
  heroTitle: { fontSize: 22, fontWeight: "800", color: theme.colors.text, marginTop: 4 },
  heroBadge: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBadgeText: { fontSize: 20, color: theme.colors.primary },
  heroBody: { marginTop: 10, fontSize: 14, color: theme.colors.textMuted, lineHeight: 20 },
  heroEm: { fontWeight: "700", color: theme.colors.text },
  inlineError: {
    marginTop: 10,
    padding: 12,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.dangerSoft,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.2)",
  },
  inlineErrorText: { fontSize: 13, color: theme.colors.danger },
  heroInput: {
    marginTop: 12,
    minHeight: 88,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    padding: 14,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: "rgba(255,255,255,0.95)",
    textAlignVertical: "top",
  },
  heroActions: { marginTop: 10 },
  heroSecondaryBtn: {
    paddingVertical: 14,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
  },
  heroSecondaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  heroPrimaryBtn: {
    marginTop: 14,
    paddingVertical: 16,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.secondary,
    alignItems: "center",
  },
  heroPrimaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  btnDisabledLight: { opacity: 0.45 },
  queueSection: { marginTop: 14, gap: 8 },
  queueHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  queueTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  queueCount: { fontSize: 12, color: theme.colors.textMuted },
  queueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: theme.radii.md,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  queueQty: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  queueQtyText: { fontWeight: "800", color: theme.colors.primary },
  queueMid: { flex: 1, minWidth: 0 },
  queueName: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
  queueHint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  queueRemove: { padding: 8 },
  queueRemoveText: { fontSize: 16, color: theme.colors.textMuted, fontWeight: "600" },
  catalogRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  catalogHint: { marginTop: 10, fontSize: 12, color: theme.colors.textMuted, textAlign: "center" },
  confirmBtn: {
    paddingVertical: 16,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
  },
  confirmBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  textLinkWrap: { alignItems: "center", paddingVertical: 8 },
  textLink: { fontSize: 14, fontWeight: "700", color: theme.colors.primary },
  backRow: { alignSelf: "flex-start", marginBottom: 4 },
  backLink: { fontSize: 14, fontWeight: "600", color: theme.colors.primary },
  emptyList: {
    padding: 24,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  emptyListText: { fontSize: 15, fontWeight: "600", color: theme.colors.text },
  emptyListSub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 6, textAlign: "center" },
  listCard: {
    padding: 16,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
    gap: 8,
  },
  listCardTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.text },
  listCardMeta: { fontSize: 12, color: theme.colors.textMuted },
  listCardActions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" },
  iconBtn: {
    minWidth: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconBtnDisabled: { opacity: 0.4 },
  iconBtnText: { fontSize: 18, fontWeight: "700", color: theme.colors.text },
  qtyLabel: { fontSize: 16, fontWeight: "800", color: theme.colors.text, minWidth: 28, textAlign: "center" },
  removeBtn: {
    marginLeft: "auto",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.colors.dangerSoft,
  },
  removeBtnText: { fontSize: 13, fontWeight: "700", color: theme.colors.danger },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 88,
    backgroundColor: theme.colors.secondary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.radii.md,
    ...theme.shadow.card,
  },
  toastText: { color: "#fff", fontWeight: "600", fontSize: 14, textAlign: "center" },
  navItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    marginHorizontal: 2,
  },
  navItemActive: { backgroundColor: theme.colors.primarySoft },
  navLabel: { fontSize: 11, fontWeight: "600", color: theme.colors.textMuted },
  navLabelActive: { color: theme.colors.primary, fontWeight: "800" },
  authGradient: { flex: 1 },
  authSafe: { flex: 1 },
  authKeyboard: { flex: 1 },
  authScroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    justifyContent: "center",
  },
  authLogo: { width: 72, height: 72, alignSelf: "center", marginBottom: 20 },
  authCard: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.12,
        shadowRadius: 28,
      },
      android: { elevation: 8 },
    }),
  },
  authSwitchRow: { flexDirection: "row", backgroundColor: "rgba(243,244,246,0.95)" },
  authSwitchBtn: { flex: 1, paddingVertical: 14, alignItems: "center" },
  authSwitchActive: { backgroundColor: "rgba(5, 150, 105, 0.92)" },
  authSwitchPressed: { opacity: 0.92 },
  authSwitchText: { color: theme.colors.textMuted, fontWeight: "600", fontSize: 14 },
  authSwitchActiveText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  authForm: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 26 },
  authHeading: { fontSize: 19, fontWeight: "800", color: theme.colors.text, textAlign: "center" },
  authSub: {
    fontSize: 14,
    color: theme.colors.textMuted,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 20,
  },
  inputLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 4 },
  authInput: {
    borderWidth: 1,
    borderColor: "rgba(229,231,235,0.95)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: "rgba(255,255,255,0.85)",
    marginBottom: 4,
  },
  errorBanner: {
    backgroundColor: theme.colors.dangerSoft,
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.2)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  errorBannerText: { color: theme.colors.danger, fontSize: 14, lineHeight: 20 },
  authSubmitBtn: {
    marginTop: 20,
    backgroundColor: "rgba(16, 185, 129, 0.95)",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.35)",
  },
  authSubmitBtnPressed: { opacity: 0.9 },
  authSubmitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  authFooter: { textAlign: "center", marginTop: 22, fontSize: 14, color: theme.colors.textMuted },
  authFooterLink: { color: theme.colors.primary, fontWeight: "700" },
  link: { color: theme.colors.primary, fontWeight: "600" },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    paddingBottom: Platform.OS === "ios" ? 22 : 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
});

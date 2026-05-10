import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from './context/AuthContext'
import { LoginForm } from './components/LoginForm'
import { RegisterForm } from './components/RegisterForm'
import { AddGroceryItems } from './components/AddGroceryItems'
import type { AddGroceryItemsHandle } from './components/AddGroceryItems'
import { ProcessedResults } from './components/ProcessedResults'
import { GroceryList } from './components/GroceryList'
import { ComparisonPage } from './components/ComparisonPage'
import { BudgetDashboard } from './components/BudgetDashboard'
import { FindNearestStore } from './components/FindNearestStore'
import { api } from './services/api'
import { mapApiProductToProduct } from './services/productMapper'
import { AVAILABLE_RETAILERS, RETAILER_LABELS } from './constants/retailers'
import type { BasketItem, ProcessListResult, Product, ProductMatchCandidate, Retailer } from './types'
import { LogOut } from 'lucide-react'

const STORES: Retailer[] = AVAILABLE_RETAILERS
const CONFIRMED_PURCHASES_STORAGE_KEY = 'pricepulse-confirmed-purchases'

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

function getCheapestStoreForBasket(items: BasketItem[]): Retailer | null {
  if (items.length === 0) return null
  const totals = STORES.map((store) => ({
    store,
    total: items.reduce((s, { product, quantity }) => s + (product.prices[store] ?? 0) * quantity, 0),
  }))
  return totals.reduce((a, b) => (a.total <= b.total ? a : b)).store
}

function trackConfirmedPurchase(items: BasketItem[], store: Retailer | null) {
  const record: ConfirmedPurchaseRecord = {
    id: crypto.randomUUID(),
    confirmedAt: new Date().toISOString(),
    estimatedStore: store,
    estimatedStoreLabel: store ? RETAILER_LABELS[store] : 'Confirmed list',
    estimatedTotal: items.reduce((total, { product, quantity }) => {
      const storePrice = store ? (product.prices[store] ?? 0) : 0
      return total + storePrice * quantity
    }, 0),
    itemCount: items.reduce((count, { quantity }) => count + quantity, 0),
    items: items.map(({ product, quantity }) => ({
      productId: product.id,
      name: product.name,
      category: product.category,
      quantity,
      unitPrice: store ? (product.prices[store] ?? 0) : 0,
    })),
  }

  const existing = JSON.parse(localStorage.getItem(CONFIRMED_PURCHASES_STORAGE_KEY) || '[]') as ConfirmedPurchaseRecord[]
  localStorage.setItem(CONFIRMED_PURCHASES_STORAGE_KEY, JSON.stringify([...existing, record]))
}

function AuthScreen() {
  const [isRegister, setIsRegister] = useState(false)
  return (
    <div className="min-h-screen flex flex-col justify-center relative overflow-hidden auth-screen-bg">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 via-primary-400/10 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-300/30 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-primary-600/15 to-transparent" />
      <div className="relative z-10 px-4 py-8 flex flex-col items-center">
        <img src="/Applogo/My Logo.png" alt="My Logo" style={{ width: 50, height: 50 }} className="mb-6 object-contain" />
        <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-white/75 backdrop-blur-xl">
          <div className="flex">
            <button
              type="button"
              onClick={() => setIsRegister(false)}
              className={`flex-1 py-3.5 text-sm font-semibold transition-all duration-300 ${
                !isRegister
                  ? 'bg-primary-500/90 text-white shadow-inner'
                  : 'bg-white/40 text-grey-600 hover:bg-white/60'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setIsRegister(true)}
              className={`flex-1 py-3.5 text-sm font-semibold transition-all duration-300 ${
                isRegister
                  ? 'bg-primary-500/90 text-white shadow-inner'
                  : 'bg-white/40 text-grey-600 hover:bg-white/60'
              }`}
            >
              Register
            </button>
          </div>
          <div className="border-t border-white/30">
            {isRegister ? (
              <RegisterForm onSwitchToLogin={() => setIsRegister(false)} />
            ) : (
              <LoginForm onSwitchToRegister={() => setIsRegister(true)} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  const { user, logout } = useAuth()
  const [basket, setBasket] = useState<BasketItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [productLoadError, setProductLoadError] = useState<string | null>(null)
  const [view, setView] = useState<'home' | 'processed-matches' | 'grocery-list' | 'comparison' | 'budget'>('home')
  const [processedResults, setProcessedResults] = useState<ProcessListResult[]>([])
  const [isSavingPurchase, setIsSavingPurchase] = useState(false)
  const [selectionAlert, setSelectionAlert] = useState<string | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userButtonRef = useRef<HTMLButtonElement>(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 })
  const addGroceryItemsRef = useRef<AddGroceryItemsHandle>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      const isButton = userButtonRef.current?.contains(target)
      const isDropdown = target.closest('[data-user-menu]')
      if (!isButton && !isDropdown) setUserMenuOpen(false)
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

  useEffect(() => {
    if (!userMenuOpen || !userButtonRef.current) return
    const rect = userButtonRef.current.getBoundingClientRect()
    setDropdownPosition({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    })
  }, [userMenuOpen])

  useEffect(() => {
    let active = true

    async function loadProducts() {
      setIsLoadingProducts(true)
      setProductLoadError(null)

      try {
        const apiProducts = await api.products.getAll(10)
        if (!active) return
        setProducts(apiProducts.map(mapApiProductToProduct))
      } catch (error) {
        if (!active) return
        setProductLoadError(error instanceof Error ? error.message : 'Failed to load products.')
      } finally {
        if (active) setIsLoadingProducts(false)
      }
    }

    void loadProducts()

    return () => {
      active = false
    }
  }, [])

  const cheapestStore = useMemo(() => getCheapestStoreForBasket(basket), [basket])

  const handleAddToList = (product: Product, quantity: number = 1) => {
    console.log('[Home] handleAddToList called', { productId: product.id, name: product.name, quantity })
    setBasket((prev) => {
      console.log('[Home] basket before add', prev.map((b) => ({ id: b.product.id, qty: b.quantity })))
      const existing = prev.find((i) => i.product.id === product.id)
      const next = existing
        ? prev.map((i) => (i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i))
        : [...prev, { product, quantity }]
      console.log('[Home] basket after add', next.map((b) => ({ id: b.product.id, qty: b.quantity })))
      return next
    })
  }

  // debugging: log basket changes
  useEffect(() => {
    console.log('[Home] basket updated', basket.map((b) => ({ id: b.product.id, name: b.product.name, qty: b.quantity })))
  }, [basket])

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setBasket((prev) =>
      prev
        .map((i) =>
          i.product.id === productId ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i
        )
        .filter((i) => i.quantity > 0)
    )
  }

  const handleRemove = (productId: string) => {
    console.log('[Home] handleRemove called', productId)
    setBasket((prev) => {
      console.log('[Home] basket before remove', prev.map((b) => ({ id: b.product.id, qty: b.quantity })))
      const next = prev.filter((i) => i.product.id !== productId)
      console.log('[Home] basket after remove', next.map((b) => ({ id: b.product.id, qty: b.quantity })))
      return next
    })
  }

  const handleReplaceBasketItem = (originalProductId: string, product: Product, quantity: number) => {
    console.log('[Home] handleReplaceBasketItem called', {
      originalProductId,
      replacementId: product.id,
      quantity,
    })
    setBasket((prev) => {
      console.log('[Home] basket before replace', prev.map((b) => ({ id: b.product.id, qty: b.quantity })))
      const withoutOriginal = prev.filter((item) => item.product.id !== originalProductId)
      const existing = withoutOriginal.find((item) => item.product.id === product.id)
      const next = existing
        ? withoutOriginal.map((item) =>
            item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
          )
        : [...withoutOriginal, { product, quantity }]
      console.log('[Home] basket after replace', next.map((b) => ({ id: b.product.id, qty: b.quantity })))
      return next
    })
  }

  const handleProcessedResultsChange = (results: ProcessListResult[]) => {
    setProcessedResults(results)
    setView('processed-matches')
  }

  const handleSelectAlternative = (candidate: ProductMatchCandidate, quantity: number, result?: ProcessListResult) => {
    const mappedProduct = mapApiProductToProduct(candidate.product)
    const originalProductId = result?.bestMatch?.product.id

    if (originalProductId) {
      handleReplaceBasketItem(originalProductId, mappedProduct, quantity)
    } else {
      handleAddToList(mappedProduct, quantity)
    }

    if (result) {
      const previousBestMatch = result.bestMatch
      const selectedCandidate: ProductMatchCandidate = {
        similarity: candidate.similarity,
        product: candidate.product,
      }

      setProcessedResults((prev) =>
        prev.map((item) => {
          if (item.inputName === result.inputName && item.quantity === result.quantity) {
            const nextAlternatives = [...item.alternatives]

            if (previousBestMatch) {
              nextAlternatives.unshift(previousBestMatch)
            }

            const dedupedAlternatives = nextAlternatives.filter(
              (alt, altIndex, altList) =>
                alt.product.id !== candidate.product.id &&
                altList.findIndex((entry) => entry.product.id === alt.product.id) === altIndex
            )

            return {
              ...item,
              bestMatch: selectedCandidate,
              alternatives: dedupedAlternatives,
            }
          }
          return item
        })
      )
    }

    setSelectionAlert(`Replaced ${originalProductId ?? 'unknown'} → ${mappedProduct.id}`)
    window.setTimeout(() => setSelectionAlert(null), 3000)
  }

  const handleFindCheapestStore = () => {
    if (basket.length === 0) return
    trackConfirmedPurchase(basket, cheapestStore)
    setSelectionAlert('✓ Item list confirmed and tracked')
    setTimeout(() => setSelectionAlert(null), 3000)
    setView('comparison')
  }

  const handleRecordPurchase = async (store: Retailer) => {
    if (basket.length === 0 || isSavingPurchase) return

    setIsSavingPurchase(true)
    try {
      await api.purchases.record(
        RETAILER_LABELS[store],
        basket.map(({ product, quantity }) => {
          const storePrice = product.prices[store] ?? 0
          return {
            productId: product.id,
            name: product.name,
            nameSinhala: product.nameSinhala,
            image: product.image,
            category: product.category,
            quantity,
            unitPrice: storePrice,
          }
        })
      )
      // Success: clear basket and navigate to budget view
      setBasket([])
      setView('budget')
      setSelectionAlert(`✓ Purchase recorded at ${RETAILER_LABELS[store]}!`)
      // Clear alert after 3 seconds
      setTimeout(() => setSelectionAlert(null), 3000)
    } catch (err) {
      console.error('Failed to record purchase:', err)
      setSelectionAlert('Failed to record purchase. Please try again.')
      setTimeout(() => setSelectionAlert(null), 3000)
    } finally {
      setIsSavingPurchase(false)
    }
  }

  return (
    <div className="min-h-screen bg-white max-w-lg mx-auto">
      <header className="sticky top-0 z-10 bg-white border-b border-grey-100 safe-top overflow-visible">
        <div className="relative flex items-center justify-between pt-4 pb-2 px-4">
          <div className="flex flex-col gap-0.5">
            <img src="/Applogo/My Logo.png" alt="My Logo" style={{ width: 42, height: 42 }} className="object-contain" />
          </div>
          <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-grey-500 text-center whitespace-nowrap">
            Hi, {user?.name ?? 'User'} 
          </p>
          <div>
            <button
              ref={userButtonRef}
              type="button"
              onClick={() => setUserMenuOpen((o) => !o)}
              className="w-10 h-10 rounded-full bg-primary-500 text-white font-semibold text-lg flex items-center justify-center shadow-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2"
              aria-label="User menu"
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
            >
              {(user?.name ?? 'U').charAt(0).toUpperCase()}
            </button>
          </div>
        </div>
      </header>
      {userMenuOpen &&
        createPortal(
          <div
            data-user-menu
            className="fixed z-[100] w-56 rounded-xl border border-grey-200 bg-white shadow-xl py-1"
            style={{
              top: dropdownPosition.top,
              right: dropdownPosition.right,
              left: 'auto',
            }}
          >
            <div className="px-4 py-3 border-b border-grey-100">
              <p className="font-medium text-grey-900 truncate">{user?.name ?? 'User'}</p>
              <p className="text-xs text-grey-500 truncate">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false)
                setView('budget')
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-grey-700 hover:bg-grey-50 focus:outline-none focus:bg-grey-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Budget & Store Finder
            </button>
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false)
                logout()
              }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-grey-700 hover:bg-grey-50 focus:outline-none focus:bg-grey-50 rounded-b-xl border-t border-grey-100"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>,
          document.body
        )}

      {view === 'comparison' ? (
        <ComparisonPage
          items={basket}
          onBack={() => setView('home')}
          onSelectStore={handleRecordPurchase}
          isProcessing={isSavingPurchase}
        />
      ) : view === 'processed-matches' ? (
        <>
          <div className="px-4 pt-4 pb-2">
            <ProcessedResults results={processedResults} onSelectAlternative={handleSelectAlternative} />
            <div className="mt-4">
              <button
                type="button"
                onClick={handleFindCheapestStore}
                disabled={basket.length === 0}
                className="w-full py-3 rounded-2xl bg-primary-600 text-white font-semibold text-base hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-600"
              >
                Confirm item list
              </button>
            </div>
          </div>
          {selectionAlert && (
            <div className="fixed bottom-24 right-4 z-50 bg-primary-600 text-white px-4 py-2 rounded-lg shadow">
              {selectionAlert}
            </div>
          )}
        </>
      ) : view === 'grocery-list' ? (
        <>
          <div className="sticky top-0 z-10 bg-white border-b border-grey-100 px-4 py-3">
            <button
              type="button"
              onClick={() => setView('home')}
              className="text-primary-600 hover:text-primary-700 font-medium text-sm"
            >
              ← Back to Home
            </button>
          </div>
          <main className="pb-6">
            <GroceryList
              items={basket}
              onUpdateQuantity={handleUpdateQuantity}
              onRemove={handleRemove}
            />

            <div className="px-4 py-6">
              <button
                type="button"
                onClick={handleFindCheapestStore}
                disabled={basket.length === 0}
                className="w-full py-4 rounded-2xl bg-primary-600 text-white font-bold text-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-600"
              >
                Find the cheapest store
              </button>
              {basket.length === 0 && (
                <p className="text-center text-sm text-grey-500 mt-2">
                  Add items to your list above first
                </p>
              )}
            </div>
          </main>
        </>
      ) : view === 'budget' ? (
        <>
          <div className="sticky top-0 z-10 bg-white border-b border-grey-100 px-4 py-3">
            <button
              type="button"
              onClick={() => setView('home')}
              className="text-primary-600 hover:text-primary-700 font-medium text-sm"
            >
              ← Back to Home
            </button>
          </div>
          <main className="pb-6">
            <BudgetDashboard />
            <FindNearestStore cheapestStore={cheapestStore} />
          </main>
        </>
      ) : (
        <>
          <main className="pb-6">
            {productLoadError && (
              <div className="mx-4 mt-4 rounded-xl border border-danger/20 bg-dangerLight px-4 py-3 text-sm text-danger">
                {productLoadError}
              </div>
            )}
            <AddGroceryItems
              ref={addGroceryItemsRef}
              products={products}
              onAddToBasket={handleAddToList}
              onProcessedResultsChange={handleProcessedResultsChange}
            />
            
            <div className="px-4 py-4">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await addGroceryItemsRef.current?.processPendingItems()
                    // Processing completed — keep user on this screen so they can review alternatives.
                    // Confirmation will navigate to comparisons via the Confirm button inside the list.
                  } catch (err) {
                    console.error('Process list failed', err)
                  }
                }}
                className="w-full py-3 rounded-2xl bg-primary-600 text-white font-semibold text-base hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 flex items-center justify-center gap-2 shadow-sm"
              >
                Process list
              </button>
              {isLoadingProducts && !productLoadError && (
                <p className="text-center text-xs text-grey-500 mt-2">
                  Loading live product catalog from the database...
                </p>
              )}
            </div>
          </main>
        </>
      )}
    </div>
  )
}

export default function Home() {
  const { user } = useAuth()
  return user ? <Dashboard /> : <AuthScreen />
}

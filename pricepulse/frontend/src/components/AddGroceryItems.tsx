import { forwardRef, useImperativeHandle, useState } from 'react'
import { PlusCircle, Sparkles, Trash2 } from 'lucide-react'
import type { Product, ProcessListResult, ProductMatchCandidate } from '../types'
import { api } from '../services/api'
import { mapApiProductToProduct } from '../services/productMapper'
import { ProcessedResults } from './ProcessedResults'

interface AddGroceryItemsProps {
  products: Product[]
  onAddToBasket: (product: Product, quantity: number) => void
  onRemoveFromBasket?: (productId: string) => void
  onReplaceBasketItem?: (originalProductId: string, product: Product, quantity: number) => void
  onConfirmProcessed?: () => void
}

export interface AddGroceryItemsHandle {
  processPendingItems: () => Promise<void>
}

export const AddGroceryItems = forwardRef<AddGroceryItemsHandle, AddGroceryItemsProps>(function AddGroceryItems(
  { products: _products, onAddToBasket, onRemoveFromBasket, onReplaceBasketItem, onConfirmProcessed },
  ref
) {
  const [customInput, setCustomInput] = useState('')
  const [pendingItems, setPendingItems] = useState<{ name: string; quantity: number }[]>([])
  const [isProcessingItems, setIsProcessingItems] = useState(false)
  const [processError, setProcessError] = useState<string | null>(null)
  const [processedResults, setProcessedResults] = useState<ProcessListResult[]>([])
  const [selectionAlert, setSelectionAlert] = useState<string | null>(null)

  const parseItem = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return null

    // Detect leading quantity like "2 eggs" or "2x eggs"
    const qtyMatch = trimmed.match(/^\s*(\d+)\s*(?:x|X)?\s+(.+)$/)
    if (qtyMatch) {
      const qty = parseInt(qtyMatch[1], 10) || 1
      const name = qtyMatch[2].trim()
      return { name, quantity: Math.max(1, qty) }
    }

    // Fallback: no explicit quantity
    return { name: trimmed, quantity: 1 }
  }

  const handleAddCustomItems = () => {
    if (!customInput.trim()) return

    const items = customInput
      .split(',')
      .map((item) => parseItem(item))
      .filter(Boolean) as { name: string; quantity: number }[]

    if (items.length === 0) return

    setPendingItems((prev) => [...prev, ...items])
    setCustomInput('')
  }

  const handleRemovePending = (index: number) => {
    setPendingItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleProcessItems = async () => {
    if (pendingItems.length === 0 || isProcessingItems) return

    setIsProcessingItems(true)
    setProcessError(null)

    try {
      console.log('Processing items:', pendingItems)
      const response = await api.products.processList(
        pendingItems.map((it) => ({ name: it.name, quantity: it.quantity }))
      )

      console.log('Process results:', response)
      setProcessedResults(response.items)

      // record mapping of result -> original product id and add best matches to basket
      response.items.forEach((result) => {
        if (!result.bestMatch) return
        const mappedProduct = mapApiProductToProduct(result.bestMatch.product)
        console.log('[AddGroceryItems] adding bestMatch', mappedProduct.id, mappedProduct.name, 'qty', result.quantity)
        onAddToBasket(mappedProduct, result.quantity)
      })

      setPendingItems([])
    } catch (error) {
      console.error('Process error:', error)
      setProcessError(error instanceof Error ? error.message : 'Failed to process grocery items.')
    } finally {
      setIsProcessingItems(false)
    }
  }

  const handleSelectAlternative = (candidate: ProductMatchCandidate, quantity: number, result?: ProcessListResult) => {
    const mappedProduct = mapApiProductToProduct(candidate.product)
    const originalProductId = result?.bestMatch?.product.id
    console.log('[AddGroceryItems] select alternative', { selectedId: mappedProduct.id, originalProductId, quantity })
    if (originalProductId && typeof onReplaceBasketItem === 'function') {
      console.log('[AddGroceryItems] calling onReplaceBasketItem with', originalProductId)
      onReplaceBasketItem(originalProductId, mappedProduct, quantity)
    } else {
      // fallback for older wiring: remove then add
      if (originalProductId && typeof onRemoveFromBasket === 'function') {
        console.log('[AddGroceryItems] calling onRemoveFromBasket with', originalProductId)
        onRemoveFromBasket(originalProductId)
      }
      onAddToBasket(mappedProduct, quantity)
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

    // show temporary toast so user can see replacement happened
    setSelectionAlert(`Replaced ${originalProductId ?? 'unknown'} → ${mappedProduct.id}`)
    window.setTimeout(() => setSelectionAlert(null), 3000)
  }

  useImperativeHandle(ref, () => ({
    processPendingItems: handleProcessItems,
  }))

  return (
    <section className="px-4 py-4" aria-label="Add grocery items">
      <div className="rounded-3xl border border-grey-200 bg-gradient-to-br from-white via-white to-primary-50/30 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.35)] overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-grey-100 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-primary-600 font-semibold">Smart List Builder</p>
              <h2 className="text-xl font-bold text-grey-900 mt-1">Add Items</h2>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-primary-100 text-primary-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-2 text-sm text-grey-500">
            Add items one by one or paste a comma-separated list. Quantities like <span className="font-medium text-grey-700">2 eggs</span> are supported.
          </p>
        </div>

        {/* Custom Text Input */}
        <div className="p-4 space-y-3">
          <div className="flex gap-2 items-start">
            <textarea
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Try: eggs, milk, 2 bread, bananas"
              className="flex-1 min-h-[72px] p-3.5 border border-grey-200 rounded-2xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 resize-none text-grey-900 placeholder:text-grey-400"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleAddCustomItems()
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddCustomItems}
              disabled={!customInput.trim()}
              className="h-[72px] px-4 rounded-2xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-sm transition-colors"
              title="Add to processing queue"
            >
              <PlusCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-grey-500">
            <span>Press Enter or click + to queue items.</span>
            <span className="text-grey-300">•</span>
            <span>Click <span className="font-semibold text-grey-700">Process</span> when ready.</span>
          </div>

          {pendingItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-grey-900">Your preview</p>
                <p className="text-xs text-grey-500">{pendingItems.length} item{pendingItems.length === 1 ? '' : 's'}</p>
              </div>
              <div className="space-y-2 max-h-72 overflow-auto pr-1">
                {pendingItems.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="group flex items-center gap-3 rounded-2xl border border-grey-200 bg-white px-3.5 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="h-9 w-9 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center font-bold text-sm">
                      {item.quantity}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-grey-900 truncate">{item.name}</p>
                      <p className="text-xs text-grey-500">Queued for price matching</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePending(index)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-grey-400 transition-colors hover:bg-grey-100 hover:text-grey-700"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleProcessItems}
            disabled={pendingItems.length === 0 || isProcessingItems}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isProcessingItems ? 'Processing...' : `Process ${pendingItems.length > 0 ? `(${pendingItems.length})` : ''}`}
          </button>

          {processError && <p className="text-sm text-danger">{processError}</p>}

          {processedResults.length > 0 && (
            <>
              <ProcessedResults results={processedResults} onSelectAlternative={handleSelectAlternative} />
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof onConfirmProcessed === 'function') onConfirmProcessed()
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-95"
                >
                  Confirm item list
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {selectionAlert && (
        <div className="fixed bottom-24 right-4 z-50 bg-primary-600 text-white px-4 py-2 rounded-lg shadow">
          {selectionAlert}
        </div>
      )}
    </section>
  )
})

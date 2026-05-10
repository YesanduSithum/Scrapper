import type { ProcessListResult, ProductMatchCandidate } from '../types'
import { ChevronDown, ChevronUp, Check, AlertCircle, Sparkles } from 'lucide-react'
import { useState, useEffect } from 'react'

interface ProcessedResultsProps {
  results: ProcessListResult[]
  onSelectAlternative?: (candidate: ProductMatchCandidate, quantity: number, result?: ProcessListResult) => void
}

export function ProcessedResults({ results, onSelectAlternative }: ProcessedResultsProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    console.log('ProcessedResults - Received results:', results)
  }, [results])

  const toggleExpanded = (inputName: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(inputName)) {
      newExpanded.delete(inputName)
    } else {
      newExpanded.add(inputName)
    }
    setExpandedItems(newExpanded)
  }

  if (results.length === 0) return null

  return (
    <div className="mt-4 rounded-3xl border border-grey-200 bg-white shadow-[0_16px_50px_-28px_rgba(15,23,42,0.3)] overflow-hidden">
      <div className="px-4 py-3 border-b border-grey-100 bg-gradient-to-r from-secondary/8 to-primary/8 flex items-center gap-2">
        <div className="h-9 w-9 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-grey-900">Processed matches</h3>
          <p className="text-xs text-grey-500">Tap any item to view alternatives</p>
        </div>
        <span className="text-xs bg-secondary/15 text-secondary px-2.5 py-1 rounded-full font-semibold">
          {results.length} items
        </span>
      </div>

      <div className="p-3 space-y-3">
        {results.map((result, idx) => {
          const itemName = result.inputName || result.userInput || ''
          const isExpanded = expandedItems.has(itemName)
          const hasAlternatives = result.alternatives && result.alternatives.length > 0

          return (
            <div
              key={`${itemName}-${idx}`}
              className="rounded-2xl border border-grey-200 bg-grey-50/40 overflow-hidden transition-all hover:border-primary-200 hover:shadow-sm"
            >
              <button
                type="button"
                onClick={() => hasAlternatives && toggleExpanded(itemName)}
                disabled={!hasAlternatives}
                className="w-full text-left p-3 disabled:cursor-default"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {result.bestMatch ? (
                      <div className="h-11 w-11 rounded-2xl bg-secondary/10 flex items-center justify-center">
                        <Check className="w-5 h-5 text-secondary" />
                      </div>
                    ) : (
                      <div className="h-11 w-11 rounded-2xl bg-warning/10 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-warning" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-grey-500 truncate">
                        {itemName}
                      </p>
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-grey-500 border border-grey-200">
                        Qty {result.quantity}
                      </span>
                    </div>
                    {result.bestMatch ? (
                      <>
                        <p className="mt-0.5 text-sm font-semibold text-grey-900 truncate">
                          {result.bestMatch.product.name}
                        </p>
                        <p className="text-xs text-grey-600 mt-1">
                          Best match{' '}
                          <span className="font-semibold text-secondary">
                            {(result.bestMatch.similarity * 100).toFixed(1)}%
                          </span>
                        </p>
                      </>
                    ) : (
                      <p className="mt-0.5 text-sm font-medium text-warning">No match found</p>
                    )}
                  </div>

                  {hasAlternatives && (
                    <div className="flex-shrink-0 text-grey-500">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  )}
                </div>

                {result.bestMatch && result.bestMatch.product.prices && (
                  <div className="mt-3 pt-3 border-t border-grey-200 flex items-center justify-between gap-2 text-xs text-grey-600">
                    <span>Price range preview</span>
                    <span className="font-medium">
                      {result.bestMatch.product.prices
                        .slice(0, 2)
                        .map((p) => `Rs. ${p.price}`)
                        .join(' - ')}
                    </span>
                  </div>
                )}
              </button>

              {/* Alternatives Section */}
              {isExpanded && hasAlternatives && (
                <div className="border-t border-grey-200 bg-white p-3 space-y-2">
                  <p className="text-xs font-semibold text-grey-700 uppercase tracking-wide">
                    Similar Products ({result.alternatives.length})
                  </p>
                  {result.alternatives.map((alt, altIdx) => (
                    <div
                      key={`${itemName}-alt-${altIdx}`}
                      className="flex items-center gap-3 p-3 bg-grey-50 rounded-2xl border border-grey-200 hover:border-primary-300 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-grey-900 truncate">
                          {alt.product.name}
                        </p>
                        <p className="text-xs text-grey-600">
                          Match: {(alt.similarity * 100).toFixed(1)}%
                        </p>
                      </div>
                      {onSelectAlternative && (
                        <button
                          type="button"
                          onClick={() => {
                            console.log('[ProcessedResults] Use This clicked', { altId: alt.product.id, qty: result.quantity, original: result.bestMatch?.product.id })
                            onSelectAlternative?.(alt, result.quantity, result)
                          }}
                          className="flex-shrink-0 px-3 py-1 rounded-lg bg-primary-100 text-primary-700 text-xs font-semibold hover:bg-primary-200 transition-colors"
                        >
                          Use This
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

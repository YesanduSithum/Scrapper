import type { ProcessListResult, ProductMatchCandidate } from '../types'
import { ChevronDown, ChevronUp, Check, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'

interface ProcessedResultsProps {
  results: ProcessListResult[]
  onSelectAlternative?: (candidate: ProductMatchCandidate, quantity: number) => void
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
    <div className="mt-4 p-4 rounded-xl border border-secondary/30 bg-gradient-to-br from-secondary/5 to-primary/5 space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <Check className="w-5 h-5 text-secondary font-bold" />
        <h3 className="text-sm font-semibold text-grey-900">Processed Matches</h3>
        <span className="text-xs bg-secondary/20 text-secondary px-2 py-1 rounded-full font-medium">
          {results.length} items
        </span>
      </div>

      <div className="space-y-2">
        {results.map((result, idx) => {
          const isExpanded = expandedItems.has(result.inputName)
          const hasAlternatives = result.alternatives && result.alternatives.length > 0

          return (
            <div
              key={`${result.inputName}-${idx}`}
              className="rounded-lg border border-grey-200 bg-white overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Main Result Item */}
              <div className="p-3">
                <div className="flex items-center gap-3">
                  {/* Best Match Status Icon */}
                  <div className="flex-shrink-0">
                    {result.bestMatch ? (
                      <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                        <Check className="w-5 h-5 text-secondary" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-warning" />
                      </div>
                    )}
                  </div>

                  {/* Item Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-grey-500 uppercase tracking-wide">
                      {result.userInput}
                    </p>
                    {result.bestMatch ? (
                      <div>
                        <p className="font-semibold text-grey-900 text-sm truncate">
                          {result.bestMatch.product.name}
                        </p>
                        <p className="text-xs text-grey-600 mt-0.5">
                          Similarity:{' '}
                          <span className="font-semibold text-secondary">
                            {(result.bestMatch.similarity * 100).toFixed(1)}%
                          </span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-warning font-medium">No match found</p>
                    )}
                  </div>

                  {/* Quantity Badge */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-grey-500">Qty:</p>
                    <p className="text-lg font-bold text-grey-900">{result.quantity}</p>
                  </div>

                  {/* Expand Button */}
                  {hasAlternatives && (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(result.inputName)}
                      className="flex-shrink-0 p-2 hover:bg-grey-100 rounded-lg transition-colors"
                      aria-label="Toggle alternatives"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-grey-500" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-grey-500" />
                      )}
                    </button>
                  )}
                </div>

                {/* Price Info */}
                {result.bestMatch && result.bestMatch.product.prices && (
                  <div className="mt-2 pt-2 border-t border-grey-100">
                    <p className="text-xs text-grey-600">
                      Prices:{' '}
                      {result.bestMatch.product.prices
                        .slice(0, 2)
                        .map((p) => `Rs. ${p.price}`)
                        .join(' - ')}
                    </p>
                  </div>
                )}
              </div>

              {/* Alternatives Section */}
              {isExpanded && hasAlternatives && (
                <div className="border-t border-grey-200 bg-grey-50/50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-grey-700 uppercase tracking-wide">
                    Similar Products ({result.alternatives.length})
                  </p>
                  {result.alternatives.map((alt, altIdx) => (
                    <div
                      key={`${result.inputName}-alt-${altIdx}`}
                      className="flex items-center gap-2 p-2 bg-white rounded-lg border border-grey-200 hover:border-primary-300 transition-colors"
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
                          onClick={() => onSelectAlternative(alt, result.quantity)}
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

'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { Award, TrendingDown, TrendingUp } from 'lucide-react'
import { type EventTheme, getThemeConfig } from '@/hooks/use-theme'
import { getQuotesByPlan } from '@/app/actions/quote'
import { MODULE_CATEGORY_LABELS } from '@/hooks/use-quote-builder'
import type { QuoteRequestWithResponses } from '@/types/quote'

export interface VendorQuoteItem {
  moduleKey: string
  moduleName: string
  category: string
  categoryLabel: string
  price: number
  pricingType: 'FLAT' | 'PER_GUEST'
}

export interface VendorQuote {
  requestId: string
  responseId: string
  vendorId: string
  vendorName: string
  totalPrice: number
  respondedAt: string
  canAccept: boolean
  isAccepted: boolean
  items: VendorQuoteItem[]
  note?: string
}

// Map QuoteRequestWithResponses[] → VendorQuote[]
export function mapQuoteRequestsToVendorQuotes(requests: QuoteRequestWithResponses[]): VendorQuote[] {
  const quotes: VendorQuote[] = []
  for (const req of requests) {
    if (req.status !== 'RESPONDED' && req.status !== 'ACCEPTED') continue
    for (const resp of req.responses) {
      const items: VendorQuoteItem[] = []
      // Base package as a line item
      if (resp.modules.basePackage) {
        items.push({
          moduleKey: 'base',
          moduleName: resp.modules.basePackage.name,
          category: 'BASE',
          categoryLabel: '기본 패키지',
          price: resp.modules.basePackage.price,
          pricingType: 'FLAT',
        })
      }
      // Included modules
      for (const m of resp.modules.includedModules ?? []) {
        items.push({
          moduleKey: m.id,
          moduleName: m.name,
          category: m.category as string,
          categoryLabel: MODULE_CATEGORY_LABELS[m.category as string] ?? m.category,
          price: m.price,
          pricingType: 'FLAT',
        })
      }
      quotes.push({
        requestId: req.id,
        responseId: resp.id,
        vendorId: resp.vendorId,
        vendorName: resp.vendor?.companyName ?? '업체',
        totalPrice: resp.totalPrice,
        respondedAt: resp.createdAt,
        canAccept: req.status === 'RESPONDED',
        isAccepted: req.status === 'ACCEPTED',
        items,
        note: resp.note ?? undefined,
      })
    }
  }
  return quotes
}

interface QuoteComparisonProps {
  /** Pass either direct quotes (static/mock use) OR planId (auto-fetch from DB) */
  quotes?: VendorQuote[]
  planId?: string
  theme: EventTheme
  guestCount?: number
  isLoading?: boolean
  isAccepting?: boolean
  onAccept?: (quoteResponseId: string) => void
}

export function QuoteComparison({
  quotes: quoteProp,
  planId,
  theme,
  guestCount = 100,
  isLoading: isLoadingProp = false,
  isAccepting = false,
  onAccept,
}: QuoteComparisonProps) {
  const config = getThemeConfig(theme)

  // Auto-fetch when planId is provided
  const [fetchedQuotes, setFetchedQuotes] = useState<VendorQuote[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!planId || quoteProp) return
    let cancelled = false
    setIsLoading(true)
    getQuotesByPlan(planId).then((result) => {
      if (cancelled) return
      if (result.success) {
        setFetchedQuotes(mapQuoteRequestsToVendorQuotes(result.data))
      }
      setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [planId, quoteProp])

  const quotes = useMemo(() => quoteProp ?? fetchedQuotes ?? [], [quoteProp, fetchedQuotes])
  const showLoading = isLoadingProp || isLoading

  // Collect unique category/module metadata
  const allModuleKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const q of quotes) for (const item of q.items) keys.add(item.moduleKey)
    return Array.from(keys)
  }, [quotes])

  const allCategories = useMemo(() => {
    const seen = new Set<string>()
    const cats: { value: string; label: string }[] = []
    for (const q of quotes) {
      for (const item of q.items) {
        if (!seen.has(item.category)) {
          seen.add(item.category)
          cats.push({ value: item.category, label: item.categoryLabel })
        }
      }
    }
    return cats
  }, [quotes])

  const priceRange = useMemo(() => {
    const map: Record<string, { min: number; max: number }> = {}
    for (const key of allModuleKeys) {
      const prices = quotes
        .map((q) => q.items.find((i) => i.moduleKey === key))
        .filter(Boolean)
        .map((i) => (i!.pricingType === 'PER_GUEST' ? i!.price * guestCount : i!.price))
      if (prices.length > 0) {
        map[key] = { min: Math.min(...prices), max: Math.max(...prices) }
      }
    }
    return map
  }, [allModuleKeys, quotes, guestCount])

  const lowestTotal = useMemo(
    () => (quotes.length > 0 ? Math.min(...quotes.map((q) => q.totalPrice)) : 0),
    [quotes]
  )

  if (showLoading) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-gray-200">
        <p className="text-sm text-gray-400">견적 응답을 불러오는 중...</p>
      </div>
    )
  }

  if (quotes.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-gray-200">
        <p className="text-sm text-gray-400">견적 응답을 기다리는 중입니다</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 w-40 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500">
              서비스 항목
            </th>
            {quotes.map((q) => (
              <th key={q.responseId} className="min-w-40 px-4 py-3 text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="font-semibold" style={{ color: config.primaryDark }}>{q.vendorName}</span>
                  {q.totalPrice === lowestTotal && (
                    <span
                      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: config.primary }}
                    >
                      <Award size={10} />
                      최저가
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {allCategories.map((cat) => {
            const catKeys = allModuleKeys.filter((key) =>
              quotes.some((q) => q.items.find((i) => i.moduleKey === key && i.category === cat.value))
            )
            if (catKeys.length === 0) return null

            return (
              <Fragment key={cat.value}>
                <tr>
                  <td
                    colSpan={quotes.length + 1}
                    className="px-4 py-2 text-xs font-semibold"
                    style={{ backgroundColor: config.surface, color: config.primary }}
                  >
                    {cat.label}
                  </td>
                </tr>

                {catKeys.map((key) => {
                  const range = priceRange[key]
                  const spread = range ? range.max - range.min : 0
                  const highSpread = spread > (range?.min ?? 0) * 0.3

                  return (
                    <tr key={key} className="border-t border-gray-50 hover:bg-gray-50/50">
                      <td className="sticky left-0 bg-white px-4 py-2.5 text-gray-700">
                        {quotes.flatMap((q) => q.items).find((i) => i.moduleKey === key)?.moduleName ?? key}
                      </td>
                      {quotes.map((q) => {
                        const item = q.items.find((i) => i.moduleKey === key)
                        if (!item) {
                          return (
                            <td key={q.responseId} className="px-4 py-2.5 text-center text-gray-300">—</td>
                          )
                        }
                        const price = item.pricingType === 'PER_GUEST' ? item.price * guestCount : item.price
                        const isMin = range && price === range.min
                        const isMax = range && price === range.max && spread > 0

                        return (
                          <td key={q.responseId} className="px-4 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {highSpread && isMin && <TrendingDown size={12} className="text-emerald-500" />}
                              {highSpread && isMax && <TrendingUp size={12} className="text-rose-400" />}
                              <span
                                className="font-medium"
                                style={{
                                  color: highSpread && isMin ? '#10b981' : highSpread && isMax ? '#f43f5e' : '#374151',
                                }}
                              >
                                {price.toLocaleString('ko-KR')}원
                              </span>
                            </div>
                            {item.pricingType === 'PER_GUEST' && (
                              <p className="text-xs text-gray-400">{item.price.toLocaleString('ko-KR')}원/명</p>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </Fragment>
            )
          })}

          {/* Total row */}
          <tr className="border-t-2 border-gray-200">
            <td className="sticky left-0 bg-white px-4 py-3 text-sm font-semibold text-gray-700">총 견적</td>
            {quotes.map((q) => (
              <td key={q.responseId} className="px-4 py-3 text-center">
                <div
                  className="text-base font-bold"
                  style={{ color: q.totalPrice === lowestTotal ? config.primary : '#374151' }}
                >
                  {q.totalPrice.toLocaleString('ko-KR')}원
                </div>
                {q.isAccepted ? (
                  <span className="mt-2 inline-flex rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
                    수락됨
                  </span>
                ) : onAccept && q.canAccept ? (
                  <button
                    type="button"
                    disabled={isAccepting}
                    onClick={() => onAccept(q.responseId)}
                    className="mt-2 rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: config.primary }}
                  >
                    {isAccepting ? '처리 중...' : '이 견적 수락'}
                  </button>
                ) : null}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

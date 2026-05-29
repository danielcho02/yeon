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
      <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-[#e5e2da] bg-white">
        <p className="text-xs text-muted-foreground/60">견적 제안을 분석하는 중...</p>
      </div>
    )
  }

  if (quotes.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-[#e5e2da] bg-white">
        <p className="text-xs text-muted-foreground/60">도착한 파트너 제안서가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#e5e2da] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.005)]">
      <table className="w-full min-w-[550px] border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-[#f2ece4] bg-[#faf9f5]">
            <th className="sticky left-0 w-44 bg-[#faf9f5] px-4 py-3 text-left font-bold text-[#2c3455] border-r border-[#f2ece4]">
              제공 품목 스펙
            </th>
            {quotes.map((q) => (
              <th key={q.responseId} className="min-w-36 px-4 py-3 text-center bg-[#faf9f5] border-r border-[#f2ece4]/60 last:border-r-0">
                <div className="flex flex-col items-center gap-1">
                  <span className="font-bold text-xs text-[#2c3455]">{q.vendorName}</span>
                  {q.totalPrice === lowestTotal && (
                    <span
                      className="inline-flex items-center gap-1 rounded bg-[#fcf8f2] text-[#c4977a] border border-[#ebdccf]/50 px-2 py-0.5 text-[8px] font-bold tracking-wider"
                    >
                      <Award size={8} />
                      최저가 제안
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-[#f2ece4]/40">
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
                    className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-wider border-y border-[#f2ece4]/50 bg-[#faf9f5]/70"
                    style={{ color: config.primary }}
                  >
                    {cat.label}
                  </td>
                </tr>

                {catKeys.map((key) => {
                  const range = priceRange[key]
                  const spread = range ? range.max - range.min : 0
                  const highSpread = spread > (range?.min ?? 0) * 0.3

                  return (
                    <tr key={key} className="hover:bg-[#faf9f5]/20 transition-colors duration-150">
                      <td className="sticky left-0 bg-white px-4 py-2.5 text-[#8c8275] font-semibold border-r border-[#f2ece4]/60">
                        {quotes.flatMap((q) => q.items).find((i) => i.moduleKey === key)?.moduleName ?? key}
                      </td>
                      {quotes.map((q) => {
                        const item = q.items.find((i) => i.moduleKey === key)
                        if (!item) {
                          return (
                            <td key={q.responseId} className="px-4 py-2.5 text-center text-[#e5e2da] border-r border-[#f2ece4]/40 last:border-r-0">—</td>
                          )
                        }
                        const price = item.pricingType === 'PER_GUEST' ? item.price * guestCount : item.price
                        const isMin = range && price === range.min
                        const isMax = range && price === range.max && spread > 0

                        return (
                          <td key={q.responseId} className="px-4 py-2.5 text-center border-r border-[#f2ece4]/40 last:border-r-0">
                            <div className="flex items-center justify-center gap-1">
                              {highSpread && isMin && <TrendingDown size={10} className="text-emerald-600" />}
                              {highSpread && isMax && <TrendingUp size={10} className="text-[#c4977a]" />}
                              <span
                                className="font-bold text-[#2c3455]"
                                style={{
                                  color: highSpread && isMin ? '#0f9652' : highSpread && isMax ? '#c4977a' : '#2c3455',
                                }}
                              >
                                {price.toLocaleString('ko-KR')}원
                              </span>
                            </div>
                            {item.pricingType === 'PER_GUEST' && (
                              <p className="text-[9px] text-[#8c8275]/50 mt-0.5">{item.price.toLocaleString('ko-KR')}원/명</p>
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

          {/* Total row - 정보 비교에 초점 */}
          <tr className="border-t-2 border-[#e5e2da] bg-[#faf9f5]/20 font-bold">
            <td className="sticky left-0 bg-[#faf9f5]/40 px-4 py-3.5 text-xs text-[#2c3455] border-r border-[#f2ece4]/60">총 제안 금액 합계</td>
            {quotes.map((q) => (
              <td key={q.responseId} className="px-4 py-3.5 text-center border-r border-[#f2ece4]/40 last:border-r-0">
                <div
                  className="text-xs font-bold tracking-tight text-[#2c3455]"
                  style={{ color: q.totalPrice === lowestTotal ? config.primary : '#2c3455' }}
                >
                  {q.totalPrice.toLocaleString('ko-KR')}원
                </div>
                {q.isAccepted ? (
                  <span className="mt-1.5 inline-flex rounded border border-violet-100 bg-violet-50/50 px-2 py-0.5 text-[9px] font-bold text-violet-700">
                    선택 수락 완료
                  </span>
                ) : onAccept && q.canAccept ? (
                  <button
                    type="button"
                    disabled={isAccepting}
                    onClick={() => onAccept(q.responseId)}
                    className="mt-1.5 inline-flex text-[9px] font-semibold text-[#c4977a] hover:text-[#b08569] underline underline-offset-2 transition-colors"
                  >
                    {isAccepting ? '수락 중...' : '이 제안 수락'}
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

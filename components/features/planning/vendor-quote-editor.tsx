'use client'

import { useState, useTransition } from 'react'
import { Plus, Minus, ChevronDown } from 'lucide-react'
import { type EventTheme, getThemeConfig } from '@/hooks/use-theme'
import { PriceCountUp } from '@/components/ui/motion'
import { submitQuoteResponse } from '@/app/actions/quote'
import { quoteServiceModules, serviceCatalog, type MvpQuoteEventType } from '@/lib/step3.shared'
import type { ModuleCategory } from '@/types/vendor-module'

interface QuoteLineItem {
  key: string
  name: string
  category: string
  categoryLabel: string
  price: number
  pricingType: 'FLAT' | 'PER_GUEST'
}

// Map catalog category strings → ModuleCategory enum values
const CATALOG_TO_MODULE_CATEGORY: Record<string, ModuleCategory> = {
  venue: 'VENUE',
  studio: 'PHOTO',
  dress: 'DRESS',
  makeup: 'MAKEUP',
  floral: 'DECORATION',
  honeymoon: 'CEREMONY',
  weddingOther: 'VENUE',
  funeralHall: 'FUNERAL_HALL',
  altarFloral: 'WREATH',
  hearse: 'TRANSPORT',
  cremation: 'CEREMONY',
  ossuary: 'CEREMONY',
  shroud: 'CEREMONY',
  funeralOther: 'OBITUARY',
}

const PRESETS: Record<MvpQuoteEventType, { label: string; keys: string[] }[]> = {
  WEDDING: [
    { label: '기본 패키지', keys: ['venue_hall', 'studio_snap', 'makeup_bride'] },
    { label: '스탠다드 패키지', keys: ['venue_hall', 'venue_sound', 'studio_snap', 'dress_wedding', 'makeup_bride', 'floral_bouquet'] },
    { label: '전체 선택', keys: [] },
  ],
  FUNERAL: [
    { label: '기본 패키지', keys: ['funeral_hall_3d', 'altar_basic', 'hearse_local'] },
    { label: '표준 패키지', keys: ['funeral_hall_3d', 'altar_premium', 'hearse_local', 'cremation_basic', 'shroud_basic'] },
    { label: '전체 선택', keys: [] },
  ],
}

interface VendorQuoteEditorProps {
  theme: EventTheme
  guestCount?: number
  /** When provided, submits via submitQuoteResponse Server Action instead of onSubmit callback */
  requestId?: string
  onSubmit?: (items: QuoteLineItem[], totalPrice: number) => void
  onSuccess?: () => void
}

export function VendorQuoteEditor({
  theme,
  guestCount = 100,
  requestId,
  onSubmit,
  onSuccess,
}: VendorQuoteEditorProps) {
  const config = getThemeConfig(theme)
  const eventType: MvpQuoteEventType = theme === 'wedding' ? 'WEDDING' : 'FUNERAL'
  const categories = quoteServiceModules[eventType]
  const catalog = serviceCatalog[eventType]

  const [included, setIncluded] = useState<QuoteLineItem[]>([])
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [selectedPreset, setSelectedPreset] = useState('')
  const [presetOpen, setPresetOpen] = useState(false)
  const [note, setNote] = useState('')
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const allItems: QuoteLineItem[] = categories.flatMap(({ value: category, label: categoryLabel }) =>
    (catalog[category] ?? []).map((item) => ({
      key: item.key,
      name: item.name,
      category,
      categoryLabel,
      price: prices[item.key] ?? 0,
      pricingType: item.pricingType,
    }))
  )

  const addItem = (item: QuoteLineItem) => {
    if (!included.find((i) => i.key === item.key)) {
      setIncluded((prev) => [...prev, { ...item, price: prices[item.key] ?? 0 }])
    }
  }

  const removeItem = (key: string) => {
    setIncluded((prev) => prev.filter((i) => i.key !== key))
  }

  const updatePrice = (key: string, price: number) => {
    setPrices((prev) => ({ ...prev, [key]: price }))
    setIncluded((prev) => prev.map((i) => (i.key === key ? { ...i, price } : i)))
  }

  const applyPreset = (preset: { label: string; keys: string[] }) => {
    if (preset.keys.length === 0) {
      setIncluded(allItems)
    } else {
      const items = preset.keys.map((key) => allItems.find((i) => i.key === key)).filter(Boolean) as QuoteLineItem[]
      setIncluded(items)
    }
    setSelectedPreset(preset.label)
    setPresetOpen(false)
  }

  const totalPrice = included.reduce((sum, item) => {
    const p = item.pricingType === 'PER_GUEST' ? item.price * guestCount : item.price
    return sum + p
  }, 0)

  const available = allItems.filter((a) => !included.find((i) => i.key === a.key))

  const handleSubmit = () => {
    if (included.length === 0) return

    if (requestId) {
      // New flow: call submitQuoteResponse Server Action
      const includedModules = included.map((item) => ({
        id: item.key,
        name: item.name,
        category: (CATALOG_TO_MODULE_CATEGORY[item.category] ?? 'VENUE') as ModuleCategory,
        price: item.pricingType === 'PER_GUEST' ? item.price * guestCount : item.price,
      }))

      const modules = {
        basePackage: {
          name: `${eventType === 'WEDDING' ? '웨딩' : '장례'} 견적 패키지`,
          price: 0,
          description: `${included.length}개 항목 포함`,
        },
        includedModules,
        optionalModules: [] as typeof includedModules,
        excludedModules: [] as Array<{ id: string; name: string; reason: string }>,
      }

      startTransition(async () => {
        const result = await submitQuoteResponse({
          requestId,
          basePrice: 0,
          modules,
          totalPrice,
          note: note.trim() || undefined,
        })
        if (result.success) {
          setStatusMsg({ ok: true, text: '견적을 성공적으로 제출했습니다.' })
          onSuccess?.()
        } else {
          setStatusMsg({ ok: false, text: result.error })
        }
      })
    } else {
      // Legacy callback flow
      onSubmit?.(included, totalPrice)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Status message */}
      {statusMsg && (
        <div className={`rounded-xl px-4 py-3 text-xs font-semibold ${statusMsg.ok ? 'bg-emerald-50/50 text-emerald-800 border border-emerald-100' : 'bg-rose-50/50 text-rose-800 border border-rose-100'}`}>
          {statusMsg.text}
        </div>
      )}

      {/* Preset selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPresetOpen(!presetOpen)}
          className="flex w-full items-center justify-between rounded-xl border border-[#e5e2da] bg-white px-4 py-3 text-xs text-[#2c3455] font-semibold transition-colors hover:bg-[#faf9f5]/55 focus:outline-none"
        >
          <span className={selectedPreset ? 'text-[#2c3455]' : 'text-muted-foreground/60'}>
            {selectedPreset || '제안 패키지 프리셋 선택 (선택사항)'}
          </span>
          <ChevronDown size={14} className={`text-muted-foreground transition-transform ${presetOpen ? 'rotate-180' : ''}`} />
        </button>
        {presetOpen && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-[#e5e2da] bg-white shadow-lg">
            {PRESETS[eventType].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="w-full px-4 py-2.5 text-left text-xs font-semibold hover:bg-[#faf9f5] border-b border-[#f2ece4]/40 last:border-0"
                style={{ color: selectedPreset === p.label ? config.primary : '#2c3455' }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Two-column editor */}
      <div className="flex flex-col md:flex-row gap-5">
        {/* Available modules */}
        <div className="flex-1 rounded-xl border border-[#e5e2da] p-4 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">선택 가능한 제안 목록</p>
          <div className="space-y-3.5">
            {categories.map(({ value: category, label: categoryLabel }) => {
              const items = available.filter((a) => a.category === category)
              if (items.length === 0) return null
              return (
                <div key={category} className="border-b border-[#f2ece4]/40 pb-3 last:border-b-0 last:pb-0">
                  <p className="mb-1.5 text-[9px] font-bold text-[#c4977a] uppercase tracking-wider">{categoryLabel}</p>
                  <div className="space-y-1.5">
                    {items.map((item) => (
                      <div key={item.key} className="flex items-center justify-between rounded-lg bg-[#faf9f5]/30 px-3 py-2 border border-transparent hover:border-[#ebdccf]/40 hover:bg-[#faf9f5]/70 transition-all">
                        <span className="text-xs font-medium text-[#2c3455]">{item.name}</span>
                        <button
                          type="button"
                          onClick={() => addItem(item)}
                          className="flex h-5 w-5 items-center justify-center rounded bg-[#c4977a] text-white transition-all hover:bg-[#b08569]"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            {available.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground/60">모든 품목이 견적서에 포함되었습니다.</p>
            )}
          </div>
        </div>

        {/* Included modules with price input */}
        <div className="flex-1 rounded-xl border border-[#ebdccf] p-4 bg-[#faf9f5]/55 shadow-[0_2px_12px_rgba(196,151,122,0.015)]">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#c4977a]">현재 포함된 제안 세부 사항</p>
          <div className="space-y-2.5">
            {included.map((item) => (
              <div key={item.key} className="rounded-xl border border-[#ebdccf]/60 bg-white px-3.5 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.01)]">
                <div className="flex items-center justify-between border-b border-[#f2ece4]/40 pb-2 mb-2">
                  <span className="text-xs font-bold text-[#2c3455]">{item.name}</span>
                  <button type="button" onClick={() => removeItem(item.key)} className="focus:outline-none">
                    <Minus size={13} className="text-muted-foreground/60 hover:text-red-500 transition-colors" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step={10000}
                    min={0}
                    placeholder="견적 금액 기입"
                    value={prices[item.key] ?? ''}
                    onChange={(e) => updatePrice(item.key, Number(e.target.value))}
                    className="flex-1 rounded-lg border border-[#e5e2da] bg-white px-3 py-1.5 text-xs text-[#2c3455] font-semibold focus:outline-none focus:ring-1 focus:ring-[#c4977a]"
                  />
                  <span className="text-[10px] text-muted-foreground/60 shrink-0 font-medium">
                    {item.pricingType === 'PER_GUEST' ? '원 / 인당' : '원 / 고정'}
                  </span>
                </div>
              </div>
            ))}
            {included.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground/60">좌측 선택 목록에서 포함할 항목을 추가하세요.</p>
            )}
          </div>
        </div>
      </div>

      {/* Note */}
      {requestId && (
        <textarea
          rows={2}
          placeholder="견적서 관련 부가 설명 및 안내 사항 (포함 범위, 일정 안내, 주의 사항 등)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-xl border border-[#e5e2da] px-4 py-3 text-xs text-[#2c3455] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-[#c4977a]"
        />
      )}

      {/* Footer */}
      <div className="flex items-center justify-between rounded-xl border border-[#ebdccf] bg-white px-5 py-4 shadow-sm">
        <div>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">총 제안 금액 합계 ({guestCount}명 기준)</p>
          <div className="text-xl font-bold tracking-tight text-[#c4977a] mt-0.5">
            <PriceCountUp value={totalPrice} />
          </div>
        </div>
        <button
          type="button"
          disabled={included.length === 0 || isPending}
          onClick={handleSubmit}
          className="rounded-xl px-6 py-3 text-xs font-semibold text-white tracking-wide transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:pointer-events-none"
          style={{ backgroundColor: config.primary }}
        >
          {isPending ? '제출 중...' : '제안서 전송'}
        </button>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, X, ShoppingBag, ClipboardList } from 'lucide-react'
import { type EventTheme, getThemeConfig } from '@/hooks/use-theme'
import {
  useQuoteBuilder,
  buildModulesFromVendorData,
  buildBasePackageFromVendorData,
  type QuoteModule,
  type BasePackage,
} from '@/hooks/use-quote-builder'
import type { VendorServiceModuleData } from '@/types/vendor-module'
import { PriceCountUp } from '@/components/ui/motion'
import { quoteServiceModules, serviceCatalog, type MvpQuoteEventType } from '@/lib/step3.shared'

// ─── Fallback mock prices (used only when no vendorModules prop is provided) ──

const MOCK_PRICES: Record<string, number> = {
  venue_hall: 3000000, venue_sound: 500000, venue_photo: 300000, venue_bridal: 200000,
  catering_meal: 55000, catering_drink: 15000, catering_cake: 400000,
  studio_snap: 1200000, studio_outdoor: 500000, studio_album: 800000, studio_video: 1500000,
  dress_wedding: 1500000, dress_fitting: 0, dress_accessory: 300000, dress_hanbok: 500000,
  makeup_bride: 800000, makeup_hair: 400000, makeup_retouch: 300000, makeup_groom: 200000,
  floral_bouquet: 300000, floral_boutonniere: 80000, floral_ceremony: 1200000, floral_table: 600000,
  honeymoon_pkg: 4000000, honeymoon_hotel: 1500000,
  wedding_mc: 500000, wedding_live: 800000,
  funeral_hall_1d: 500000, funeral_hall_2d: 900000, funeral_hall_3d: 1300000,
  funeral_food: 30000, funeral_staff: 600000,
  altar_basic: 500000, altar_premium: 1200000, altar_wreath: 300000,
  hearse_local: 200000, hearse_long: 500000,
  cremation_basic: 400000, cremation_urn: 200000, cremation_urn_premium: 500000,
  ossuary_1y: 1000000, ossuary_5y: 4000000,
  shroud_basic: 500000, shroud_premium: 1200000,
  funeral_obituary: 200000, funeral_limo: 400000,
}

const MOCK_BASE_PACKAGES: Record<MvpQuoteEventType, BasePackage[]> = {
  WEDDING: [
    { id: 'w-starter',  name: '스타터 패키지',  description: '예식홀 + 기본 촬영 + 메이크업',         price: 5000000,  includedModuleKeys: ['venue_hall', 'studio_snap', 'makeup_bride'] },
    { id: 'w-balanced', name: '밸런스 패키지',  description: '예식홀 + 스냅 + 드레스 + 메이크업 + 꽃', price: 8500000,  includedModuleKeys: ['venue_hall', 'studio_snap', 'dress_wedding', 'makeup_bride', 'floral_bouquet'] },
    { id: 'w-premium',  name: '프리미엄 패키지', description: '전체 서비스 포함 패키지',              price: 15000000, includedModuleKeys: ['venue_hall', 'venue_sound', 'studio_snap', 'studio_video', 'dress_wedding', 'makeup_bride', 'floral_ceremony', 'honeymoon_pkg'] },
  ],
  FUNERAL: [
    { id: 'f-basic',    name: '기본 패키지',  description: '빈소 3일 + 기본 제단꽃 + 운구',         price: 3000000, includedModuleKeys: ['funeral_hall_3d', 'altar_basic', 'hearse_local'] },
    { id: 'f-standard', name: '표준 패키지',  description: '빈소 3일 + 프리미엄 제단꽃 + 운구 + 화장', price: 5500000, includedModuleKeys: ['funeral_hall_3d', 'altar_premium', 'hearse_local', 'cremation_basic'] },
    { id: 'f-premium',  name: '프리미엄 패키지', description: '전체 장례 서비스 포함',              price: 9000000, includedModuleKeys: ['funeral_hall_3d', 'altar_premium', 'altar_wreath', 'hearse_long', 'cremation_basic', 'cremation_urn_premium', 'shroud_premium'] },
  ],
}

// ─── Build module list ────────────────────────────────────────────────────────

function buildCatalogModules(eventType: MvpQuoteEventType): QuoteModule[] {
  const categoryMeta = quoteServiceModules[eventType]
  const catalog = serviceCatalog[eventType]
  const modules: QuoteModule[] = []
  for (const { value: category, label: categoryLabel } of categoryMeta) {
    const items = catalog[category] ?? []
    for (const item of items) {
      modules.push({
        key: item.key,
        name: item.name,
        category,
        categoryLabel,
        price: MOCK_PRICES[item.key] ?? 0,
        pricingType: item.pricingType,
      })
    }
  }
  return modules
}

// ─── Module Row (Elegant 1-row layout with high readability) ──────────────────

function ModuleRow({
  module,
  isSelected,
  onToggle,
  theme,
  guestCount,
}: {
  module: QuoteModule
  isSelected: boolean
  onToggle: () => void
  theme: EventTheme
  guestCount: number
}) {
  const config = getThemeConfig(theme)
  const displayPrice = module.pricingType === 'PER_GUEST' ? module.price * guestCount : module.price
  const priceLabel = module.pricingType === 'PER_GUEST'
    ? `${module.price.toLocaleString('ko-KR')}원/인`
    : `${displayPrice.toLocaleString('ko-KR')}원`

  return (
    <motion.button
      layout
      type="button"
      onClick={onToggle}
      className="group relative flex w-full items-center justify-between gap-4 border-b border-[#e5e2da]/70 py-3 text-left transition-all duration-150 hover:bg-[#faf9f5]/50 px-2"
      style={{
        borderBottomColor: isSelected ? config.primary : '#ebdccf/40',
      }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Left: Name & Category Label */}
      <div className="flex flex-col min-w-0 pr-2">
        <span 
          className="text-xs font-semibold leading-tight text-[#2c3455] group-hover:text-foreground transition-colors break-keep"
          style={{ 
            color: isSelected ? config.primaryDark : '#2c3455',
            wordBreak: 'keep-all'
          }}
        >
          {module.name}
        </span>
        <span className="mt-1 text-[10px] text-muted-foreground/60 font-normal">
          {module.categoryLabel}
        </span>
      </div>

      {/* Right: Price & Checkbox */}
      <div className="flex items-center gap-3.5 shrink-0 ml-auto">
        <span 
          className="text-xs font-bold font-mono tracking-tight whitespace-nowrap" 
          style={{ color: isSelected ? config.primary : '#8c8275' }}
        >
          {priceLabel}
        </span>
        <div
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all duration-150"
          style={{
            borderColor: isSelected ? config.primary : '#e5e2da',
            backgroundColor: isSelected ? config.primary : 'transparent',
          }}
        >
          {isSelected && <Check size={10} color="white" strokeWidth={3.5} />}
        </div>
      </div>
    </motion.button>
  )
}

// ─── Summary Panel ────────────────────────────────────────────────────────────

function SummaryPanel({
  builder,
  theme,
  guestCount,
  isSubmitting = false,
  onRequestQuote,
  validationMessage,
}: {
  builder: ReturnType<typeof useQuoteBuilder>
  theme: EventTheme
  guestCount: number
  isSubmitting?: boolean
  onRequestQuote?: () => void
  validationMessage?: string | null
}) {
  const config = getThemeConfig(theme)
  const { selectedModules, basePackage, totalPrice } = builder
  const isWedding = theme === 'wedding'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 pb-2 border-b border-[#f2ece4]">
        <ShoppingBag size={13} style={{ color: config.primary }} />
        <span className="text-xs font-bold uppercase tracking-wider text-[#2c3455] whitespace-nowrap">
          {isWedding ? '추천 견적 구성 요약' : '추모 의례 준비 항목 요약'}
        </span>
      </div>

      {basePackage && (
        <div className="rounded-xl p-3 border border-border/40 bg-[#faf9f5]/70">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#2c3455] break-keep">{basePackage.name}</span>
            <span className="text-xs font-bold font-mono whitespace-nowrap" style={{ color: config.primary }}>
              {basePackage.price.toLocaleString('ko-KR')}원
            </span>
          </div>
          <p className="mt-1 text-[10px] text-[#8c8275] leading-relaxed break-keep">{basePackage.description}</p>
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px]">
        <AnimatePresence>
          {selectedModules.map((m) => {
            const price = m.pricingType === 'PER_GUEST' ? m.price * guestCount : m.price
            return (
              <motion.div
                key={m.key}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-between py-1 border-b border-[#f2ece4]/40 gap-2">
                  <button
                    type="button"
                    onClick={() => builder.toggleModule(m)}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-500 font-medium whitespace-nowrap overflow-hidden text-ellipsis"
                  >
                    <X size={10} className="shrink-0" />
                    <span className="truncate">{m.name}</span>
                  </button>
                  <span className="text-[11px] font-bold font-mono text-[#2c3455] whitespace-nowrap shrink-0">
                    {price.toLocaleString('ko-KR')}원
                  </span>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {selectedModules.length === 0 && !basePackage && (
          <p className="py-8 text-center text-xs text-muted-foreground/60 font-normal leading-relaxed break-keep">
            {isWedding 
              ? '추천 구성에서 필요한 항목을 선택하면 요청 내용을 정리해드립니다.' 
              : '기본 준비 항목을 확인한 뒤 상담 요청을 보낼 수 있습니다.'}
          </p>
        )}
      </div>

      {validationMessage && (
        <p className="rounded-xl border border-amber-200 bg-amber-50/50 px-3.5 py-2.5 text-[10px] font-semibold text-amber-800 leading-normal break-keep" role="status">
          {validationMessage}
        </p>
      )}

      <div className="border-t border-[#f2ece4] pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold text-muted-foreground">
            {isWedding ? '예상 제안 합계액' : '예상 제안 금액'}
          </span>
          <div className="text-base font-bold font-mono" style={{ color: config.primary }}>
            <PriceCountUp value={totalPrice} />
          </div>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground/60 leading-normal break-keep">상세 조율 결과에 따라 금액이 유연하게 다듬어집니다.</p>
      </div>

      <button
        type="button"
        disabled={isSubmitting || (selectedModules.length === 0 && !basePackage)}
        onClick={onRequestQuote}
        className="w-full rounded-xl py-2.5 text-xs font-bold text-white transition-all duration-150 hover:opacity-95 disabled:opacity-40 whitespace-nowrap shadow-sm hover:shadow"
        style={{ backgroundColor: config.primary }}
      >
        {isSubmitting 
          ? '전송 중...' 
          : isWedding 
            ? '이 구성으로 견적 요청' 
            : '의전 맞춤 상담 요청하기'}
      </button>
    </div>
  )
}

// ─── Mobile Bottom Bar ────────────────────────────────────────────────────────

function MobileBottomBar({
  builder,
  theme,
  onOpen,
  isSubmitting = false,
  onRequestQuote,
  validationMessage,
}: {
  builder: ReturnType<typeof useQuoteBuilder>
  theme: EventTheme
  onOpen: () => void
  isSubmitting?: boolean
  onRequestQuote?: () => void
  validationMessage?: string | null
}) {
  const config = getThemeConfig(theme)
  const count = builder.selectedModules.length + (builder.basePackage ? 1 : 0)
  const isWedding = theme === 'wedding'

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#e5e2da] bg-white p-4 shadow-md lg:hidden">
      {validationMessage && (
        <p className="mb-2 rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2 text-[10px] font-semibold text-amber-800 break-keep" role="status">
          {validationMessage}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onOpen} className="flex items-center gap-2">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full text-white text-[10px] font-bold shrink-0"
            style={{ backgroundColor: config.primary }}
          >
            {count}
          </div>
          <div className="text-left min-w-0 pr-1">
            <p className="text-[10px] text-[#8c8275]">선택한 서비스</p>
            <p className="text-sm font-bold font-mono truncate" style={{ color: config.primary }}>
              <PriceCountUp value={builder.totalPrice} />
            </p>
          </div>
          <ChevronDown size={12} className="text-[#8c8275] shrink-0" />
        </button>
        <button
          type="button"
          disabled={isSubmitting || count === 0}
          onClick={onRequestQuote}
          className="rounded-xl px-4 py-2 text-xs font-bold text-white disabled:opacity-40 shrink-0 whitespace-nowrap shadow-sm hover:shadow"
          style={{ backgroundColor: config.primary }}
        >
          {isSubmitting 
            ? '전송 중...' 
            : isWedding 
              ? '견적 요청' 
              : '상담 요청하기'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ModularQuoteBuilderProps {
  theme: EventTheme
  guestCount?: number
  /** Real vendor service modules from DB — when provided, replaces catalog+mock data */
  vendorModules?: VendorServiceModuleData[]
  isSubmitting?: boolean
  onRequestQuote?: (modules: QuoteModule[], base: BasePackage | null) => void
}

export function ModularQuoteBuilder({
  theme,
  guestCount = 100,
  vendorModules,
  isSubmitting = false,
  onRequestQuote,
}: ModularQuoteBuilderProps) {
  const config = getThemeConfig(theme)
  const eventType: MvpQuoteEventType = theme === 'wedding' ? 'WEDDING' : 'FUNERAL'
  const isWedding = theme === 'wedding'

  const [showCustomizer, setShowCustomizer] = useState(false)

  // When real vendor modules are provided, use them; otherwise fall back to catalog
  const allModules = useMemo(() => {
    if (vendorModules && vendorModules.length > 0) {
      return buildModulesFromVendorData(vendorModules)
    }
    return buildCatalogModules(eventType)
  }, [vendorModules, eventType])

  // Categories derived from actual modules (real) or from catalog (mock)
  const categories = useMemo(() => {
    if (vendorModules && vendorModules.length > 0) {
      const seen = new Set<string>()
      const cats: { value: string; label: string }[] = []
      for (const m of allModules) {
        if (!seen.has(m.category)) {
          seen.add(m.category)
          cats.push({ value: m.category, label: m.categoryLabel })
        }
      }
      return cats
    }
    return quoteServiceModules[eventType]
  }, [vendorModules, allModules, eventType])

  // Base packages: from real data (isBaseIncluded) or fallback MOCK
  const basePackages = useMemo((): BasePackage[] => {
    if (vendorModules && vendorModules.length > 0) {
      const derived = buildBasePackageFromVendorData(vendorModules, guestCount)
      return derived ? [derived] : []
    }
    return MOCK_BASE_PACKAGES[eventType]
  }, [vendorModules, guestCount, eventType])

  const builder = useQuoteBuilder(guestCount)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [sheetOpen, setSheetOpen] = useState(false)
  const { basePackage, setBasePackage, pruneSelectedModules } = builder
  const hasQuoteSelection = builder.selectedModules.length > 0 || Boolean(builder.basePackage)

  // Automatically select the first package by default to provide a high-end concierge presets
  useEffect(() => {
    if (!builder.basePackage && basePackages.length > 0) {
      builder.setBasePackage(basePackages[0])
    }
  }, [basePackages, builder])

  const selectionValidationMessage = useMemo(() => {
    if (hasQuoteSelection) return null
    return isWedding
      ? '견적을 요청하려면 1개 이상의 구성 항목을 선택해 주세요.'
      : '상담을 진행하려면 1개 이상의 준비 항목을 선택해 주세요.'
  }, [hasQuoteSelection, isWedding])

  useEffect(() => {
    if (!basePackage) return
    const refreshed = basePackages.find((pkg) => pkg.id === basePackage.id)
    if (refreshed && refreshed.price !== basePackage.price) {
      setBasePackage(refreshed)
    }
  }, [basePackage, basePackages, setBasePackage])

  const filtered = activeCategory === 'all'
    ? allModules
    : allModules.filter((m) => m.category === activeCategory)

  // Compute what modules are implicitly included in the active base package
  const baseIncludedModules = useMemo(() => {
    if (!basePackage) return []
    return allModules.filter((m) => basePackage.includedModuleKeys.includes(m.key))
  }, [basePackage, allModules])

  const baseIncludedKeys = useMemo(
    () => new Set(basePackage?.includedModuleKeys ?? []),
    [basePackage]
  )

  const adjustableModules = useMemo(
    () => filtered.filter((module) => !baseIncludedKeys.has(module.key)),
    [baseIncludedKeys, filtered]
  )

  useEffect(() => {
    if (baseIncludedKeys.size === 0) return
    pruneSelectedModules((module) => baseIncludedKeys.has(module.key))
  }, [baseIncludedKeys, pruneSelectedModules])

  const handleRequestQuote = () => {
    if (!hasQuoteSelection) return
    onRequestQuote?.(builder.selectedModules, builder.basePackage)
  }

  return (
    <div className="relative space-y-6">
      {/* ── 1. Concierge Package Proposal Board (지배적이고 우아한 단일 패키지 구성안 노출) ── */}
      {basePackages.length > 0 && (
        <div className="space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5e2da] pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#2c3455]">
              {isWedding ? 'yeON 엄선 웨딩 권장 패키지' : 'yeON 정립 정중 의전 상담 패키지'}
            </h3>
            <span className="text-[10px] text-muted-foreground/60 leading-normal">
              {isWedding 
                ? '번거로운 구성 조립 없이, 검증된 세트로 아름답고 확실하게 준비합니다.' 
                : '갑작스러운 슬픔 속에서, 경건하고 품격 있게 배웅을 보좌할 필수 구성 절차안입니다.'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {basePackages.map((pkg) => {
              const active = builder.basePackage?.id === pkg.id
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => builder.setBasePackage(active ? null : pkg)}
                  className="rounded-xl border p-4 text-left transition-all duration-150 hover:bg-[#faf9f5]/30 group relative overflow-hidden animate-fade-in"
                  style={{
                    borderColor: active ? config.primary : '#ebdccf/40',
                    backgroundColor: active ? config.surface : 'white',
                  }}
                >
                  {active && (
                    <div 
                      className="absolute right-0 top-0 rounded-bl-lg px-2 py-0.5 text-[8px] font-bold text-white whitespace-nowrap"
                      style={{ backgroundColor: config.primary }}
                    >
                      {isWedding ? '기본 선택됨' : '상담 기준'}
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2 pr-4">
                    <p className="text-xs font-bold text-[#2c3455] break-keep group-hover:text-foreground">
                      {pkg.name}
                    </p>
                  </div>
                  <p className="mt-1.5 text-[10px] text-[#8c8275] leading-relaxed break-keep">{pkg.description}</p>
                  <p className="mt-3.5 text-xs font-extrabold font-mono" style={{ color: config.primary }}>
                    {pkg.price.toLocaleString('ko-KR')}원~
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 2. Included Spec Board (현재 구성안에 무엇이 꼼꼼하게 다 포함되어 있는지 요약) ── */}
      {basePackage && baseIncludedModules.length > 0 && (
        <div className="rounded-2xl border border-dashed border-[#e5e2da] p-5 bg-[#faf9f5]/30 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={13} style={{ color: config.primary }} />
            <h4 className="text-xs font-bold text-[#2c3455]">
              {basePackage.name} 포함 품목 상세 스펙 리포트
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {baseIncludedModules.map((m) => (
              <div 
                key={m.key} 
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e2da] bg-white px-3 py-1.5 text-[11px] text-[#2c3455] font-medium whitespace-nowrap"
              >
                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: config.primary }} />
                <span>{m.name}</span>
                <span className="text-[9px] text-[#8c8275]/50">({m.categoryLabel})</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/60 leading-normal">
            {isWedding 
              ? '위 항목이 권장 구성에 포함되어 제공됩니다. 세부 항목 조정을 원하시면 하단 개별 조정을 펼치세요.' 
              : '장례 절차에 필요한 필수 의전 품목이 모두 사전 매핑되었습니다.'}
          </p>
        </div>
      )}

      {/* ── 3. Progressive Disclosure: Optional Customization (세부 항목 개별 조절) ── */}
      <div className="border-t border-[#ebdccf]/40 pt-5">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-[#2c3455] flex items-center gap-1">
              <span>{isWedding ? "웨딩 세부 품목 개별 조정" : "장례 준비 항목 개별 조정"}</span>
              <span className="text-[9px] font-normal text-muted-foreground/50">(선택 사항)</span>
            </h4>
            <p className="text-[10px] text-muted-foreground/60 leading-normal break-keep">
              {isWedding 
                ? "제안된 구성안 외에 사진 촬영, 신부 드레스 등 추가적인 옵션이나 수량 변경을 원하시는 경우에만 펼쳐주세요."
                : "제안된 의례 품목 외에 부고장, 제단꽃 유형 등 특수한 세부 조정을 원하시는 경우에만 펼쳐주세요."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCustomizer(!showCustomizer)}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#e5e2da] bg-white hover:bg-[#faf9f5]/50 text-xs font-semibold transition-all duration-150`}
            style={{ color: config.primary }}
          >
            <span>{showCustomizer ? "개별 조정 접기" : "개별 조정 펼치기"}</span>
            <span className="text-[9px]">{showCustomizer ? "▲" : "▼"}</span>
          </button>
        </div>

        {showCustomizer && (
          <div className="mt-5 space-y-4 animate-fade-in">
            {/* Category Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1.5 border-b border-[#e5e2da] scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className="shrink-0 rounded-lg px-3 py-1 text-[10px] font-bold transition-all duration-150 whitespace-nowrap"
                style={{
                  backgroundColor: activeCategory === 'all' ? config.primary : '#faf9f5',
                  color: activeCategory === 'all' ? 'white' : '#2c3455',
                  border: `1px solid ${activeCategory === 'all' ? config.primary : '#e5e2da'}`
                }}
              >
                전체 보기
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setActiveCategory(cat.value)}
                  className="shrink-0 rounded-lg px-3 py-1 text-[10px] font-bold transition-all duration-150 whitespace-nowrap"
                  style={{
                    backgroundColor: activeCategory === cat.value ? config.primary : '#faf9f5',
                    color: activeCategory === cat.value ? 'white' : '#2c3455',
                    border: `1px solid ${activeCategory === cat.value ? config.primary : '#e5e2da'}`
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Module Row List */}
            <div className="flex-1">
              {allModules.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground/60">등록된 서비스 모듈이 없습니다.</p>
              ) : (
                <motion.div layout className="flex flex-col border border-[#ebdccf]/40 bg-white rounded-xl p-3 divide-y divide-[#f2ece4]/40">
                  <AnimatePresence>
                    {adjustableModules.map((m) => (
                      <ModuleRow
                        key={m.key}
                        module={m}
                        isSelected={builder.isSelected(m.key)}
                        onToggle={() => builder.toggleModule(m)}
                        theme={theme}
                        guestCount={guestCount}
                      />
                    ))}
                  </AnimatePresence>
                  {adjustableModules.length === 0 && (
                    <div className="px-3 py-8 text-center text-xs leading-relaxed text-muted-foreground/70">
                      기본 패키지에 포함된 항목은 위 포함 품목에서 확인됩니다.
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Desktop: 2-col layout */}
      <div className="flex flex-col lg:flex-row gap-6 border-t border-[#e5e2da] pt-5">
        <div className="flex-1">
          <div className="rounded-xl border border-dashed border-[#e5e2da] p-5 bg-white space-y-3">
            <h4 className="text-xs font-bold text-[#2c3455]">
              {isWedding ? "의례 대행 플래닝 안전 보증" : "차분하고 격조 높은 장례 안전 서약"}
            </h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed break-keep">
              {isWedding 
                ? "yeON은 심사 기준을 거친 검증된 의전/웨딩 파트너와만 소통하여 격식 있고 무결한 서비스를 안심하고 제안받습니다. 견적 전송 단계에서는 파트너사에 어떠한 비용도 발생하지 않으며 안전하게 상담이 가능합니다."
                : "yeON은 경황 없는 유족 분들의 아픔을 보좌하기 위해 허례허식을 배제하고 국가 표준 의전 사양에 부합하는 정직한 파트너사들과만 협력하여 차분한 추모에만 전념하실 수 있도록 안전 서약을 운영합니다."}
            </p>
          </div>
        </div>

        {/* Desktop Summary Panel */}
        <div className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-4 rounded-2xl border border-[#e5e2da] p-5 bg-white shadow-sm">
            <SummaryPanel
              builder={builder}
              theme={theme}
              guestCount={guestCount}
              isSubmitting={isSubmitting}
              onRequestQuote={handleRequestQuote}
              validationMessage={selectionValidationMessage}
            />
          </div>
        </div>
      </div>

      {/* Mobile Bottom Bar */}
      <div className="h-24 lg:hidden" />
      <MobileBottomBar
        builder={builder}
        theme={theme}
        onOpen={() => setSheetOpen(true)}
        isSubmitting={isSubmitting}
        onRequestQuote={handleRequestQuote}
        validationMessage={selectionValidationMessage}
      />

      {/* Mobile Bottom Sheet */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-white p-6 lg:hidden"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{ maxHeight: '80vh', overflowY: 'auto' }}
            >
              <div className="mb-4 flex items-center justify-between border-b border-[#f2ece4] pb-2">
                <span className="text-xs font-bold text-[#2c3455] uppercase tracking-wider">의례 구성안 요약</span>
                <button type="button" onClick={() => setSheetOpen(false)}>
                  <X size={18} className="text-[#8c8275]" />
                </button>
              </div>
              <SummaryPanel
                builder={builder}
                theme={theme}
                guestCount={guestCount}
                isSubmitting={isSubmitting}
                onRequestQuote={() => { setSheetOpen(false); handleRequestQuote() }}
                validationMessage={selectionValidationMessage}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

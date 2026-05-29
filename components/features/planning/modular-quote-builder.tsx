'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, X, ShoppingBag } from 'lucide-react'
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

// ─── Module Tile ──────────────────────────────────────────────────────────────

function ModuleTile({
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
    ? `${module.price.toLocaleString('ko-KR')}원/명`
    : `${displayPrice.toLocaleString('ko-KR')}원`

  return (
    <motion.button
      layout
      type="button"
      onClick={onToggle}
      className="relative flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-all duration-150"
      style={{
        borderColor: isSelected ? config.primary : '#e5e2da',
        backgroundColor: isSelected ? config.surface : 'white',
      }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-xs font-semibold leading-tight" style={{ color: isSelected ? config.primaryDark : '#2c3455' }}>
          {module.name}
        </span>
        <div
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-150"
          style={{
            borderColor: isSelected ? config.primary : '#e5e2da',
            backgroundColor: isSelected ? config.primary : 'white',
          }}
        >
          {isSelected && <Check size={9} color="white" strokeWidth={3} />}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/60">{module.categoryLabel}</span>
        <span className="text-[10px] font-bold" style={{ color: isSelected ? config.primary : '#8c8275' }}>
          {priceLabel}
        </span>
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 pb-2 border-b border-[#f2ece4]">
        <ShoppingBag size={14} style={{ color: config.primary }} />
        <span className="text-xs font-bold uppercase tracking-wider text-[#2c3455]">의례 구성안 요약</span>
      </div>

      {basePackage && (
        <div className="rounded-xl p-3" style={{ backgroundColor: config.muted }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#2c3455]">{basePackage.name}</span>
            <span className="text-xs font-bold" style={{ color: config.primary }}>
              {basePackage.price.toLocaleString('ko-KR')}원
            </span>
          </div>
          <p className="mt-1 text-[10px] text-[#8c8275] leading-relaxed">{basePackage.description}</p>
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto">
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
                <div className="flex items-center justify-between py-1 border-b border-[#f2ece4]/40">
                  <button
                    type="button"
                    onClick={() => builder.toggleModule(m)}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-red-500 font-semibold"
                  >
                    <X size={11} />
                    {m.name}
                  </button>
                  <span className="text-[11px] font-bold text-[#2c3455]">
                    {price.toLocaleString('ko-KR')}원
                  </span>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {selectedModules.length === 0 && !basePackage && (
          <p className="py-6 text-center text-xs text-muted-foreground/50 font-normal">선택하신 서비스 항목이 없습니다.</p>
        )}
      </div>

      {validationMessage && (
        <p className="rounded-xl border border-amber-200 bg-amber-50/50 px-3.5 py-2.5 text-[10px] font-semibold text-amber-800 leading-normal" role="status">
          {validationMessage}
        </p>
      )}

      <div className="border-t border-[#f2ece4] pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold text-muted-foreground">예상 제안 합계액</span>
          <div className="text-lg font-bold text-[#c4977a]">
            <PriceCountUp value={totalPrice} />
          </div>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground/60 leading-normal">상세 조율 결과에 따라 금액이 유연하게 다듬어집니다.</p>
      </div>

      <button
        type="button"
        disabled={isSubmitting || (selectedModules.length === 0 && !basePackage)}
        onClick={onRequestQuote}
        className="w-full rounded-xl py-2.5 text-xs font-bold text-white transition-all duration-150 hover:opacity-95 disabled:opacity-40"
        style={{ backgroundColor: config.primary }}
      >
        {isSubmitting ? '전송 중...' : '이 구성으로 제안 요청하기'}
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

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#e5e2da] bg-white p-4 shadow-md lg:hidden">
      {validationMessage && (
        <p className="mb-2 rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2 text-[10px] font-semibold text-amber-800" role="status">
          {validationMessage}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onOpen} className="flex items-center gap-2">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full text-white text-[10px] font-bold"
            style={{ backgroundColor: config.primary }}
          >
            {count}
          </div>
          <div className="text-left">
            <p className="text-[10px] text-[#8c8275]">선택한 서비스</p>
            <p className="text-sm font-bold" style={{ color: config.primary }}>
              <PriceCountUp value={builder.totalPrice} />
            </p>
          </div>
          <ChevronDown size={12} className="text-[#8c8275]" />
        </button>
        <button
          type="button"
          disabled={isSubmitting || count === 0}
          onClick={onRequestQuote}
          className="rounded-xl px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
          style={{ backgroundColor: config.primary }}
        >
          {isSubmitting ? '전송 중...' : '제안 요청'}
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
  const { basePackage, setBasePackage } = builder
  const hasQuoteSelection = builder.selectedModules.length > 0 || Boolean(builder.basePackage)
  const selectionValidationMessage = hasQuoteSelection
    ? null
    : '제안을 보내려면 1개 이상의 서비스 옵션을 활성화해 주세요.'

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

  const handleRequestQuote = () => {
    if (!hasQuoteSelection) return
    onRequestQuote?.(builder.selectedModules, builder.basePackage)
  }

  return (
    <div className="relative space-y-6">
      {/* Base Packages */}
      {basePackages.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[#2c3455]">
            {theme === 'wedding' ? '권장 베이스 패키지 구성 (추천)' : '기본 권장 의전 구성'}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {basePackages.map((pkg) => {
              const active = builder.basePackage?.id === pkg.id
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => builder.setBasePackage(active ? null : pkg)}
                  className="rounded-xl border p-4 text-left transition-all duration-150"
                  style={{
                    borderColor: active ? config.primary : '#e5e2da',
                    backgroundColor: active ? config.surface : 'white',
                  }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs font-bold text-[#2c3455]">
                      {pkg.name}
                    </p>
                    {active && <Check size={12} style={{ color: config.primary }} />}
                  </div>
                  <p className="mt-1 text-[10px] text-[#8c8275] leading-normal">{pkg.description}</p>
                  <p className="mt-3 text-xs font-extrabold" style={{ color: config.primary }}>
                    {pkg.price.toLocaleString('ko-KR')}원~
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className="shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all duration-150"
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
            className="shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all duration-150"
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

      {selectionValidationMessage && (
        <p className="rounded-xl border border-amber-200 bg-amber-50/50 px-3.5 py-2.5 text-[10px] font-semibold text-amber-800" role="status">
          {selectionValidationMessage}
        </p>
      )}

      {/* Desktop: 2-col layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Module Grid */}
        <div className="flex-1">
          {allModules.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground/60">등록된 서비스 모듈이 없습니다.</p>
          ) : (
            <motion.div layout className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <AnimatePresence>
                {filtered.map((m) => (
                  <ModuleTile
                    key={m.key}
                    module={m}
                    isSelected={builder.isSelected(m.key)}
                    onToggle={() => builder.toggleModule(m)}
                    theme={theme}
                    guestCount={guestCount}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        {/* Desktop Summary Panel */}
        <div className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-4 rounded-xl border border-[#e5e2da] p-4 bg-white">
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

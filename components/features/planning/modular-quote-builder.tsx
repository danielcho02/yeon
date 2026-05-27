'use client'

import { useMemo, useState } from 'react'
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
      className="relative flex flex-col gap-2 rounded-xl border p-3 text-left transition-all"
      style={{
        borderColor: isSelected ? config.primary : '#e5e7eb',
        backgroundColor: isSelected ? config.surface : 'white',
      }}
      whileTap={{ scale: 0.97 }}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-sm font-medium leading-tight" style={{ color: isSelected ? config.primaryDark : '#111827' }}>
          {module.name}
        </span>
        <div
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all"
          style={{
            borderColor: isSelected ? config.primary : '#d1d5db',
            backgroundColor: isSelected ? config.primary : 'white',
          }}
        >
          {isSelected && <Check size={11} color="white" strokeWidth={3} />}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{module.categoryLabel}</span>
        <span className="text-xs font-semibold" style={{ color: isSelected ? config.primary : '#6b7280' }}>
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
  onRequestQuote,
}: {
  builder: ReturnType<typeof useQuoteBuilder>
  theme: EventTheme
  guestCount: number
  onRequestQuote?: () => void
}) {
  const config = getThemeConfig(theme)
  const { selectedModules, basePackage, totalPrice } = builder

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <ShoppingBag size={16} style={{ color: config.primary }} />
        <span className="text-sm font-semibold" style={{ color: config.primaryDark }}>견적 요약</span>
      </div>

      {basePackage && (
        <div className="rounded-xl p-3" style={{ backgroundColor: config.muted }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: config.primaryDark }}>{basePackage.name}</span>
            <span className="text-xs font-semibold" style={{ color: config.primary }}>
              {basePackage.price.toLocaleString('ko-KR')}원
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">{basePackage.description}</p>
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
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-between py-1">
                  <button
                    type="button"
                    onClick={() => builder.toggleModule(m)}
                    className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-red-500"
                  >
                    <X size={12} />
                    {m.name}
                  </button>
                  <span className="text-xs font-medium text-gray-700">
                    {price.toLocaleString('ko-KR')}원
                  </span>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        {selectedModules.length === 0 && !basePackage && (
          <p className="py-4 text-center text-xs text-gray-400">서비스를 선택하면 여기에 표시됩니다</p>
        )}
      </div>

      <div className="border-t border-gray-100 pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-gray-600">예상 총액</span>
          <div className="text-xl font-bold" style={{ color: config.primary }}>
            <PriceCountUp value={totalPrice} />
          </div>
        </div>
        <p className="mt-0.5 text-xs text-gray-400">실제 견적은 업체 확인 후 달라질 수 있습니다</p>
      </div>

      <button
        type="button"
        disabled={selectedModules.length === 0 && !basePackage}
        onClick={onRequestQuote}
        className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: config.primary }}
      >
        견적 요청하기
      </button>
    </div>
  )
}

// ─── Mobile Bottom Bar ────────────────────────────────────────────────────────

function MobileBottomBar({
  builder,
  theme,
  onOpen,
  onRequestQuote,
}: {
  builder: ReturnType<typeof useQuoteBuilder>
  theme: EventTheme
  onOpen: () => void
  onRequestQuote?: () => void
}) {
  const config = getThemeConfig(theme)
  const count = builder.selectedModules.length + (builder.basePackage ? 1 : 0)

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-100 bg-white p-4 shadow-lg lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onOpen} className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-white text-xs font-bold"
            style={{ backgroundColor: config.primary }}
          >
            {count}
          </div>
          <div className="text-left">
            <p className="text-xs text-gray-500">선택한 서비스</p>
            <p className="text-base font-bold" style={{ color: config.primary }}>
              <PriceCountUp value={builder.totalPrice} />
            </p>
          </div>
          <ChevronDown size={14} className="text-gray-400" />
        </button>
        <button
          type="button"
          disabled={count === 0}
          onClick={onRequestQuote}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: config.primary }}
        >
          견적 요청
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
  onRequestQuote?: (modules: QuoteModule[], base: BasePackage | null) => void
}

export function ModularQuoteBuilder({
  theme,
  guestCount = 100,
  vendorModules,
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
      const derived = buildBasePackageFromVendorData(vendorModules)
      return derived ? [derived] : []
    }
    return MOCK_BASE_PACKAGES[eventType]
  }, [vendorModules, eventType])

  const builder = useQuoteBuilder(guestCount)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [sheetOpen, setSheetOpen] = useState(false)

  const filtered = activeCategory === 'all'
    ? allModules
    : allModules.filter((m) => m.category === activeCategory)

  const handleRequestQuote = () => {
    onRequestQuote?.(builder.selectedModules, builder.basePackage)
  }

  return (
    <div className="relative">
      {/* Base Packages */}
      {basePackages.length > 0 && (
        <div className="mb-6">
          <p className="mb-3 text-sm font-semibold text-gray-700">베이스 패키지 (선택)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {basePackages.map((pkg) => {
              const active = builder.basePackage?.id === pkg.id
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => builder.setBasePackage(active ? null : pkg)}
                  className="rounded-xl border p-4 text-left transition-all"
                  style={{
                    borderColor: active ? config.primary : '#e5e7eb',
                    backgroundColor: active ? config.surface : 'white',
                  }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-sm font-semibold" style={{ color: active ? config.primaryDark : '#111827' }}>
                      {pkg.name}
                    </p>
                    {active && <Check size={14} style={{ color: config.primary }} />}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{pkg.description}</p>
                  <p className="mt-2 text-sm font-bold" style={{ color: config.primary }}>
                    {pkg.price.toLocaleString('ko-KR')}원~
                  </p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className="shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all"
          style={{
            backgroundColor: activeCategory === 'all' ? config.primary : '#f3f4f6',
            color: activeCategory === 'all' ? 'white' : '#374151',
          }}
        >
          전체
        </button>
        {categories.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => setActiveCategory(cat.value)}
            className="shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all"
            style={{
              backgroundColor: activeCategory === cat.value ? config.primary : '#f3f4f6',
              color: activeCategory === cat.value ? 'white' : '#374151',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Desktop: 2-col layout */}
      <div className="flex gap-6">
        {/* Module Grid */}
        <div className="flex-1">
          {allModules.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">등록된 서비스 모듈이 없습니다.</p>
          ) : (
            <motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
          <div className="sticky top-4 rounded-2xl border border-gray-100 p-4 shadow-sm">
            <SummaryPanel builder={builder} theme={theme} guestCount={guestCount} onRequestQuote={handleRequestQuote} />
          </div>
        </div>
      </div>

      {/* Mobile Bottom Bar */}
      <div className="h-24 lg:hidden" />
      <MobileBottomBar builder={builder} theme={theme} onOpen={() => setSheetOpen(true)} onRequestQuote={handleRequestQuote} />

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
              <div className="mb-4 flex items-center justify-between">
                <span className="font-semibold">견적 요약</span>
                <button type="button" onClick={() => setSheetOpen(false)}>
                  <X size={20} className="text-gray-400" />
                </button>
              </div>
              <SummaryPanel
                builder={builder}
                theme={theme}
                guestCount={guestCount}
                onRequestQuote={() => { setSheetOpen(false); handleRequestQuote() }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

'use client'

import { useState, useCallback, useMemo } from 'react'
import type { ModuleCategory, VendorServiceModuleData } from '@/types/vendor-module'
import type { BasePackage as ApiBasePackage } from '@/types/quote'

// UI-extended module type (superset of the API QuoteModule shape)
export interface QuoteModule {
  key: string            // catalog key or DB id (React key + isSelected lookup)
  id?: string            // VendorServiceModule.id — required for createQuoteRequest
  name: string
  category: string
  categoryLabel: string
  price: number
  pricingType: 'FLAT' | 'PER_GUEST'
}

// UI-extended base package (compatible with ApiBasePackage + UI-only fields)
export interface BasePackage extends ApiBasePackage {
  id: string
  includedModuleKeys: string[]
}

interface UseQuoteBuilderReturn {
  selectedModules: QuoteModule[]
  basePackage: BasePackage | null
  totalPrice: number
  toggleModule: (module: QuoteModule) => void
  setBasePackage: (pkg: BasePackage | null) => void
  isSelected: (key: string) => boolean
  reset: () => void
}

export function useQuoteBuilder(guestCount = 100): UseQuoteBuilderReturn {
  const [selectedModules, setSelectedModules] = useState<QuoteModule[]>([])
  const [basePackage, setBasePackageState] = useState<BasePackage | null>(null)

  const toggleModule = useCallback((module: QuoteModule) => {
    setSelectedModules((prev) => {
      const exists = prev.find((m) => m.key === module.key)
      return exists ? prev.filter((m) => m.key !== module.key) : [...prev, module]
    })
  }, [])

  const setBasePackage = useCallback((pkg: BasePackage | null) => {
    setBasePackageState(pkg)
  }, [])

  const isSelected = useCallback(
    (key: string) => selectedModules.some((m) => m.key === key),
    [selectedModules]
  )

  const totalPrice = useMemo(() => {
    const base = basePackage?.price ?? 0
    const extra = selectedModules.reduce((sum, m) => {
      const price = m.pricingType === 'PER_GUEST' ? m.price * guestCount : m.price
      return sum + price
    }, 0)
    return base + extra
  }, [basePackage, selectedModules, guestCount])

  const reset = useCallback(() => {
    setSelectedModules([])
    setBasePackageState(null)
  }, [])

  return { selectedModules, basePackage, totalPrice, toggleModule, setBasePackage, isSelected, reset }
}

// Helper: build QuoteModule[] from VendorServiceModuleData (real DB records)
export const MODULE_CATEGORY_LABELS: Record<string, string> = {
  VENUE: '예식장·홀',
  PHOTO: '사진·영상',
  DRESS: '드레스',
  MAKEUP: '메이크업',
  DECORATION: '장식',
  CATERING: '식음료',
  INVITATION: '초대장',
  FUNERAL_HALL: '장례식장',
  WREATH: '제단꽃',
  TRANSPORT: '운구',
  CEREMONY: '추모식',
  MEAL: '식음료',
  OBITUARY: '부고',
}

export function buildModulesFromVendorData(modules: VendorServiceModuleData[]): QuoteModule[] {
  return modules
    .filter((m) => m.isActive)
    .map((m) => ({
      key: m.id,
      id: m.id,
      name: m.name,
      category: m.category as string,
      categoryLabel: MODULE_CATEGORY_LABELS[m.category as string] ?? m.category,
      price: m.price,
      pricingType: 'FLAT' as const,
    }))
}

export function buildBasePackageFromVendorData(modules: VendorServiceModuleData[]): BasePackage | null {
  const baseModules = modules.filter((m) => m.isBaseIncluded && m.isActive)
  if (baseModules.length === 0) return null
  const price = baseModules.reduce((sum, m) => sum + m.price, 0)
  return {
    id: 'vendor-base',
    name: '기본 패키지',
    description: baseModules.map((m) => m.name).join(' + '),
    price,
    includedModuleKeys: baseModules.map((m) => m.id),
  }
}

// Suppress unused-import warning — these types are re-exported for downstream use
export type { ModuleCategory, VendorServiceModuleData }

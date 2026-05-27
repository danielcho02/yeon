'use client'

import { useState } from 'react'
import { useForm, type FieldValues, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { SwipeTransition, ProgressBar } from '@/components/ui/motion'
import { type EventTheme, getThemeConfig } from '@/hooks/use-theme'
import { quoteServiceModules } from '@/lib/step3.shared'

// ─── Schemas ────────────────────────────────────────────────────────────────

const weddingSchemas = [
  z.object({ eventDate: z.string().min(1, '날짜를 선택해주세요') }),
  z.object({ region: z.string().min(1, '지역을 선택해주세요'), district: z.string().min(1, '구/군을 선택해주세요') }),
  z.object({ guestCount: z.coerce.number().min(10, '최소 10명').max(2000, '최대 2000명') }),
  z.object({ budgetMin: z.coerce.number().min(0), budgetMax: z.coerce.number().min(0) }),
  z.object({ services: z.array(z.string()).min(1, '최소 1개의 서비스를 선택해주세요') }),
]

const funeralSchemas = [
  z.object({ eventDate: z.string().min(1, '날짜를 선택해주세요'), duration: z.enum(['3', '5']) }),
  z.object({ region: z.string().min(1, '지역을 선택해주세요') }),
  z.object({ guestCount: z.coerce.number().min(1, '최소 1명').max(5000, '최대 5000명') }),
  z.object({ services: z.array(z.string()).min(1, '최소 1개의 서비스를 선택해주세요') }),
]

// ─── Types ───────────────────────────────────────────────────────────────────

export type WeddingWizardData = {
  eventDate: string
  region: string
  district: string
  guestCount: number
  budgetMin: number
  budgetMax: number
  services: string[]
}

export type FuneralWizardData = {
  eventDate: string
  duration: '3' | '5'
  region: string
  guestCount: number
  services: string[]
}

export type WizardData = WeddingWizardData | FuneralWizardData

// ─── Step Sub-components ─────────────────────────────────────────────────────

type StepProps = { form: UseFormReturn<FieldValues>; theme: EventTheme }

const REGIONS = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']
const DISTRICTS: Record<string, string[]> = {
  서울: ['강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'],
  경기: ['수원시', '성남시', '고양시', '용인시', '부천시', '안산시', '안양시', '남양주시', '화성시', '평택시', '의정부시', '시흥시', '파주시', '광명시', '김포시', '군포시', '광주시', '이천시', '양주시', '오산시'],
  인천: ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'],
  부산: ['중구', '서구', '동구', '영도구', '부산진구', '동래구', '남구', '북구', '해운대구', '사하구', '금정구', '강서구', '연제구', '수영구', '사상구', '기장군'],
}

function DateStep({ form, theme }: StepProps) {
  const config = getThemeConfig(theme)
  const isFuneral = theme === 'funeral'
  const duration = form.watch('duration') as string

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {isFuneral ? '발인 날짜' : '예식 날짜'}
        </label>
        <input
          type="date"
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2"
          min={new Date().toISOString().split('T')[0]}
          {...form.register('eventDate')}
        />
        {form.formState.errors.eventDate && (
          <p className="mt-1.5 text-xs text-red-500">{form.formState.errors.eventDate.message as string}</p>
        )}
      </div>
      {isFuneral && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">장례 기간</label>
          <div className="flex gap-3">
            {(['3', '5'] as const).map((d) => (
              <label
                key={d}
                className="flex flex-1 cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors"
                style={{
                  borderColor: duration === d ? config.primary : '#e5e7eb',
                  backgroundColor: duration === d ? config.surface : 'white',
                }}
              >
                <input type="radio" value={d} className="sr-only" {...form.register('duration')} />
                <span className="text-sm font-medium">{d}일장</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LocationStep({ form, theme }: StepProps) {
  const config = getThemeConfig(theme)
  const selectedRegion = form.watch('region') as string
  const districts = DISTRICTS[selectedRegion] ?? []

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">지역</label>
        <select className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none" {...form.register('region')}>
          <option value="">지역 선택</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {form.formState.errors.region && (
          <p className="mt-1.5 text-xs text-red-500">{form.formState.errors.region.message as string}</p>
        )}
      </div>
      {theme === 'wedding' && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">구/군</label>
          <select className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none" disabled={!selectedRegion} {...form.register('district')}>
            <option value="">구/군 선택</option>
            {districts.map((d) => <option key={d} value={d}>{d}</option>)}
            {selectedRegion && districts.length === 0 && <option value={selectedRegion}>{selectedRegion} 전체</option>}
          </select>
          {form.formState.errors.district && (
            <p className="mt-1.5 text-xs text-red-500">{form.formState.errors.district.message as string}</p>
          )}
        </div>
      )}
      <p className="text-xs" style={{ color: config.primaryLight }}>
        행사 장소가 결정되지 않은 경우 희망 지역을 선택하세요
      </p>
    </div>
  )
}

function GuestCountStep({ form, theme }: StepProps) {
  const config = getThemeConfig(theme)
  const count = Number(form.watch('guestCount')) || 100

  return (
    <div className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">예상 하객 수</label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={theme === 'wedding' ? 10 : 1}
            max={theme === 'wedding' ? 500 : 1000}
            step={10}
            className="flex-1"
            style={{ accentColor: config.primary }}
            value={count}
            onChange={(e) => form.setValue('guestCount', Number(e.target.value))}
          />
          <input
            type="number"
            className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-center text-sm focus:outline-none"
            {...form.register('guestCount')}
          />
        </div>
        <p className="mt-2 text-sm font-medium" style={{ color: config.primary }}>
          약 <strong>{count}명</strong>
        </p>
        {form.formState.errors.guestCount && (
          <p className="mt-1.5 text-xs text-red-500">{form.formState.errors.guestCount.message as string}</p>
        )}
      </div>
    </div>
  )
}

function BudgetStep({ form, theme }: StepProps) {
  const config = getThemeConfig(theme)
  const min = Number(form.watch('budgetMin')) || 0
  const max = Number(form.watch('budgetMax')) || 5000

  const PRESETS = [
    { label: '3천만원 이하', min: 0, max: 3000 },
    { label: '3천~5천만원', min: 3000, max: 5000 },
    { label: '5천~1억', min: 5000, max: 10000 },
    { label: '1억 이상', min: 10000, max: 30000 },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => { form.setValue('budgetMin', p.min); form.setValue('budgetMax', p.max) }}
            className="rounded-xl border px-4 py-3 text-sm transition-all"
            style={{
              borderColor: min === p.min && max === p.max ? config.primary : '#e5e7eb',
              backgroundColor: min === p.min && max === p.max ? config.surface : 'white',
              color: min === p.min && max === p.max ? config.primary : '#374151',
              fontWeight: min === p.min && max === p.max ? 600 : 400,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-gray-500">최소 (만원)</label>
          <input type="number" step={100} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none" {...form.register('budgetMin')} />
        </div>
        <div className="flex items-end pb-2 text-gray-400">~</div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-gray-500">최대 (만원)</label>
          <input type="number" step={100} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none" {...form.register('budgetMax')} />
        </div>
      </div>
      <p className="text-sm" style={{ color: config.primary }}>
        예산 범위: <strong>{min.toLocaleString('ko-KR')}만원 ~ {max.toLocaleString('ko-KR')}만원</strong>
      </p>
    </div>
  )
}

function ServicesStep({ form, theme }: StepProps) {
  const config = getThemeConfig(theme)
  const eventType = theme === 'wedding' ? 'WEDDING' : 'FUNERAL'
  const modules = quoteServiceModules[eventType]
  const selected = (form.watch('services') as string[]) || []

  const toggle = (value: string) => {
    const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]
    form.setValue('services', next, { shouldValidate: true })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">필요한 서비스를 모두 선택하세요 (복수 선택 가능)</p>
      <div className="grid grid-cols-2 gap-3">
        {modules.map((m) => {
          const active = selected.includes(m.value)
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => toggle(m.value)}
              className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm transition-all"
              style={{
                borderColor: active ? config.primary : '#e5e7eb',
                backgroundColor: active ? config.surface : 'white',
                color: active ? config.primary : '#374151',
              }}
            >
              <div
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                style={{ borderColor: active ? config.primary : '#d1d5db', backgroundColor: active ? config.primary : 'white' }}
              >
                {active && <Check size={10} color="white" strokeWidth={3} />}
              </div>
              {m.label}
            </button>
          )
        })}
      </div>
      {form.formState.errors.services && (
        <p className="text-xs text-red-500">{form.formState.errors.services.message as string}</p>
      )}
    </div>
  )
}

function ReviewStep({ data, theme }: { data: Partial<WizardData>; theme: EventTheme }) {
  const config = getThemeConfig(theme)
  const wd = data as Partial<WeddingWizardData>
  const fd = data as Partial<FuneralWizardData>

  const items: { label: string; value: string }[] = [
    { label: '날짜', value: wd.eventDate ?? '-' },
    ...(theme === 'funeral' ? [{ label: '기간', value: `${fd.duration ?? 3}일장` }] : []),
    {
      label: '지역',
      value: theme === 'wedding' ? `${wd.region ?? ''} ${wd.district ?? ''}`.trim() : fd.region ?? '-',
    },
    { label: '하객 수', value: `약 ${data.guestCount ?? 0}명` },
    ...(theme === 'wedding' ? [{ label: '예산', value: `${wd.budgetMin?.toLocaleString()}만원 ~ ${wd.budgetMax?.toLocaleString()}만원` }] : []),
    { label: '서비스', value: (wd.services ?? []).join(', ') || '-' },
  ]

  return (
    <div className="space-y-3">
      <p className="mb-4 text-sm text-gray-500">입력 내용을 확인해주세요</p>
      {items.map((item) => (
        <div key={item.label} className="flex items-start gap-3 rounded-xl border border-gray-100 px-4 py-3">
          <span className="w-20 shrink-0 text-xs text-gray-500">{item.label}</span>
          <span className="text-sm font-medium" style={{ color: config.primaryDark }}>{item.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

interface MultiStepWizardProps {
  theme: EventTheme
  onComplete: (data: WizardData) => void
  onCancel?: () => void
}

export function MultiStepWizard({ theme, onComplete, onCancel }: MultiStepWizardProps) {
  const config = getThemeConfig(theme)
  const isWedding = theme === 'wedding'
  const schemas = isWedding ? weddingSchemas : funeralSchemas

  const STEP_LABELS = isWedding
    ? ['날짜', '지역', '하객 수', '예산', '서비스']
    : ['날짜/기간', '지역', '하객 수', '서비스']

  const totalSteps = schemas.length + 1
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [collectedData, setCollectedData] = useState<Partial<WizardData>>({})

  const form = useForm<FieldValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: step < schemas.length ? (zodResolver(schemas[step]) as any) : undefined,
    defaultValues: {
      guestCount: 100,
      budgetMin: 0,
      budgetMax: 5000,
      services: [],
      duration: '3',
      ...collectedData,
    },
  })

  const isReview = step === schemas.length

  const handleNext = form.handleSubmit((values) => {
    const merged = { ...collectedData, ...values }
    setCollectedData(merged)
    form.clearErrors()
    setDirection('forward')
    setStep((s) => s + 1)
  })

  const handleBack = () => {
    form.clearErrors()
    setDirection('back')
    setStep((s) => Math.max(0, s - 1))
  }

  const renderStep = () => {
    if (isReview) return <ReviewStep data={collectedData} theme={theme} />
    if (isWedding) {
      if (step === 0) return <DateStep form={form} theme={theme} />
      if (step === 1) return <LocationStep form={form} theme={theme} />
      if (step === 2) return <GuestCountStep form={form} theme={theme} />
      if (step === 3) return <BudgetStep form={form} theme={theme} />
      if (step === 4) return <ServicesStep form={form} theme={theme} />
    } else {
      if (step === 0) return <DateStep form={form} theme={theme} />
      if (step === 1) return <LocationStep form={form} theme={theme} />
      if (step === 2) return <GuestCountStep form={form} theme={theme} />
      if (step === 3) return <ServicesStep form={form} theme={theme} />
    }
    return null
  }

  return (
    <div className="flex flex-col" style={{ minHeight: 480 }}>
      <div className="mb-6">
        <ProgressBar current={step + 1} total={totalSteps} theme={theme} />
        <p className="mt-3 text-lg font-semibold" style={{ color: config.primaryDark }}>
          {isReview ? '최종 확인' : STEP_LABELS[step]}
        </p>
      </div>

      <div className="flex-1">
        <SwipeTransition stepKey={step} direction={direction} theme={theme}>
          <form onSubmit={handleNext}>{renderStep()}</form>
        </SwipeTransition>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={step === 0 ? onCancel : handleBack}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-5 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
        >
          <ChevronLeft size={16} />
          {step === 0 ? '취소' : '이전'}
        </button>

        {isReview ? (
          <button
            type="button"
            onClick={() => onComplete(collectedData as WizardData)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: config.primary }}
          >
            <Check size={16} />
            {isWedding ? '플랜 시작하기' : '장례 플랜 시작'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: config.primary }}
          >
            {step === schemas.length - 1 ? '검토하기' : '다음'}
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

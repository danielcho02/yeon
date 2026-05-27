'use client'

import { useTransition } from 'react'
import { MultiStepWizard, type WizardData, type WeddingWizardData, type FuneralWizardData } from '@/components/features/planning/multi-step-wizard'
import { type EventTheme } from '@/hooks/use-theme'
import { createPlan } from '../actions'

interface PlanWizardClientProps {
  eventType: 'WEDDING' | 'FUNERAL'
}

export function PlanWizardClient({ eventType }: PlanWizardClientProps) {
  const [isPending, startTransition] = useTransition()
  const theme: EventTheme = eventType === 'WEDDING' ? 'wedding' : 'funeral'

  const handleComplete = (data: WizardData) => {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('type', eventType)

      if (eventType === 'WEDDING') {
        const wd = data as WeddingWizardData
        const label = theme === 'wedding' ? '웨딩 준비' : '장례 준비'
        const year = wd.eventDate ? new Date(wd.eventDate).getFullYear() : new Date().getFullYear()
        fd.set('title', `${year}년 ${label}`)
        fd.set('scheduledAt', wd.eventDate ?? '')
        fd.set('region', `${wd.region}${wd.district ? ' ' + wd.district : ''}`)
        fd.set('guestTarget', String(wd.guestCount ?? 0))
        // wizard budget is in 만원 units → convert to won
        fd.set('budget', String((wd.budgetMax ?? 0) * 10000))
        fd.set('description', (wd.services ?? []).join(', '))
      } else {
        const fd2 = fd
        const fu = data as FuneralWizardData
        fd2.set('title', `장례 준비 (${fu.duration ?? 3}일장)`)
        fd2.set('scheduledAt', fu.eventDate ?? '')
        fd2.set('region', fu.region ?? '')
        fd2.set('guestTarget', String(fu.guestCount ?? 0))
        fd2.set('description', (fu.services ?? []).join(', '))
      }

      await createPlan(fd)
    })
  }

  return (
    <div className="rounded-3xl border border-border/60 bg-white/90 p-6 shadow-sm sm:p-8">
      {isPending ? (
        <div className="flex min-h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: theme === 'wedding' ? '#f43f5e' : '#475569' }}
            />
            <p className="text-sm text-muted-foreground">플랜을 생성하는 중...</p>
          </div>
        </div>
      ) : (
        <MultiStepWizard
          theme={theme}
          onComplete={handleComplete}
          onCancel={() => window.history.back()}
        />
      )}
    </div>
  )
}

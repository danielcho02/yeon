'use client'

import { motion } from 'framer-motion'
import { type EventTheme, getThemeConfig } from '@/hooks/use-theme'

interface ProgressBarProps {
  current: number
  total: number
  theme?: EventTheme
  showLabel?: boolean
  className?: string
}

export function ProgressBar({
  current,
  total,
  theme = 'wedding',
  showLabel = true,
  className = '',
}: ProgressBarProps) {
  const config = getThemeConfig(theme)
  const pct = Math.min((current / total) * 100, 100)

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500">
          <span style={{ color: config.primary }} className="font-medium">
            {current} / {total} 단계
          </span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: config.primary }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{
            type: config.transitionType,
            stiffness: config.transitionType === 'spring' ? 200 : undefined,
            damping: config.transitionType === 'spring' ? 22 : undefined,
            duration: config.transitionType === 'tween' ? config.transitionDuration : undefined,
          }}
        />
      </div>
    </div>
  )
}

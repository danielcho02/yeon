'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { type EventTheme, getThemeConfig } from '@/hooks/use-theme'

interface SwipeTransitionProps {
  children: React.ReactNode
  stepKey: string | number
  direction?: 'forward' | 'back'
  theme?: EventTheme
}

export function SwipeTransition({
  children,
  stepKey,
  direction = 'forward',
  theme = 'wedding',
}: SwipeTransitionProps) {
  const { transitionDuration, transitionType } = getThemeConfig(theme)
  const x = direction === 'forward' ? 40 : -40

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stepKey}
        initial={{ opacity: 0, x }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -x }}
        transition={{
          type: transitionType,
          duration: transitionType === 'tween' ? transitionDuration : undefined,
          stiffness: transitionType === 'spring' ? 280 : undefined,
          damping: transitionType === 'spring' ? 22 : undefined,
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

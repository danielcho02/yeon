'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'
import { type EventTheme, getThemeConfig } from '@/hooks/use-theme'

interface FadeInProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode
  delay?: number
  yOffset?: number
  theme?: EventTheme
  once?: boolean
}

export function FadeIn({
  children,
  delay = 0,
  yOffset = 16,
  theme = 'wedding',
  once = true,
  ...props
}: FadeInProps) {
  const { transitionDuration, transitionType } = getThemeConfig(theme)

  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once }}
      transition={{
        type: transitionType,
        duration: transitionType === 'tween' ? transitionDuration : undefined,
        stiffness: transitionType === 'spring' ? 260 : undefined,
        damping: transitionType === 'spring' ? 20 : undefined,
        delay,
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

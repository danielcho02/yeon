'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'
import { type EventTheme, getThemeConfig } from '@/hooks/use-theme'

interface SlideUpProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode
  delay?: number
  theme?: EventTheme
  once?: boolean
}

export function SlideUp({
  children,
  delay = 0,
  theme = 'wedding',
  once = true,
  ...props
}: SlideUpProps) {
  const { transitionDuration, transitionType } = getThemeConfig(theme)

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once }}
      transition={{
        type: transitionType,
        duration: transitionType === 'tween' ? transitionDuration : undefined,
        stiffness: transitionType === 'spring' ? 300 : undefined,
        damping: transitionType === 'spring' ? 24 : undefined,
        delay,
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

interface StaggerListProps {
  children: React.ReactNode[]
  theme?: EventTheme
  staggerDelay?: number
  className?: string
}

export function StaggerList({
  children,
  theme = 'wedding',
  staggerDelay = 0.08,
  className,
}: StaggerListProps) {
  return (
    <div className={className}>
      {children.map((child, i) => (
        <SlideUp key={i} theme={theme} delay={i * staggerDelay}>
          {child}
        </SlideUp>
      ))}
    </div>
  )
}

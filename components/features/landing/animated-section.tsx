'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'
import { FadeIn, SlideUp, StaggerList } from '@/components/ui/motion'

interface AnimatedSectionHeaderProps {
  eyebrow?: string
  title: string
  center?: boolean
  className?: string
}

export function AnimatedSectionHeader({ eyebrow, title, center, className = '' }: AnimatedSectionHeaderProps) {
  return (
    <div className={`mb-12 ${center ? 'text-center' : ''} ${className}`}>
      {eyebrow && (
        <FadeIn yOffset={8} delay={0}>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground/55">{eyebrow}</p>
        </FadeIn>
      )}
      <FadeIn yOffset={12} delay={0.06}>
        <h2 className="font-[var(--font-display)] text-3xl font-bold text-foreground sm:text-4xl">{title}</h2>
      </FadeIn>
    </div>
  )
}

interface AnimatedCardGridProps {
  children: React.ReactNode[]
  className?: string
}

export function AnimatedCardGrid({ children, className = 'grid gap-5 sm:grid-cols-3' }: AnimatedCardGridProps) {
  return (
    <StaggerList className={className} staggerDelay={0.1}>
      {children}
    </StaggerList>
  )
}

interface AnimatedStepGridProps {
  children: React.ReactNode[]
}

export function AnimatedStepGrid({ children }: AnimatedStepGridProps) {
  return (
    <div className="relative grid gap-10 sm:grid-cols-3 sm:gap-8">
      <div className="pointer-events-none absolute left-1/2 top-11 hidden h-px w-[calc(66.6%-6rem)] -translate-x-1/2 border-t-2 border-dashed border-border/50 sm:block" />
      {children.map((child, i) => (
        <SlideUp key={i} delay={i * 0.12}>
          {child}
        </SlideUp>
      ))}
    </div>
  )
}

interface ParallaxSectionProps {
  children: React.ReactNode
  className?: string
  speed?: number
}

export function ParallaxSection({ children, className = '', speed = 0.15 }: ParallaxSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['0%', `${speed * 100}%`])

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.div style={{ y }}>
        {children}
      </motion.div>
    </div>
  )
}

interface AnimatedHeroContentProps {
  children: React.ReactNode
}

export function AnimatedHeroContent({ children }: AnimatedHeroContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.4 }}
    >
      {children}
    </motion.div>
  )
}
